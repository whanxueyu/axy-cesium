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
      <span class="param-unit">{{ waterLevel.toFixed(1) }} m</span>
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
        <span class="label">淹没面积：</span>
        <span class="value">{{ Math.round(floodResult.area).toLocaleString() }} m²</span>
      </div>
      <div class="result-item">
        <span class="label">淹没体积：</span>
        <span class="value">{{ Math.round(floodResult.volume).toLocaleString() }} m³</span>
      </div>
      <div class="result-item">
        <span class="label">最大水深：</span>
        <span class="value">{{ floodResult.maxDepth.toFixed(2) }} m</span>
      </div>
      <div class="result-item">
        <span class="label">淹没网格：</span>
        <span class="value">{{ floodResult.floodedCount }} 个</span>
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
  <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";
import * as Cesium from "cesium";
import Map from "@/components/cesium/map.vue";
import {
  computeFlood,
  pickPositionOnMap,
  samplePolygonGrid,
  sampleTerrainHeights,
  type FloodResult,
  type LonLat,
  type PolygonGridResult,
} from "@/modules/cesium/analysisUtils";
import { DynamicWallMaterialProperty } from "@/modules/cesium/analysisWallMaterial";

var viewer: Cesium.Viewer;
const isMeasuring = ref(false);
const gridSpacing = ref(20);
const waterLevel = ref(0);
const sliderMin = ref(0);
const sliderMax = ref(100);
const gridReady = ref(false);
const computing = ref(false);
const hint = ref("");
const floodResult = ref<FloodResult | null>(null);

let gridResult: PolygonGridResult | null = null;
let polygonLngLats: LonLat[] = [];
let waterEntities: Cesium.Entity[] = [];
let wallEntity: Cesium.Entity | null = null;
let previewLineEntity: Cesium.Entity | null = null;
let labelEntity: Cesium.Entity | null = null;
let pointEntities: Cesium.Entity[] = [];
let positions: Cesium.Cartesian3[] = [];
let isDrawing = false;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
let debounceTimer: number | undefined;
let waterAnimId: number | undefined;

/** 停止水位上涨动画 */
const stopWaterAnim = () => {
  if (waterAnimId !== undefined) {
    cancelAnimationFrame(waterAnimId);
    waterAnimId = undefined;
  }
};

/** 水位从当前值缓动上涨到目标值（easeOutCubic） */
const animateWaterTo = (target: number, durationMs = 2500) => {
  stopWaterAnim();
  const start = waterLevel.value;
  const t0 = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - t0) / durationMs);
    const eased = 1 - Math.pow(1 - t, 3);
    waterLevel.value = start + (target - start) * eased;
    if (t < 1) {
      waterAnimId = requestAnimationFrame(step);
    } else {
      waterAnimId = undefined;
    }
  };
  waterAnimId = requestAnimationFrame(step);
};

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  // 让实体与真实地形正确遮挡
  viewer.scene.globe.depthTestAgainstTerrain = true;
  handleClickListener();
  reset();
};

const reset = () => {
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

const handleClear = () => {
  stopWaterAnim();
  [previewLineEntity, wallEntity, labelEntity].forEach((entity) => {
    if (entity) {
      viewer.entities.remove(entity);
    }
  });
  previewLineEntity = null;
  wallEntity = null;
  labelEntity = null;
  waterEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  waterEntities = [];
  pointEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  pointEntities = [];
  positions = [];
  polygonLngLats = [];
  gridResult = null;
  gridReady.value = false;
  isDrawing = false;
  computing.value = false;
  floodResult.value = null;
  hint.value = "";
  // 重置水位与滑块范围，避免清除后残留旧数值
  waterLevel.value = 0;
  sliderMin.value = 0;
  sliderMax.value = 100;
};

const addPointMarker = (position: Cesium.Cartesian3, index: number) => {
  const point = viewer.entities.add({
    position: position,
    point: {
      pixelSize: 8,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
    },
    label: {
      text: `${index}`,
      font: "bold 14pt monospace",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      pixelOffset: new Cesium.Cartesian2(0, 10),
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });
  pointEntities.push(point);
};

const updatePreviewLine = () => {
  if (previewLineEntity) {
    viewer.entities.remove(previewLineEntity);
  }
  if (positions.length < 2) return;
  previewLineEntity = viewer.entities.add({
    polyline: {
      positions: [...positions],
      width: 3,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW,
        glowPower: 0.3,
      }),
      clampToGround: false,
    },
  });
};

/** 沿绘制边界更新动态水墙（墙高 = 水位 - 边界地表高程） */
const updateWall = () => {
  if (!positions.length) return;

  const groundHeights = positions.map((p) => Cesium.Cartographic.fromCartesian(p).height);
  // 墙高随水位实时变化，用 CallbackProperty 每帧计算
  // （地表高于水位的顶点处墙高为 0，max 不能小于 min，否则几何非法整体不渲染）
  const maxHeights = new Cesium.CallbackProperty(
    () => positions.map((p, i) => Math.max(waterLevel.value, groundHeights[i])),
    false,
  );

  if (wallEntity) {
    viewer.entities.remove(wallEntity);
  }
  wallEntity = viewer.entities.add({
    wall: {
      positions: [...positions],
      minimumHeights: groundHeights,
      maximumHeights: maxHeights,
      material: new DynamicWallMaterialProperty({
        color: Cesium.Color.fromCssColorString("#00c8ff").withAlpha(0.85),
        duration: 2000,
        trailImage: "/textures/flow-wall-1.png",
        count: 10,
        viewer: viewer,
      }),
    },
  });
};

/** 重建水面（经典做法：贴地 polygon 拉伸到水位，低于水位处自然露出水面）
 *  extrudedHeight 用 CallbackProperty 每帧取水位，水位上涨动画时水面连续抬升 */
const updateWaterSurface = () => {
  waterEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  waterEntities = [];

  if (polygonLngLats.length < 3) return;
  const entity = viewer.entities.add({
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        polygonLngLats.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 0)),
      ),
      perPositionHeight: false,
      extrudedHeight: new Cesium.CallbackProperty(() => waterLevel.value, false),
      material: Cesium.Color.fromCssColorString("#00c8ff").withAlpha(0.5),
    },
  });
  waterEntities.push(entity);
};

/** 按当前水位即时重算 */
const doUpdate = () => {
  if (!gridResult) return;
  const result = computeFlood(gridResult, waterLevel.value);
  floodResult.value = result;
  updateWaterSurface();
  updateWall();
};

/** 右键结束绘制 → 采样网格并初始化淹没 */
const finishDrawing = () => {
  if (!isMeasuring.value || !isDrawing) return;
  isDrawing = false;

  // 移除临时标签
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
    labelEntity = null;
  }

  if (positions.length < 3) {
    hint.value = "至少需要 3 个点才能构成面";
    return;
  }

  polygonLngLats = positions.map((p) => {
    const carto = Cesium.Cartographic.fromCartesian(p);
    return {
      lng: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
    };
  });

  hint.value = "";
  computing.value = true;
  samplePolygonGrid(viewer, polygonLngLats, gridSpacing.value)
    .then(async (g) => {
      gridResult = g;
      // 拾取点可能在椭球面上（地形未加载时），用真实地形高程重建边界顶点，
      // 否则水墙/水面会埋入地下
      const boundary = await sampleTerrainHeights(viewer, polygonLngLats);
      if (boundary.length) {
        positions = boundary.map((p) =>
          Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.height),
        );
        rebuildBoundaryEntities();
      }
      sliderMin.value = g.minHeight - 1;
      sliderMax.value = g.maxHeight + 5;
      // 初始水位取区间 85% 处，从谷底缓动上涨，效果明显
      waterLevel.value = g.minHeight;
      gridReady.value = true;
      doUpdate();
      animateWaterTo(g.minHeight + (g.maxHeight - g.minHeight) * 0.85);
    })
    .catch((error) => {
      console.error("网格采样失败:", error);
      hint.value = "网格采样失败，请重试";
    })
    .finally(() => {
      computing.value = false;
    });
};

/** 按校正后的边界顶点重建点标记与预览线 */
const rebuildBoundaryEntities = () => {
  pointEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  pointEntities = [];
  positions.forEach((p, i) => {
    addPointMarker(p, i + 1);
  });
  updatePreviewLine();
};

const handleClickListener = () => {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  // 左键点击添加顶点
  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!isMeasuring.value) return;

      if (!isDrawing) {
        isDrawing = true;
        positions = [];
        floodResult.value = null;
        hint.value = "";
      }

      const cartesian = pickPositionOnMap(viewer, event.position);
      if (!cartesian) {
        hint.value = "未拾取到地形，请稍后重试";
        return;
      }

      positions.push(cartesian);
      addPointMarker(cartesian, positions.length);
      updatePreviewLine();

      // 最后一个点上显示顶点数
      if (labelEntity) {
        viewer.entities.remove(labelEntity);
      }
      labelEntity = viewer.entities.add({
        position: cartesian,
        label: {
          text: `点${positions.length}`,
          font: "bold 14pt monospace",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -9),
          disableDepthTestDistance: Number.MAX_VALUE,
        },
      });
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );

  // 右键结束绘制
  handler.setInputAction(() => {
    finishDrawing();
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

  mouseHandler = handler;
};

// 水位变化 → 防抖 150ms 重算
watch(waterLevel, () => {
  if (!gridReady.value) return;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    doUpdate();
  }, 150);
});

// 网格间距变化 → 重新采样
watch(gridSpacing, () => {
  if (gridResult && !computing.value) {
    if (!polygonLngLats.length) return;
    computing.value = true;
    samplePolygonGrid(viewer, polygonLngLats, gridSpacing.value)
      .then((g) => {
        gridResult = g;
        sliderMin.value = g.minHeight - 1;
        sliderMax.value = g.maxHeight + 5;
        waterLevel.value = g.minHeight + (g.maxHeight - g.minHeight) * 0.85;
        doUpdate();
      })
      .catch((error) => {
        console.error("网格采样失败:", error);
      })
      .finally(() => {
        computing.value = false;
      });
  }
});

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  stopWaterAnim();
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  if (viewer) {
    [previewLineEntity, wallEntity, labelEntity].forEach((entity) => {
      if (entity) viewer.entities.remove(entity);
    });
    waterEntities.forEach((entity) => {
      viewer.entities.remove(entity);
    });
    pointEntities.forEach((entity) => {
      viewer.entities.remove(entity);
    });
  }
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
    width: 300px;
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
  }

  .result-box {
    margin: 10px 0;
    padding: 8px;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 4px;

    .result-item {
      margin: 5px 0;
      font-size: 14px;

      .label {
        color: #aaa;
        margin-right: 5px;
      }

      .value {
        color: #00eeff;
        font-weight: bold;
      }
    }
  }
}
</style>
