<template>
    <div id="cesiumContainer" class="fullSize"></div>
    <div class="operation">
        <el-checkbox v-model="dynamicLighting" label="动态效果" @change="handleRoate"></el-checkbox>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from 'cesium';
import 'cesium/Source/Widgets/widgets.css';
const viewer = ref<Cesium.Viewer | null>(null);
const dynamicLighting = ref(false);
const imageryLayers = ref<Cesium.ImageryLayerCollection | null>(null);
const nightLayer = ref<Cesium.ImageryLayer | null>(null);
const dayLayer = ref<Cesium.ImageryLayer | null>(null);

// Add a button to toggle dynamic lighting
const handleRoate = () => {
    // dynamicLighting.value = !dynamicLighting.value;
    updateLighting(dynamicLighting.value);
}

onMounted(async () => {
    viewer.value = new Cesium.Viewer('cesiumContainer', {
        baseLayer: await Cesium.ImageryLayer.fromProviderAsync(
            Cesium.IonImageryProvider.fromAssetId(3812), {}
        ),
    });

    imageryLayers.value = viewer.value.imageryLayers;
    nightLayer.value = imageryLayers.value.get(0);
    dayLayer.value = await Cesium.ImageryLayer.fromProviderAsync(
        Cesium.IonImageryProvider.fromAssetId(3845), {}
    );
    imageryLayers.value.add(dayLayer.value);
    imageryLayers.value.lowerToBottom(dayLayer.value);

    viewer.value.clock.multiplier = 4000;

    updateLighting(dynamicLighting.value);
});

function updateLighting(dynamicLighting: boolean) {
    if (dayLayer.value && nightLayer.value) {
        dayLayer.value.show = dynamicLighting;
        viewer.value!.scene.globe.enableLighting = dynamicLighting;
        viewer.value!.clock.shouldAnimate = dynamicLighting;
        nightLayer.value.dayAlpha = dynamicLighting ? 0.0 : 1.0;
    }
}
</script>

<style scoped>
.fullSize {
    width: 100%;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
}

.operation {
    position: fixed;
    top: 20px;
    left: 20px;
    background-color: #fff;
    width: 200px;
}
</style>