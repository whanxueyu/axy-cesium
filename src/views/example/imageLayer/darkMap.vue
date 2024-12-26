<template>
    <div id="cesiumContainer" class="fullSize"></div>
</template>

<script setup lang="ts">
import { onMounted, nextTick, ref, reactive } from 'vue';
import * as Cesium from "cesium";
import 'cesium/Source/Widgets/widgets.css';
import AmapMercatorTilingScheme from '@/modules/AmapMercatorTilingScheme/AmapMercatorTilingScheme';

// Cesium.Ion.defaultAccessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";
const viewModel = reactive({
    brightness: 0,
    contrast: 0,
    hue: 0,
    saturation: 0,
    gamma: 0,
})
// 获取 Cesium 视图对象
let viewer: Cesium.Viewer | undefined;
const filterColor = ref('#003690')
const imageryLayers = ref()
const setBlackMap = () => {
    let { red, blue, green } = hexColorToRgba(filterColor.value)
    console.log(red, blue, green)
    if (viewer)
        modifyMap(viewer, {
            //反色?
            invertColor: true,
            brightness: 0.8,
            filterRGB: [red, green, blue],
            hue: 0.5,
            gamma: 0.2,
            contrast: 3,
            saturation: 1.5,
            // color: 'rgb('+red+','+green+','+blue+')',
        });
}


const modifyMap = (viewer: Cesium.Viewer, options: any) => {
    const baseLayer = viewer.imageryLayers.get(0)
    baseLayer.brightness = options.brightness || 0.6
    baseLayer.contrast = options.contrast || 1.8
    baseLayer.gamma = options.gamma || 0.3
    baseLayer.hue = options.hue || 1
    baseLayer.saturation = options.saturation || 0
    const baseFragShader = (viewer.scene.globe as any)._surfaceShaderSet
        .baseFragmentShaderSource.sources
    for (let i = 0; i < baseFragShader.length; i++) {
        const strS = 'color = czm_saturation(color, textureSaturation);\n#endif\n'
        let strT = 'color = czm_saturation(color, textureSaturation);\n#endif\n'
        if (options.invertColor) {
            strT += `
                color.r = 1.0 - color.r;
                color.g = 1.0 - color.g;
                color.b = 1.0 - color.b;
                `
        }
        if (options.filterRGB.length > 0) {
            strT += `
                color.r = color.r * ${options.filterRGB[0]}.0/255.0;
                color.g = color.g * ${options.filterRGB[1]}.0/255.0;
                color.b = color.b * ${options.filterRGB[2]}.0/255.0;
                `
        }
        baseFragShader[i] = baseFragShader[i].replace(strS, strT)
    }
    nextTick(() => {
        updateViewModel()
    })
}
const updateViewModel = () => {
    if (imageryLayers.value.length > 0) {
        const layer = imageryLayers.value.get(0);
        viewModel.brightness = layer.brightness;
        viewModel.contrast = layer.contrast;
        viewModel.hue = layer.hue;
        viewModel.saturation = layer.saturation;
        viewModel.gamma = layer.gamma;
    }
}

const hexColorToRgba = (color: string) => {
    // 检查输入颜色是否以 "#" 开头
    if (!color.startsWith('#')) {
        throw new Error('Invalid hex color format. Color should start with "#".');
    }

    // 获取去掉 "#" 后的颜色值部分
    const hexValue = color.slice(1);

    // 根据颜色值长度确定是 RGB 还是 RGBA
    const isRgba = hexValue.length === 8;

    // 确保颜色值长度合法（6 或 8 位）
    if (hexValue.length !== 6 && hexValue.length !== 8) {
        throw new Error(`Invalid hex color length. Expected 6 or 8 characters, got ${hexValue.length}.`);
    }

    // 将十六进制颜色值转换为十进制整数
    const hexToInt = (hex: string) => parseInt(hex, 16);

    // 提取 RGB 分量
    const redHex = hexValue.substring(0, 2);
    const greenHex = hexValue.substring(2, 4);
    const blueHex = hexValue.substring(4, 6);

    const red = hexToInt(redHex);
    const green = hexToInt(greenHex);
    const blue = hexToInt(blueHex);

    // 如果是 RGBA，提取 Alpha 分量
    let alpha = 1;
    if (isRgba) {
        const alphaHex = hexValue.substring(6, 8);
        alpha = hexToInt(alphaHex);
    }

    return {
        red: red,
        green: green,
        blue: blue,
        alpha: alpha
    };
};
onMounted(() => {
    viewer = new Cesium.Viewer("cesiumContainer", {
        infoBox: false,
        selectionIndicator: false,
        sceneModePicker: false,
        animation: false,    //左下角的动画仪表盘
        baseLayerPicker: false,  //右上角的图层选择按钮
        geocoder: false,  //搜索框
        homeButton: false,  //home按钮
        timeline: false,    //底部的时间轴
        navigationHelpButton: false,  //右上角的帮助按钮，
        fullscreenButton: false,
        terrain: Cesium.Terrain.fromWorldTerrain(),
    });
    if (viewer.imageryLayers.length > 0)
        viewer.imageryLayers.removeAll();
    (viewer.cesiumWidget.creditContainer as HTMLElement).style.display = "none";
    let gdvMap = new Cesium.UrlTemplateImageryProvider({
        url: 'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=2&style=8&x={x}&y={y}&z={z}',
        tileWidth: 256,
        tileHeight: 256,
        tilingScheme: new AmapMercatorTilingScheme() as any,
        maximumLevel: 18, // 根据高德地图的实际最大层级设置  
    })
    viewer.imageryLayers.addImageryProvider(gdvMap)
    setBlackMap()
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