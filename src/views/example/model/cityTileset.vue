<template>
    <div class="menubox box2">
        <el-button type="primary" @click="changeShadar(1)">自定义材质</el-button>
        <el-button type="primary" @click="changeShadar(2)">图片材质</el-button>
        <el-button type="primary" @click="changeShadar(3)">原始材质</el-button>
    </div>
    <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import * as Cesium from "cesium";
import Map from '@/components/cesium/map.vue'
var viewer: Cesium.Viewer;
const mapLoaded = ref(false)
const selected = {
    feature: undefined,
    originalColor: new Cesium.Color(),
};

// An entity object which will hold info about the currently selected feature for infobox display
const selectedEntity = new Cesium.Entity();
var nameOverlay: HTMLDivElement | undefined = undefined
// Get default left click handler for when a feature is not picked on left click
const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
    viewer = MapViewer;
    mapLoaded.value = true;
    // 删除地形
    viewer.scene.globe.depthTestAgainstTerrain = true;
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    nameOverlay = document.createElement("div");
    viewer.container.appendChild(nameOverlay);
    nameOverlay.className = "backdrop";
    nameOverlay.style.display = "none";
    nameOverlay.style.position = "absolute";
    nameOverlay.style.bottom = "0";
    nameOverlay.style.left = "0";
    nameOverlay.style.pointerEvents = "none";
    nameOverlay.style.padding = "4px";
    nameOverlay.style.backgroundColor = "black";
    load3DTileset()
    reset()
}
const reset = () => {
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(103.82, 36.02, 3000),
        orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-40),
            roll: 0.0,
        },
        duration: 1
    });
}
const colorShadar = new Cesium.CustomShader({
    lightingModel: Cesium.LightingModel.UNLIT,
    fragmentShaderText: `
            // Color tiles by distance to the camera
            void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
            {
                material.diffuse = vec3(0.0, 0.5, 0.8);
                // material.diffuse.g = -fsInput.attributes.positionEC.z / 1.0e4;
            }`,
});
const imgShader = new Cesium.CustomShader({
    uniforms: {
        // elapsed time in seconds for animation
        u_time: {
            type: Cesium.UniformType.FLOAT,
            value: 0,
        },
        // user-defined texture
        u_stripes: {
            type: Cesium.UniformType.SAMPLER_2D,
            value: new Cesium.TextureUniform({
                url: "public/textures/line-sprite2.png",
            }),
        },
    },
    // Apply the texture to the model, but move the texture coordinates
    // a bit over time so it's animated.
    fragmentShaderText: `
                  void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
                  {
                      vec2 texCoord = vec2(fsInput.attributes.positionMC.y / 100., 0.) + 0.01 * vec2(czm_frameNumber, 0.0);
                      material.diffuse = texture(u_stripes, texCoord).rgb;
                  }`,
});
let tileset: Cesium.Cesium3DTileset | undefined;
const changeShadar = (type: number) => {
    if (tileset) {
        if (type === 1) {
            tileset.customShader = colorShadar
        } else if (type === 2) {
            tileset.customShader = imgShader
        } else if (type === 3) {
            tileset.customShader = undefined
        }
    }
}
// 加载3DTileset
const load3DTileset = async () => {
    try {
        tileset = await Cesium.Cesium3DTileset.fromUrl(
            "https://jdvop.oss-cn-qingdao.aliyuncs.com/mapv-data/titleset/lanzhou/tileset.json",
        );
        viewer.scene.primitives.add(tileset);
        tileset.customShader = colorShadar
        // var height = 738.0
        tileset.initialTilesLoaded.addEventListener(function () {
            console.log('Initial tiles are loaded');
            handlePick()
            // var cartographic = Cesium.Cartographic.fromCartesian(tileset.boundingSphere.center)
            // var lng = Cesium.Math.toDegrees(cartographic.longitude) //使用经纬度和弧度的转换，将WGS84弧度坐标系转换到目标值，弧度转度
            // var lat = Cesium.Math.toDegrees(cartographic.latitude)
            // // var lat = 34.219588
            // // var lng = 108.959397
            // //计算中心点位置的地表坐标
            // var surface = Cesium.Cartesian3.fromRadians(lng, lat, 0.0)
            // //偏移后的坐标
            // var offset = Cesium.Cartesian3.fromRadians(lng, lat, 0)
            // var translation = Cesium.Cartesian3.subtract(offset, surface, new Cesium.Cartesian3())
            // tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation)
        });
        viewer.zoomTo(tileset);
    } catch (error) {
        console.error(`Error creating tileset: ${error}`);
    }
}
const handlePick = () => {
    const clickHandler = viewer.screenSpaceEventHandler.getInputAction(
        Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );
    if (Cesium.PostProcessStageLibrary.isSilhouetteSupported(viewer.scene)) {
        // Silhouettes are supported
        const silhouetteBlue =
            Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
        silhouetteBlue.uniforms.color = Cesium.Color.RED;
        silhouetteBlue.uniforms.length = 0.01;
        silhouetteBlue.selected = [];

        const silhouetteGreen =
            Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
        silhouetteGreen.uniforms.color = Cesium.Color.LIME;
        silhouetteGreen.uniforms.length = 0.01;
        silhouetteGreen.selected = [];

        viewer.scene.postProcessStages.add(
            Cesium.PostProcessStageLibrary.createSilhouetteStage([
                silhouetteBlue,
                silhouetteGreen,
            ]),
        );

        // Silhouette a feature blue on hover.
        viewer.screenSpaceEventHandler.setInputAction(function onMouseMove(movement: any) {
            // If a feature was previously highlighted, undo the highlight
            silhouetteBlue.selected = [];

            // Pick a new feature
            const pickedFeature = viewer.scene.pick(movement.endPosition);

            if (Cesium.defined(pickedFeature)) {
                console.log("onMouseMove--pickedFeature", pickedFeature);
            }
            updateNameOverlay(pickedFeature, movement.endPosition);

            if (!Cesium.defined(pickedFeature)) {
                return;
            }

            // Highlight the feature if it's not already selected.
            if (pickedFeature !== selected.feature) {
                silhouetteBlue.selected = [pickedFeature];
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Silhouette a feature on selection and show metadata in the InfoBox.
        viewer.screenSpaceEventHandler.setInputAction(function onLeftClick(movement: any) {
            // If a feature was previously selected, undo the highlight
            silhouetteGreen.selected = [];

            // Pick a new feature
            const pickedFeature = viewer.scene.pick(movement.position);
            if (!Cesium.defined(pickedFeature)) {
                clickHandler(movement);
                return;
            }

            // Select the feature if it's not already selected
            if (silhouetteGreen.selected[0] === pickedFeature) {
                return;
            }

            // Save the selected feature's original color
            const highlightedFeature = silhouetteBlue.selected[0];
            if (pickedFeature === highlightedFeature) {
                silhouetteBlue.selected = [];
            }

            // Highlight newly selected feature
            silhouetteGreen.selected = [pickedFeature];

            // Set feature infobox description
            viewer.selectedEntity = selectedEntity;
            console.log("onLeftClick--pickedFeature", pickedFeature);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } else {
        // Silhouettes are not supported. Instead, change the feature color.

        // Information about the currently highlighted feature
        const highlighted: any = {
            feature: undefined,
            originalColor: new Cesium.Color(),
        };

        // Color a feature yellow on hover.
        viewer.screenSpaceEventHandler.setInputAction(function onMouseMove(movement: any) {
            // If a feature was previously highlighted, undo the highlight
            if (Cesium.defined(highlighted.feature)) {
                highlighted.feature.color = highlighted.originalColor;
                highlighted.feature = undefined;
            }
            // Pick a new feature
            const pickedFeature = viewer.scene.pick(movement.endPosition);
            updateNameOverlay(pickedFeature, movement.endPosition);

            if (!Cesium.defined(pickedFeature)) {
                return;
            }

            // Highlight the feature if it's not already selected.
            if (pickedFeature !== selected.feature) {
                highlighted.feature = pickedFeature;
                Cesium.Color.clone(pickedFeature.color, highlighted.originalColor);
                pickedFeature.color = Cesium.Color.YELLOW;
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Color a feature on selection and show metadata in the InfoBox.
        viewer.screenSpaceEventHandler.setInputAction(function onLeftClick(movement: any) {
            // If a feature was previously selected, undo the highlight
            if (Cesium.defined(selected.feature)) {
                selected.feature.color = selected.originalColor;
                selected.feature = undefined;
            }
            // Pick a new feature
            const pickedFeature = viewer.scene.pick(movement.position);
            if (!Cesium.defined(pickedFeature)) {
                clickHandler(movement);
                return;
            }
            // Select the feature if it's not already selected
            if (selected.feature === pickedFeature) {
                return;
            }
            selected.feature = pickedFeature;
            // Save the selected feature's original color
            if (pickedFeature === highlighted.feature) {
                Cesium.Color.clone(highlighted.originalColor, selected.originalColor);
                highlighted.feature = undefined;
            } else {
                Cesium.Color.clone(pickedFeature.color, selected.originalColor);
            }
            // Highlight newly selected feature
            pickedFeature.color = Cesium.Color.LIME;

            // Set feature infobox description
            viewer.selectedEntity = selectedEntity;
            console.log(pickedFeature);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
}
function updateNameOverlay(pickedFeature:any, position:any) {
    if (!nameOverlay) return
    if (!Cesium.defined(pickedFeature)) {
        nameOverlay.style.display = "none";
        return;
    }
    // A feature was picked, so show its overlay content
    nameOverlay.style.display = "block";
    nameOverlay.style.bottom = `${viewer.canvas.clientHeight - position.y}px`;
    nameOverlay.style.left = `${position.x}px`;
    const name = pickedFeature.featureId;
    nameOverlay.textContent = `featureId：${name}`;
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