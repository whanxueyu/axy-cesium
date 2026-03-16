<template>
  <div class="menubox box2">
    <el-switch
      v-model="isMeasuring"
      inline-prompt
      size="large"
      style="--el-switch-off-color: #ff4949"
      active-text="开启测量位置"
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
const measureResult = ref({
  longitude: 0,
  latitude: 0,
  height: 0,
  elevation: 0,
  modelHeight: 0,
});
let markerEntity: Cesium.Entity | null = null;
let labelEntity: Cesium.Entity | null = null;
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
  if (markerEntity) {
    viewer.entities.remove(markerEntity);
    markerEntity = null;
  }
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
    labelEntity = null;
  }
  resultVisible.value = false;
  measureResult.value = {
    longitude: 0,
    latitude: 0,
    height: 0,
    elevation: 0,
    modelHeight: 0,
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
  // 获取笛卡尔坐标对应的地理坐标
  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);

  // 获取经纬度坐标
  const longitude = Cesium.Math.toDegrees(cartographic.longitude);
  const latitude = Cesium.Math.toDegrees(cartographic.latitude);
  const height = cartographic.height; // 这是相对于椭球体的高度

  // 获取高程数据（地形高度）
  const elevation = viewer.scene.globe.getHeight(cartographic) || 0;

  // 检测是否有模型（使用 drillPick）
  let modelHeight = 0;
  let hasModel = false;
  const pickedObjects = viewer.scene.drillPick(screenPosition);

  if (pickedObjects.length > 0) {
    for (let i = 0; i < pickedObjects.length; i++) {
      const object = pickedObjects[i];

      // 检查是否是 3D Tiles 模型
      if (object instanceof Cesium.Cesium3DTileFeature) {
        const tileset = object.tileset;
        if (tileset) {
          // 获取 3D Tiles 的高度信息
          const cartographicPos = Cesium.Cartographic.fromCartesian(cartesian);
          const heightAboveGround = cartographicPos.height - elevation;
          modelHeight = heightAboveGround;
          hasModel = true;
          break;
        }
      }

      // 检查是否是 Entity 模型
      if (object.id && object.id instanceof Cesium.Entity) {
        const entity = object.id;
        if (entity.model) {
          const modelCartesian = entity.position?.getValue(
            viewer.clock.currentTime
          );
          if (modelCartesian) {
            const modelCartographic =
              Cesium.Cartographic.fromCartesian(modelCartesian);
            // const modelLng = Cesium.Math.toDegrees(modelCartographic.longitude);
            // const modelLat = Cesium.Math.toDegrees(modelCartographic.latitude);
            const modelAlt = modelCartographic.height;

            // 计算点击位置与模型底部的距离
            modelHeight = Math.abs(height - modelAlt);
            hasModel = true;
          }
          break;
        }
      }
    }
  }

  // 更新测量结果
  measureResult.value = {
    longitude: Number(longitude.toFixed(6)),
    latitude: Number(latitude.toFixed(6)),
    height: Number(height.toFixed(2)),
    elevation: Number(elevation.toFixed(2)),
    modelHeight: hasModel ? Number(modelHeight.toFixed(2)) : 0,
  };
  resultVisible.value = true;

  // 在地图上添加标记点
  if (markerEntity) {
    viewer.entities.remove(markerEntity);
  }
  markerEntity = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: 10,
      color: Cesium.Color.RED,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
    },
  });

  // 添加标签显示坐标信息
  if (labelEntity) {
    viewer.entities.remove(labelEntity);
  }
  labelEntity = viewer.entities.add({
    position: cartesian,
    label: {
      text: `经度：${longitude.toFixed(6)}°\n纬度：${latitude.toFixed(
        6
      )}°\n高度：${height.toFixed(2)}m\n高程：${elevation.toFixed(2)}m${
        hasModel ? `\n模型高：${modelHeight.toFixed(2)}m` : ""
      }`,
      font: "14pt monospace",
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      fillColor: Cesium.Color.YELLOW,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      disableDepthTestDistance: Number.MAX_VALUE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -9),
    },
  });
};
onUnmounted(() => {
  if (mouseHandler) {
    mouseHandler.destroy();
  }
  if (markerEntity && viewer) {
    viewer.entities.remove(markerEntity);
  }
  if (labelEntity && viewer) {
    viewer.entities.remove(labelEntity);
  }
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
