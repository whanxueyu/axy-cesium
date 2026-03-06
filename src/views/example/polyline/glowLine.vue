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
    id: "border001",
    width: 5,
    material: new Cesium.Color(0.2, 0.2, 0.8, 1.0),
    shadows: Cesium.ShadowMode.CAST_ONLY,
    name: "天津边界",
    json: tjJson,
    glowPower: 0.25,
  },
  {
    id: "border002",
    width: 2,
    material: new Cesium.Color(0.8, 0.2, 0.2, 1.0),
    name: "北京边界",
    json: bjJson,
    glowPower: 0.5,
  },
];

const checkList = ref<string[]>();
checkList.value = dataList.map((item) => item.id);

const addLine = () => {
  viewer.scene.postProcessStages.fxaa.enabled = true;

  dataList.forEach((item) => {
    const feature = item.json.features[0];
    const coordinates = feature.geometry.coordinates;

    let geometry = new Cesium.PolylineGeometry({
      positions: Cesium.Cartesian3.fromDegreesArray(coordinates.flat(2)),
      width: item.width,
    });

    const instance = new Cesium.GeometryInstance({
      geometry: geometry,
      id: item.id,
    });
    const glowBorder = new Cesium.Primitive({
      geometryInstances: instance,
      appearance: new Cesium.PolylineMaterialAppearance({
        material: new Cesium.Material({
          fabric: {
            type: "MyBorderColor",
            uniforms: {
              color: item.material,
              glowPower: item.glowPower,
              taperPower: 1,
            },
            source: `
                  uniform vec4 color;
                  uniform float glowPower;
                  uniform float taperPower;
                  czm_material czm_getMaterial(czm_materialInput materialInput)
                  {
                    czm_material material = czm_getDefaultMaterial(materialInput);
                    vec2 st = materialInput.st;
                    float glow = glowPower / abs(st.t - 0.5) - (glowPower / 0.5);

                    if (taperPower <= 0.99999) {
                        glow *= min(1.0, taperPower / (0.5 - st.s * 0.5) - (taperPower / 0.5));
                    }

                    vec4 fragColor;
                    fragColor.rgb = max(vec3(glow - 1.0 + color.rgb), color.rgb);
                    fragColor.a = clamp(0.0, 1.0, glow) * color.a;
                    fragColor = czm_gammaCorrect(fragColor);

                    material.emission = fragColor.rgb;
                    material.alpha = fragColor.a;

                    return material;
                  }
                `,
          },
        }),
      }),
      allowPicking: false,
    });

    viewer.scene.primitives.add(glowBorder);
  });
};
const getPrimitiveById = (id: string) => {
  let foundPrimitive: Cesium.Primitive | undefined;
  for (let i = 0; i < viewer.scene.primitives.length; i++) {
    const primitive = viewer.scene.primitives.get(i);
    if ((primitive as any)._instanceIds.includes(id)) {
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
  addLine();
  mapLoaded.value = true;
  reset();
};
const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(116.405, 39.875, 600000),
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
