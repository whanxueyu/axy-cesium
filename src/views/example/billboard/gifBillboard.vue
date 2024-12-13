<template>
    <div id="cesiumContainer" class="fullSize"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import gifList from "@/assets/images/particle";
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const dataList = [
    {
        id: '10',
        name: "爆炸",
        position: [116.4, 39.9],
        scale: 1,
        width: 500,
        height: 500,
        image: gifList.Bomb
    },
    {
        id: '11',
        name: "紧急",
        position: [116.41, 39.9],
        scale: 1,
        width: 500,
        height: 500,
        image: gifList.Emergency
    },
    {
        id: '12',
        name: "台风",
        position: [116.42, 39.9],
        scale: 1,
        width: 500,
        height: 500,
        image: gifList.Tf
    },
]
const addBillboard = () => {
    dataList.forEach(item => {
        const billboard = viewer.entities.add({
            name: item.name,
            position: Cesium.Cartesian3.fromDegrees(item.position[0], item.position[1], 50),
            billboard: {
                width: item.width,
                height: item.height,
                scale: item.scale,
                sizeInMeters: true
            }
        })
        if (billboard && billboard.billboard) {
            let gif = window.gifler(item.image)
            gif.frames(document.createElement('canvas'), function (ctx:any, frame: {
                buffer: HTMLCanvasElement;
                duration: number;
            }) {
                ctx;
                billboard.billboard!.image = new Cesium.CallbackProperty(() => {
                    return frame.buffer.toDataURL()
                }, false)
            })
        }
        viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(116.41, 39.88, 2000), 2000))
    })
}
onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
    });
    addBillboard()
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