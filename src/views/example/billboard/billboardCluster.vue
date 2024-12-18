<template>
  <div id="cesiumContainer" class="fullSize"></div>
  <div class="operation">
    <span>随机生成点位</span>
    <el-input-number :min="1" v-model="pointNum" :step="100"></el-input-number>
    <el-button type="primary" @click="handleAdd">生成</el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import * as Cesium from "cesium";
import markList from '@/assets/images/marker/index'
import 'cesium/Source/Widgets/widgets.css';
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const dataSource = ref()
const pointNum = ref(500);
const handleAdd = () => {
  viewer.entities.removeAll()
  dataSource.value.entities.removeAll()
  addEntityCluster()
}
const addEntityCluster = () => {
  dataSource.value = new Cesium.CustomDataSource("poi")
  const entities = [];
  for (let i = 0; i < pointNum.value; i++) {
    const longitude = Math.random() * (110 - 90) + 90;
    const latitude = Math.random() * (40 - 30) + 30;
    const entity = new Cesium.Entity({
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
      billboard: {
        image: markList.LaceRed,
        scale: 0.5,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 500000, // 禁用深度测试
        // heightReference: Cesium.HeightReference.CLAMP_TO_GROUND // 使 billboard 始终显示在地形上方
      }
    });
    entities.push(entity);
    dataSource.value.entities.add(entity);
  }
  viewer.dataSources.add(dataSource.value)
  combineListener()
  nextTick(() => {
    viewer.zoomTo(dataSource.value)
  })
}
const combineListener = () => {
  dataSource.value.clustering.enabled = true;
  dataSource.value.clustering.pixelRange = 40;
  dataSource.value.clustering.minimumClusterSize = 2;

  dataSource.value.clustering.clusterEvent.addEventListener(function (
    clusteredEntities: Cesium.Entity[],
    cluster: Cesium.Entity | any
  ) {
    // 关闭自带的显示聚合数量的标签
    cluster.label.show = true;
    cluster.label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
    cluster.label.pixelOffset = new Cesium.Cartesian2(0, 8);
    cluster.label.font = '20px sans-serif'
    cluster.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
    // cluster.label.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
    cluster.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    cluster.label.zIndex = 999;
    cluster.billboard.show = true;
    cluster.billboard.id = cluster.label.id;
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
    cluster.billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER;
    cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
    // cluster.billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND
    cluster.billboard.zIndex = 1;

    // 根据聚合数量的多少设置不同层级的图片以及大小
    if (clusteredEntities.length >= 100) {
      cluster.billboard.image = markList.M5;
      cluster.billboard.width = 60;
      cluster.billboard.height = 60;
    } else if (clusteredEntities.length >= 50) {
      cluster.billboard.image = markList.M4;
      cluster.billboard.width = 55;
      cluster.billboard.height = 55;
    } else if (clusteredEntities.length >= 20) {
      cluster.billboard.image = markList.M3
      cluster.billboard.width = 50;
      cluster.billboard.height = 50;
    } else if (clusteredEntities.length >= 10) {
      cluster.billboard.image = markList.M2
      cluster.billboard.width = 45;
      cluster.billboard.height = 45;
    } else {
      cluster.billboard.image = markList.M1
      cluster.billboard.width = 45;
      cluster.billboard.height = 45;
    }
  });
}
onMounted(() => {
  viewer = new Cesium.Viewer("cesiumContainer", {
    // terrain: Cesium.Terrain.fromWorldTerrain(),
  });
  addEntityCluster()
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