<template>
    <div id="cesiumContainer" class="fullSize"></div>
    <baseLayer v-if="inited" :viewer="viewer"></baseLayer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import baseLayer from '@/components/cesium/baseLayer.vue';
var viewer: Cesium.Viewer;
const inited = ref(false);
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
        infoBox: false,
        selectionIndicator: false,
        sceneModePicker: false,
        animation: false,    //左下角的动画仪表盘
        baseLayerPicker: false,  //右上角的图层选择按钮
        geocoder: false,  //搜索框
        homeButton: false,  //home按钮
        timeline: false,    //底部的时间轴
        navigationHelpButton: false,  //右上角的帮助按钮，
        fullscreenButton: false,
        terrain: Cesium.Terrain.fromWorldTerrain(),
    });
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
    inited.value = true
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