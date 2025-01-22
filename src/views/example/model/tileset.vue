<template>
    <div class="menubox box2">
        <el-button type="primary" @click="load3DTileset">加载倾斜摄影模型</el-button>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import Map from '@/components/cesium/map.vue'
var viewer: Cesium.Viewer;
const mapLoaded = ref(false)
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    mapLoaded.value = true;
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.391257, 39.907204, 300),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0.0,
        },
        duration: 1
    });
}
// 加载3DTileset
const load3DTileset = async () => {
    try {
        const tileset = await Cesium.Cesium3DTileset.fromUrl(
            "https://zouyaoji.top/vue-cesium/SampleData/Cesium3DTiles/Tilesets/dayanta/tileset.json"
        );
        viewer.scene.primitives.add(tileset);
        // var height = 738.0
        tileset.initialTilesLoaded.addEventListener(function () {
            console.log('Initial tiles are loaded');
            var cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center)
            var lng = Cesium.Math.toDegrees(cartographic.longitude) //使用经纬度和弧度的转换，将WGS84弧度坐标系转换到目标值，弧度转度
            var lat = Cesium.Math.toDegrees(cartographic.latitude)
            // var lat = 34.219588
            // var lng = 108.959397
            //计算中心点位置的地表坐标
            var surface = Cesium.Cartesian3.fromRadians(lng, lat, 0.0)
            //偏移后的坐标
            var offset = Cesium.Cartesian3.fromRadians(lng, lat, 0)
            var translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3())
            tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation)
        });
        viewer.zoomTo(tileset);
    } catch (error) {
        console.error(`Error creating tileset: ${error}`);
    }
}
onMounted(() => {

});
</script>

<style scoped lang="scss">
.menubox {
    position: absolute;
    z-index: 999;
    border-bottom-right-radius: 10px;
    // padding: 0 10px 10px;
    border: 1px solid rgba(139, 139, 139, 0.2);
    background-color: #222222;
    color: #fff;
    user-select: none;
    transition: all .3s;

    &.box2 {
        left: 5px;
        top: 65px;
    }
}
</style>