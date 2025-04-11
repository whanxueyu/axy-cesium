<template>
  <div class="operation">
    <span>随机生成点位</span>
    <el-input-number :min="1" v-model="pointNum" :step="100"></el-input-number>
    <el-button type="primary" @click="">生成</el-button>
  </div>
  <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import markList from '@/assets/images/marker/index'
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue'
const mapLoaded = ref(false)
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

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    createBillboards()
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(101.405, 36.5, 2500000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0,
        },
        duration: 1
    });
}
</script>

<style scoped>
.operation{
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: #fff;
  width: 200px;
  z-index: 9999;
}
</style>