<template>
    <div class="side-panel">
        <el-button @click="startDraw" type="primary">开始绘制动态管道</el-button>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue'
import volumeFlowMaterial from "@/modules/cesium/volumeFlowMaterial";

const mapLoaded = ref(false)
const isDraw = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
var primitive: Cesium.Primitive;
var primitive2: Cesium.Primitive;
var handler: Cesium.ScreenSpaceEventHandler;
const mapData = ref<{
    volumePos: {
        x: number;
        y: number;
        z: number;
    }[];
    volumeTempPos: Cesium.Cartesian3[];
}>({
    volumePos: [
        {
            "x": -2177201.82050819,
            "y": 4388589.806613274,
            "z": 4070571.7351155565
        },
        {
            "x": -2177988.9909251616,
            "y": 4389740.360741229,
            "z": 4068928.8307151883
        },
        {
            "x": -2179302.2248579017,
            "y": 4389019.149448835,
            "z": 4068992.8966739667
        },
        {
            "x": -2178830.032981934,
            "y": 4388245.689606762,
            "z": 4070067.8450776404
        },
        {
            "x": -2177956.995766465,
            "y": 4388699.3039861955,
            "z": 4070047.108646281
        },
        {
            "x": -2178301.181579197,
            "y": 4389135.880901199,
            "z": 4069398.408079544
        },
    ],
    volumeTempPos: [],
})

const startDraw = () => {
    isDraw.value = !isDraw.value
}
const drawVolume = () => {
    if (primitive) {
        viewer.scene.primitives.remove(primitive)
    }
    console.log(mapData.value.volumeTempPos)
    var geometry = new Cesium.PolylineVolumeGeometry({
        polylinePositions: mapData.value.volumeTempPos,
        vertexFormat: Cesium.VertexFormat.POSITION_NORMAL_AND_ST,
        shapePositions: computeCircle(10.0),
        cornerType: Cesium.CornerType.MITERED,
    })

    primitive = viewer.scene.primitives.add(
        new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({
                geometry: geometry,
            }),
            appearance: new Cesium.MaterialAppearance({
                material: volumeFlowMaterial(Cesium.Color.fromCssColorString('#f23f6f'))
            }),
        })
    )

    // if (!handler)
    //    handler = viewer.scene.preUpdate.addEventListener(function () {
    //         var offset = primitive.appearance.material.uniforms.offset
    //         offset += 0.001
    //         if (offset > 1.0) {
    //             offset = 0.0
    //         }
    //         primitive.appearance.material.uniforms.offset = offset
    //     })
}

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    mapLoaded.value = true;
    reset();
    let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(handleMouseMove.bind(this), Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction(handleLeftClick.bind(this), Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction(handleRightClick.bind(this), Cesium.ScreenSpaceEventType.RIGHT_CLICK);
    addTestData()
}
const handleLeftClick = (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    let ray = viewer.camera.getPickRay(event.position);
    if (!ray) return
    let cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) return
    let cartographic = Cesium.Cartographic.fromCartesian(cartesian);
    let lng = Cesium.Math.toDegrees(cartographic.longitude); // 经度
    let lat = Cesium.Math.toDegrees(cartographic.latitude); // 纬度
    let coordinate = {
        longitude: Number(lng.toFixed(6)),
        latitude: Number(lat.toFixed(6)),
        height: Number(cartographic.height.toFixed(6)),
    };
    console.log(coordinate)
    if (isDraw.value) {
        mapData.value.volumeTempPos.push(cartesian);
        drawVolume()
    }
}
const handleRightClick = (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    console.log("rightClick", event)
    if (isDraw.value) {
        mapData.value.volumeTempPos.pop();
        drawVolume()
        isDraw.value = false
    }
}
const handleMouseMove = (event: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
    let ray = viewer.camera.getPickRay(event.endPosition);
    if (!ray) return
    if (isDraw.value) {
        let cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (cartesian) {
            if (mapData.value.volumeTempPos.length > 0) {
                if (mapData.value.volumeTempPos.length > 1) {
                    mapData.value.volumeTempPos.pop();
                }
                mapData.value.volumeTempPos.push(cartesian);
                drawVolume()
            }
        }
    }
}
const computeCircle = (radius: number) => {
    var positions = []
    for (var i = 0; i < 360; i++) {
        var radians = Cesium.Math.toRadians(i)
        positions.push(
            new Cesium.Cartesian2(
                radius * Math.cos(radians),
                radius * Math.sin(radians)
            )
        )
    }
    return positions
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

const addTestData = () => {
    let positions = mapData.value.volumePos.map((item) => {
        return new Cesium.Cartesian3(item.x, item.y, item.z)
    })
    var geometry = new Cesium.PolylineVolumeGeometry({
        polylinePositions: positions,
        vertexFormat: Cesium.VertexFormat.POSITION_NORMAL_AND_ST,
        shapePositions: computeCircle(10.0),
        cornerType: Cesium.CornerType.MITERED,
    })
    if (primitive2) {
        viewer.scene.primitives.remove(primitive2)
    }
    primitive2 = viewer.scene.primitives.add(
        new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({
                geometry: geometry,
            }),
            appearance: new Cesium.MaterialAppearance({
                material: volumeFlowMaterial(Cesium.Color.fromCssColorString('#22ffff'))
            }),
        })
    )

    if (!handler)
        viewer.scene.preUpdate.addEventListener(function () {
            var offset = primitive2.appearance.material.uniforms.offset
            offset += 0.001
            if (offset > 1.0) {
                offset = 0.0
            }
            primitive2.appearance.material.uniforms.offset = offset;
            if (primitive)
                primitive.appearance.material.uniforms.offset = offset
        })
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