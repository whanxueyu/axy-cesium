<template>
  <div class="menu">
    <el-radio-group v-model="imgIndex" @change="changeImage">
      <el-radio :value="0">影像地图</el-radio>
      <el-radio :value="1">矢量地图</el-radio>
      <el-radio :value="2">其他地图</el-radio>
    </el-radio-group>
  </div>
  <div id="cesiumContainer" class="fullSize"></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
const imgIndex = ref(0);
const imgList = ref([
  "/public/textures/earthbg.png",
  "/public/textures/earthblue.png",
  "/public/textures/xiaoba.jpg",
]);
const viewer = ref();
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const changeImage = () => {
  if (viewer.value.imageryLayers.length > 0)
    viewer.value.imageryLayers.removeAll();
  // 方法 1: 使用 SingleTileImageryProvider 加载单张图片
  const singleTileProvider = new Cesium.SingleTileImageryProvider({
    url: imgList.value[imgIndex.value], // 替换为你的图片路径
    tileWidth: 256,
    tileHeight: 256,
  });

  // 将图片图层添加到底图
  viewer.value.imageryLayers.addImageryProvider(singleTileProvider);
};
onMounted(() => {
  // 初始化 Viewer，关闭默认图层
  viewer.value = new Cesium.Viewer("cesiumContainer", {
    baseLayerPicker: false, // 关闭底图选择器
    terrainProvider: undefined, // 可选：是否加载地形
    animation: false, // 隐藏动画控件
    timeline: false, // 隐藏时间轴
    fullscreenButton: false, // 隐藏全屏按钮
    vrButton: false, // 隐藏 VR 按钮
    geocoder: false, // 隐藏地名搜索
    homeButton: false, // 隐藏主页按钮
    infoBox: false, // 隐藏信息框
    sceneModePicker: false, // 隐藏场景模式选择器
    selectionIndicator: false, // 隐藏选择指示器
    navigationHelpButton: false, // 隐藏导航帮助按钮
    shouldAnimate: true, // 开启动画
  });
  if (viewer.value.imageryLayers.length > 0)
    viewer.value.imageryLayers.removeAll();
  // 方法 1: 使用 SingleTileImageryProvider 加载单张图片
  const singleTileProvider = new Cesium.SingleTileImageryProvider({
    url: imgList.value[imgIndex.value], // 替换为你的图片路径
    tileWidth: 256,
    tileHeight: 256,
  });

  // 将图片图层添加到底图
  viewer.value.imageryLayers.addImageryProvider(singleTileProvider);

  // 设置相机视角到中国区域
  viewer.value.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(104.0, 36.0, 10000000), // 经度，纬度，高度（米）
    orientation: {
      heading: Cesium.Math.toRadians(0.0), // 方向：正北
      pitch: Cesium.Math.toRadians(-90.0), // 俯仰角：垂直向下
      roll: 0.0, // 翻滚角：无旋转
    },
  });
  console.log(viewer.value.imageryLayers.get(0));
});
</script>

<style scoped>
.menu {
  position: absolute;
  top: 20px;
  left: 20px;
  background-color: rgb(255, 255, 255);
  z-index: 9;
  padding: 10px 20px;
  border-radius: 5px;
}
.fullSize {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
