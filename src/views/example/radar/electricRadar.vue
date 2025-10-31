<template>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue';
import EllipsoidElectricMaterialProperty from "@/modules/cesium/EllipsoidElectricMaterial";

const mapLoaded = ref(false)
var viewer: Cesium.Viewer;
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const radarList = [
    {
        id: 1,
        name: "雷达1",
        position: [116.388, 39.91],
        radius: 500,
        color: "#ffff0f",
        speed: 5,
    },
    {
        id: 2,
        name: "雷达2",
        position: [116.405, 39.91],
        radius: 1000,
        color: "#ff0f0f",
        speed: 2,
    },
    {
        id: 3,
        name: "雷达3",
        position: [116.39, 39.897],
        radius: 800,
        color: "#00cfff",
        speed: 10,
    },
    {
        id: 4,
        name: "雷达4",
        position: [116.415, 39.896],
        radius: 500,
        color: "#0fff0f",
        speed: 20,
    },

]
const drawCircleWaveRadar = () => {
    viewer.scene.postProcessStages.fxaa.enabled = true

    radarList.forEach((item) => {
        viewer.entities.add({
            id: item.id+"",
            position: Cesium.Cartesian3.fromDegrees(item.position[0], item.position[1]),
            ellipsoid: {
                radii: new Cesium.Cartesian3(item.radius, item.radius, item.radius),
                material: new EllipsoidElectricMaterialProperty({
                    color: Cesium.Color.fromCssColorString(item.color),
                    speed: item.speed
                })
            }
        })
    })
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    drawCircleWaveRadar()
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 3000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-40),
            roll: 0.0,
        }
    });
}
</script>

<style scoped>
.side-panel {
    position: absolute;
    padding: 10px;
    top: 10px;
    left: 10px;
    background-color: rgba(255, 255, 255, 0.8);
    z-index: 999;
}

.custom-tree-node {
    width: 100%;
    display: flex;
    justify-content: space-between;
}

.node-name {
    width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
}
</style>