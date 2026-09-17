<template>
  <div class="css3d-demo">
    <Map
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="0.8"
      :loadTerrain="false"
      :showLayerSelect="false"
      :showStatusBar="false"
      :showCompass="false"
      @loaded="handleMapLoaded"
    />

    <section class="demo-panel">
      <div class="demo-panel__eyebrow">CESIUM / CSS3D</div>
      <h1>世界坐标 3D Div 标牌</h1>
      <p>
        面板的四个角点直接来自 Cesium 世界坐标。拖动相机观察它的透视、侧视缩窄和地球遮挡。
      </p>

      <div class="demo-panel__divider"></div>

      <label class="demo-toggle">
        <input v-model="labelsVisible" type="checkbox" @change="toggleLabels" />
        <span>显示标牌</span>
      </label>
      <label class="demo-toggle">
        <input v-model="backfaceCulling" type="checkbox" @change="toggleBackfaceCulling" />
        <span>隐藏背面</span>
      </label>

      <button class="demo-button" type="button" @click="resetView">
        回到初始视角
      </button>

      <div class="demo-panel__status">
        <span class="demo-panel__status-dot"></span>
        {{ loaded ? "3 个世界平面已同步" : "正在初始化 Cesium" }}
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
import Map from "@/components/cesium/map.vue";
import { CSS3DWorldPlane } from "@/modules/cesium/css3DRender";

const cameraDestination = {
  longitude: 113.4,
  latitude: 22.5,
  height: 52000,
};
const cameraOrientation = {
  heading: 0,
  pitch: -40,
  roll: 0,
};

const loaded = ref(false);
const labelsVisible = ref(true);
const backfaceCulling = ref(false);
let viewer: Cesium.Viewer | undefined;
let planes: CSS3DWorldPlane[] = [];

const createSignHTML = (
  code: string,
  title: string,
  value: string,
  detail: string,
  accent: string,
) => `
  <article class="css3d-sign" style="--sign-accent: ${accent}">
    <div class="css3d-sign__scanline"></div>
    <div class="css3d-sign__topline">
      <span class="css3d-sign__code">${code}</span>
      <span class="css3d-sign__live"><i></i> LIVE</span>
    </div>
    <div class="css3d-sign__title">${title}</div>
    <div class="css3d-sign__value">${value}</div>
    <div class="css3d-sign__detail">${detail}</div>
    <div class="css3d-sign__footer">
      <span>WORLD PLANE</span>
      <span>SYNCED</span>
    </div>
  </article>
`;

const createPlanes = () => {
  if (!viewer) {
    return;
  }

  planes = [
    new CSS3DWorldPlane(viewer, {
      position: Cesium.Cartesian3.fromDegrees(113.4, 22.5, 1800),
      width: 9200,
      height: 5200,
      pixelWidth: 440,
      pixelHeight: 250,
      heading: Cesium.Math.toRadians(0),
      html: createSignHTML(
        "A-01",
        "CSS3D WORLD ANCHOR",
        "9200 × 5200 m",
        "固定于经纬度 / 高度的真实平面",
        "#27e6ff",
      ),
      className: "css3d-sign-plane",
      pointerEvents: "none",
      backfaceCulling: backfaceCulling.value,
    }),
    new CSS3DWorldPlane(viewer, {
      position: Cesium.Cartesian3.fromDegrees(113.445, 22.505, 900),
      width: 6800,
      height: 3900,
      pixelWidth: 370,
      pixelHeight: 212,
      heading: Cesium.Math.toRadians(62),
      html: createSignHTML(
        "B-07",
        "PERSPECTIVE PANEL",
        "62° HEADING",
        "转动相机后，面板会沿世界方向产生侧视透视",
        "#ffbf47",
      ),
      className: "css3d-sign-plane",
      pointerEvents: "none",
      backfaceCulling: backfaceCulling.value,
    }),
    new CSS3DWorldPlane(viewer, {
      position: Cesium.Cartesian3.fromDegrees(113.355, 22.475, 1200),
      width: 7200,
      height: 4100,
      pixelWidth: 390,
      pixelHeight: 222,
      heading: Cesium.Math.toRadians(-48),
      html: createSignHTML(
        "C-12",
        "DEPTH AWARE",
        "OCCLUSION ON",
        "地球背面和场景深度会参与标牌可见性判断",
        "#a98cff",
      ),
      className: "css3d-sign-plane",
      pointerEvents: "none",
      backfaceCulling: backfaceCulling.value,
    }),
  ];
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  setCameraView(false);
  createPlanes();
  loaded.value = true;
};

const toggleLabels = () => {
  planes.forEach((plane) => plane.setVisible(labelsVisible.value));
};

const toggleBackfaceCulling = () => {
  planes.forEach((plane) => plane.setBackfaceCulling(backfaceCulling.value));
};

const resetView = () => {
  setCameraView(true);
};

const setCameraView = (animate: boolean) => {
  if (!viewer) {
    return;
  }

  const focus = Cesium.Cartesian3.fromDegrees(
    cameraDestination.longitude,
    cameraDestination.latitude,
    1800,
  );
  const offset = new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(cameraOrientation.heading),
    Cesium.Math.toRadians(cameraOrientation.pitch),
    30000,
  );

  viewer.camera.cancelFlight();
  if (animate) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        cameraDestination.longitude,
        cameraDestination.latitude,
        21168,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(cameraOrientation.heading),
        pitch: Cesium.Math.toRadians(cameraOrientation.pitch),
        roll: Cesium.Math.toRadians(cameraOrientation.roll),
      },
      duration: 0.8,
      complete: () => {
        if (viewer) {
          viewer.camera.lookAt(focus, offset);
          viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
        }
      },
    });
  } else {
    viewer.camera.lookAt(focus, offset);
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
};

onBeforeUnmount(() => {
  planes.forEach((plane) => plane.destroy());
  planes = [];
});
</script>

<style>
.css3d-demo {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #061119;
}

.css3d-demo .cesium-viewer,
.css3d-demo .cesium-widget,
.css3d-demo #cesiumContainer {
  width: 100%;
  height: 100%;
}

.demo-panel {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 1000;
  width: 290px;
  box-sizing: border-box;
  padding: 20px;
  color: #eafcff;
  background: rgba(5, 18, 28, 0.9);
  border: 1px solid rgba(102, 222, 255, 0.28);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(12px);
}

.demo-panel__eyebrow {
  color: #65e8ff;
  font: 600 11px/1.2 "Arial Narrow", Arial, sans-serif;
  letter-spacing: 1.6px;
}

.demo-panel h1 {
  margin: 10px 0 8px;
  color: #ffffff;
  font-size: 21px;
  line-height: 1.25;
  letter-spacing: 0;
}

.demo-panel p {
  margin: 0;
  color: #9cb4bf;
  font-size: 13px;
  line-height: 1.65;
}

.demo-panel__divider {
  height: 1px;
  margin: 18px 0 14px;
  background: rgba(142, 225, 244, 0.2);
}

.demo-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 30px;
  color: #d7edf2;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
}

.demo-toggle input {
  width: 15px;
  height: 15px;
  accent-color: #35d9f6;
}

.demo-button {
  width: 100%;
  margin-top: 14px;
  padding: 9px 12px;
  color: #061119;
  font: 700 13px/1.2 Arial, sans-serif;
  background: #65e8ff;
  border: 0;
  border-radius: 2px;
  cursor: pointer;
}

.demo-button:hover {
  background: #b1f5ff;
}

.demo-panel__status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  color: #72919d;
  font-size: 11px;
}

.demo-panel__status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #5ee8b2;
  box-shadow: 0 0 10px rgba(94, 232, 178, 0.9);
}

.css3d-sign {
  position: relative;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: hidden;
  padding: 22px 28px 18px;
  color: #e8fbff;
  font-family: "Arial Narrow", Arial, sans-serif;
  background: rgba(4, 23, 35, 0.94);
  border: 2px solid var(--sign-accent);
  box-shadow:
    inset 0 0 0 1px rgba(218, 250, 255, 0.18),
    inset 0 0 28px rgba(32, 209, 242, 0.12),
    0 0 18px color-mix(in srgb, var(--sign-accent) 42%, transparent);
  transform-style: preserve-3d;
}

.css3d-sign::before {
  position: absolute;
  inset: 8px;
  content: "";
  pointer-events: none;
  border: 1px solid color-mix(in srgb, var(--sign-accent) 45%, transparent);
}

.css3d-sign::after {
  position: absolute;
  top: 0;
  right: 0;
  width: 34%;
  height: 2px;
  content: "";
  background: var(--sign-accent);
  box-shadow: 0 0 12px var(--sign-accent);
}

.css3d-sign__scanline {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent 0,
    transparent 8px,
    rgba(125, 239, 255, 0.035) 9px,
    transparent 10px
  );
}

.css3d-sign__topline,
.css3d-sign__footer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: color-mix(in srgb, var(--sign-accent) 75%, white);
  font-size: 11px;
  letter-spacing: 1.2px;
}

.css3d-sign__live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.css3d-sign__live i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #63efb2;
  box-shadow: 0 0 8px #63efb2;
}

.css3d-sign__title {
  position: relative;
  margin-top: 16px;
  color: #ffffff;
  font-size: 23px;
  font-weight: 700;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.css3d-sign__value {
  position: relative;
  margin-top: 8px;
  color: var(--sign-accent);
  font-size: 29px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 1px;
  text-shadow: 0 0 12px color-mix(in srgb, var(--sign-accent) 62%, transparent);
}

.css3d-sign__detail {
  position: relative;
  margin-top: 14px;
  color: #b1c9d1;
  font-size: 13px;
  line-height: 1.45;
}

.css3d-sign__footer {
  position: absolute;
  right: 28px;
  bottom: 17px;
  left: 28px;
  padding-top: 8px;
  border-top: 1px solid rgba(183, 236, 247, 0.16);
  color: #7696a1;
  font-size: 9px;
}

@media (max-width: 700px) {
  .demo-panel {
    top: 12px;
    right: 12px;
    left: 12px;
    width: auto;
    padding: 15px;
  }

  .demo-panel p {
    max-width: 440px;
  }
}
</style>
