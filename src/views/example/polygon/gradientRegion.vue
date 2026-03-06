<template>
  <div class="side-panel">
    <el-tree
      node-key="id"
      ref="treeRef"
      :data="dataList"
      :props="defaultProps"
      show-checkbox
      :default-checked-keys="checkList"
      @check-change="checkListChange"
      default-expand-all
    >
      <template #default="{ data }">
        <div class="custom-tree-node flex-sb-center">
          <div class="node-name">{{ data.name }}</div>
        </div>
      </template>
    </el-tree>
  </div>
  <Map @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref } from "vue";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
import Map from "@/components/cesium/map.vue";
import tjJson from "@/assets/json/tianjin.json";
import bjJson from "@/assets/json/beijing.json";
const defaultProps = {
  children: "children",
  label: "name",
};
const mapLoaded = ref(false);
var viewer: Cesium.Viewer;
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyMjBkODk3NS0xZmE4LTQ5MzgtYTAxZC1mZTZhZTVmMTY3ZjQiLCJpZCI6MTcwNzE3LCJpYXQiOjE2OTY4MTY5OTN9.YivsBCkT8fHJNB5lFMFo2bh7860luv368ALHw-_gCD0";

const dataList = [
      {
    id: "bjJson001",
    width: 2,
    name: "北京边界",
    json: bjJson,
    edgeColor: Cesium.Color.BLUE.withAlpha(1.0),
    centerColor: Cesium.Color.SKYBLUE.withAlpha(0.1),
    gradientPower: 1.0,
  },
  {
    id: "tjJson001",
    width: 5,
    shadows: Cesium.ShadowMode.CAST_ONLY,
    name: "天津边界",
    json: tjJson,
    edgeColor: Cesium.Color.GREEN.withAlpha(1.0),
    centerColor: Cesium.Color.YELLOW.withAlpha(0.2),
    gradientPower: 2.0,
  },
];

const checkList = ref<string[]>();
checkList.value = dataList.map((item) => item.id);

const addArea = () => {
  viewer.scene.postProcessStages.fxaa.enabled = true;

  dataList.forEach((item) => {
    const feature = item.json.features[0];
    const coordinates = feature.geometry.coordinates;

    const maskArea = new Cesium.GeometryInstance({
      geometry: new Cesium.PolygonGeometry({
        polygonHierarchy: new Cesium.PolygonHierarchy(
          Cesium.Cartesian3.fromDegreesArray(coordinates.flat(2))
        ),
      }),
      id: item.id,
    });
    var centerGradientMaterial = new Cesium.Material({
      fabric: {
        type: "EdgeToCenterGradient",
        uniforms: {
          edgeColor: item.edgeColor,
          centerColor: item.centerColor,
          gradientPower: item.gradientPower,
        },
        source: `
                  uniform vec4 edgeColor;
                  uniform vec4 centerColor;
                  uniform float gradientPower;
                  
                  czm_material czm_getMaterial(czm_materialInput materialInput)
                  {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    
                    // Calculate distance from center (0.5, 0.5)
                    vec2 center = vec2(0.5, 0.5);
                    float distFromCenter = distance(st, center);
                    
                    // Normalize distance (0 at center, 1 at edges)
                    float maxDist = distance(vec2(0.0, 0.0), center);
                    float normalizedDist = distFromCenter / maxDist;
                    
                    // Apply power curve to control gradient sharpness
                    float gradientFactor = pow(normalizedDist, 1.0 / gradientPower);
                    
                    // Mix colors from edge to center
                    vec4 finalColor = mix(centerColor, edgeColor, gradientFactor);
                    
                    material.diffuse = finalColor.rgb;
                    material.alpha = finalColor.a;
                    
                    return material;
                  }
                `,
      },
    });
    const mask = new Cesium.GroundPrimitive({
      geometryInstances: maskArea,
      appearance: new Cesium.MaterialAppearance({
        material: centerGradientMaterial,
      }),
      allowPicking: false,
    });
    viewer.scene.primitives.add(mask);
  });
};
const getPrimitiveById = (id: string) => {
  let foundPrimitive: Cesium.Primitive | undefined;
  for (let i = 0; i < viewer.scene.primitives.length; i++) {
    const primitive = viewer.scene.primitives.get(i);
    if ((primitive as any)._boundingSpheresKeys.includes(id)) {
      foundPrimitive = primitive;
      break;
    }
  }
  return foundPrimitive;
};

const checkListChange = (data: any, check: boolean) => {
  let foundPrimitive = getPrimitiveById(data.id);

  if (foundPrimitive) {
    // 控制显示隐藏
    console.log("Found primitive:", foundPrimitive);
    foundPrimitive.show = check;
  }
};
const handleMapLoaded = (Viewer: Cesium.Viewer) => {
  viewer = Viewer;
  addArea();
  mapLoaded.value = true;
  reset();
};
const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 490000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
    duration: 1,
  });
};
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
