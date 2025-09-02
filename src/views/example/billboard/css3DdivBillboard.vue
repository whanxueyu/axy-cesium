<template>
    <div class="cesium-app">
        <Map @loaded="handleMapLoaded"></Map>
        <div class="control-panel" v-if="showControls">
            <h3>CSS3D Earth Controls</h3>
            <button @click="toggleCSS3DVisibility">
                {{ css3dVisible ? 'Hide' : 'Show' }} CSS3D Earth
            </button>
            <button @click="reset">Reset View</button>
            <button @click="toggleControls">Hide Controls</button>
        </div>

        <button class="control-toggle" v-if="!showControls" @click="toggleControls">
            Show Controls
        </button>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import DivBillboard from "@/modules/cesium/DivBillboard";
import { CSS3DEarthSync } from '@/modules/cesium/css3DRender';
import lineDiv from '@/components/billboard/lineDiv.vue';
import iframeDiv from '@/components/billboard/iframeDiv.vue';
import chartDiv from '@/components/billboard/chartDiv.vue';
import Map from '@/components/cesium/map.vue'
const mapLoaded = ref(false)
const showControls = ref(true);
const css3dVisible = ref(true);
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
var viewer: Cesium.Viewer
let css3dSync: CSS3DEarthSync | null = null;
const cesiumContainer = ref<HTMLElement | null>(null);
const addBillboard = () => {
    if (viewer) {
        new DivBillboard(viewer, Cesium.Cartesian3.fromDegrees(116.41, 39.88, 200), 'https://axy-cesium.netlify.app', iframeDiv, true)
        new DivBillboard(viewer, Cesium.Cartesian3.fromDegrees(113, 37, 100), '这是一个Vue组件', lineDiv)
        new DivBillboard(viewer, Cesium.Cartesian3.fromDegrees(120, 35, 100), '这是一个Echarts组件', chartDiv, true)
    }
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    cesiumContainer.value = document.getElementById('cesiumContainer');
    viewer = MapViewer;
    // addBillboard()
    mapLoaded.value = true;
    reset()
    initCSS3DEarth()
}
// 初始化CSS3D地球
const initCSS3DEarth = () => {
    if (!viewer || !cesiumContainer.value) return;

    css3dSync = new CSS3DEarthSync(viewer, cesiumContainer.value, {
        radius: 6378137, // 地球半径(米)
        enableDebug: true // 显示球体网格线，便于调试
    });
};

// 控制方法
const toggleCSS3DVisibility = () => {
    if (css3dSync) {
        css3dVisible.value = !css3dVisible.value;
        css3dSync.setVisibility(css3dVisible.value);
    }
};

const resetView = () => {
    if (viewer) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(-75.1641667, 39.9522222, 5000000),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-45),
                roll: 0
            },
            duration: 2
        });
    }
};

const toggleControls = () => {
    showControls.value = !showControls.value;
};
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

.cesium-app {
    width: 100vw;
    height: 100vh;
    position: relative;
    overflow: hidden;
}

#cesiumContainer {
    width: 100%;
    height: 100%;
}

.control-panel {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 1000;
    background: rgba(42, 42, 42, 0.8);
    padding: 15px;
    border-radius: 8px;
    color: white;
    font-family: Arial, sans-serif;
    min-width: 200px;
}

.control-panel h3 {
    margin-top: 0;
    margin-bottom: 15px;
}

.control-panel button {
    display: block;
    width: 100%;
    margin-bottom: 10px;
    padding: 8px 12px;
    background: #007acc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
}

.control-panel button:hover {
    background: #005a9e;
}

.control-toggle {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 1000;
    padding: 8px 12px;
    background: rgba(42, 42, 42, 0.8);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
</style>