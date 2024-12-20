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
  const pinBuilder = new Cesium.PinBuilder()

  dataSource.value.clustering.clusterEvent.addEventListener(function (
    clusteredEntities: Cesium.Entity[],
    cluster: Cesium.Entity | any
  ) {
    cluster.label.show = false
    cluster.billboard.show = true
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM
    
    let size = clusteredEntities.length;
    let color = Cesium.Color.RED;
    if (clusteredEntities.length >= 100) {
      size = 60;
      color = Cesium.Color.ORANGERED;
    } else if (clusteredEntities.length >= 50) {
      size = 55;
      color = Cesium.Color.ORANGE;
    } else if (clusteredEntities.length >= 20) {
      size = 50;
      color = Cesium.Color.YELLOW;
    } else if (clusteredEntities.length >= 10) {
      size = 45;
      color = Cesium.Color.GREENYELLOW;
    } else {
      size = 40;
      color = Cesium.Color.SKYBLUE;
    }
    let pinImg = pinBuilder.fromText(cluster.label.text, color, size).toDataURL()
    // 根据聚合数量的多少设置不同层级的图片以及大小
    cluster.billboard.image = pinImg;
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

.operation {
  position: fixed;
  top: 20px;
  left: 20px;
  background-color: #fff;
  width: 200px;
}
</style>