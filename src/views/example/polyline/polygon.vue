<template>
    <div class="side-panel">
        <el-tree node-key="id" ref="treeRef" :data="polygonList" :props="defaultProps" show-checkbox
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
import { PolygonEditor } from '@/modules/control/rectangleEdit'
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue'
const defaultProps = {
    children: "children",
    label: "name",
};
const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const polygonList = [
    {
        id: 'polygon001',
        name: "红色半透明多边形",
        positions: [112, 38, 114, 36, 113, 34, 112, 36, 112, 38],
        material: new Cesium.ImageMaterialProperty({
            image: 'public/textures/gugong.jpg',
            repeat: new Cesium.Cartesian2(1, 1)
        })
    },
    {
        id: 'polygon002',
        name: "蓝色多边形",
        positions: [110, 38, 111, 38, 111, 37, 110, 37, 110, 38],
        material: new Cesium.ImageMaterialProperty({
            image: 'public/textures/gugong.jpg',
            repeat: new Cesium.Cartesian2(1, 1)
        })
    }
]

const checkListChange = (value: { [key: string]: any; }, check: boolean) => {
    const entity = viewer?.entities?.getById(value.id);
    if (entity) {
        entity.show = check
    }
}

const checkList = ref<string[]>()
checkList.value = polygonList.map(item => item.id)


const addPolygon = (data: any) => {
    const entity = viewer?.entities?.getById(data.id);
    if (entity) {
        entity.show = !entity.show;
    } else {
        viewer.entities.add({
            id: data.id,
            polygon: {
                hierarchy: Cesium.Cartesian3.fromDegreesArray(data.positions),
                material: data.material ?? Cesium.Color.RED.withAlpha(0.5),
                // height: 0,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                outline: true,
                outlineColor: Cesium.Color.BLACK
            }
        });
    }
}
const location = (data: any) => {
    const entity = viewer?.entities?.getById(data.id);
    if (entity) {
        viewer.zoomTo(entity)
    }
}
const selectId = ref<string>()
const control = ref<PolygonEditor>()
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(function (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) {
        let ray = viewer.camera.getPickRay(event.position);
        if (!ray) return
        var pick = viewer.scene.pick(event.position);//拾取鼠标所在的entity
        console.log('pick', pick)
        if (Cesium.defined(pick?.id)) {
            if (pick.id.id === selectId.value && selectId.value) {
                selectId.value = '';
                if (control.value) {
                    control.value.stopEditing()
                }
                return
            }
            if (pick.id) {
                let entity: Cesium.Entity = pick.id
                let sid = pick.id.id
                selectId.value = sid
                control.value = new PolygonEditor(viewer, entity, (positions) => {
                    console.log('positions', positions)
                });
            } else {
                if (control.value) {
                    control.value.stopEditing()
                }
            }
        } else {
            if (selectId.value) {
                selectId.value = '';

            }
            if (control.value) {
                control.value.stopEditing()
            }
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    polygonList.forEach(item => {
        addPolygon(item)
    })
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