<template>
  <div :class="['menubox box1', showPanel ? '' : 'hide']">
    <div class="menuclose" @click="handleShowPanel">
      <el-icon size="20">
        <Close />
      </el-icon>
    </div>
    <div class="menucell">
      <div>
        <span>鼠标控制模型移动：</span>
        <el-switch v-model="isAnimation" width="80" size="large" inline-prompt
          style="--el-switch-on-color: #13ce66; --el-switch-off-color: #ff4949" active-text="开启移动" inactive-text="停止移动"
          @change="handleAnimationChange" />
      </div>
      <div class="status">当前状态：{{ statusText }}</div>
      <div>操作说明：开启移动后，点击地图任意位置，模型自动走向点击处；移动中可随时点击改道；关闭开关停止移动，再次开启后继续走向目标</div>
    </div>
    <div v-if="!showPanel" class="hideicon" @click="handleShowPanel">
      <el-icon size="30">
        <Grid />
      </el-icon>
    </div>
  </div>
  <Map :showStatusBar="true" @loaded="handleMapLoaded"></Map>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import * as Cesium from "cesium";
import { Grid, Close } from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";

let viewer: Cesium.Viewer;
const showPanel = ref(true);
const isAnimation = ref(false);
// 是否已到达目标点
const arrived = ref(true);

let modelEntity: Cesium.Entity | null = null;
let positionProperty: Cesium.ConstantPositionProperty | null = null;
let orientationProperty: Cesium.ConstantProperty | null = null;
let removeTickListener: (() => void) | null = null;
// 点击特效：扩散涟漪圆环 + 目标点标记
let rippleEntity: Cesium.Entity | null = null;
let targetMarkerEntity: Cesium.Entity | null = null;
let rippleStartTime: Cesium.JulianDate | null = null;

const setModelAnimations = (running: boolean) => {
  const model = modelEntity?.model;
  if (model) {
    model.runAnimations = new Cesium.ConstantProperty(running);
  }
};

// 模型当前位置（ECEF 笛卡尔坐标）
let currentPosition = Cesium.Cartesian3.fromDegrees(117.210698, 38.617627, 0);
// 目标点（ECEF），null 表示无目标
let targetPosition: Cesium.Cartesian3 | null = null;
// 上一帧时间，用于计算帧间隔 dt
let lastTickTime: Cesium.JulianDate | null = null;

// 移动速度：度/秒（与原键盘控制页面一致）
const SPEED = 0.0001;
// 到达判定距离：米
const ARRIVE_DISTANCE_M = 2;
// 地球半径：米（用于角度距离换算）
const EARTH_RADIUS = Cesium.Ellipsoid.WGS84.maximumRadius;

// 根据移动方向计算模型朝向。
// Cesium 模型前方向为 +X，而 headingPitchRollQuaternion 中 heading 为 0 时
// 模型面朝正东，因此需在移动方向方位角的基础上减 π/2，
// 使模型面朝移动方向（与原 VelocityOrientationProperty 效果一致）。
const getHeading = (dLon: number, dLat: number, latitude: number) =>
  Math.atan2(dLon * Math.cos(latitude), dLat) - Cesium.Math.PI_OVER_TWO;

const statusText = computed(() => {
  if (!isAnimation.value) return "未开启移动，开启后点击地图任意位置";
  if (!targetPosition) {
    return arrived.value
      ? "已到达目标点，可继续点击地图"
      : "已开启移动，点击地图任意位置设定目标";
  }
  return "移动中，可随时点击地图改道";
});

const handleMapLoaded = (MapViewer: Cesium.Viewer) => {
  viewer = MapViewer;
  viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;

  const startTime = new Date().getTime();
  viewer.clock.startTime = Cesium.JulianDate.fromDate(new Date(startTime));
  viewer.clock.currentTime = viewer.clock.startTime.clone();
  viewer.clock.shouldAnimate = false;
  viewer.clock.multiplier = 1;

  reset();
  addModel();
  setupClickHandler();

  // 每帧直接朝目标点移动：目标点由鼠标点击实时更新，
  // 中途点击其他位置下一帧即改道，无延迟
  removeTickListener = viewer.clock.onTick.addEventListener(() => {
    const time = viewer.clock.currentTime;
    const dt = lastTickTime
      ? Cesium.JulianDate.secondsDifference(time, lastTickTime)
      : 0;
    lastTickTime = time.clone();

    // 时钟恢复后的第一帧 dt 异常大，跳过该帧
    if (
      !isAnimation.value ||
      !modelEntity ||
      !positionProperty ||
      !orientationProperty ||
      !targetPosition ||
      dt <= 0
    )
      return;

    // 页面卡顿/节流时 dt 可能很大，限制单帧步长防止瞬移
    const stepDt = Math.min(dt, 0.5);

    const currentCarto = Cesium.Cartographic.fromCartesian(currentPosition);
    const targetCarto = Cesium.Cartographic.fromCartesian(targetPosition);
    const dLon = targetCarto.longitude - currentCarto.longitude;
    const dLat = targetCarto.latitude - currentCarto.latitude;
    const cosLat = Math.cos(currentCarto.latitude);
    const distRad = Math.sqrt(dLon * dLon * cosLat * cosLat + dLat * dLat);
    const distMeters = distRad * EARTH_RADIUS;

    // 已到达目标点：停止移动与行走动画
    if (distMeters <= ARRIVE_DISTANCE_M) {
      currentPosition = targetPosition;
      positionProperty.setValue(currentPosition);
      targetPosition = null;
      arrived.value = true;
      setModelAnimations(false);
      return;
    }

    const stepRad = Cesium.Math.toRadians(SPEED) * stepDt;
    if (distRad <= stepRad) {
      // 剩余距离不足一帧步长，直接落到目标点
      currentPosition = targetPosition;
      positionProperty.setValue(currentPosition);
      targetPosition = null;
      arrived.value = true;
      setModelAnimations(false);
      return;
    }

    // 朝目标点前进，并保持朝向与移动方向一致
    currentPosition = Cesium.Cartesian3.fromRadians(
      currentCarto.longitude + (dLon / distRad) * stepRad,
      currentCarto.latitude + (dLat / distRad) * stepRad,
      0
    );
    positionProperty.setValue(currentPosition);
    orientationProperty.setValue(
      Cesium.Transforms.headingPitchRollQuaternion(
        currentPosition,
        new Cesium.HeadingPitchRoll(
          getHeading(dLon, dLat, currentCarto.latitude),
          0,
          0
        )
      )
    );
  });
};

const addModel = () => {
  if (modelEntity) {
    viewer.entities.remove(modelEntity);
  }

  // 重置模型位置与状态
  currentPosition = Cesium.Cartesian3.fromDegrees(117.210698, 38.617627, 0);
  targetPosition = null;
  arrived.value = true;
  lastTickTime = null;

  positionProperty = new Cesium.ConstantPositionProperty(currentPosition);
  orientationProperty = new Cesium.ConstantProperty(
    Cesium.Transforms.headingPitchRollQuaternion(
      currentPosition,
      // heading -π/2 对应面朝正北
      new Cesium.HeadingPitchRoll(-Cesium.Math.PI_OVER_TWO, 0, 0)
    )
  );

  const model = viewer.entities.add({
    position: positionProperty,
    orientation: orientationProperty,
    name: "Cesium_Man",
    model: {
      scale: 16,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      uri: "./models/Cesium_Man.glb",
      clampAnimations: true,
      // 初始站立不动，点击目标后开始播放行走动画
      runAnimations: new Cesium.ConstantProperty(false),
      color: Cesium.Color.RED,
      colorBlendMode: Cesium.ColorBlendMode.MIX,
      colorBlendAmount: 0.5,
      silhouetteColor: new Cesium.Color(0, 1, 0, 1.0),
      silhouetteSize: 2.0,
    },
  });
  modelEntity = model;
};

// 点击特效：在点击处显示扩散涟漪圆环和目标点标记
const RIPPLE_DURATION = 0.5; // 涟漪动画时长：秒
const RIPPLE_MAX_RADIUS = 20; // 涟漪最大半径：米
const showClickEffect = (position: Cesium.Cartesian3) => {
  // 移除上一次的特效
  if (rippleEntity) {
    viewer.entities.remove(rippleEntity);
    rippleEntity = null;
  }
  if (targetMarkerEntity) {
    viewer.entities.remove(targetMarkerEntity);
    targetMarkerEntity = null;
  }
  rippleStartTime = viewer.clock.currentTime.clone();

  // 目标点标记：常驻显示，到达后仍可见，直到下一次点击
  targetMarkerEntity = viewer.entities.add({
    position,
    point: {
      pixelSize: 12,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // 扩散涟漪圆环：半径随时间扩大、透明度渐隐
  const radiusCallback = new Cesium.CallbackProperty((time?: Cesium.JulianDate) => {
    const currentTime = time ?? rippleStartTime;
    if (!rippleStartTime || !currentTime) return 0;
    const t = Cesium.JulianDate.secondsDifference(currentTime, rippleStartTime) / RIPPLE_DURATION;
    const progress = Math.max(0, Math.min(1, t));
    return 8 + progress * (RIPPLE_MAX_RADIUS - 8);
  }, false);
  const ripple = viewer.entities.add({
    position,
    ellipse: {
      semiMajorAxis: radiusCallback,
      semiMinorAxis: radiusCallback,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      material: new Cesium.ColorMaterialProperty(
        new Cesium.CallbackProperty((time?: Cesium.JulianDate) => {
          const currentTime = time ?? rippleStartTime;
          if (!rippleStartTime || !currentTime) {
            return Cesium.Color.CYAN.withAlpha(0);
          }
          const t = Cesium.JulianDate.secondsDifference(currentTime, rippleStartTime) / RIPPLE_DURATION;
          return Cesium.Color.CYAN.withAlpha(Math.max(0, 1 - t) * 0.8);
        }, false)
      ),
    },
  });
  rippleEntity = ripple;

  // 动画结束后移除涟漪（防止快速连续点击时误删新涟漪，比较实体引用）
  setTimeout(() => {
    if (rippleEntity === ripple) {
      viewer.entities.remove(ripple);
      rippleEntity = null;
    }
  }, RIPPLE_DURATION * 1000 + 200);
};

// 鼠标点击地图：拾取点击处坐标，立即设为新的目标点
const setupClickHandler = () => {
  viewer.screenSpaceEventHandler.setInputAction(
    (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      if (!isAnimation.value || !modelEntity) return;
      const picked = viewer.camera.pickEllipsoid(
        movement.position,
        viewer.scene.globe.ellipsoid
      );
      if (!picked) return; // 点击到天空等非地表区域时忽略

      targetPosition = picked;
      arrived.value = false;
      // 恢复行走动画
      setModelAnimations(true);
      // 播放点击特效
      showClickEffect(picked);
    },
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );
};

const handleAnimationChange = (val: boolean) => {
  isAnimation.value = val;
  viewer.clock.shouldAnimate = val;
  if (!val) {
    // 关闭开关停止移动，保留目标点，再次开启后继续走向目标
    setModelAnimations(false);
  } else if (targetPosition && modelEntity) {
    setModelAnimations(true);
  }
};

const handleShowPanel = () => {
  showPanel.value = !showPanel.value;
};

const reset = () => {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(117.2105, 38.616, 320),
    orientation: {
      heading: Cesium.Math.toRadians(361),
      pitch: Cesium.Math.toRadians(-50),
      roll: 0.0,
    },
    duration: 1,
  });
};

onUnmounted(() => {
  if (removeTickListener) removeTickListener();
  if (viewer) {
    viewer.screenSpaceEventHandler.removeInputAction(
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
  }
});
</script>

<style scoped lang="scss">
.menubox {
  position: absolute;
  z-index: 999;
  border-bottom-right-radius: 10px;
  // padding: 0 10px 10px;
  border: 1px solid rgba(139, 139, 139, 0.2);
  background-color: #e6e6e6;
  color: #2e2e2e;
  user-select: none;
  transition: all 0.3s;

  .menuclose {
    position: absolute;
    right: 4px;
    top: 4px;
    cursor: pointer;
    color: #006269;

    &:hover {
      color: #00ccb1;
    }
  }

  &.hide {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    padding: 0;
    background-color: #01a1fd;
    // border: 1px solid #00eeff;
    transition: all 0.3s;

    &:hover {
      box-shadow: 0 0 4px 1px #00eeff;
    }

    .el-tabs {
      display: none;
    }

    .menucell {
      display: none;
    }

    .menuclose {
      display: none;
    }
  }

  &.box1 {
    left: 5px;
    top: 65px;
  }

  .hideicon {
    width: 30px;
    height: 30px;
    padding: 5px;
    transition: all 0.3s;
  }

  .menucell {
    padding: 10px;
    max-width: 500px;
  }
}

.status {
  margin: 10px 0;
  color: #006269;
}
</style>
