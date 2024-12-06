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
    let tdtMap = new Cesium.WebMapTileServiceImageryProvider({
        //影像底图
        url:
            'https://t{s}.tianditu.gov.cn/vec_w/wmts?service=WMTS&request=GetTile&version=1.0.0&layer=vec&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=' +
            '436ce7e50d27eede2f2929307e6b33c0',
        layer: 'tdt_imgLayer',
        style: 'default',
        subdomains: ['1', '2', '3', '4', '5', '6', '7'],
        tileWidth: 256,
        tileHeight: 256,
        tileMatrixSetID: 'GoogleMapsCompatible', //使用谷歌的瓦片切片方式
        maximumLevel: 24,
    })
    viewer.imageryLayers.addImageryProvider(tdtMap)
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