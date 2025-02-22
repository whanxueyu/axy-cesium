<template>
    <div id="cesiumContainer" class="fullSize"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
const TDT_URL_TEMPLATE = 'https://t{s}.tianditu.gov.cn/img_w/wmts?service=WMTS&request=GetTile&version=1.0.0&layer=img&tileMatrixSet=w&TileMatrix={TileMatrix}&TileRow={TileRow}&TileCol={TileCol}&style=default&format=tiles&tk=436ce7e50d27eede2f2929307e6b33c0';
const TDT_SUBDOMAINS = ['1', '2', '3', '4', '5', '6', '7'];
const TDT_LAYER = 'tdt_imgLayer';
const TDT_STYLE = 'default';
const TDT_FORMAT = 'image/jpeg';
const TDT_TILE_SIZE = 256;
const TDT_MAX_LEVEL = 18;
const TDT_TILE_MATRIX_SET_ID = 'GoogleMapsCompatible';
Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const BOUNDARY_COORDINATES = [
    [117, 39],
    [117, 39.3],
    [117.5, 39.3],
    [117.5, 39],
    [117, 39] // 添加最后一个点以闭合折线
];

onMounted(async () => {
    try {
        // 初始化 Cesium Viewer
        const viewer = new Cesium.Viewer("cesiumContainer", {
            terrain: Cesium.Terrain.fromWorldTerrain(),
        });

        // 移除默认图层
        if (viewer.imageryLayers.length > 0) {
            viewer.imageryLayers.removeAll();
        }

        // 创建区域多边形实体
        const region = viewer.entities.add({
            name: 'Region',
            // polygon: {
            //     hierarchy: Cesium.Cartesian3.fromDegreesArray(BOUNDARY_COORDINATES.flat()),
            //     material: Cesium.Color.RED.withAlpha(0.5)
            // }
            polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(BOUNDARY_COORDINATES.flat()),
                width: 5,
                material: Cesium.Color.RED,
                clampToGround: true,
            }
        });
        viewer.imageryLayers.addImageryProvider(
            await Cesium.IonImageryProvider.fromAssetId(4),
        );
        // 配置天地图瓦片服务
        const tdtMap = new Cesium.WebMapTileServiceImageryProvider({
            url: TDT_URL_TEMPLATE,
            subdomains: TDT_SUBDOMAINS,
            layer: TDT_LAYER,
            style: TDT_STYLE,
            format: TDT_FORMAT,
            tileWidth: TDT_TILE_SIZE,
            tileHeight: TDT_TILE_SIZE,
            tileMatrixSetID: TDT_TILE_MATRIX_SET_ID,
            maximumLevel: TDT_MAX_LEVEL,
            rectangle: Cesium.Rectangle.fromCartesianArray(BOUNDARY_COORDINATES.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat)))
        });

        // 添加天地图瓦片服务到图层
        viewer.imageryLayers.addImageryProvider(tdtMap);

        // 缩放到区域
        viewer.zoomTo(region);
    } catch (error) {
        console.error('Cesium initialization failed:', error);
    }
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

<style scoped>
.fullSize {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
}
</style>