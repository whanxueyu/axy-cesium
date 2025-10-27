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
import { Location } from "@element-plus/icons-vue";
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue';
import radaeScanMaterial from "@/modules/cesium/radaeScanMaterial";
const defaultProps = {
    children: "children",
    label: "name",
};
const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const dataList = [
    // 原有Color案例
    {
        id: '001',
        name: "绿色-修改图元材质",
        positions: [116.388, 39.92]
    },
    // 新增材质案例
    {
        id: '002',
        name: "蓝色-canvas材质",
        positions: [116.4, 39.92]
    },
    {
        id: '003',
        name: "红色-图片材质",
        positions: [116.4, 39.92]
    },
    {
        id: '004',
        name: "图片材质",
        positions: [116.4, 39.92]
    },
];
const checkListChange = (value: { [key: string]: any; }, check: boolean) => {
    const entity = viewer?.entities?.getById(value.id);
    if (entity) {
        entity.show = check
    }
}

const checkList = ref<string[]>()
checkList.value = dataList.map(item => item.id)
const location = (data: any) => {
    const entity = viewer?.entities?.getById(data.id);
    if (entity) {
        viewer.zoomTo(entity)
    }
}
const drawScanRadar = () => {
    var circleGeometry = new Cesium.CircleGeometry({
        center: Cesium.Cartesian3.fromDegrees(116.39, 39.915),
        radius: 800.0,
        vertexFormat: Cesium.VertexFormat.POSITION_AND_ST,
    })
    var instance = new Cesium.GeometryInstance({
        geometry: circleGeometry,
    })
    viewer.scene.primitives.add(
        new Cesium.GroundPrimitive({
            geometryInstances: instance,
            appearance: new Cesium.MaterialAppearance({
                material: radaeScanMaterial(Cesium.Color.fromCssColorString('#00ff33')),
            }),
        })
    )
}
const rotation = ref(0)
const rotation2 = ref(0)
const rotation3 = ref(0)

const drawRadar = () => {
    viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(116.42, 39.915),
        ellipse: {
            semiMinorAxis: 800,
            semiMajorAxis: 800,
            material: new Cesium.ImageMaterialProperty({
                image: new Cesium.CallbackProperty(drawCanvas, false),
                transparent: true
            }),
            outline: true,
            outlineWidth: 5,
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            outlineColor: Cesium.Color.fromCssColorString('#00ffff'),

            rotation: new Cesium.CallbackProperty(() => {
                return rotation.value += 0.01
            }, false),
            stRotation: new Cesium.CallbackProperty(() => {
                return rotation.value += 0.01
            }, false),
        },
    })
}
const drawRadar2 = () => {
    viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(116.39, 39.9),
        ellipse: {
            semiMinorAxis: 800,
            semiMajorAxis: 800,
            material: new Cesium.ImageMaterialProperty({
                image: 'http://' + window.location.host + '/textures/circle-scan.png',
                repeat: new Cesium.Cartesian2(1, 1),
                transparent: true,
                color: Cesium.Color.fromCssColorString('#00ffff99')
            }),
            outline: true,
            outlineWidth: 5,
            outlineColor: Cesium.Color.fromCssColorString('#00ffff'),

            rotation: new Cesium.CallbackProperty(() => {
                return rotation2.value -= 0.01
            }, false),
            stRotation: new Cesium.CallbackProperty(() => {
                return rotation2.value -= 0.01
            }, false),
        },
    })
}
const drawRadar3 = () => {
    viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(116.42, 39.9),
        ellipse: {
            semiMinorAxis: 800,
            semiMajorAxis: 800,
            material: new Cesium.ImageMaterialProperty({
                image: 'http://' + window.location.host + '/textures/circle-two.png',
                repeat: new Cesium.Cartesian2(1, 1),
                transparent: true,
                color: Cesium.Color.fromCssColorString('#ffffff')
            }),
            rotation: new Cesium.CallbackProperty(() => {
                return rotation3.value -= 0.01
            }, false),
            stRotation: new Cesium.CallbackProperty(() => {
                return rotation3.value -= 0.01
            }, false),
        },
    })
}
const drawCanvas = () => {
    let canvas = document.createElement("canvas")
    canvas.setAttribute('id', 'scanMaterial')
    canvas.setAttribute('width', '300px')
    canvas.setAttribute('height', '300px')
    let context = canvas.getContext('2d')
    if (!context) return
    let grd = context.createLinearGradient(175, 100, 300, 150)
    grd.addColorStop(0, '#00ffff00')
    grd.addColorStop(1, '#00ffffff')
    context.fillStyle = grd
    context.beginPath()
    context.moveTo(150, 150)
    context.arc(150, 150, 150, -90 / 180 * Math.PI, 0 / 180 * Math.PI)
    context.fill()
    return canvas
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    drawScanRadar();
    drawRadar();
    drawRadar2()
    drawRadar3()
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