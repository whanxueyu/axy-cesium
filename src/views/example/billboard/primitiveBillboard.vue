<template>
  <div id="cesiumContainer" class="fullSize"></div>
  <div class="operation">
    <span>随机生成点位</span>
    <el-input-number :min="1" v-model="pointNum" :step="100"></el-input-number>
    <el-button type="primary" @click="">生成</el-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import markList from '@/assets/images/marker/index'
import 'cesium/Source/Widgets/widgets.css';

var viewer: Cesium.Viewer;
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const pointNum = ref(10000);
const createBillboards = () => {
  const billboardCollection = new Cesium.BillboardCollection()
  for (let i = 0; i < pointNum.value; i++) {
    const longitude = Math.random() * (110 - 90) + 90;
    const latitude = Math.random() * (40 - 30) + 30;
    billboardCollection.add({
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, 10),
      image: markList.LaceRed,
      scale: 0.5,
      disableDepthTestDistance: 10,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    });
  }
  viewer.scene.primitives.add(billboardCollection)
};

onMounted(() => {
  viewer = new Cesium.Viewer("cesiumContainer", {
    // terrain: Cesium.Terrain.fromWorldTerrain(),
  });
  createBillboards();

});
</script>

<style scoped>
.fullSize {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.operation{
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: #fff;
  width: 200px;
}
</style>