
<template>
    <div id="cesiumContainer" class="fullSize"></div>
  </template>
  
  <script setup lang="ts">
  import { onMounted } from 'vue';
  import * as Cesium from "cesium";
  import 'cesium/Source/Widgets/widgets.css';
  var viewer = null
  Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
  
  onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
      terrain: Cesium.Terrain.fromWorldTerrain(),     
    });
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