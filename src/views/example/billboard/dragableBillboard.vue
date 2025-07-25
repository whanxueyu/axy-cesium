<template>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="list" :props="defaultProps" show-checkbox
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
import PopInfo from "@/modules/cesium/PopInfo";
import { createApp, h } from "vue";
import chartDiv from '@/components/billboard/chartDiv.vue';
import Map from '@/components/cesium/map.vue'
const defaultProps = {
    children: "children",
    label: "name",
};
const mapLoaded = ref(false)
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
var viewer: Cesium.Viewer;
interface LineConfig {
    length: number;
    angle: number;
    color: string;
    width?: number;
    opacity?: number;
    anchorPoint?: 'center' | 'nearest' | string;
}
type dataType = {
    id: string;
    name: string;
    innerHTML: string | any;
    position: number[];
    type: number;
    lineConfig?: LineConfig;
    style?: Partial<CSSStyleDeclaration>;
}
const list = ref<dataType[]>([
    {
        id: '001',
        name: "默认属性",
        innerHTML: `
            <h3>默认属性</h3>
            <p>连线会自动连到最近的角</p>
            <p>连线默认角度45度</p>
        `,
        position: [116.41, 39.88, 200],
        type: 1
    },
    {
        id: '002',
        name: "修改连线属性",
        innerHTML: `
            <h3>连线属性修改</h3>
            <p>连线为红色，连接标牌中心点</p>
            <p>连线角度60度长120</p>
        `,
        position: [113, 37, 100],
        lineConfig: {
            length: 120,
            angle: 60,
            anchorPoint: 'center',
            color: "#ff0000"
        },
        type: 1
    },
    {
        id: '003',
        name: "自定义标牌样式",
        innerHTML: `
            <h3>自定义样式</h3>
            <p>zIndex: 1000,</p>
            <p>backgroundColor: 'rgba(0, 0, 0, 0.8)',</p>
            <p>borderRadius: '4px',</p>
            <p>padding: '8px',</p>
            <p>color: '#ffffff',</p>
            <p>fontSize: '12px',</p>
            <p>maxWidth: '300px',</p>
            <p>pointerEvents: 'auto',</p>
        `,
        position: [120, 35, 100],
        type: 1,
        lineConfig: {
            length: 220,
            angle: 60,
            anchorPoint: 'nearest',
            color: "#ff0000"
        },
        style: {
            zIndex: '1000', // 层级
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '4px',
            padding: '8px',
            color: '#ffffff',
            fontSize: '12px',
            maxWidth: '300px',
            pointerEvents: 'auto',
        }
    },
    {
        id: '004',
        name: "加载vue组件",
        innerHTML: chartDiv,
        position: [117, 39, 200],
        type: 2
    },
])
var billboardMap: { [key: string]: PopInfo } = {};
const checkListChange = (value: dataType, check: boolean) => {
    const entity = billboardMap[value.id];
    if (entity) {
        if (check) {
            entity.show()
        } else {
            entity.hide()
        }
    }
}
const location = (data: dataType) => {
    const entity = billboardMap[data.id];
    if (entity) {
        entity.flyTo()
    }
}
const checkList = ref<string[]>()
checkList.value = list.value.map(item => item.id)
const addBillboard = () => {
    if (viewer) {
        list.value.forEach(item => {
            const popupElement = document.createElement('div');
            if (item.type == 2) {
                const app = createApp({
                    render: () => h(item.innerHTML)
                });
                app.mount(popupElement);
            } else {
                popupElement.innerHTML = item.innerHTML as string
            }
            let pop = new PopInfo({
                viewer: viewer,
                position: item.position,
                element: popupElement,
                geographicMode: 3,
                style: item.style,
                lineConfig: item.lineConfig
            })
            billboardMap[item.id] = pop
        })
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