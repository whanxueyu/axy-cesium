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
      <span class="param-label">边界采样间距：</span>
      <el-input-number v-model="edgeSpacing" :min="10" :max="100" :step="10" size="small" />
      <span class="param-unit">米</span>
    </div>
    <div class="result-box" v-if="calculating">
      <div class="result-item">
        <span class="value">计算中...</span>
      </div>
    </div>
    <div class="result-box" v-else-if="resultVisible">
      <div class="result-item">
        <span class="label">贴地面积：</span>
        <span class="value">{{ surfaceArea.toFixed(2) }} m²</span>
      </div>
      <div class="result-item">
        <span class="label">换算：</span>
        <span class="value">{{ (surfaceArea / 666.67).toFixed(2) }} 亩 / {{ (surfaceArea / 10000).toFixed(2) }} 公顷</span>
      </div>
      <div class="result-item">
        <span class="label">球面面积：</span>
        <span class="value">{{ sphericalArea.toFixed(2) }} m²</span>
      </div>
      <div class="result-item">
        <span class="label">平面面积：</span>
        <span class="value">{{ planarArea.toFixed(2) }} m²</span>
      </div>
      <div class="result-item">
        <span class="label">边界点数：</span>
        <span class="value">{{ pointCount }} 个</span>
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
import { onUnmounted, ref } from "vue";
import * as Cesium from "cesium";
import Map from "@/components/cesium/map.vue";
import {
  computeSurfaceArea3D,
  computeSphericalArea,
  computePlanarArea,
  pickPositionOnMap,
  type LonLat,
  type TerrainSample,
} from "@/modules/cesium/analysisUtils";

var viewer: Cesium.Viewer;
const isMeasuring = ref(false);
const edgeSpacing = ref(30);
const calculating = ref(false);
const resultVisible = ref(false);
const hint = ref("");
const surfaceArea = ref(0);
const sphericalArea = ref(0);
const planarArea = ref(0);
const pointCount = ref(0);

let previewLineEntity: Cesium.Entity | null = null; // 绘制过程中的预览线
let polygonEntity: Cesium.Entity | null = null; // 最终面积多边形
let pointEntities: Cesium.Entity[] = [];
let labelEntity: Cesium.Entity | null = null;
let positions: Cesium.Cartesian3[] = [];
let isDrawing = false;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;

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
  if (previewLineEntity) {
    viewer.entities.remove(previewLineEntity);
    previewLineEntity = null;
  }
  if (polygonEntity) {
    viewer.entities.remove(polygonEntity);
    polygonEntity = null;
  }
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
    labelEntity = null;
  }
  pointEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  pointEntities = [];
  positions = [];
  isDrawing = false;
  calculating.value = false;
  resultVisible.value = false;
  hint.value = "";
  surfaceArea.value = 0;
  sphericalArea.value = 0;
  planarArea.value = 0;
  pointCount.value = 0;
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

/** 绘制面积多边形（顶点高程抬升 1.5m，避免与地形重叠闪烁） */
const drawPolygon = (ring: TerrainSample[]) => {
  if (polygonEntity) {
    viewer.entities.remove(polygonEntity);
  }
  polygonEntity = viewer.entities.add({
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        ring.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.height + 1.5)),
      ),
      perPositionHeight: true,
      material: Cesium.Color.YELLOW.withAlpha(0.35),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
    },
  });
};

/** 计算三种面积 */
const computeAreas = async () => {
  hint.value = "";
  resultVisible.value = false;
  calculating.value = true;

  // 世界坐标转经纬度
  const lngLats: LonLat[] = positions.map((p) => {
    const carto = Cesium.Cartographic.fromCartesian(p);
    return {
      lng: Cesium.Math.toDegrees(carto.longitude),
      lat: Cesium.Math.toDegrees(carto.latitude),
    };
  });

  // 球面/平面面积同步计算
  sphericalArea.value = computeSphericalArea(lngLats);
  planarArea.value = computePlanarArea(lngLats);
  pointCount.value = lngLats.length;

  // 贴地面积需边界加密 + 地形采样（异步）
  try {
    const { area, ring } = await computeSurfaceArea3D(viewer, lngLats, edgeSpacing.value);
    surfaceArea.value = area;
    drawPolygon(ring);
    resultVisible.value = true;
  } catch (error) {
    console.error("贴地面积计算失败:", error);
    hint.value = "贴地面积计算失败，请重试";
  }
  calculating.value = false;
};

/** 右键结束绘制 */
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
  computeAreas();
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
        resultVisible.value = false;
        hint.value = "";
      }

      const cartesian = pickPositionOnMap(viewer, event.position);
      if (!cartesian) return;

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

onUnmounted(() => {
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  if (viewer) {
    [previewLineEntity, polygonEntity, labelEntity].forEach((entity) => {
      if (entity) viewer.entities.remove(entity);
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
