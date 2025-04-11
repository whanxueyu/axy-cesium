<template>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import DivBillboard from "@/modules/cesium/DivBillboard";
import lineDiv from '@/components/billboard/lineDiv.vue';
import iframeDiv from '@/components/billboard/iframeDiv.vue';
import chartDiv from '@/components/billboard/chartDiv.vue';
import Map from '@/components/cesium/map.vue'
const mapLoaded = ref(false)
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
var viewer: Cesium.Viewer
const addBillboard = () => {
    if(viewer){
        new DivBillboard(viewer,Cesium.Cartesian3.fromDegrees(116.41, 39.88, 200),'https://axy-cesium.netlify.app',iframeDiv,true)
        new DivBillboard(viewer,Cesium.Cartesian3.fromDegrees(113, 37, 100),'这是一个Vue组件',lineDiv)
        new DivBillboard(viewer,Cesium.Cartesian3.fromDegrees(120, 35, 100),'这是一个Echarts组件',chartDiv,true)
    }
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    addBillboard()
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(113.4, 22.5, 2400000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-50),
            roll: 0.0,
        },
        duration: 1
    });
}
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