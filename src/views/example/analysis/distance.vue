<template>
  <div class="menubox box2">
    <el-switch
      v-model="isMeasuring"
      inline-prompt
      size="large"
      style="--el-switch-off-color: #ff4949"
      active-text="开启测量"
      inactive-text="停止测量"
    />
    <div>
      <el-switch
        v-model="straightLine"
        inline-prompt
        size="large"
        style="--el-switch-off-color: #13ae66"
        active-text="直线距离"
        inactive-text="贴地距离"
      />
    </div>
    <div class="result-box" v-if="resultVisible && totalDistance > 0">
      <div class="result-item">
        <span class="label">总距离：</span>
        <span class="value">{{ totalDistance.toFixed(2) }} 米</span>
      </div>
      <div class="result-item" v-if="segmentDistances.length > 0">
        <span class="label">段数：</span>
        <span class="value">{{ segmentDistances.length }} 段</span>
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

var viewer: Cesium.Viewer;
const isMeasuring = ref(false);
const straightLine = ref(false);
const resultVisible = ref(false);
const totalDistance = ref(0);
const segmentDistances = ref<number[]>([]);

let labelEntity: Cesium.Entity | null = null;
let lineEntity: Cesium.Entity | null = null;
let pointEntities: Cesium.Entity[] = [];
let segmentLabels: Cesium.Entity[] = []; // 存储每段距离的标签
let positions: Cesium.Cartesian3[] = [];
let isDrawing = false;
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
const mapLoaded = ref(false);

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  mapLoaded.value = true;
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
  if (lineEntity) {
    viewer.entities.remove(lineEntity);
    lineEntity = null;
  }
  pointEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  pointEntities = [];
  // 清除所有线段标签
  segmentLabels.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  segmentLabels = [];
  positions = [];
  isDrawing = false;
  resultVisible.value = false;
  totalDistance.value = 0;
  segmentDistances.value = [];
};

const calculateDistance = (
  pos1: Cesium.Cartesian3,
  pos2: Cesium.Cartesian3
): number => {
  if (straightLine.value) {
    return Cesium.Cartesian3.distance(pos1, pos2);
  } else {
    const cartographic1 = Cesium.Cartographic.fromCartesian(pos1);
    const cartographic2 = Cesium.Cartographic.fromCartesian(pos2);

    // 使用 EllipsoidGeodesic 计算大地测量距离
    const geodesic = new Cesium.EllipsoidGeodesic(
      cartographic1,
      cartographic2,
      viewer.scene.globe.ellipsoid
    );

    return geodesic.surfaceDistance;
  }
};

const updateLineVisualization = () => {
  if (lineEntity) {
    viewer.entities.remove(lineEntity);
  }

  if (positions.length < 2) return;

  lineEntity = viewer.entities.add({
    polyline: {
      positions: positions,
      width: 4,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.CYAN,
        glowPower: 0.2,
      }),
      clampToGround: !straightLine.value,
    },
  });
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
      font: "12pt monospace",
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

const addSegmentLabel = (
  position: Cesium.Cartesian3,
  distance: number,
  segmentIndex: number
) => {
  const label = viewer.entities.add({
    position: position,
    label: {
      text: `${distance.toFixed(2)}m`,
      font: "10pt monospace",
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 1,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -5),
      disableDepthTestDistance: Number.MAX_VALUE,
      backgroundColor: new Cesium.Color(0.0, 0.0, 0.0, 0.6),
      backgroundPadding: new Cesium.Cartesian2(4, 2),
    },
  });
  segmentLabels.push(label);
};

const processPickResult = (
  cartesian: Cesium.Cartesian3,
  screenPosition: Cesium.Cartesian2
) => {
  if (!isDrawing) return;

  // 添加新的点
  positions.push(cartesian);
  const pointIndex = positions.length;
  addPointMarker(cartesian, pointIndex);

  // 如果已经有至少两个点，计算新线段的距离
  if (positions.length >= 2) {
    const lastIndex = positions.length - 2;
    const distance = calculateDistance(positions[lastIndex], cartesian);
    segmentDistances.value.push(distance);

    // 计算总距离
    totalDistance.value = segmentDistances.value.reduce(
      (sum, dist) => sum + dist,
      0
    );
    resultVisible.value = true;

    // 更新线的可视化
    updateLineVisualization();

    // 计算线段中点位置用于显示距离
    const midpoint = Cesium.Cartesian3.midpoint(
      positions[lastIndex],
      cartesian,
      new Cesium.Cartesian3()
    );
    
    // 添加线段距离标签
    addSegmentLabel(midpoint, distance, segmentDistances.value.length);

    // 在最后一个点显示当前总距离
    if (labelEntity) {
      viewer.entities.remove(labelEntity);
    }
    labelEntity = viewer.entities.add({
      position: cartesian,
      label: {
        text: `点${pointIndex}\n总距离：${totalDistance.value.toFixed(2)}m`,
        font: "12pt monospace",
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -9),
        disableDepthTestDistance: Number.MAX_VALUE,
      },
    });
  }
};

const handleClickListener = () => {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  // 左键点击添加点
  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!isMeasuring.value) return;

      if (!isDrawing) {
        isDrawing = true;
        positions = [];
        segmentDistances.value = [];
        totalDistance.value = 0;
      }

      const cartesian = viewer.scene.pickPosition(event.position);

      if (!cartesian) {
        const ray = viewer.camera.getPickRay(event.position);
        if (!ray) return;

        const ellipsoidCartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!ellipsoidCartesian) return;

        processPickResult(ellipsoidCartesian, event.position);
        return;
      }

      processPickResult(cartesian, event.position);
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );

  // 右键结束绘制
  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!isMeasuring.value || !isDrawing) return;

      isDrawing = false;

      // 移除临时标签
      if (labelEntity) {
        viewer.entities.remove(labelEntity);
        labelEntity = null;
      }

      // 显示最终结果标签（在最后一个点位置）
      if (positions.length > 0) {
        const lastPosition = positions[positions.length - 1];
        labelEntity = viewer.entities.add({
          position: lastPosition,
          label: {
            text: `总距离：${totalDistance.value.toFixed(2)}米\n段数：${
              segmentDistances.value.length
            }`,
            font: "14pt monospace",
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -9),
            disableDepthTestDistance: Number.MAX_VALUE,
          },
        });
      }
    },
    Cesium.ScreenSpaceEventType.RIGHT_CLICK
  );

  mouseHandler = handler;
};

onUnmounted(() => {
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  if (lineEntity && viewer) {
    viewer.entities.remove(lineEntity);
  }
  pointEntities.forEach((entity) => {
    if (viewer) {
      viewer.entities.remove(entity);
    }
  });
  // 清理线段标签
  segmentLabels.forEach((entity) => {
    if (viewer) {
      viewer.entities.remove(entity);
    }
  });
});
</script>

// ... existing code ...

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
