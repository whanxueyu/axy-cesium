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
        生成
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
        <span class="label">可视占比：</span>
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
import {
  pickPositionOnMap,
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
const verticalFov = ref(38);
const radius = ref(1800);
const heading = ref(55);
const pitch = ref(-12);
const observerHeight = ref(80);
const sampleDistanceStep = ref(50);
const sampleAngleStep = ref(2);
const resultOpacity = ref(45);
const showFrustum = ref(true);
const showRays = ref(true);
const pickMode = ref<PickMode>("observer");
const computing = ref(false);
const hint = ref("图上选点后生成视椎体可视域");
const analysisResult = ref<ViewshedStats | null>(null);
const observerPosition = ref<Cesium.Cartesian3 | null>(null);
const canAnalyze = computed(() => observerPosition.value !== null);

let viewer: Cesium.Viewer | null = null;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
let observerEntity: Cesium.Entity | null = null;
let observerLabelEntity: Cesium.Entity | null = null;
let heightLineEntity: Cesium.Entity | null = null;
let frustumPrimitive: Cesium.Primitive | null = null;
let viewshedPrimitive: Cesium.Primitive | null = null;
let frustumEntities: Cesium.Entity[] = [];
let rayEntities: Cesium.Entity[] = [];
let lastCells: ViewshedCell[] = [];
let lastRayRows: ViewshedRayRow[] = [];
let debounceTimer: number | undefined;
let analysisToken = 0;

const VIEW_HEIGHT_OFFSET = 2;
const HORIZON_EPSILON = Cesium.Math.toRadians(0.02);

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.pickTranslucentDepth = true;
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
  pickMode.value = pickMode.value === "observer" ? "none" : "observer";
  hint.value = pickMode.value === "observer" ? "请在地图上选择相机位置" : "";
};

const startPickDirection = () => {
  if (!observerPosition.value) {
    hint.value = "请先选择相机位置";
    pickMode.value = "observer";
    return;
  }
  pickMode.value = pickMode.value === "direction" ? "none" : "direction";
  hint.value = pickMode.value === "direction" ? "请在地图上选择视线方向" : "";
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
  clearObserverEntities();
  clearFrustumVisuals();
  clearViewshedVisuals();
  observerPosition.value = null;
  lastCells = [];
  lastRayRows = [];
  analysisResult.value = null;
  computing.value = false;
  hint.value = "图上选点后生成视椎体可视域";
  pickMode.value = "observer";
};

const bindMapActions = () => {
  if (!viewer) return;

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

const handleMapClick = (position: Cesium.Cartesian2) => {
  if (!viewer || pickMode.value === "none") return;

  const cartesian = pickPositionOnMap(viewer, position);
  if (!cartesian) return;

  if (pickMode.value === "direction") {
    heading.value = Math.round(getBearingFromObserver(cartesian));
    pickMode.value = "none";
    refreshScene();
    scheduleAnalysis();
    return;
  }

  observerPosition.value = cartesian;
  analysisResult.value = null;
  hint.value = "";
  renderObserver();
  refreshScene();
  startAnalysis();
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
  hint.value = "";
  renderObserver();
  renderFrustum();

  try {
    const rows = await buildViewshedRows(info);
    if (token !== analysisToken) return;

    const { cells, stats } = buildViewshedCells(rows);
    if (!cells.length) {
      clearViewshedVisuals();
      lastCells = [];
      lastRayRows = rows;
      analysisResult.value = null;
      hint.value = "当前俯仰角和视场未落到地表";
      return;
    }

    lastCells = cells;
    lastRayRows = rows;
    analysisResult.value = stats;
    renderViewshedCells();
    renderViewshedRays();
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
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    debounceTimer = undefined;
    startAnalysis();
  }, 250);
};

const refreshScene = () => {
  renderObserver();
  renderFrustum();
  if (lastCells.length) {
    renderViewshedCells();
  }
  if (lastRayRows.length) {
    renderViewshedRays();
  }
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

const renderFrustum = () => {
  if (!viewer) return;
  clearFrustumVisuals();

  if (!showFrustum.value) return;
  const info = getObserverInfo();
  if (!info) return;

  const corners = getFrustumCorners(info);
  frustumPrimitive = createFrustumBody(info.eye, corners);
  if (frustumPrimitive) {
    viewer.scene.primitives.add(frustumPrimitive);
  }

  addFrustumPolyline([info.eye, corners[0]], Cesium.Color.WHITE.withAlpha(0.8), 2);
  addFrustumPolyline([info.eye, corners[1]], Cesium.Color.WHITE.withAlpha(0.8), 2);
  addFrustumPolyline([info.eye, corners[2]], Cesium.Color.WHITE.withAlpha(0.8), 2);
  addFrustumPolyline([info.eye, corners[3]], Cesium.Color.WHITE.withAlpha(0.8), 2);

  const leftAzimuth = heading.value - horizontalFov.value / 2;
  const rightAzimuth = heading.value + horizontalFov.value / 2;
  const bottomPitch = pitch.value - verticalFov.value / 2;
  const topPitch = pitch.value + verticalFov.value / 2;
  const shellColor = Cesium.Color.WHITE.withAlpha(0.72);
  const centerColor = Cesium.Color.LIME.withAlpha(0.72);
  const horizontalShells = [
    bottomPitch,
    pitch.value - verticalFov.value / 4,
    pitch.value,
    pitch.value + verticalFov.value / 4,
    topPitch,
  ];
  const verticalShells = [
    leftAzimuth,
    heading.value - horizontalFov.value / 4,
    heading.value,
    heading.value + horizontalFov.value / 4,
    rightAzimuth,
  ];

  horizontalShells.forEach((shellPitch) => {
    addFrustumPolyline(
      buildHorizontalArc(info, leftAzimuth, rightAzimuth, shellPitch),
      shellPitch === pitch.value ? centerColor : shellColor,
      shellPitch === pitch.value ? 2.5 : 2,
    );
  });

  verticalShells.forEach((shellAzimuth) => {
    addFrustumPolyline(
      buildVerticalArc(info, shellAzimuth, bottomPitch, topPitch),
      shellAzimuth === heading.value ? centerColor : shellColor,
      shellAzimuth === heading.value ? 2.5 : 2,
    );
  });

  const centerEnd = pointByAzimuthPitch(info, heading.value, pitch.value, radius.value);
  addFrustumPolyline([info.eye, centerEnd], Cesium.Color.LIME.withAlpha(0.9), 3, true);
};

const renderViewshedCells = () => {
  if (!viewer) return;
  clearViewshedPrimitive();

  if (!lastCells.length) return;
  const instances = lastCells.map((cell) => {
    const positions = cell.positions.map((point) =>
      Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height + VIEW_HEIGHT_OFFSET),
    );
    return new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(positions),
        perPositionHeight: true,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(getCellColor(cell.visible)),
      },
    });
  });

  viewshedPrimitive = new Cesium.Primitive({
    geometryInstances: instances,
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: true,
    }),
    asynchronous: false,
  });
  viewer.scene.primitives.add(viewshedPrimitive);
};

const renderViewshedRays = () => {
  if (!viewer) return;
  clearRayEntities();

  if (!showRays.value) return;
  const info = getObserverInfo();
  if (!info || !lastRayRows.length) return;

  const stride = Math.max(1, Math.ceil(lastRayRows.length / 36));
  lastRayRows.forEach((row, rowIndex) => {
    if (rowIndex % stride !== 0 && rowIndex !== lastRayRows.length - 1) return;

    const inConePoints = row.points.filter((point) => point.inVertical && point.distance > 0);
    if (!inConePoints.length) return;

    const visiblePoints = inConePoints.filter((point) => point.visible);
    const lastVisible = visiblePoints[visiblePoints.length - 1];
    const lastPoint = inConePoints[inConePoints.length - 1];

    if (lastVisible) {
      addRayPolyline(
        [info.eye, samplePointToCartesian(lastVisible)],
        Cesium.Color.LIME.withAlpha(0.85),
        2,
      );
    }

    if (!lastVisible || lastVisible.distance < lastPoint.distance) {
      addRayPolyline(
        [lastVisible ? samplePointToCartesian(lastVisible) : info.eye, samplePointToCartesian(lastPoint)],
        Cesium.Color.RED.withAlpha(0.82),
        2,
      );
    }
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

  const lowerPitch = Cesium.Math.toRadians(pitch.value - verticalFov.value / 2);
  const upperPitch = Cesium.Math.toRadians(pitch.value + verticalFov.value / 2);

  rows.forEach((row) => {
    let maxElevation = Number.NEGATIVE_INFINITY;
    row.points.forEach((point) => {
      if (point.distance === 0) return;

      const elevation = Math.atan2(point.height + VIEW_HEIGHT_OFFSET - info.eyeHeight, point.distance);
      point.elevation = Cesium.Math.toDegrees(elevation);
      point.inVertical = elevation >= lowerPitch && elevation <= upperPitch;
      point.visible = point.inVertical && elevation >= maxElevation - HORIZON_EPSILON;
      maxElevation = Math.max(maxElevation, elevation);
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

const getFrustumCorners = (info: ObserverInfo) => {
  const leftAzimuth = heading.value - horizontalFov.value / 2;
  const rightAzimuth = heading.value + horizontalFov.value / 2;
  const bottomPitch = pitch.value - verticalFov.value / 2;
  const topPitch = pitch.value + verticalFov.value / 2;

  return [
    pointByAzimuthPitch(info, leftAzimuth, bottomPitch, radius.value),
    pointByAzimuthPitch(info, rightAzimuth, bottomPitch, radius.value),
    pointByAzimuthPitch(info, rightAzimuth, topPitch, radius.value),
    pointByAzimuthPitch(info, leftAzimuth, topPitch, radius.value),
  ];
};

const createFrustumBody = (eye: Cesium.Cartesian3, corners: Cesium.Cartesian3[]) => {
  const positions = new Float64Array([
    eye.x,
    eye.y,
    eye.z,
    corners[0].x,
    corners[0].y,
    corners[0].z,
    corners[1].x,
    corners[1].y,
    corners[1].z,
    corners[2].x,
    corners[2].y,
    corners[2].z,
    corners[3].x,
    corners[3].y,
    corners[3].z,
  ]);

  const attributes = new Cesium.GeometryAttributes();
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: positions,
  });

  return new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.Geometry({
        attributes,
        indices: new Uint16Array([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1, 1, 2, 3, 1, 3, 4]),
        primitiveType: Cesium.PrimitiveType.TRIANGLES,
        boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN.withAlpha(0.14)),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: true,
      closed: false,
      renderState: {
        depthTest: {
          enabled: true,
        },
        depthMask: false,
        blending: Cesium.BlendingState.ALPHA_BLEND,
      },
    }),
    asynchronous: false,
  });
};

const buildHorizontalArc = (
  info: ObserverInfo,
  startAzimuth: number,
  endAzimuth: number,
  elevation: number,
) => {
  const samples = 40;
  const positions: Cesium.Cartesian3[] = [];

  for (let index = 0; index <= samples; index++) {
    const azimuth = startAzimuth + ((endAzimuth - startAzimuth) * index) / samples;
    positions.push(pointByAzimuthPitch(info, azimuth, elevation, radius.value));
  }

  return positions;
};

const buildVerticalArc = (
  info: ObserverInfo,
  azimuth: number,
  startElevation: number,
  endElevation: number,
) => {
  const samples = 28;
  const positions: Cesium.Cartesian3[] = [];

  for (let index = 0; index <= samples; index++) {
    const elevation = startElevation + ((endElevation - startElevation) * index) / samples;
    positions.push(pointByAzimuthPitch(info, azimuth, elevation, radius.value));
  }

  return positions;
};

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

const samplePointToCartesian = (point: TerrainSample) =>
  Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height + VIEW_HEIGHT_OFFSET);

const addFrustumPolyline = (
  positions: Cesium.Cartesian3[],
  color: Cesium.Color,
  width: number,
  glow = false,
) => {
  if (!viewer || positions.length < 2) return;

  const entity = viewer.entities.add({
    polyline: {
      positions,
      width,
      material: glow
        ? new Cesium.PolylineGlowMaterialProperty({
            color,
            glowPower: 0.18,
          })
        : color,
      clampToGround: false,
    },
  });
  frustumEntities.push(entity);
};

const addRayPolyline = (
  positions: Cesium.Cartesian3[],
  color: Cesium.Color,
  width: number,
) => {
  if (!viewer || positions.length < 2) return;

  const entity = viewer.entities.add({
    polyline: {
      positions,
      width,
      material: color,
      clampToGround: false,
    },
  });
  rayEntities.push(entity);
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

const getCellColor = (visible: boolean) => {
  const alpha = resultOpacity.value / 100;
  return visible
    ? Cesium.Color.LIME.withAlpha(alpha)
    : Cesium.Color.RED.withAlpha(Math.min(0.9, alpha + 0.1));
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

const clearFrustumVisuals = () => {
  if (!viewer) return;
  if (frustumPrimitive) {
    viewer.scene.primitives.remove(frustumPrimitive);
    frustumPrimitive = null;
  }
  frustumEntities.forEach((entity) => viewer?.entities.remove(entity));
  frustumEntities = [];
};

const clearViewshedPrimitive = () => {
  if (!viewer) return;
  if (viewshedPrimitive) {
    viewer.scene.primitives.remove(viewshedPrimitive);
    viewshedPrimitive = null;
  }
};

const clearRayEntities = () => {
  if (!viewer) return;
  rayEntities.forEach((entity) => viewer?.entities.remove(entity));
  rayEntities = [];
};

const clearViewshedVisuals = () => {
  clearViewshedPrimitive();
  clearRayEntities();
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
  renderFrustum();
});

watch(showRays, () => {
  renderViewshedRays();
});

watch(resultOpacity, () => {
  if (lastCells.length) {
    renderViewshedCells();
  }
});

onUnmounted(() => {
  analysisToken++;
  if (debounceTimer !== undefined) {
    window.clearTimeout(debounceTimer);
  }
  if (mouseHandler) {
    mouseHandler.destroy();
    mouseHandler = null;
  }
  clearObserverEntities();
  clearFrustumVisuals();
  clearViewshedVisuals();
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
