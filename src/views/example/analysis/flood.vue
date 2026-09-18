<template>
  <div class="menubox box2">
    <el-switch
      v-model="isMeasuring"
      inline-prompt
      size="large"
      style="--el-switch-off-color: #ff4949"
      active-text="开启绘制"
      inactive-text="停止绘制"
    />

    <div class="param-item">
      <span class="param-label">网格间距：</span>
      <el-input-number v-model="gridSpacing" :min="10" :max="100" :step="10" size="small" />
      <span class="param-unit">米</span>
    </div>

    <div class="param-item">
      <span class="param-label">水位高程：</span>
      <el-slider
        v-model="waterLevel"
        :min="sliderMin"
        :max="sliderMax"
        :step="0.5"
        :disabled="!gridReady"
        class="water-slider"
        @input="stopWaterAnim"
      />
      <span class="param-unit water-value">{{ waterLevel.toFixed(1) }} m</span>
    </div>

    <div class="button-row">
      <el-button size="small" type="primary" :disabled="!gridReady" @click="playRise">
        上涨模拟
      </el-button>
      <el-button size="small" :disabled="!gridReady" @click="lowerToBottom">
        回落
      </el-button>
      <el-button size="small" :disabled="!waterAnimating" @click="stopWaterAnim">
        暂停
      </el-button>
    </div>

    <div class="result-box" v-if="computing">
      <div class="result-item">
        <span class="value">采样中...</span>
      </div>
    </div>

    <div class="result-box" v-else-if="floodResult">
      <div class="result-item">
        <span class="label">水位：</span>
        <span class="value">{{ floodResult.waterLevel.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">区域面积：</span>
        <span class="value">{{ formatInteger(regionArea) }} m²</span>
      </div>
      <div class="result-item">
        <span class="label">淹没面积：</span>
        <span class="value">{{ formatInteger(floodResult.area) }} m²</span>
      </div>
      <div class="result-item">
        <span class="label">淹没体积：</span>
        <span class="value">{{ formatInteger(floodResult.volume) }} m³</span>
      </div>
      <div class="result-item">
        <span class="label">淹没比例：</span>
        <span class="value">{{ formatPercent(floodResult.coverageRatio) }}</span>
      </div>
      <div class="result-item">
        <span class="label">平均水深：</span>
        <span class="value">{{ floodResult.averageDepth.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">最大水深：</span>
        <span class="value">{{ floodResult.maxDepth.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">淹没三角面：</span>
        <span class="value">{{ floodResult.floodedCount }} / {{ floodResult.totalCount }} 个</span>
      </div>
      <div class="result-item">
        <span class="label">实际间距：</span>
        <span class="value">{{ actualSpacing.toFixed(0) }} m</span>
      </div>
    </div>

    <div class="result-box" v-else-if="hint">
      <div class="result-item">
        <span class="value">{{ hint }}</span>
      </div>
    </div>

    <div>
      <el-button type="danger" @click="handleClear">清除结果</el-button>
    </div>
  </div>

  <CesiumMap @loaded="handleMapLoaded"></CesiumMap>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from "vue";
import * as Cesium from "cesium";
import CesiumMap from "@/components/cesium/map.vue";
import {
  computeFlood,
  pickPositionOnMap,
  sampleTerrainTriangleMesh,
  sampleTerrainHeights,
  type FloodResult,
  type LonLat,
  type TerrainTriangleMesh,
} from "@/modules/cesium/analysisUtils";
import { FloodAnalysisLayer } from "@/modules/cesium/floodAnalysisLayer";

let viewer: Cesium.Viewer | null = null;
let analysisLayer: FloodAnalysisLayer | null = null;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
let gridResult: TerrainTriangleMesh | null = null;
let polygonLngLats: LonLat[] = [];
let positions: Cesium.Cartesian3[] = [];
let isDrawing = false;
let updateTimer: number | undefined;
let waterAnimId: number | undefined;
let sampleToken = 0;

const isMeasuring = ref(false);
const gridSpacing = ref(20);
const waterLevel = ref(0);
const sliderMin = ref(0);
const sliderMax = ref(100);
const gridReady = ref(false);
const computing = ref(false);
const hint = ref("");
const actualSpacing = ref(0);
const waterAnimating = ref(false);
const floodResult = shallowRef<FloodResult | null>(null);

const regionArea = computed(() => {
  const result = floodResult.value;
  const grid = gridResult;
  return result && grid ? (result.totalArea ?? grid.surfaceArea) : 0;
});

const formatInteger = (value: number) => Math.round(value).toLocaleString();

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toLonLat = (position: Cesium.Cartesian3): LonLat => {
  const carto = Cesium.Cartographic.fromCartesian(position);
  return {
    lng: Cesium.Math.toDegrees(carto.longitude),
    lat: Cesium.Math.toDegrees(carto.latitude),
  };
};

const getInitialTargetLevel = (grid: TerrainTriangleMesh) => {
  const span = Math.max(grid.maxHeight - grid.minHeight, 1);
  return grid.minHeight + span * 0.85;
};

const syncSliderRange = (grid: TerrainTriangleMesh) => {
  const span = Math.max(grid.maxHeight - grid.minHeight, 1);
  sliderMin.value = Number((grid.minHeight - Math.max(span * 0.05, 1)).toFixed(2));
  sliderMax.value = Number((grid.maxHeight + Math.max(span * 0.15, 5)).toFixed(2));
  actualSpacing.value = grid.spacing;
};

const resetWaterRange = () => {
  waterLevel.value = 0;
  sliderMin.value = 0;
  sliderMax.value = 100;
  actualSpacing.value = 0;
};

const stopWaterAnim = () => {
  if (waterAnimId !== undefined) {
    cancelAnimationFrame(waterAnimId);
    waterAnimId = undefined;
  }
  waterAnimating.value = false;
};

const animateWaterTo = (target: number, durationMs = 2500) => {
  stopWaterAnim();

  const start = waterLevel.value;
  const end = clamp(target, sliderMin.value, sliderMax.value);
  if (Math.abs(start - end) < 0.01) {
    waterLevel.value = end;
    return;
  }

  waterAnimating.value = true;
  const startTime = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startTime) / durationMs);
    const eased = 1 - Math.pow(1 - progress, 3);
    waterLevel.value = start + (end - start) * eased;

    if (progress < 1) {
      waterAnimId = requestAnimationFrame(step);
      return;
    }

    waterLevel.value = end;
    waterAnimId = undefined;
    waterAnimating.value = false;
  };

  waterAnimId = requestAnimationFrame(step);
};

const playRise = () => {
  if (!gridResult) return;

  const target = getInitialTargetLevel(gridResult);
  if (waterLevel.value >= target - 0.1) {
    waterLevel.value = sliderMin.value;
  }
  animateWaterTo(target);
};

const lowerToBottom = () => {
  animateWaterTo(sliderMin.value, 1000);
};

const resetCamera = () => {
  viewer?.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(103.82, 36.02, 3000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-40),
      roll: 0,
    },
    duration: 1,
  });
};

const clearRuntimeState = () => {
  sampleToken++;
  stopWaterAnim();

  if (updateTimer) {
    clearTimeout(updateTimer);
    updateTimer = undefined;
  }

  positions = [];
  polygonLngLats = [];
  gridResult = null;
  isDrawing = false;
  gridReady.value = false;
  computing.value = false;
  floodResult.value = null;
  hint.value = "";
  resetWaterRange();
};

const handleClear = () => {
  analysisLayer?.clear();
  clearRuntimeState();
};

const updateFloodResult = () => {
  if (!gridResult || !analysisLayer) return;

  const result = computeFlood(gridResult, waterLevel.value);
  floodResult.value = result;
  analysisLayer.renderFloodDepth(gridResult, result);
  viewer?.scene.requestRender();
};

const scheduleFloodUpdate = () => {
  if (!gridReady.value) return;
  if (updateTimer) {
    clearTimeout(updateTimer);
  }
  updateTimer = window.setTimeout(() => {
    updateFloodResult();
    updateTimer = undefined;
  }, 120);
};

const applySampledGrid = async (grid: TerrainTriangleMesh, token: number, animate: boolean) => {
  if (!viewer || !analysisLayer || token !== sampleToken) return;

  const validCount = grid.triangles.length;
  if (!validCount) {
    hint.value = "区域内无有效三角面，请增大绘制范围或调整间距";
    floodResult.value = null;
    gridReady.value = false;
    return;
  }

  const sampledBoundary = await sampleTerrainHeights(viewer, polygonLngLats);
  if (token !== sampleToken) return;

  gridResult = grid;
  syncSliderRange(grid);

  if (sampledBoundary.length) {
    positions = sampledBoundary.map((point) =>
      Cesium.Cartesian3.fromDegrees(point.lng, point.lat, point.height),
    );
  }

  analysisLayer.renderAnalysisArea(polygonLngLats, positions, grid);

  waterLevel.value = animate
    ? sliderMin.value
    : clamp(waterLevel.value, sliderMin.value, sliderMax.value);
  gridReady.value = true;
  updateFloodResult();

  if (animate) {
    animateWaterTo(getInitialTargetLevel(grid));
  }
};

const sampleCurrentPolygon = async (animate = false) => {
  if (!viewer || polygonLngLats.length < 3) return;

  const token = ++sampleToken;
  stopWaterAnim();
  computing.value = true;
  hint.value = "";

  try {
    const grid = await sampleTerrainTriangleMesh(viewer, polygonLngLats, gridSpacing.value);
    await applySampledGrid(grid, token, animate);
  } catch (error) {
    if (token !== sampleToken) return;
    console.error("网格采样失败:", error);
    hint.value = "网格采样失败，请重试";
    floodResult.value = null;
  } finally {
    if (token === sampleToken) {
      computing.value = false;
    }
  }
};

const startDrawing = () => {
  analysisLayer?.clear();
  clearRuntimeState();
  isDrawing = true;
};

const finishDrawing = () => {
  if (!isMeasuring.value || !isDrawing) return;

  isDrawing = false;
  analysisLayer?.clearVertexLabel();

  if (positions.length < 3) {
    hint.value = "至少需要 3 个点才能构成面";
    return;
  }

  polygonLngLats = positions.map(toLonLat);
  sampleCurrentPolygon(true);
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewer.scene.globe.depthTestAgainstTerrain = true;
  analysisLayer = new FloodAnalysisLayer(viewer, {
    getWaterLevel: () => waterLevel.value,
  });
  bindMouseEvents();
  resetCamera();
};

const bindMouseEvents = () => {
  if (!viewer) return;

  mouseHandler?.destroy();
  mouseHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  mouseHandler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!viewer || !analysisLayer || !isMeasuring.value) return;

      if (!isDrawing) {
        startDrawing();
      }

      const cartesian = pickPositionOnMap(viewer, event.position);
      if (!cartesian) {
        hint.value = "未拾取到地形，请稍后重试";
        return;
      }

      positions.push(cartesian);
      hint.value = "";
      analysisLayer.drawDraft(positions);
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );

  mouseHandler.setInputAction(() => {
    finishDrawing();
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
};

watch(waterLevel, () => {
  scheduleFloodUpdate();
});

watch(gridSpacing, () => {
  if (gridReady.value && !computing.value && polygonLngLats.length) {
    sampleCurrentPolygon(false);
  }
});

watch(isMeasuring, (enabled) => {
  if (!enabled && isDrawing) {
    isDrawing = false;
    analysisLayer?.clearDraft();
    positions = [];
  }
});

onUnmounted(() => {
  clearRuntimeState();
  mouseHandler?.destroy();
  mouseHandler = null;
  analysisLayer?.destroy();
  analysisLayer = null;
  viewer = null;
});
</script>

<style scoped lang="scss">
.menubox {
  position: absolute;
  z-index: 999;
  border-bottom-right-radius: 10px;
  border: 1px solid rgba(139, 139, 139, 0.2);
  background-color: #222222;
  color: #fff;
  user-select: none;
  transition: all 0.3s;
  padding: 10px;

  &.box2 {
    left: 5px;
    top: 65px;
    width: 340px;
  }

  .param-item {
    display: flex;
    align-items: center;
    margin-top: 10px;

    .param-label {
      color: #aaa;
      font-size: 14px;
      white-space: nowrap;
    }

    .param-unit {
      color: #aaa;
      font-size: 13px;
      margin-left: 5px;
      white-space: nowrap;
    }

    .water-slider {
      flex: 1;
      margin: 0 8px;
    }

    .water-value {
      width: 58px;
      text-align: right;
    }
  }

  .button-row {
    display: flex;
    gap: 6px;
    margin-top: 10px;

    .el-button {
      margin-left: 0;
    }
  }

  .result-box {
    margin: 10px 0;
    padding: 8px;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 4px;

    .result-item {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      margin: 5px 0;
      font-size: 14px;

      .label {
        color: #aaa;
        white-space: nowrap;
      }

      .value {
        color: #00eeff;
        font-weight: bold;
        text-align: right;
      }
    }
  }
}
</style>
