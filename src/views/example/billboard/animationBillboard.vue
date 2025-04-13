<template>
    <div class="side-panel">
        <el-button @click="addFallingBillboard">下落标牌</el-button>
        <el-button @click="addScaleBillboard">缩放标牌</el-button>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import markList from "@/assets/images/marker";
import Map from '@/components/cesium/map.vue'
const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const dataList = [
    {
        id: '10',
        name: "高度跳动",
        position: [116.4, 39.9],
        image: markList.LaceBlue
    },
    {
        id: '11',
        name: "偏移跳动",
        position: [116.4, 39.8],
        image: markList.LaceBlue
    },
    {
        id: '111',
        name:"html",
        position: [116.4, 39.8, 10],
    }
]
// 测试代码
// const addLine = () => {
//     viewer.entities.add({
//             id: "test-line-20250413-zoom",
//             polyline: {
//     positions: Cesium.Cartesian3.fromDegreesArray([115.3, 38.9, 116.4, 39.9, 116.4, 39.8]), 
//     width: 5,
//     material: Cesium.Color.RED,
//   },
//     })
// }
// const location = () => {
//     const entity = viewer?.entities?.getById("test-line-20250413-zoom");
//     if (entity) {
//         viewer.zoomTo(entity)
//     }
// }
const checkList = ref<string[]>()
checkList.value = dataList.map(item => item.id)
let offset = 0;
const addFallingBillboard = () => {
    viewer?.entities?.removeAll();
    const startTime = Cesium.JulianDate.now();
    pointList.value.forEach(item => {
        viewer.entities.add({
            id: item.id,
            name: item.name,
            position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude, 0),
            billboard: {
                image: markList.LaceBlue,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                pixelOffset: new Cesium.CallbackProperty(
                    (time) => {
                        if (!time) return new Cesium.Cartesian2(0, 0);
                        
                        const deltaTime = Cesium.JulianDate.secondsDifference(time, startTime);
                        if (deltaTime > 2.0) {
                            return new Cesium.Cartesian2(0, 0);
                        }
                        // 下落阶段（0~1秒）
                        if (deltaTime <= 1) {
                            offset = 100 - 100 * deltaTime*deltaTime; // 下落轨迹：50像素/1秒²
                        }
                        // 反弹阶段（1~2秒）
                        else if(deltaTime <= 1.5) {
                            offset = 50 * (deltaTime - 1); // 反弹轨迹：从50像素回弹到0
                        }else {
                            offset = 50 * (2 - deltaTime); // 反弹轨迹：从50像素回弹到0   
                        }
                        return new Cesium.Cartesian2(0, -offset);
                    },
                    false
                )
            }
        });
    });
};
var flag = true;
const addScaleBillboard = () => {
    viewer?.entities?.removeAll();
    let entityScale = 1;
    pointList.value.forEach(item => {
        viewer.entities.add({
            id: item.id,
            name: item.name,
            position: Cesium.Cartesian3.fromDegrees(item.longitude, item.latitude, 0),
            billboard: {
                image: markList.LaceBlue,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                scale: new Cesium.CallbackProperty(
                    () => {
                        if (flag) {
                            entityScale -= 0.00001;
                            if (entityScale < 0.5) {
                                flag = false;
                            }
                        } else {
                            entityScale += 0.00001;
                            if (entityScale > 1) {
                                flag = true;
                            }
                        }
                        return entityScale;
                    },
                    false
                )
            }
        });
    });
};


const pointList = ref<{
    longitude: number,
    latitude:number,
    id: string,
    name: string
}[]>([])
const getRandomPoint = () => {
    for (let i = 0; i < 1000; i++) {
        // 经度范围：115 ~ 118（覆盖北京+天津）
        const longitude = Math.random() * (118 - 115) + 115;
        // 纬度范围：38 ~ 41（覆盖北京+天津）
        const latitude = Math.random() * (41 - 38) + 38;
        pointList.value.push({
            longitude,
            latitude,
            id: i + '-pb',
            name: 'poi' + i
        });
    }
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    getRandomPoint()
    mapLoaded.value = true;
    viewer.clock.shouldAnimate = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 250000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-80),
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
.custom-tree-node{
    width: 100%;
    display: flex;
    justify-content: space-between;
}
.node-name{
    width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: start;
}
</style>