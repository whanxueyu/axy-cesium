<template>
    <div id="cesiumContainer" ref="cesiumContainer"></div>
    <base-layer v-if="mapLoaded && viewer" :viewer="viewer" :map-type="props.mapType"></base-layer>
    <status-bar v-if="mapLoaded && viewer" :viewer="viewer"></status-bar>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, defineEmits } from "vue";
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import baseLayer from '@/components/cesium/baseLayer.vue'
import Compass from '@/modules/compass/compass'
import statusBar from "./status-bar.vue";
var viewer: Cesium.Viewer | null = null;
const props = defineProps({
    // 默认经纬度
    lazy: {
        type: Boolean,
        default: false
    },
    duration: {
        type: Number,
        default: 8
    },
    // 默认地图类型
    mapType: {
        type: String,
        default: 'tdt'
    }
})
const emits = defineEmits(['loaded'])
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
    });
    viewer.scene.screenSpaceCameraController.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH];
    viewer.scene.screenSpaceCameraController.tiltEventTypes = [Cesium.CameraEventType.PINCH, Cesium.CameraEventType.RIGHT_DRAG];
    (viewer.cesiumWidget.creditContainer as HTMLBaseElement).style.display = "none";
    // viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableRotate = true; //拖拽旋转
    viewer.scene.screenSpaceCameraController.enableTilt = true; //右键拖拽倾斜
    new Compass(viewer)
    var helper = new Cesium.EventHelper();
    if (props.lazy) {
        helper.add(viewer.scene.globe.tileLoadProgressEvent, function (e) {
            if (e == 0) {
                console.log("矢量切片加载完成时的回调");
                if (!mapLoaded.value) {
                    nextTick(() => {
                        // 首次加载完成
                        reset()
                    })
                    mapLoaded.value = true;
                    emits('loaded', viewer)
                }
            }
        });
    } else {
        reset()
        mapLoaded.value = true;
        emits('loaded', viewer)
    }
}
const reset = () => {
    if (viewer)
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(105, 35, 10000000),
            orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-90),
                roll: 0.0,
            },
            duration: props.duration
        });
}

onMounted(() => {
    // 禁用浏览器默认右键菜单，避免与自定义操作冲突
    document.oncontextmenu = (event) => {
        event.preventDefault();
        return false;
    };
    initCesium()
})
</script>

<style lang="scss" scoped>
#cesiumContainer {
    width: 100vw;
    height: 100vh;
}


.popmenu {
    position: fixed;
    z-index: 1004;
    background-color: rgba(9, 33, 49, 0.8);
    padding: 5px 10px;
    border-radius: 2px;
}
</style>