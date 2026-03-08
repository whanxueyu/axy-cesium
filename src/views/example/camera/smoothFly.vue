<template>
  <div class="menubox">
    <el-checkbox v-model="smoothFly" @change="handleSmoothFly"
      >丝滑加载</el-checkbox
    >
    <div>如果对比效果不明显</div>
    <div>请清空浏览器缓存</div>
    <div>或禁用图片缓存</div>
  </div>
  <div id="cesiumContainer" ref="cesiumContainer"></div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import * as Cesium from "cesium";
import { ElMessageBox } from "element-plus";
import "cesium/Source/Widgets/widgets.css";
var viewer: Cesium.Viewer;

const smoothFly = ref("false");

const mapLoaded = ref(false);
const initCesium = () => {
  Cesium.Ion.defaultAccessToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
  viewer = new Cesium.Viewer("cesiumContainer", {
    infoBox: false,
    selectionIndicator: false,
    sceneModePicker: false,
    animation: false, //左下角的动画仪表盘
    baseLayerPicker: false, //右上角的图层选择按钮
    geocoder: false, //搜索框
    homeButton: false, //home按钮
    timeline: false, //底部的时间轴
    navigationHelpButton: false, //右上角的帮助按钮，
    fullscreenButton: false,
    terrain: Cesium.Terrain.fromWorldTerrain({
      requestWaterMask: true,
      requestVertexNormals: true,
    }),
  });
  viewer.scene.screenSpaceCameraController.zoomEventTypes = [
    Cesium.CameraEventType.WHEEL,
    Cesium.CameraEventType.PINCH,
  ];
  viewer.scene.screenSpaceCameraController.tiltEventTypes = [
    Cesium.CameraEventType.PINCH,
    Cesium.CameraEventType.RIGHT_DRAG,
  ];
  viewer.cesiumWidget.creditContainer.setAttribute("style", "display:none;");
  viewer.scene.screenSpaceCameraController.enableRotate = true; //拖拽旋转
  viewer.scene.screenSpaceCameraController.enableTilt = true; //右键拖拽倾斜

  let tdtMap = new Cesium.WebMapTileServiceImageryProvider({
    //影像底图
    url:
      "https://t{s}.tianditu.gov.cn/img_w/wmts?service=WMTS&request=GetTile&version=1.0.0&layer=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=" +
      "436ce7e50d27eede2f2929307e6b33c0",
    subdomains: ["1", "2", "3", "4", "5", "6", "7"], //URL模板中用于{s}占位符的子域。如果该参数是单个字符串，则字符串中的每个字符都是一个子域。如果它是一个数组，数组中的每个元素都是一个子域
    layer: "tdt_imgLayer",
    style: "default",
    format: "image/jpeg",
    tileWidth: 256,
    tileHeight: 256,
    tileMatrixSetID: "GoogleMapsCompatible", //使用谷歌的瓦片切片方式
    maximumLevel: 18,
  });
  viewer.imageryLayers.addImageryProvider(tdtMap);
  var helper = new Cesium.EventHelper();
  if (smoothFly.value === "true") {
    helper.add(viewer.scene.globe.tileLoadProgressEvent, function (e) {
      if (e == 0) {
        console.log("矢量切片加载完成时的回调");
        if (!mapLoaded.value) {
          nextTick(() => {
            // 首次加载完成
            reset();
          });
          mapLoaded.value = true;
        }
      }
    });
  } else {
    reset();
    mapLoaded.value = true;
  }
};
const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(105, 35, 100000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
    duration: 8,
  });
};
const handleSmoothFly = (val: boolean) => {
  ElMessageBox.confirm("切换后将重新加载地图查看效果，确定要切换吗？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  }).then(() => {
    smoothFly.value = val ? "true" : "false";
    sessionStorage.setItem("smoothFly", val ? "true" : "false"); // Store the value as a string
    // 清空浏览器地图瓦片缓存

    nextTick(() => {
      window.location.reload();
    });
  });
};

onMounted(() => {
  smoothFly.value = sessionStorage.getItem("smoothFly") === "true" ? "true" : "false";
  console.log("smoothFly:", smoothFly.value, sessionStorage.getItem("smoothFly"));
  nextTick(() => {
    initCesium();
  });
});
</script>

<style lang="scss" scoped>
#cesiumContainer {
  width: 100vw;
  height: 100vh;
}

.menubox {
  position: fixed;
  z-index: 1004;
  background-color: rgba(9, 33, 49, 0.8);
  padding: 5px 10px;
  border-radius: 2px;
}
</style>
