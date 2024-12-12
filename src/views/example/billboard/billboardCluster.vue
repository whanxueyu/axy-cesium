
<template>
    <div id="cesiumContainer" class="fullSize"></div>
  </template>
  
  <script setup lang="ts">
  import { onMounted } from 'vue';
  import * as Cesium from "cesium";
  import 'cesium/Source/Widgets/widgets.css';
  var viewer:Cesium.Viewer
  Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
  const addBillboard = () => {
    const data = [
      {
        id: 1,
        name: "1",
        position: [116.4, 39.9],
        color: "#ff0000",
        scale: 1,
        image: "https://gw.alipayobjects.com/zos/rmsportal/KDpgvguMpGfqaHPjicRK.svg"
      }
    ]
    data.forEach(item => {
      const billboard = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(item.position[0], item.position[1]),
        billboard: {
          image: item.image,
          scale: item.scale,
          color: Cesium.Color.fromCssColorString(item.color),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        }
      })
      viewer.zoomTo(billboard)
    })
  }
  onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
      terrain: Cesium.Terrain.fromWorldTerrain(),     
    });
    addBillboard()
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
  </style>