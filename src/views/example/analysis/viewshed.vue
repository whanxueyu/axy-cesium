<template>
  <div class="viewshed-panel">
    <div class="panel-title">viewShed - 视椎体可视域</div>

    <div class="action-row">
      <el-button
        size="small"
        :type="pickMode === 'observer' ? 'warning' : 'primary'"
        @click="startPickObserver"
      >
        图上选点
      </el-button>
      <el-button
        size="small"
        :disabled="!canAnalyze"
        :type="pickMode === 'direction' ? 'warning' : 'primary'"
        @click="startPickDirection"
      >
        图上选方向
      </el-button>
      <el-button size="small" :disabled="!canAnalyze" @click="locateObserver">
        定位
      </el-button>
    </div>

    <div class="param-item">
      <span class="param-label">水平张角：</span>
      <el-slider
        v-model="horizontalFov"
        :min="10"
        :max="160"
        :step="1"
        :format-tooltip="formatDegreeTooltip"
      />
      <span class="param-value">{{ horizontalFov }}°</span>
    </div>

    <div class="param-item">
      <span class="param-label">垂直张角：</span>
      <el-slider
        v-model="verticalFov"
        :min="5"
        :max="90"
        :step="1"
        :format-tooltip="formatDegreeTooltip"
      />
      <span class="param-value">{{ verticalFov }}°</span>
    </div>

    <div class="param-item">
      <span class="param-label">投射距离：</span>
      <el-slider
        v-model="radius"
        :min="200"
        :max="5000"
        :step="50"
        :format-tooltip="formatMeterTooltip"
      />
      <span class="param-value">{{ radius }} m</span>
    </div>

    <div class="param-item">
      <span class="param-label">四周方向：</span>
      <el-slider
        v-model="heading"
        :min="0"
        :max="360"
        :step="1"
        :format-tooltip="formatDegreeTooltip"
      />
      <span class="param-value">{{ heading }}°</span>
    </div>

    <div class="param-item">
      <span class="param-label">俯仰角度：</span>
      <el-slider
        v-model="pitch"
        :min="-60"
        :max="25"
        :step="1"
        :format-tooltip="formatDegreeTooltip"
      />
      <span class="param-value">{{ pitch }}°</span>
    </div>

    <div class="param-item">
      <span class="param-label">相机高度：</span>
      <el-input-number v-model="observerHeight" :min="1" :max="1000" :step="5" size="small" />
      <span class="param-unit">m</span>
    </div>

    <div class="param-item">
      <span class="param-label">采样间距：</span>
      <el-input-number v-model="sampleDistanceStep" :min="10" :max="200" :step="10" size="small" />
      <span class="param-unit">m</span>
    </div>

    <div class="option-row">
      <el-checkbox v-model="showFrustum">视椎体</el-checkbox>
      <el-checkbox v-model="showRays">视线</el-checkbox>
      <span class="opacity-label">透明度</span>
      <el-slider
        v-model="resultOpacity"
        :min="10"
        :max="85"
        :step="5"
        :format-tooltip="formatPercentTooltip"
      />
    </div>

    <div class="legend-row">
      <span><i class="legend-color visible"></i>可视</span>
      <span><i class="legend-color hidden"></i>遮挡</span>
      <span><i class="legend-color cone"></i>视椎体</span>
    </div>

    <div class="action-row bottom-actions">
      <el-button type="primary" size="small" :loading="computing" :disabled="!canAnalyze" @click="startAnalysis">
        计算
      </el-button>
      <el-button type="danger" size="small" @click="handleClear">清除</el-button>
    </div>

    <div class="result-box" v-if="computing">
      <div class="result-item">
        <span class="value">分析中...</span>
      </div>
    </div>
    <div class="result-box" v-else-if="analysisResult">
      <div class="result-item">
        <span class="label">可视面积：</span>
        <span class="value ok">{{ formatArea(analysisResult.visibleArea) }}</span>
      </div>
      <div class="result-item">
        <span class="label">遮挡面积：</span>
        <span class="value bad">{{ formatArea(analysisResult.hiddenArea) }}</span>
      </div>
      <div class="result-item">
        <span class="label">覆盖率：</span>
        <span class="value">{{ analysisResult.visibleRate.toFixed(1) }}%</span>
      </div>
      <div class="result-item">
        <span class="label">射线数量：</span>
        <span class="value">{{ analysisResult.rayCount }} 条</span>
      </div>
    </div>
    <div class="result-box" v-else-if="hint">
      <div class="result-item">
        <span class="value">{{ hint }}</span>
      </div>
    </div>
  </div>

  <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import * as turf from "@turf/turf";
import Map from "@/components/cesium/map.vue";
import { ArticleViewshedRenderer } from "@/modules/cesium/viewshedRenderer";
import {
  createArticleSensorFrame,
  isDirectionInArticleSensor,
  type ArticleSensorFrame,
} from "@/modules/cesium/viewshedGeometry";
import {
  sampleTerrainHeights,
  type TerrainSample,
} from "@/modules/cesium/analysisUtils";

type PickMode = "none" | "observer" | "direction";

interface LocalFrame {
  east: Cesium.Cartesian3;
  north: Cesium.Cartesian3;
  up: Cesium.Cartesian3;
}

interface ObserverInfo {
  lng: number;
  lat: number;
  surfaceHeight: number;
  eyeHeight: number;
  surface: Cesium.Cartesian3;
  eye: Cesium.Cartesian3;
  frame: LocalFrame;
}

interface ViewshedPoint extends TerrainSample {
  angleIndex: number;
  distanceIndex: number;
  azimuth: number;
  rawAzimuth: number;
  distance: number;
  visible: boolean;
  inVertical: boolean;
  elevation: number;
}

interface ViewshedRayRow {
  angle: number;
  points: ViewshedPoint[];
}

interface ViewshedCell {
  positions: TerrainSample[];
  visible: boolean;
  area: number;
}

interface ViewshedStats {
  visibleArea: number;
  hiddenArea: number;
  visibleRate: number;
  rayCount: number;
  sampleCount: number;
  blockedRayCount: number;
}

const horizontalFov = ref(80);
const verticalFov = ref(45);
const radius = ref(1800);
const heading = ref(45);
const pitch = ref(0);
const observerHeight = ref(2);
const sampleDistanceStep = ref(50);
const sampleAngleStep = ref(2);
const resultOpacity = ref(45);
const showFrustum = ref(true);
const showRays = ref(true);
const pickMode = ref<PickMode>("observer");
const computing = ref(false);
const hint = ref("图上选点后预览视椎体，点击计算查看覆盖率");
const analysisResult = ref<ViewshedStats | null>(null);
const observerPosition = ref<Cesium.Cartesian3 | null>(null);
const canAnalyze = computed(() => observerPosition.value !== null);

let viewer: Cesium.Viewer | null = null;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
let observerEntity: Cesium.Entity | null = null;
let observerLabelEntity: Cesium.Entity | null = null;
let heightLineEntity: Cesium.Entity | null = null;
let viewshedRenderer: ArticleViewshedRenderer | null = null;
let debounceTimer: number | undefined;
let analysisToken = 0;
let pickToken = 0;
let previousGlobeShadowMode: Cesium.ShadowMode | undefined;
let globeShadowModeCaptured = false;

const VIEW_HEIGHT_OFFSET = 2;
const HORIZON_EPSILON = Cesium.Math.toRadians(0.02);

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.pickTranslucentDepth = true;
  previousGlobeShadowMode = viewer.scene.globe.shadows;
  globeShadowModeCaptured = true;
  viewer.scene.globe.shadows = Cesium.ShadowMode.ENABLED;
  bindMapActions();
  resetCamera();
};

const resetCamera = () => {
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(103.82, 36.02, 3000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-40),
      roll: 0.0,
    },
    duration: 1,
  });
};

const startPickObserver = () => {
  pickMode.value = "observer";
  hint.value = "请在地图上选择相机位置";
};

const startPickDirection = () => {
  if (!observerPosition.value) {
    hint.value = "请先选择相机位置";
    pickMode.value = "observer";
    return;
  }
  pickMode.value = "direction";
  hint.value = "请在地图上选择视线方向";
};

const locateObserver = () => {
  const info = getObserverInfo();
  if (!viewer || !info) return;

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(info.lng, info.lat, Math.max(info.eyeHeight + 900, 1200)),
    orientation: {
      heading: Cesium.Math.toRadians(heading.value),
      pitch: Cesium.Math.toRadians(-42),
      roll: 0,
    },
    duration: 0.8,
  });
};

const handleClear = () => {
  analysisToken++;
  pickToken++;
  clearObserverEntities();
  clearArticleViewshed();
  observerPosition.value = null;
  analysisResult.value = null;
  computing.value = false;
  hint.value = "图上选点后预览视椎体，点击计算查看覆盖率";
  pickMode.value = "observer";
};

const bindMapActions = () => {
  if (!viewer) return;

  mouseHandler?.destroy();
  mouseHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  mouseHandler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      handleMapClick(event.position);
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );
  mouseHandler.setInputAction(() => {
    pickMode.value = "none";
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
};

const handleMapClick = async (position: Cesium.Cartesian2) => {
  if (!viewer || pickMode.value === "none") return;

  const currentViewer = viewer;
  const activePickMode = pickMode.value;
  const currentPickToken = ++pickToken;
  const picked = pickMapPosition(currentViewer, position);
  if (!picked) {
    hint.value = "未拾取到地形，请稍后重试";
    return;
  }

  if (activePickMode === "direction") {
    heading.value = Math.round(getBearingFromObserver(picked.position));
    pickMode.value = "none";
    refreshScene();
    scheduleAnalysis();
    return;
  }

  analysisToken++;
  computing.value = false;
  pickMode.value = "none";
  observerPosition.value = picked.position;
  analysisResult.value = null;
  hint.value = "观察点已选择，点击“计算”生成可视域结果";
  renderObserver();
  refreshScene();

  if (!picked.fromEllipsoidFallback) return;

  hint.value = "观察点已选择，正在校正地形高程...";
  const corrected = await resolveTerrainPosition(currentViewer, picked.position);
  if (!corrected || currentPickToken !== pickToken) return;

  observerPosition.value = corrected;
  hint.value = "观察点已选择，点击“计算”生成可视域结果";
  renderObserver();
  refreshScene();
};

interface PickedMapPosition {
  position: Cesium.Cartesian3;
  fromEllipsoidFallback: boolean;
}

const pickMapPosition = (
  currentViewer: Cesium.Viewer,
  windowPosition: Cesium.Cartesian2,
): PickedMapPosition | undefined => {
  const scene = currentViewer.scene;
  const pickedObject = scene.pick(windowPosition);

  if (
    Cesium.defined(pickedObject) &&
    pickedObject instanceof Cesium.Cesium3DTileFeature
  ) {
    const pickedModelPosition = scene.pickPosition(windowPosition);
    if (pickedModelPosition) {
      return { position: pickedModelPosition, fromEllipsoidFallback: false };
    }
  }

  const ray = currentViewer.camera.getPickRay(windowPosition);
  if (ray) {
    const terrainPosition = scene.globe.pick(ray, scene);
    if (terrainPosition) {
      return { position: terrainPosition, fromEllipsoidFallback: false };
    }
  }

  if (scene.pickPositionSupported) {
    const pickedPosition = scene.pickPosition(windowPosition);
    if (pickedPosition) {
      return { position: pickedPosition, fromEllipsoidFallback: false };
    }
  }

  const ellipsoidPosition = currentViewer.camera.pickEllipsoid(
    windowPosition,
    currentViewer.scene.globe.ellipsoid,
  );
  if (!ellipsoidPosition) return undefined;

  return {
    position: ellipsoidPosition,
    fromEllipsoidFallback: true,
  };
};

const resolveTerrainPosition = async (
  currentViewer: Cesium.Viewer,
  position: Cesium.Cartesian3,
): Promise<Cesium.Cartesian3 | undefined> => {
  const cartographic = Cesium.Cartographic.fromCartesian(position);
  const lng = Cesium.Math.toDegrees(cartographic.longitude);
  const lat = Cesium.Math.toDegrees(cartographic.latitude);
  const loadedHeight = currentViewer.scene.globe.getHeight(cartographic);

  if (loadedHeight !== undefined) {
    return Cesium.Cartesian3.fromDegrees(lng, lat, loadedHeight);
  }

  const sampled = await sampleTerrainHeights(currentViewer, [{ lng, lat }]);
  const height = sampled[0]?.height;
  return height === undefined
    ? position
    : Cesium.Cartesian3.fromDegrees(lng, lat, height);
};

const startAnalysis = async () => {
  if (!viewer) return;

  const info = getObserverInfo();
  if (!info) {
    hint.value = "请先选择相机位置";
    pickMode.value = "observer";
    return;
  }

  const token = ++analysisToken;
  computing.value = true;
  analysisResult.value = null;
  hint.value = "";
  renderObserver();
  renderViewshedPreview();

  try {
    const rows = await buildViewshedRows(info);
    if (token !== analysisToken) return;

    const { cells, stats } = buildViewshedCells(rows);
    if (!cells.length) {
      analysisResult.value = null;
      hint.value = "当前俯仰角和视场未落到地表";
      return;
    }

    analysisResult.value = stats;
  } catch (error) {
    console.error("视椎体可视域分析失败:", error);
    hint.value = "可视域分析失败，请重试";
  } finally {
    if (token === analysisToken) {
      computing.value = false;
    }
  }
};

const scheduleAnalysis = () => {
  if (!observerPosition.value) return;
  analysisToken++;
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined;
    analysisResult.value = null;
    renderObserver();
    renderViewshedPreview();
    hint.value = "参数已更新，点击“计算”刷新可视域结果";
  }, 120);
};

const refreshScene = () => {
  renderObserver();
  renderViewshedPreview();
};

const renderObserver = () => {
  if (!viewer) return;
  const info = getObserverInfo();
  if (!info) return;

  clearObserverEntities();

  observerEntity = viewer.entities.add({
    position: info.eye,
    point: {
      pixelSize: 10,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });

  observerLabelEntity = viewer.entities.add({
    position: info.eye,
    label: {
      text: "相机",
      font: "bold 14pt monospace",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });

  heightLineEntity = viewer.entities.add({
    polyline: {
      positions: [info.surface, info.eye],
      width: 2,
      material: Cesium.Color.CYAN.withAlpha(0.65),
      clampToGround: false,
    },
  });
};

const renderViewshedPreview = () => {
  if (!viewer) return;
  const info = getObserverInfo();
  if (!info) {
    clearArticleViewshed();
    return;
  }

  const viewPosition = getCurrentViewPosition(info);
  const sensorFrame = getCurrentSensorFrame(info);
  viewshedRenderer ??= new ArticleViewshedRenderer(viewer);
  viewshedRenderer.update({
    observer: info.eye,
    viewPosition,
    sensorFrame,
    radius: radius.value,
    horizontalFov: horizontalFov.value,
    verticalFov: verticalFov.value,
    showFrustum: showFrustum.value,
    showLines: showRays.value,
    sensorAlpha: resultOpacity.value / 100,
  });
};

const buildViewshedRows = async (info: ObserverInfo): Promise<ViewshedRayRow[]> => {
  const angleRows = buildAngleRows();
  const distanceRows = buildDistanceRows();
  const descriptors: Array<{
    angleIndex: number;
    distanceIndex: number;
    azimuth: number;
    rawAzimuth: number;
    distance: number;
    lng: number;
    lat: number;
  }> = [];

  angleRows.forEach((rawAzimuth, angleIndex) => {
    distanceRows.forEach((distance, distanceIndex) => {
      if (distanceIndex === 0) return;
      const position = turf.destination([info.lng, info.lat], distance, normalizeAngle(rawAzimuth), {
        units: "meters",
      });
      descriptors.push({
        angleIndex,
        distanceIndex,
        azimuth: normalizeAngle(rawAzimuth),
        rawAzimuth,
        distance,
        lng: position.geometry.coordinates[0],
        lat: position.geometry.coordinates[1],
      });
    });
  });

  const sampled = await sampleTerrainHeights(
    viewer as Cesium.Viewer,
    descriptors.map((point) => ({ lng: point.lng, lat: point.lat })),
  );

  const rows: ViewshedRayRow[] = angleRows.map((angle, angleIndex) => ({
    angle,
    points: [
      {
        lng: info.lng,
        lat: info.lat,
        height: info.surfaceHeight,
        angleIndex,
        distanceIndex: 0,
        azimuth: normalizeAngle(angle),
        rawAzimuth: angle,
        distance: 0,
        visible: true,
        inVertical: true,
        elevation: 0,
      },
    ],
  }));

  sampled.forEach((sample, index) => {
    const descriptor = descriptors[index];
    if (!descriptor) return;
    rows[descriptor.angleIndex].points[descriptor.distanceIndex] = {
      ...sample,
      angleIndex: descriptor.angleIndex,
      distanceIndex: descriptor.distanceIndex,
      azimuth: descriptor.azimuth,
      rawAzimuth: descriptor.rawAzimuth,
      distance: descriptor.distance,
      visible: false,
      inVertical: false,
      elevation: 0,
    };
  });

  const sensorFrame = getCurrentSensorFrame(info);

  rows.forEach((row) => {
    let maxElevation = Number.NEGATIVE_INFINITY;
    row.points.forEach((point) => {
      if (point.distance === 0) return;

      const elevation = Math.atan2(point.height + VIEW_HEIGHT_OFFSET - info.eyeHeight, point.distance);
      point.elevation = Cesium.Math.toDegrees(elevation);
      const target = Cesium.Cartesian3.fromDegrees(
        point.lng,
        point.lat,
        point.height + VIEW_HEIGHT_OFFSET,
      );
      const sightDirection = Cesium.Cartesian3.normalize(
        Cesium.Cartesian3.subtract(target, info.eye, new Cesium.Cartesian3()),
        new Cesium.Cartesian3(),
      );

      point.inVertical = isDirectionInArticleSensor(
        sightDirection,
        sensorFrame,
        horizontalFov.value,
        verticalFov.value,
      );
      point.visible =
        point.inVertical && elevation >= maxElevation - HORIZON_EPSILON;
      if (point.inVertical) {
        maxElevation = Math.max(maxElevation, elevation);
      }
    });
  });

  return rows;
};

const buildViewshedCells = (rows: ViewshedRayRow[]) => {
  const cells: ViewshedCell[] = [];
  let visibleArea = 0;
  let hiddenArea = 0;
  let sampleCount = 0;
  let blockedRayCount = 0;

  rows.forEach((row) => {
    const samplesInCone = row.points.filter((point) => point.inVertical && point.distance > 0);
    if (samplesInCone.length) {
      sampleCount += samplesInCone.length;
      if (samplesInCone.some((point) => !point.visible)) {
        blockedRayCount++;
      }
    }
  });

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex++) {
    const leftRow = rows[rowIndex];
    const rightRow = rows[rowIndex + 1];
    const maxDistanceIndex = Math.min(leftRow.points.length, rightRow.points.length) - 1;

    for (let distanceIndex = 1; distanceIndex <= maxDistanceIndex; distanceIndex++) {
      const innerLeft = leftRow.points[distanceIndex - 1];
      const outerLeft = leftRow.points[distanceIndex];
      const outerRight = rightRow.points[distanceIndex];
      const innerRight = rightRow.points[distanceIndex - 1];
      const inVertical = outerLeft.inVertical || outerRight.inVertical || innerLeft.inVertical || innerRight.inVertical;

      if (!inVertical) continue;

      const visible = outerLeft.visible || outerRight.visible;
      const positions =
        distanceIndex === 1
          ? [innerLeft, outerLeft, outerRight]
          : [innerLeft, outerLeft, outerRight, innerRight];
      const area = estimateCellArea(leftRow.angle, rightRow.angle, innerLeft.distance, outerLeft.distance);

      cells.push({
        positions,
        visible,
        area,
      });

      if (visible) {
        visibleArea += area;
      } else {
        hiddenArea += area;
      }
    }
  }

  const totalArea = visibleArea + hiddenArea;
  const stats: ViewshedStats = {
    visibleArea,
    hiddenArea,
    visibleRate: totalArea > 0 ? (visibleArea / totalArea) * 100 : 0,
    rayCount: rows.length,
    sampleCount,
    blockedRayCount,
  };

  return { cells, stats };
};

const buildAngleRows = () => {
  const span = horizontalFov.value;
  const step = Math.max(0.5, sampleAngleStep.value);
  const segmentCount = Math.max(2, Math.ceil(span / step));
  const start = heading.value - span / 2;
  const rows: number[] = [];

  for (let index = 0; index <= segmentCount; index++) {
    rows.push(start + (span * index) / segmentCount);
  }

  return rows;
};

const buildDistanceRows = () => {
  const step = Math.max(10, Math.min(sampleDistanceStep.value, radius.value));
  const count = Math.max(1, Math.ceil(radius.value / step));
  const rows = [0];

  for (let index = 1; index <= count; index++) {
    rows.push(Math.min(index * step, radius.value));
  }

  return rows;
};

const getObserverInfo = (): ObserverInfo | null => {
  if (!observerPosition.value) return null;

  const carto = Cesium.Cartographic.fromCartesian(observerPosition.value);
  const lng = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const surfaceHeight = carto.height;
  const eyeHeight = surfaceHeight + observerHeight.value;
  const surface = Cesium.Cartesian3.fromDegrees(lng, lat, surfaceHeight);
  const eye = Cesium.Cartesian3.fromDegrees(lng, lat, eyeHeight);

  return {
    lng,
    lat,
    surfaceHeight,
    eyeHeight,
    surface,
    eye,
    frame: getLocalFrame(eye),
  };
};

const getLocalFrame = (origin: Cesium.Cartesian3): LocalFrame => {
  const matrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const eastColumn = Cesium.Matrix4.getColumn(matrix, 0, new Cesium.Cartesian4());
  const northColumn = Cesium.Matrix4.getColumn(matrix, 1, new Cesium.Cartesian4());
  const upColumn = Cesium.Matrix4.getColumn(matrix, 2, new Cesium.Cartesian4());

  return {
    east: Cesium.Cartesian3.normalize(new Cesium.Cartesian3(eastColumn.x, eastColumn.y, eastColumn.z), new Cesium.Cartesian3()),
    north: Cesium.Cartesian3.normalize(new Cesium.Cartesian3(northColumn.x, northColumn.y, northColumn.z), new Cesium.Cartesian3()),
    up: Cesium.Cartesian3.normalize(new Cesium.Cartesian3(upColumn.x, upColumn.y, upColumn.z), new Cesium.Cartesian3()),
  };
};

const getBearingFromObserver = (target: Cesium.Cartesian3) => {
  const info = getObserverInfo();
  if (!info) return heading.value;

  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(target, info.surface, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );
  const east = Cesium.Cartesian3.dot(direction, info.frame.east);
  const north = Cesium.Cartesian3.dot(direction, info.frame.north);

  return normalizeAngle(Cesium.Math.toDegrees(Math.atan2(east, north)));
};

const getCurrentViewPosition = (info: ObserverInfo) =>
  pointByAzimuthPitch(info, heading.value, pitch.value, radius.value);

const getCurrentSensorFrame = (info: ObserverInfo): ArticleSensorFrame =>
  createArticleSensorFrame(
    info.eye,
    getCurrentViewPosition(info),
    info.frame.up,
  );

const pointByAzimuthPitch = (
  info: ObserverInfo,
  azimuthDegrees: number,
  pitchDegrees: number,
  distance: number,
) => {
  const direction = directionByAzimuthPitch(info.frame, azimuthDegrees, pitchDegrees);
  const offset = Cesium.Cartesian3.multiplyByScalar(direction, distance, new Cesium.Cartesian3());
  return Cesium.Cartesian3.add(info.eye, offset, new Cesium.Cartesian3());
};

const directionByAzimuthPitch = (
  frame: LocalFrame,
  azimuthDegrees: number,
  pitchDegrees: number,
) => {
  const azimuth = Cesium.Math.toRadians(normalizeAngle(azimuthDegrees));
  const elevation = Cesium.Math.toRadians(pitchDegrees);
  const northPart = Cesium.Cartesian3.multiplyByScalar(frame.north, Math.cos(azimuth), new Cesium.Cartesian3());
  const eastPart = Cesium.Cartesian3.multiplyByScalar(frame.east, Math.sin(azimuth), new Cesium.Cartesian3());
  const horizontal = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.add(northPart, eastPart, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );
  const horizontalPart = Cesium.Cartesian3.multiplyByScalar(horizontal, Math.cos(elevation), new Cesium.Cartesian3());
  const verticalPart = Cesium.Cartesian3.multiplyByScalar(frame.up, Math.sin(elevation), new Cesium.Cartesian3());

  return Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.add(horizontalPart, verticalPart, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  );
};

const estimateCellArea = (
  leftAngle: number,
  rightAngle: number,
  innerDistance: number,
  outerDistance: number,
) => {
  const angle = Math.abs(Cesium.Math.toRadians(rightAngle - leftAngle));
  return (angle * (outerDistance * outerDistance - innerDistance * innerDistance)) / 2;
};

const clearObserverEntities = () => {
  if (!viewer) return;
  [observerEntity, observerLabelEntity, heightLineEntity].forEach((entity) => {
    if (entity) viewer?.entities.remove(entity);
  });
  observerEntity = null;
  observerLabelEntity = null;
  heightLineEntity = null;
};

const clearArticleViewshed = () => {
  viewshedRenderer?.clear();
};

const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;

const formatArea = (area: number) => {
  if (area >= 1000000) {
    return `${(area / 1000000).toFixed(2)} km²`;
  }
  return `${Math.round(area).toLocaleString()} m²`;
};

const formatDegreeTooltip = (value: number) => `${value}°`;
const formatMeterTooltip = (value: number) => `${value} m`;
const formatPercentTooltip = (value: number) => `${value}%`;

watch(
  [observerHeight, horizontalFov, verticalFov, radius, heading, pitch, sampleDistanceStep, sampleAngleStep],
  () => {
    if (!observerPosition.value) return;
    refreshScene();
    scheduleAnalysis();
  },
);

watch(showFrustum, () => {
  renderViewshedPreview();
});

watch(showRays, () => {
  renderViewshedPreview();
});

watch(resultOpacity, () => {
  renderViewshedPreview();
});

onUnmounted(() => {
  analysisToken++;
  pickToken++;
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
  }
  if (mouseHandler) {
    mouseHandler.destroy();
    mouseHandler = null;
  }
  clearObserverEntities();
  clearArticleViewshed();
  viewshedRenderer?.destroy();
  viewshedRenderer = null;
  if (viewer && globeShadowModeCaptured && previousGlobeShadowMode !== undefined) {
    viewer.scene.globe.shadows = previousGlobeShadowMode;
  }
  previousGlobeShadowMode = undefined;
  globeShadowModeCaptured = false;
});
</script>

<style scoped lang="scss">
.viewshed-panel {
  position: absolute;
  z-index: 999;
  left: 10px;
  top: 50px;
  width: 322px;
  padding: 10px;
  color: #fff;
  user-select: none;
  border: 1px solid rgba(168, 184, 210, 0.38);
  border-radius: 6px;
  background: rgba(32, 39, 50, 0.92);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);

  .panel-title {
    display: flex;
    align-items: center;
    height: 24px;
    margin-bottom: 8px;
    color: #edf4ff;
    font-size: 15px;
    font-weight: 600;
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 8px 0;
  }

  .bottom-actions {
    margin-top: 10px;
  }

  .param-item {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) 58px;
    align-items: center;
    column-gap: 7px;
    min-height: 31px;

    .param-label {
      color: #c4cfdd;
      font-size: 13px;
      white-space: nowrap;
    }

    .param-value,
    .param-unit {
      color: #eef5ff;
      font-size: 12px;
      text-align: right;
      white-space: nowrap;
    }
  }

  .option-row {
    display: grid;
    grid-template-columns: 68px 58px 48px minmax(0, 1fr);
    align-items: center;
    column-gap: 4px;
    min-height: 32px;

    .opacity-label {
      color: #c4cfdd;
      font-size: 12px;
      text-align: right;
    }
  }

  .legend-row {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 7px 8px;
    margin-top: 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.22);
    color: #d6e0ed;
    font-size: 12px;

    span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }

    .legend-color {
      width: 14px;
      height: 8px;
      border-radius: 2px;

      &.visible {
        background: rgba(0, 255, 0, 0.65);
      }

      &.hidden {
        background: rgba(255, 0, 0, 0.68);
      }

      &.cone {
        border: 1px solid rgba(255, 255, 255, 0.78);
        background: rgba(0, 255, 255, 0.18);
      }
    }
  }

  .result-box {
    margin-top: 10px;
    padding: 8px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.36);

    .result-item {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 4px 0;
      font-size: 13px;

      .label {
        color: #b8c3d1;
      }

      .value {
        color: #29dfff;
        font-weight: 600;
        text-align: right;

        &.ok {
          color: #00ee7f;
        }

        &.bad {
          color: #ff5d65;
        }
      }
    }
  }

  :deep(.el-slider) {
    --el-slider-main-bg-color: #3186ff;
    --el-slider-runway-bg-color: rgba(222, 231, 244, 0.2);
  }

  :deep(.el-checkbox) {
    height: 24px;
    margin-right: 0;
  }

  :deep(.el-checkbox__label) {
    color: #d9e2ef;
    font-size: 12px;
    padding-left: 5px;
  }

  :deep(.el-input-number--small) {
    width: 100%;
  }

  :deep(.el-button--small) {
    min-width: 58px;
  }
}
</style>
