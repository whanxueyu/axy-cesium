<template>
    <div id="cesiumContainer" ref="cesiumContainer"></div>
    <base-layer v-if="mapLoaded && viewer" :viewer="viewer" map-type="tdt"></base-layer>
    <status-bar v-if="mapLoaded && viewer" :viewer="viewer"></status-bar>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import baseLayer from '@/components/cesium/baseLayer.vue'
import Compass from '@/modules/compass/compass'
import statusBar from "@/components/cesium/status-bar.vue";
var viewer: Cesium.Viewer | null = null;
const mapLoaded = ref(false)
const initCesium = () => {
    Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
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
        terrain: Cesium.Terrain.fromWorldTerrain({
            requestWaterMask: true,
            requestVertexNormals: true,
        }),
        orderIndependentTranslucency: false, //去掉大气层黑圈
        contextOptions: {
            webgl: {
                alpha: true,
            }
        },
    });
    mapLoaded.value = true;
    viewer.imageryLayers.removeAll();
    viewer.scene.screenSpaceCameraController.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
    viewer.scene.screenSpaceCameraController.tiltEventTypes = [Cesium.CameraEventType.PINCH, Cesium.CameraEventType.RIGHT_DRAG];
    (viewer.cesiumWidget.creditContainer as HTMLBaseElement).style.display = "none";
    // viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableRotate = true; //拖拽旋转
    viewer.scene.screenSpaceCameraController.enableTilt = true; //右键拖拽倾斜

    viewer.scene.skyBox.show = false;
    viewer.scene.backgroundColor = new Cesium.Color(0.0, 0.0, 0.0, 0.0);
    new Compass(viewer)
}

onMounted(() => {
    initCesium()
})
</script>

<style lang="scss" scoped>
#cesiumContainer {
    width: 100vw;
    background-image: url("@/assets/images/skybox/lxy.jpg");
    height: 100vh;
}
</style>