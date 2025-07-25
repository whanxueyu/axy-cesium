<template>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="divList" :props="defaultProps" show-checkbox
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
import DivBillboard from "@/modules/cesium/DivBillboard";
import lineDiv from '@/components/billboard/lineDiv.vue';
import iframeDiv from '@/components/billboard/iframeDiv.vue';
import chartDiv from '@/components/billboard/chartDiv.vue';
import Map from '@/components/cesium/map.vue'
const defaultProps = {
    children: "children",
    label: "name",
};
const mapLoaded = ref(false)
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
var viewer: Cesium.Viewer;
type divType = {
    id: string;
    name: string;
    position: number[];
    content: string;
    vueComponent: any;
}
const divList = ref<divType[]>([
    {
        id: "001",
        name: '这是iframe网页',
        position: [116.41, 39.88, 200],
        content: 'https://axy-cesium.netlify.app',
        vueComponent: iframeDiv
    },
    {
        id: "002",
        name: '这是Vue组件',
        position: [113, 37, 100],
        content: '这是一个Vue组件',
        vueComponent: lineDiv
    },
    {
        id: "003",
        name: '这是Echarts组件',
        position: [120, 35, 100],
        content: '这是一个Echarts组件',
        vueComponent: chartDiv
    },
])
var divbillboardMap: { [key: string]: any } = {}
const addBillboard = () => {
    if (viewer) {
        divList.value.forEach((item) => {
            let divbillboard = new DivBillboard(viewer, Cesium.Cartesian3.fromDegrees(item.position[0], item.position[1], item.position[2]), item.content, item.vueComponent, true, item.id)
            divbillboardMap[item.id] = divbillboard
        })
    }
}
const checkListChange = (value: divType, check: boolean) => {
    const entity = divbillboardMap[value.id];
    if (entity) {
        entity.visiable(check)
    }
}
const location = (data: divType) => {
    const entity = divbillboardMap[data.id];
    if (entity) {
        entity.flyTo()
    }
}
const checkList = ref<string[]>()
checkList.value = divList.value.map(item => item.id)
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