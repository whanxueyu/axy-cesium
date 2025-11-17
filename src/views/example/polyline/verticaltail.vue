<template>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import Map from '@/components/cesium/map.vue';
import verticalLineMaterial from "@/modules/cesium/verticalLineMaterial";

const mapLoaded = ref(false)
var viewer: Cesium.Viewer
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const drawVerticalLine = () => {
  viewer.scene.primitives.add(
    new Cesium.Primitive({
      geometryInstances: generateRandomLines([116.39, 39.959], 100),
      appearance: new Cesium.PolylineMaterialAppearance({
        material: verticalLineMaterial(Cesium.Color.fromCssColorString('#ff66f099')),
      }),
      allowPicking: false
    })
  )
//   const center = Cesium.Cartesian3.fromDegrees(116.39, 39.959);
//   viewer.camera.lookAt(center, new Cesium.Cartesian3(0.0, -10000.0, 3930.0));
//   viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
}
const generateRandomLines = (center:[number,number], num: number) => {
  let geometryInstances = []
  for (let i = 0; i < num; i++) {
    let lon = center[0] + (Math.random() - 0.5) * 0.1;
    let lat = center[1] + (Math.random() - 0.5) * 0.1;
    const geometry = new Cesium.PolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([
        lon, lat, 0, lon, lat, 5000 * Math.random()
      ]),
      width: 1.0,
    })
    const instance = new Cesium.GeometryInstance({ geometry: geometry })
    geometryInstances.push(instance)
  }
  return geometryInstances
}
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    // viewer.clock.shouldAnimate = true;
    drawVerticalLine()
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.405, 39.75, 20000),
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