<template>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="dataList" :props="defaultProps" show-checkbox
            :default-checked-keys="checkList" @check-change="checkListChange" default-expand-all>
            <template #default="{ data }">
                <div class="custom-tree-node flex-sb-center" @dblclick="location(data)">
                    <div class="node-name">{{ data.name }}</div>
                    <div @click="location(data)">
                        <el-icon size="16" color="#ff404E">
                            <Location />
                        </el-icon>
                    </div>
                </div>
            </template>
        </el-tree>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import gifList from "@/assets/images/particle";
import Map from '@/components/cesium/map.vue'
const mapLoaded = ref(false)
var viewer: Cesium.Viewer;
const defaultProps = {
    children: "children",
    label: "name",
};
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
type Billboard = {
    id: string;
    name: string;
    position: number[];
    scale: number;
    width: number;
    height: number;
    image: string;
}
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
        billboardMap[item.id] = billboard;
        viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(116.41, 39.88, 2000), 2000))
    })
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    addBillboard()
    mapLoaded.value = true;
    reset()
    
}
var billboardMap: { [key: string]: any } = {}
const checkListChange = (value:Billboard, check: boolean) => {
    const entity = billboardMap[value.id];
    if (entity) {
        entity.show = check
    }
}
const location = (data:Billboard) => {
    const entity = billboardMap[data.id];
    if (entity) {
        viewer.zoomTo(entity)
    }
}
const checkList = ref<string[]>()
checkList.value = dataList.map(item => item.id)
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.41, 39.9, 4000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
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