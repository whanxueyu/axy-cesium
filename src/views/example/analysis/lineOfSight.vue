<template>
  <div class="los-panel">
    <div class="panel-title">
      <el-icon><Aim /></el-icon>
      <span>通视分析</span>
    </div>

    <el-radio-group v-model="analysisMode" size="small" @change="handleModeChange">
      <el-radio-button label="two-point">两点通视</el-radio-button>
      <el-radio-button label="omnidirectional">360°通视</el-radio-button>
    </el-radio-group>

    <div class="panel-hint">
      {{ analysisMode === "two-point" ? "依次选择起点和终点，判断两点之间是否存在遮挡。" : "选择观察点，以观察点的绝对高程向四周发射视线，统计各方向的通视情况。" }}
    </div>

    <div class="action-row">
      <el-button
        size="small"
        :type="pickMode === 'primary' ? 'warning' : 'primary'"
        @click="startPrimaryPick"
      >
        <el-icon><Location /></el-icon>
        {{ analysisMode === "two-point" ? "选择起点" : "选择观察点" }}
      </el-button>
      <el-button
        v-if="analysisMode === 'two-point'"
        size="small"
        :disabled="!startPoint"
        :type="pickMode === 'secondary' ? 'warning' : 'primary'"
        @click="startSecondaryPick"
      >
        <el-icon><LocationInformation /></el-icon>
        选择终点
      </el-button>
    </div>

    <template v-if="analysisMode === 'two-point'">
      <div class="param-item">
        <span class="param-label">起点高度</span>
        <el-input-number v-model="observerHeight" :min="0" :max="1000" :step="5" size="small" />
        <span class="param-unit">m</span>
      </div>
      <div class="param-item">
        <span class="param-label">终点高度</span>
        <el-input-number v-model="targetHeight" :min="0" :max="1000" :step="5" size="small" />
        <span class="param-unit">m</span>
      </div>
    </template>

    <template v-else>
      <div class="param-item">
        <span class="param-label">观察高度</span>
        <el-input-number v-model="observerHeight" :min="1" :max="1000" :step="5" size="small" />
        <span class="param-unit">m</span>
      </div>
      <div class="param-item">
        <span class="param-label">扫描半径</span>
        <el-slider v-model="radius" :min="200" :max="5000" :step="50" :format-tooltip="formatMeterTooltip" />
        <span class="param-value">{{ radius }} m</span>
      </div>
      <div class="param-item">
        <span class="param-label">角度间隔</span>
        <el-slider v-model="angleStep" :min="2" :max="30" :step="1" :format-tooltip="formatDegreeTooltip" />
        <span class="param-value">{{ angleStep }}°</span>
      </div>
    </template>

    <div class="point-summary">
      <div v-if="analysisMode === 'two-point'" class="point-row">
        <span class="point-tag start">A</span>
        <span>{{ formatPoint(startPoint) }}</span>
      </div>
      <div v-if="analysisMode === 'two-point'" class="point-row">
        <span class="point-tag end">B</span>
        <span>{{ formatPoint(endPoint) }}</span>
      </div>
      <div v-else class="point-row">
        <span class="point-tag observer">O</span>
        <span>{{ formatPoint(observerPoint) }}</span>
      </div>
    </div>

    <div class="action-row bottom-actions">
      <el-button type="primary" size="small" :loading="computing" :disabled="!canAnalyze" @click="runAnalysis">
        <el-icon><Aim /></el-icon>
        分析
      </el-button>
      <el-button type="danger" size="small" @click="handleClear">
        <el-icon><Delete /></el-icon>
        清除
      </el-button>
    </div>

    <div v-if="computing" class="result-box">
      <div class="result-message">分析中...</div>
    </div>

    <div v-else-if="analysisMode === 'two-point' && twoPointResult" class="result-box">
      <div class="result-heading" :class="twoPointResult.visible ? 'ok' : 'bad'">
        {{ twoPointResult.visible ? "两点通视，无遮挡" : "两点不通视，存在遮挡" }}
      </div>
      <div class="result-item">
        <span class="label">空间距离</span>
        <span class="value">{{ formatDistance(twoPointResult.distance) }}</span>
      </div>
      <div v-if="!twoPointResult.visible" class="result-item">
        <span class="label">可见距离</span>
        <span class="value ok">{{ formatDistance(twoPointResult.visibleDistance) }}</span>
      </div>
      <div v-if="!twoPointResult.visible" class="result-item">
        <span class="label">遮挡类型</span>
        <span class="value bad">{{ twoPointResult.obstructionType === "model" ? "模型" : "地形" }}</span>
      </div>
      <div v-if="!twoPointResult.visible && twoPointResult.obstruction" class="obstruction-info">
        遮挡点：{{ formatCartesian(twoPointResult.obstruction) }}
      </div>
    </div>

    <div v-else-if="analysisMode === 'omnidirectional' && omniResult" class="result-box">
      <div class="result-heading ok">360°通视分析完成</div>
      <div class="result-item">
        <span class="label">通视方向</span>
        <span class="value ok">{{ omniResult.visibleRayCount }} / {{ omniResult.rayCount }}</span>
      </div>
      <div class="result-item">
        <span class="label">通视率</span>
        <span class="value">{{ omniResult.visibleRate.toFixed(1) }}%</span>
      </div>
      <div class="result-item">
        <span class="label">最大通视距离</span>
        <span class="value">{{ formatDistance(omniResult.maxVisibleDistance) }}</span>
      </div>
      <div class="result-item">
        <span class="label">遮挡方向</span>
        <span class="value bad">{{ omniResult.blockedRayCount }} 条</span>
      </div>
    </div>

    <div v-else class="result-box">
      <div class="result-message">{{ hint }}</div>
    </div>

    <div class="legend-row">
      <span><i class="legend-color visible"></i>可见</span>
      <span><i class="legend-color hidden"></i>遮挡</span>
      <span><i class="legend-color preview"></i>预览</span>
    </div>
  </div>

  <CesiumMap @loaded="handleMapLoaded"></CesiumMap>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import {
  Aim,
  Delete,
  Location,
  LocationInformation,
} from "@element-plus/icons-vue";
import CesiumMap from "@/components/cesium/map.vue";
import {
  isLineOfSightClear,
  pickPositionOnMap,
} from "@/modules/cesium/analysisUtils";

type AnalysisMode = "two-point" | "omnidirectional";
type PickMode = "none" | "primary" | "secondary";

interface TwoPointAnalysisResult {
  visible: boolean;
  distance: number;
  visibleDistance: number;
  obstruction?: Cesium.Cartesian3;
  obstructionType?: "terrain" | "model";
}

interface OmniRayResult {
  azimuth: number;
  target: Cesium.Cartesian3;
  distance: number;
  visible: boolean;
  visibleDistance: number;
  obstruction?: Cesium.Cartesian3;
  obstructionType?: "terrain" | "model";
}

interface OmniAnalysisResult {
  rayCount: number;
  visibleRayCount: number;
  blockedRayCount: number;
  visibleRate: number;
  maxVisibleDistance: number;
}

const analysisMode = ref<AnalysisMode>("two-point");
const pickMode = ref<PickMode>("none");
const observerHeight = ref(20);
const targetHeight = ref(20);
const radius = ref(1800);
const angleStep = ref(5);
const computing = ref(false);
const hint = ref("请选择起点和终点");
const startPoint = ref<Cesium.Cartesian3 | null>(null);
const endPoint = ref<Cesium.Cartesian3 | null>(null);
const observerPoint = ref<Cesium.Cartesian3 | null>(null);
const twoPointResult = ref<TwoPointAnalysisResult | null>(null);
const omniResult = ref<OmniAnalysisResult | null>(null);
const omniRays = ref<OmniRayResult[]>([]);
const canAnalyze = computed(() =>
  analysisMode.value === "two-point"
    ? Boolean(startPoint.value && endPoint.value)
    : Boolean(observerPoint.value),
);

let viewer: Cesium.Viewer | null = null;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
let analysisToken = 0;
let pointEntities: Cesium.Entity[] = [];
let previewEntities: Cesium.Entity[] = [];
let resultEntities: Cesium.Entity[] = [];

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
      roll: 0,
    },
    duration: 1,
  });
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
    if (pickMode.value !== "none") {
      pickMode.value = "none";
      hint.value = getDefaultHint();
    }
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
};

const handleModeChange = () => {
  analysisToken++;
  pickMode.value = "none";
  startPoint.value = null;
  endPoint.value = null;
  observerPoint.value = null;
  twoPointResult.value = null;
  omniResult.value = null;
  omniRays.value = [];
  clearPointVisuals();
  clearPreviewVisuals();
  clearResultVisuals();
  hint.value = getDefaultHint();
};

const startPrimaryPick = () => {
  pickMode.value = "primary";
  hint.value = analysisMode.value === "two-point" ? "请在地图上选择起点" : "请在地图上选择观察点";
};

const startSecondaryPick = () => {
  if (!startPoint.value) {
    hint.value = "请先选择起点";
    return;
  }
  pickMode.value = "secondary";
  hint.value = "请在地图上选择终点";
};

const handleMapClick = (windowPosition: Cesium.Cartesian2) => {
  if (!viewer || pickMode.value === "none") return;

  const picked = pickPositionOnMap(viewer, windowPosition);
  if (!picked) {
    hint.value = "当前位置没有拾取到地表或模型";
    return;
  }

  if (analysisMode.value === "two-point") {
    if (pickMode.value === "primary") {
      startPoint.value = picked;
      endPoint.value = null;
      twoPointResult.value = null;
      clearResultVisuals();
      pickMode.value = "secondary";
      hint.value = "起点已选择，请选择终点";
    } else {
      endPoint.value = picked;
      twoPointResult.value = null;
      pickMode.value = "none";
      hint.value = "两点已选择，点击“分析”检查通视";
    }
    renderPointVisuals();
    renderTwoPointPreview();
    return;
  }

  observerPoint.value = picked;
  omniResult.value = null;
  omniRays.value = [];
  clearResultVisuals();
  pickMode.value = "none";
  hint.value = "观察点已选择，点击“分析”执行 360°通视";
  renderPointVisuals();
  renderOmniPreview();
};

const runAnalysis = async () => {
  if (!viewer || !canAnalyze.value) return;

  const token = ++analysisToken;
  computing.value = true;
  clearResultVisuals();

  try {
    if (analysisMode.value === "two-point") {
      runTwoPointAnalysis();
    } else {
      await runOmniAnalysis(token);
    }
  } catch (error) {
    console.error("通视分析失败:", error);
    hint.value = "通视分析失败，请重试";
  } finally {
    if (token === analysisToken) {
      computing.value = false;
    }
  }
};

const runTwoPointAnalysis = () => {
  if (!viewer || !startPoint.value || !endPoint.value) return;

  const from = liftPoint(startPoint.value, observerHeight.value);
  const to = liftPoint(endPoint.value, targetHeight.value);
  const distance = Cesium.Cartesian3.distance(from, to);
  const result = isLineOfSightClear(viewer, from, to);
  const visibleDistance = result.visible
    ? distance
    : result.obstruction
      ? Cesium.Cartesian3.distance(from, result.obstruction)
      : 0;

  twoPointResult.value = {
    visible: result.visible,
    distance,
    visibleDistance,
    obstruction: result.obstruction,
    obstructionType: result.obstructionType,
  };
  hint.value = result.visible ? "两点之间无遮挡" : "视线被地形或模型遮挡";
  renderTwoPointResult(from, to, twoPointResult.value);
};

const runOmniAnalysis = async (token: number) => {
  if (!viewer || !observerPoint.value) return;

  const currentViewer = viewer;
  const center = Cesium.Cartographic.fromCartesian(observerPoint.value);
  const centerLng = Cesium.Math.toDegrees(center.longitude);
  const centerLat = Cesium.Math.toDegrees(center.latitude);
  const from = liftPoint(observerPoint.value, observerHeight.value);
  const absoluteHeight = Cesium.Cartographic.fromCartesian(from).height;
  const azimuths = buildAzimuths();
  const destinations = azimuths.map((azimuth) =>
    destinationByBearing(centerLng, centerLat, azimuth, radius.value),
  );

  // 目标点的 Z 直接使用实际发射点的绝对高程。
  // 例如 from=(117.35, 36.52, 201)，所有 target 的 height 都是 201。
  const rays = destinations.map((destination, index) => {
    const target = Cesium.Cartesian3.fromDegrees(
      destination.lng,
      destination.lat,
      absoluteHeight,
    );
    const result = isLineOfSightClear(currentViewer, from, target);
    const distance = Cesium.Cartesian3.distance(from, target);
    const visibleDistance = result.visible
      ? distance
      : result.obstruction
        ? Cesium.Cartesian3.distance(from, result.obstruction)
        : 0;
    return {
      azimuth: azimuths[index],
      target,
      distance,
      visible: result.visible,
      visibleDistance,
      obstruction: result.obstruction,
      obstructionType: result.obstructionType,
    };
  });

  if (token !== analysisToken) return;

  omniRays.value = rays;
  const visibleRayCount = rays.filter((ray) => ray.visible).length;
  const blockedRayCount = rays.length - visibleRayCount;
  omniResult.value = {
    rayCount: rays.length,
    visibleRayCount,
    blockedRayCount,
    visibleRate: rays.length ? (visibleRayCount / rays.length) * 100 : 0,
    maxVisibleDistance: rays.reduce(
      (maxDistance, ray) => Math.max(maxDistance, ray.visibleDistance),
      0,
    ),
  };
  hint.value = "360°通视分析完成";
  renderOmniResult(from, rays);
};

const buildAzimuths = () => {
  const azimuths: number[] = [];
  for (let azimuth = 0; azimuth < 360; azimuth += angleStep.value) {
    azimuths.push(azimuth);
  }
  return azimuths;
};

const renderPointVisuals = () => {
  if (!viewer) return;
  clearPointVisuals();

  if (analysisMode.value === "two-point") {
    addPointEntity(startPoint.value, "A", Cesium.Color.CYAN);
    addPointEntity(endPoint.value, "B", Cesium.Color.ORANGE);
  } else {
    addPointEntity(observerPoint.value, "O", Cesium.Color.YELLOW);
  }
};

const renderTwoPointPreview = () => {
  clearPreviewVisuals();
  if (!viewer || !startPoint.value || !endPoint.value) return;

  const from = liftPoint(startPoint.value, observerHeight.value);
  const to = liftPoint(endPoint.value, targetHeight.value);
  addLineEntity(
    [from, to],
    new Cesium.PolylineDashMaterialProperty({
      color: Cesium.Color.WHITE.withAlpha(0.8),
      gapColor: Cesium.Color.TRANSPARENT,
      dashLength: 12,
    }),
    2,
    previewEntities,
  );
};

const renderOmniPreview = () => {
  clearPreviewVisuals();
  if (!viewer || !observerPoint.value) return;

  const center = Cesium.Cartographic.fromCartesian(observerPoint.value);
  const centerLng = Cesium.Math.toDegrees(center.longitude);
  const centerLat = Cesium.Math.toDegrees(center.latitude);
  const from = liftPoint(observerPoint.value, observerHeight.value);
  const previewHeight = Cesium.Cartographic.fromCartesian(from).height;
  const circle: Cesium.Cartesian3[] = [];

  for (let azimuth = 0; azimuth <= 360; azimuth += 5) {
    const destination = destinationByBearing(centerLng, centerLat, azimuth, radius.value);
    circle.push(Cesium.Cartesian3.fromDegrees(destination.lng, destination.lat, previewHeight));
  }

  addLineEntity(
    circle,
    new Cesium.PolylineDashMaterialProperty({
      color: Cesium.Color.WHITE.withAlpha(0.7),
      gapColor: Cesium.Color.TRANSPARENT,
      dashLength: 10,
    }),
    2,
    previewEntities,
  );

  for (let azimuth = 0; azimuth < 360; azimuth += 30) {
    const destination = destinationByBearing(centerLng, centerLat, azimuth, radius.value);
    const end = Cesium.Cartesian3.fromDegrees(destination.lng, destination.lat, previewHeight);
    addLineEntity(
      [from, end],
      Cesium.Color.WHITE.withAlpha(0.38),
      1,
      previewEntities,
    );
  }
};

const renderTwoPointResult = (
  from: Cesium.Cartesian3,
  to: Cesium.Cartesian3,
  result: TwoPointAnalysisResult,
) => {
  clearResultVisuals();
  if (!result.visible && result.obstruction) {
    addLineEntity([from, result.obstruction], Cesium.Color.LIME.withAlpha(0.95), 4, resultEntities);
    addLineEntity([result.obstruction, to], Cesium.Color.RED.withAlpha(0.95), 4, resultEntities);
    addPointEntity(result.obstruction, "遮挡点", Cesium.Color.RED, resultEntities);
    return;
  }
  addLineEntity([from, to], Cesium.Color.LIME.withAlpha(0.95), 4, resultEntities);
};

const renderOmniResult = (from: Cesium.Cartesian3, rays: OmniRayResult[]) => {
  clearResultVisuals();
  rays.forEach((ray) => {
    if (ray.visible || !ray.obstruction) {
      addLineEntity([from, ray.target], Cesium.Color.LIME.withAlpha(0.82), 2, resultEntities);
      return;
    }

    addLineEntity([from, ray.obstruction], Cesium.Color.LIME.withAlpha(0.82), 2, resultEntities);
    addLineEntity([ray.obstruction, ray.target], Cesium.Color.RED.withAlpha(0.78), 2, resultEntities);
    addPointEntity(ray.obstruction, "", Cesium.Color.RED, resultEntities, 6);
  });
};

const addPointEntity = (
  position: Cesium.Cartesian3 | null | undefined,
  label: string,
  color: Cesium.Color,
  collection: Cesium.Entity[] = pointEntities,
  pixelSize = 10,
) => {
  if (!viewer || !position) return;

  const entity = viewer.entities.add({
    position,
    point: {
      pixelSize,
      color,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: label
      ? {
          text: label,
          font: "bold 13px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }
      : undefined,
  });
  collection.push(entity);
};

const addLineEntity = (
  positions: Cesium.Cartesian3[],
  material: Cesium.MaterialProperty | Cesium.Color,
  width: number,
  collection: Cesium.Entity[],
) => {
  if (!viewer || positions.length < 2) return;
  const entity = viewer.entities.add({
    polyline: {
      positions,
      width,
      material,
      clampToGround: false,
      depthFailMaterial: material,
    },
  });
  collection.push(entity);
};

const liftPoint = (position: Cesium.Cartesian3, heightOffset: number) => {
  const cartographic = Cesium.Cartographic.fromCartesian(position);
  return Cesium.Cartesian3.fromRadians(
    cartographic.longitude,
    cartographic.latitude,
    cartographic.height + heightOffset,
  );
};

const destinationByBearing = (lng: number, lat: number, bearing: number, distance: number) => {
  const latRad = Cesium.Math.toRadians(lat);
  const lonRad = Cesium.Math.toRadians(lng);
  const bearingRad = Cesium.Math.toRadians(bearing);
  const angularDistance = distance / 6371008.8;
  const newLat = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad),
  );
  const newLon =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLat),
    );
  return {
    lng: Cesium.Math.toDegrees(newLon),
    lat: Cesium.Math.toDegrees(newLat),
  };
};

const clearPointVisuals = () => {
  if (!viewer) return;
  pointEntities.forEach((entity) => viewer?.entities.remove(entity));
  pointEntities = [];
};

const clearPreviewVisuals = () => {
  if (!viewer) return;
  previewEntities.forEach((entity) => viewer?.entities.remove(entity));
  previewEntities = [];
};

const clearResultVisuals = () => {
  if (!viewer) return;
  resultEntities.forEach((entity) => viewer?.entities.remove(entity));
  resultEntities = [];
};

const handleClear = () => {
  analysisToken++;
  pickMode.value = "none";
  startPoint.value = null;
  endPoint.value = null;
  observerPoint.value = null;
  twoPointResult.value = null;
  omniResult.value = null;
  omniRays.value = [];
  clearPointVisuals();
  clearPreviewVisuals();
  clearResultVisuals();
  hint.value = getDefaultHint();
};

const getDefaultHint = () =>
  analysisMode.value === "two-point" ? "请选择起点和终点" : "请选择观察点";

const formatPoint = (position: Cesium.Cartesian3 | null) => {
  if (!position) return "未选择";
  return formatCartesian(position);
};

const formatCartesian = (position: Cesium.Cartesian3) => {
  const cartographic = Cesium.Cartographic.fromCartesian(position);
  return `${Cesium.Math.toDegrees(cartographic.longitude).toFixed(4)}°, ${Cesium.Math.toDegrees(cartographic.latitude).toFixed(4)}°`;
};

const formatDistance = (distance: number) =>
  distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`;

const formatDegreeTooltip = (value: number) => `${value}°`;
const formatMeterTooltip = (value: number) => `${value} m`;

watch([observerHeight, targetHeight, radius, angleStep], () => {
  if (!viewer || !canAnalyze.value) return;

  analysisToken++;
  twoPointResult.value = null;
  omniResult.value = null;
  omniRays.value = [];
  clearResultVisuals();
  renderPointVisuals();

  if (analysisMode.value === "two-point") {
    renderTwoPointPreview();
  } else {
    renderOmniPreview();
  }
  hint.value = "参数已更新，点击“分析”刷新通视结果";
});

onUnmounted(() => {
  analysisToken++;
  if (mouseHandler) {
    mouseHandler.destroy();
    mouseHandler = null;
  }
  clearPointVisuals();
  clearPreviewVisuals();
  clearResultVisuals();
});
</script>

<style scoped lang="scss">
.los-panel {
  position: absolute;
  z-index: 999;
  top: 50px;
  left: 10px;
  width: 336px;
  padding: 12px;
  color: #edf4ff;
  user-select: none;
  border: 1px solid rgba(168, 184, 210, 0.38);
  border-radius: 6px;
  background: rgba(32, 39, 50, 0.94);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);

  .panel-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 10px;
    font-size: 15px;
    font-weight: 600;
  }

  .panel-hint {
    margin: 9px 0;
    color: #aebdce;
    font-size: 12px;
    line-height: 1.5;
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 9px 0;
  }

  .bottom-actions {
    margin-top: 11px;
  }

  .param-item {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) 52px;
    align-items: center;
    gap: 7px;
    min-height: 32px;

    .param-label,
    .param-unit,
    .param-value {
      color: #c4cfdd;
      font-size: 12px;
      white-space: nowrap;
    }

    .param-unit,
    .param-value {
      color: #eef5ff;
      text-align: right;
    }
  }

  .point-summary {
    display: grid;
    gap: 5px;
    padding: 8px;
    margin-top: 8px;
    border-left: 2px solid rgba(91, 155, 255, 0.65);
    background: rgba(0, 0, 0, 0.22);
    color: #b8c6d8;
    font-size: 12px;
  }

  .point-row {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 18px;
  }

  .point-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    color: #13202e;
    font-size: 11px;
    font-weight: 700;

    &.start,
    &.observer {
      background: #00e5ff;
    }

    &.end {
      background: #ffb04a;
    }
  }

  .result-box {
    padding: 9px;
    margin-top: 10px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.36);
  }

  .result-heading {
    margin-bottom: 7px;
    font-weight: 600;

    &.ok {
      color: #00ee7f;
    }

    &.bad {
      color: #ff6872;
    }
  }

  .result-item {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin: 5px 0;
    font-size: 12px;

    .label {
      color: #abb9ca;
    }

    .value {
      color: #29dfff;
      font-weight: 600;
      text-align: right;

      &.ok {
        color: #00ee7f;
      }

      &.bad {
        color: #ff6872;
      }
    }
  }

  .result-message,
  .obstruction-info {
    color: #b8c6d8;
    font-size: 12px;
    line-height: 1.5;
  }

  .obstruction-info {
    padding-top: 4px;
    color: #ffb4b8;
  }

  .legend-row {
    display: flex;
    gap: 14px;
    padding-top: 9px;
    color: #c5d1df;
    font-size: 12px;

    span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
  }

  .legend-color {
    width: 14px;
    height: 3px;
    border-radius: 2px;

    &.visible {
      background: #00ee7f;
    }

    &.hidden {
      background: #ff4f5d;
    }

    &.preview {
      background: #ffffff;
    }
  }

  :deep(.el-radio-button__inner) {
    padding: 6px 12px;
  }

  :deep(.el-slider) {
    --el-slider-main-bg-color: #3186ff;
    --el-slider-runway-bg-color: rgba(222, 231, 244, 0.2);
  }

  :deep(.el-input-number--small) {
    width: 100%;
  }

  :deep(.el-button--small) {
    min-width: 68px;
  }
}
</style>
