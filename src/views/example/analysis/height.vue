<template>
  <div class="menubox box2">
    <el-switch
      v-model="isMeasuring"
      inline-prompt
      size="large"
      active-text="开启测量"
      inactive-text="停止测量"
    />
    <div>
      <el-button type="danger" @click="handleClear">清除结果</el-button>
    </div>
    <div class="result-box" v-if="resultVisible && points.length > 0">
      <div class="result-item" v-if="points.length === 1">
        <span class="label">请点击第二个点</span>
      </div>
      <div class="result-item" v-if="points.length >= 2">
        <span class="label">点 1 高度：</span>
        <span class="value">{{ heightDiff.point1Height.toFixed(2) }} 米</span>
      </div>
      <div class="result-item" v-if="points.length >= 2">
        <span class="label">点 2 高度：</span>
        <span class="value">{{ heightDiff.point2Height.toFixed(2) }} 米</span>
      </div>
      <div class="result-item" v-if="points.length >= 2">
        <span class="label">高度差：</span>
        <span class="value">{{ heightDiff.diff.toFixed(2) }} 米</span>
      </div>
      <div class="result-item" v-if="points.length >= 2">
        <span class="label">水平距离：</span>
        <span class="value"
          >{{ heightDiff.horizontalDistance.toFixed(2) }} 米</span
        >
      </div>
      <div class="result-item" v-if="points.length >= 2">
        <span class="label">斜距：</span>
        <span class="value">{{ heightDiff.slopeDistance.toFixed(2) }} 米</span>
      </div>
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
const resultVisible = ref(false);
const points: Cesium.Cartesian3[] = [];
const heightDiff = ref({
  point1Height: 0,
  point2Height: 0,
  diff: 0,
  horizontalDistance: 0,
  slopeDistance: 0,
});
let markerEntities: Cesium.Entity[] = [];
let labelEntity: Cesium.Entity | null = null;
let triangleEntity: Cesium.Entity | null = null;
let lineEntity: Cesium.Entity | null = null;
let lineEntities: Cesium.Entity[] = []; // 存储所有线条
let mouseHandler: Cesium.ScreenSpaceEventHandler | null = null;
const mapLoaded = ref(false);
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  mapLoaded.value = true;
  // 删除地形
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
  load3DTileset();
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
let tileset: Cesium.Cesium3DTileset | undefined;

// 加载3DTileset
const load3DTileset = async () => {
  try {
    tileset = await Cesium.Cesium3DTileset.fromUrl(
      "https://jdvop.oss-cn-qingdao.aliyuncs.com/mapv-data/titleset/lanzhou/tileset.json"
    );
    viewer.scene.primitives.add(tileset);
    tileset.initialTilesLoaded.addEventListener(function () {
      console.log("Initial tiles are loaded");
      handleClickListener();
    });
    viewer.zoomTo(tileset);
  } catch (error) {
    console.error(`Error creating tileset: ${error}`);
  }
};
const handleClear = () => {
  // 清除所有标记和结果显示
  markerEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  markerEntities = [];

  if (labelEntity) {
    viewer.entities.remove(labelEntity);
    labelEntity = null;
  }

  if (triangleEntity) {
    viewer.entities.remove(triangleEntity);
    triangleEntity = null;
  }

  if (lineEntity) {
    viewer.entities.remove(lineEntity);
    lineEntity = null;
  }

  // 清除所有线条
  lineEntities.forEach((entity) => {
    viewer.entities.remove(entity);
  });
  lineEntities = [];

  points.length = 0;
  resultVisible.value = false;
  heightDiff.value = {
    point1Height: 0,
    point2Height: 0,
    diff: 0,
    horizontalDistance: 0,
    slopeDistance: 0,
  };
};

const handleClickListener = () => {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction(
    (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!isMeasuring.value) return;
      const cartesian = viewer.scene.pickPosition(event.position);

      if (!cartesian) {
        // 如果 pickPosition 失败，尝试使用 ray 投射到椭球体
        const ray = viewer.camera.getPickRay(event.position);
        if (!ray) return;

        const ellipsoidCartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!ellipsoidCartesian) return;

        // 使用椭球体上的点
        processPickResult(ellipsoidCartesian, event.position);
        return;
      }

      processPickResult(cartesian, event.position);
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );

  mouseHandler = handler;
};
const processPickResult = (
  cartesian: Cesium.Cartesian3,
  screenPosition: Cesium.Cartesian2
) => {
  // 添加新的点
  points.push(cartesian);
  console.log("Pick result:", cartesian, screenPosition);
  // 获取笛卡尔坐标对应的地理坐标
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const height = cartographic.height;
  const elevation = viewer.scene.globe.getHeight(cartographic) || 0;
  const totalHeight = height + elevation;

  // 添加标记点
  const marker = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: 10,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
    },
    label: {
      text: `点${points.length}\n高：${totalHeight.toFixed(2)}m`,
      font: "bold 14pt monospace",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      pixelOffset: new Cesium.Cartesian2(0, -45),
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });
  markerEntities.push(marker);

  // 如果有两个点，计算高度差并绘制三角形
  if (points.length === 2) {
    calculateHeightDifference(points[0], points[1]);
    drawTriangle(points[0], points[1]);
    resultVisible.value = true;
    isMeasuring.value = false; // 测量完成后自动停止
  }
};
const calculateHeightDifference = (
  pos1: Cesium.Cartesian3,
  pos2: Cesium.Cartesian3
) => {
  const cartographic1 = Cesium.Cartographic.fromCartesian(pos1);
  const cartographic2 = Cesium.Cartographic.fromCartesian(pos2);

  // 获取两个点的高度（相对于椭球体）
  const height1 = cartographic1.height;
  const height2 = cartographic2.height;

  // 获取高程数据（地形高度）
  const elevation1 = viewer.scene.globe.getHeight(cartographic1) || 0;
  const elevation2 = viewer.scene.globe.getHeight(cartographic2) || 0;

  // 总高度 = 椭球体高度 + 地形高度
  const totalHeight1 = height1 + elevation1;
  const totalHeight2 = height2 + elevation2;

  // 高度差
  const diff = Math.abs(totalHeight1 - totalHeight2);

  // 计算水平距离（投影到海平面的距离）
  const horizontalDistance = Cesium.Cartesian3.distance(
    new Cesium.Cartesian3(pos1.x, pos1.y, pos1.z - (height1 + elevation1)),
    new Cesium.Cartesian3(pos2.x, pos2.y, pos2.z - (height2 + elevation2))
  );

  // 计算斜距（两点之间的实际距离）
  const slopeDistance = Cesium.Cartesian3.distance(pos1, pos2);

  heightDiff.value = {
    point1Height: totalHeight1,
    point2Height: totalHeight2,
    diff: diff,
    horizontalDistance: horizontalDistance,
    slopeDistance: slopeDistance,
  };
};

const drawTriangle = (pos1: Cesium.Cartesian3, pos2: Cesium.Cartesian3) => {
  const cartographic1 = Cesium.Cartographic.fromCartesian(pos1);
  const cartographic2 = Cesium.Cartographic.fromCartesian(pos2);

  // 获取两个点的高程
  const elevation1 = viewer.scene.globe.getHeight(cartographic1) || 0;
  const elevation2 = viewer.scene.globe.getHeight(cartographic2) || 0;

  // 总高度
  const totalHeight1 = cartographic1.height + elevation1;
  const totalHeight2 = cartographic2.height + elevation2;

  // 确定较高点和较低点
  const isPoint1Higher = totalHeight1 >= totalHeight2;
  const higherPoint = isPoint1Higher ? pos1 : pos2;
  const lowerPoint = isPoint1Higher ? pos2 : pos1;
  const higherCartographic = isPoint1Higher ? cartographic1 : cartographic2;
  const lowerHeight = isPoint1Higher ? totalHeight2 : totalHeight1;

  // 计算第三个点：较高点的经纬度 + 较低点的高度
  const thirdPoint = Cesium.Cartesian3.fromRadians(
    higherCartographic.longitude,
    higherCartographic.latitude,
    lowerHeight
  );

  // 绘制水平线（从较低点到第三个点）
  const horizontalLine = viewer.entities.add({
    polyline: {
      positions: [lowerPoint, thirdPoint],
      width: 3,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW,
        glowPower: 0.3,
      }),
      depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW.withAlpha(0.8),
      }),
    },
  });
  lineEntities.push(horizontalLine);

  // 绘制垂直线（从第三个点到较高点）
  const verticalLine = viewer.entities.add({
    polyline: {
      positions: [thirdPoint, higherPoint],
      width: 3,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW,
        glowPower: 0.3,
      }),
      depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW.withAlpha(0.8),
      }),
    },
  });
  lineEntities.push(verticalLine);

  // 绘制斜边（两点之间的连线）
  const slopeLine = viewer.entities.add({
    polyline: {
      positions: [lowerPoint, higherPoint],
      width: 4,
      material: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW,
        glowPower: 0.3,
      }),
      depthFailMaterial: new Cesium.PolylineGlowMaterialProperty({
        color: Cesium.Color.YELLOW.withAlpha(0.8),
      }),
    },
  });
  lineEntities.push(slopeLine);

  // 在垂直边旁边添加高度差标签
  const verticalMidpoint = Cesium.Cartesian3.midpoint(
    thirdPoint,
    higherPoint,
    new Cesium.Cartesian3()
  );

  // 计算标签位置（稍微偏移垂直边）
  const labelOffset = new Cesium.Cartesian3();
  const direction = Cesium.Cartesian3.subtract(
    verticalMidpoint,
    thirdPoint,
    new Cesium.Cartesian3()
  );
  Cesium.Cartesian3.normalize(direction, direction);
  const perpendicular = Cesium.Cartesian3.cross(
    direction,
    new Cesium.Cartesian3(0, 0, 1),
    labelOffset
  );
  Cesium.Cartesian3.normalize(perpendicular, perpendicular);
  Cesium.Cartesian3.multiplyByScalar(perpendicular, 50, perpendicular);
  const labelPosition = Cesium.Cartesian3.add(
    verticalMidpoint,
    perpendicular,
    new Cesium.Cartesian3()
  );

  labelEntity = viewer.entities.add({
    position: labelPosition,
    label: {
      text: `高度差: ${heightDiff.value.diff.toFixed(2)}m`,
      font: "bold 14pt monospace",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      pixelOffset: new Cesium.Cartesian2(0, 0),
      disableDepthTestDistance: Number.MAX_VALUE,
      backgroundColor: new Cesium.Color(0.0, 0.0, 0.0, 0.7),
      backgroundPadding: new Cesium.Cartesian2(5, 3),
    },
  });
};

onUnmounted(() => {
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  markerEntities.forEach((entity) => {
    if (viewer) {
      viewer.entities.remove(entity);
    }
  });
  if (labelEntity && viewer) {
    viewer.entities.remove(labelEntity);
  }
  if (triangleEntity && viewer) {
    viewer.entities.remove(triangleEntity);
  }
  if (lineEntity && viewer) {
    viewer.entities.remove(lineEntity);
  }
  // 清理所有线条
  lineEntities.forEach((entity) => {
    if (viewer) {
      viewer.entities.remove(entity);
    }
  });
});
</script>

<style scoped lang="scss">
.menubox {
  position: absolute;
  z-index: 999;
  border-bottom-right-radius: 10px;
  // padding: 0 10px 10px;
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
}
</style>
