<template>
    <div id="cesiumContainer" class="fullSize"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
var viewer = null
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

onMounted(async () => {
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
    if (viewer.imageryLayers.length > 0)
        viewer.imageryLayers.removeAll();
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
    let gridOptions = {
        color: Cesium.Color.fromCssColorString('#ccc'),
        backgroundColor: Cesium.Color.fromCssColorString('#00000000'),
        glowColor: Cesium.Color.fromCssColorString('#666'),
        glowWidth: 1,
        cells: 2
    }
    var GridImagery = new Cesium.GridImageryProvider(gridOptions);
    viewer.imageryLayers.addImageryProvider(GridImagery);
    viewer.scene.globe.baseColor = Cesium.Color.BLACK;
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