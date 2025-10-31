<template>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue';
import radarEffectAppearance from "@/modules/cesium/radarEffectAppearance";

const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const radarList = [
    {
        id: 1,
        name: "雷达1",
        position: [116.388, 39.91],
        radius: 100,
        color: "#ffff0f",
        length: 250,
        count: 15,
        thickness: 0.5,
    },
    {
        id: 2,
        name: "雷达2",
        position: [116.405, 39.91],
        radius: 500,
        color: "#ff3666",
        length: 1000,
        count: 30,
        thickness: 0.3,
    },
    {
        id: 3,
        name: "雷达3",
        position: [116.39, 39.897],
        radius: 300,
        color: "#00cfff99",
        length: 800,
        count: 20,
        thickness: 0.2,
    },
    {
        id: 4,
        name: "雷达4",
        position: [116.415, 39.896],
        radius: 250,
        color: "#0fff0f",
        length: 500,
        count: 10,
        thickness: 0.1,
    },
]
const handleDrawRadar = () => { 
    radarList.forEach((item)=>{
        drawRadar(item)
    })
}
const drawRadar = (option: {
    id: number;
    name: string;
    position: number[];
    radius: number;
    color: string;
    length: number;
    count: number;
    thickness: number;
}) => {
    var scene = viewer.scene
    // 雷达位置计算
    // 雷达的高度
    var length = option.length
    // 地面位置(垂直地面)
    var positionOnEllipsoid = Cesium.Cartesian3.fromDegrees(option.position[0], option.position[1])
    // 矩阵计算
    var modelMatrix = Cesium.Matrix4.multiplyByTranslation(
        Cesium.Transforms.eastNorthUpToFixedFrame(positionOnEllipsoid),
        new Cesium.Cartesian3(0.0, 0.0, length * 0.5),
        new Cesium.Matrix4()
    )
    //  创建雷达放射波
    //  先创建Geometry
    var cylinderGeometry = new Cesium.CylinderGeometry({
        length: length,
        topRadius: 0.0,
        bottomRadius: option.radius,
        vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    })
    //  创建GeometryInstance
    var redCone = new Cesium.GeometryInstance({
        geometry: cylinderGeometry,
        modelMatrix: modelMatrix,
    })
    //  创建Primitive
    var radar = scene.primitives.add(
        new Cesium.Primitive({
            geometryInstances: redCone,
            appearance: radarEffectAppearance(Cesium.Color.fromCssColorString(option.color),option.count,option.thickness),
        })
    )

    // 动态修改雷达材质中的offset变量，从而实现动态效果。
    viewer.scene.preUpdate.addEventListener(function () {
        var offset = radar.appearance.material?.uniforms?.offset;
        offset -= 0.001
        if (offset > 1.0) {
            offset = 0.0
        }
        radar.appearance.material.uniforms.offset = offset
    })
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    handleDrawRadar();
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 2500),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-40),
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
</style>