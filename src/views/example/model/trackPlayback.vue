<template>
  <div class="track-page">
    <aside :class="['track-panel', { collapsed: !showPanel }]">
      <button
        v-if="showPanel"
        class="icon-button panel-close"
        type="button"
        title="收起面板"
        @click="togglePanel"
      >
        <el-icon size="18"><Close /></el-icon>
      </button>
      <button
        v-else
        class="panel-open"
        type="button"
        title="打开面板"
        @click="togglePanel"
      >
        <el-icon size="22"><Grid /></el-icon>
      </button>

      <div v-if="showPanel" class="panel-content">
        <div class="panel-heading">
          <div>
            <div class="eyebrow">TRACK PLAYBACK</div>
            <h1>轨迹编辑与相机跟随</h1>
          </div>
          <button class="icon-button" type="button" title="恢复默认路径" @click="restoreDefaultPath">
            <el-icon size="17"><Refresh /></el-icon>
          </button>
        </div>

        <div class="status-row">
          <span :class="['status-dot', { playing: isPlaying }]"></span>
          <span>{{ playbackStatus }}</span>
          <span>{{ pathPositions.length }} 个路径点</span>
        </div>

        <section class="section">
          <div class="section-heading">
            <span>路径点编辑</span>
            <span class="section-caption">{{ addPointMode ? "点击地图添加" : "拖动地图查看" }}</span>
          </div>
          <div class="button-row">
            <button
              :class="['action-button', { active: addPointMode }]"
              type="button"
              :disabled="isPlaying"
              @click="toggleAddPoint"
            >
              <el-icon><Plus /></el-icon>
              添加路径点
            </button>
            <button class="action-button action-button--muted" type="button" @click="clearPath">
              <el-icon><Delete /></el-icon>
              清空
            </button>
          </div>

          <el-table
            v-if="pathPositions.length"
            :data="pathPositions"
            class="path-table"
            size="small"
            max-height="210"
          >
            <el-table-column type="index" label="#" width="42" />
            <el-table-column label="经度" min-width="96">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.longitude"
                  :controls="false"
                  :precision="6"
                  size="small"
                  @change="handlePathEdit"
                />
              </template>
            </el-table-column>
            <el-table-column label="纬度" min-width="96">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.latitude"
                  :controls="false"
                  :precision="6"
                  size="small"
                  @change="handlePathEdit"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="48">
              <template #default="{ $index }">
                <button
                  class="table-icon-button"
                  type="button"
                  title="删除路径点"
                  @click="removePathPoint($index)"
                >
                  <el-icon><Delete /></el-icon>
                </button>
              </template>
            </el-table-column>
          </el-table>
          <div v-else class="empty-state">
            <el-icon size="20"><Pointer /></el-icon>
            <span>添加至少两个路径点开始播放</span>
          </div>
        </section>

        <section class="section">
          <div class="section-heading">
            <span>时间轴播放</span>
            <span class="section-caption">{{ formatTime(currentSeconds) }} / {{ formatTime(pathDuration) }}</span>
          </div>
          <div class="transport-controls">
            <button
              class="transport-button"
              type="button"
              title="停止并回到起点"
              :disabled="!canPlay"
              @click="stopPlayback"
            >
              <el-icon size="16"><CircleClose /></el-icon>
            </button>
            <button
              class="transport-button transport-button--primary"
              type="button"
              :title="isPlaying ? '暂停播放' : '开始播放'"
              :disabled="!canPlay"
              @click="togglePlayback"
            >
              <el-icon size="18">
                <VideoPause v-if="isPlaying" />
                <VideoPlay v-else />
              </el-icon>
            </button>
            <button
              class="transport-button"
              type="button"
              title="从头播放"
              :disabled="!canPlay"
              @click="restartPlayback"
            >
              <el-icon size="16"><RefreshRight /></el-icon>
            </button>
          </div>
          <div class="timeline-labels">
            <span>{{ formatTime(currentSeconds) }}</span>
            <span>{{ formatTime(pathDuration) }}</span>
          </div>
          <el-slider
            v-model="progress"
            :min="0"
            :max="100"
            :step="0.1"
            :disabled="!canPlay"
            :show-tooltip="false"
            @change="seekPlayback"
          />
          <div class="setting-row">
            <span>播放倍速</span>
            <el-select v-model="playbackRate" size="small" :disabled="!canPlay" @change="handleRateChange">
              <el-option label="0.5x" :value="0.5" />
              <el-option label="1x" :value="1" />
              <el-option label="2x" :value="2" />
              <el-option label="4x" :value="4" />
            </el-select>
          </div>
          <div class="setting-row">
            <span>循环播放</span>
            <el-switch v-model="loopEnabled" size="small" :disabled="!canPlay" @change="handleLoopChange" />
          </div>
        </section>

        <section class="section">
          <div class="section-heading">
            <span>相机跟随</span>
            <span class="section-caption">播放时锁定视角</span>
          </div>
          <el-radio-group v-model="followMode" size="small" @change="handleFollowModeChange">
            <el-radio-button value="free">自由</el-radio-button>
            <el-radio-button value="first">第一人称</el-radio-button>
            <el-radio-button value="third">第三人称</el-radio-button>
          </el-radio-group>
          <div v-if="followMode === 'third'" class="setting-row">
            <span>跟随距离</span>
            <el-input-number
              v-model="followDistance"
              :min="20"
              :max="1000"
              :step="10"
              size="small"
              controls-position="right"
            />
          </div>
        </section>

        <section class="section">
          <div class="section-heading">
            <span>相机关键帧</span>
            <span class="section-caption">{{ keyframes.length }} 个关键帧</span>
          </div>
          <div class="button-row">
            <button class="action-button" type="button" @click="recordKeyframe">
              <el-icon><Camera /></el-icon>
              记录当前相机
            </button>
            <button
              class="action-button action-button--muted"
              type="button"
              :disabled="keyframes.length < 2"
              @click="playCameraTour"
            >
              <el-icon><VideoPlay /></el-icon>
              播放巡航
            </button>
          </div>
          <div v-if="keyframes.length" class="keyframe-list">
            <div v-for="(keyframe, index) in keyframes" :key="keyframe.id" class="keyframe-row">
              <span class="keyframe-index">{{ String(index + 1).padStart(2, "0") }}</span>
              <span class="keyframe-label">T {{ formatTime(keyframe.seconds) }}</span>
              <button class="table-icon-button" type="button" title="删除关键帧" @click="removeKeyframe(index)">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>
          <div v-else class="empty-state empty-state--compact">
            <el-icon size="18"><Camera /></el-icon>
            <span>调整相机后记录关键帧</span>
          </div>
        </section>
      </div>
    </aside>

    <Map
      :loadTerrain="false"
      :showLayerSelect="false"
      :showStatusBar="true"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      @loaded="handleMapLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import * as Cesium from "cesium";
import {
  Camera,
  CircleClose,
  Close,
  Delete,
  Grid,
  Plus,
  Pointer,
  Refresh,
  RefreshRight,
  VideoPause,
  VideoPlay,
} from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";

type FollowMode = "free" | "first" | "third";

interface PathPoint {
  longitude: number;
  latitude: number;
  height: number;
}

interface CameraKeyframe {
  id: number;
  seconds: number;
  position: Cesium.Cartesian3;
  heading: number;
  pitch: number;
  roll: number;
}

const DEFAULT_PATH: PathPoint[] = [
  { longitude: 117.21067, latitude: 38.619915, height: 0 },
  { longitude: 117.210677, latitude: 38.618953, height: 0 },
  { longitude: 117.209499, latitude: 38.618965, height: 0 },
  { longitude: 117.208264, latitude: 38.618938, height: 0 },
  { longitude: 117.2083, latitude: 38.618266, height: 0 },
  { longitude: 117.209325, latitude: 38.618252, height: 0 },
  { longitude: 117.210683, latitude: 38.618237, height: 0 },
  { longitude: 117.210688, latitude: 38.617351, height: 0 },
  { longitude: 117.212041, latitude: 38.617346, height: 0 },
];

const cameraDestination = {
  longitude: 117.2105,
  latitude: 38.616,
  height: 320,
};

const cameraOrientation = {
  heading: 1,
  pitch: -50,
  roll: 0,
};

const showPanel = ref(true);
const viewerReady = ref(false);
const pathPositions = ref<PathPoint[]>(clonePath(DEFAULT_PATH));
const addPointMode = ref(false);
const isPlaying = ref(false);
const loopEnabled = ref(true);
const playbackRate = ref(1);
const progress = ref(0);
const currentSeconds = ref(0);
const pathDuration = ref(0);
const followMode = ref<FollowMode>("free");
const followDistance = ref(140);
const cameraTourEnabled = ref(false);
const keyframes = ref<CameraKeyframe[]>([]);

let viewer: Cesium.Viewer | null = null;
let modelEntity: Cesium.Entity | null = null;
let lineEntity: Cesium.Entity | null = null;
let pointEntities: Cesium.Entity[] = [];
let positionProperty: Cesium.SampledPositionProperty | null = null;
let orientationProperty: Cesium.VelocityOrientationProperty | null = null;
let startTime: Cesium.JulianDate | null = null;
let stopTime: Cesium.JulianDate | null = null;
let eventHandler: Cesium.ScreenSpaceEventHandler | null = null;
let playbackFrameId: number | null = null;
let lastPlaybackTimestamp: number | null = null;
let followHeading: number | null = null;
let nextKeyframeId = 1;

const canPlay = computed(
  () => viewerReady.value && pathPositions.value.length >= 2 && pathDuration.value > 0,
);
const playbackStatus = computed(() => {
  if (cameraTourEnabled.value) return isPlaying.value ? "相机巡航中" : "相机巡航已暂停";
  if (isPlaying.value) return "轨迹播放中";
  if (pathPositions.value.length < 2) return "等待路径点";
  return "轨迹已暂停";
});

function clonePath(points: PathPoint[]): PathPoint[] {
  return points.map((point) => ({ ...point }));
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const getPointCartesian = (point: PathPoint) =>
  Cesium.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height);

const FIRST_PERSON_HEIGHT = 11.25;
const FIRST_PERSON_FORWARD_OFFSET = 0.6;
const HEADING_LOOK_AHEAD_SECONDS = 1.8;
const HEADING_SMOOTHING = 0.18;
const MODEL_SCALE = 8;
const ROUTE_SPEED = 16 * (MODEL_SCALE / 16);
const ROUTE_SAMPLE_STEP = 4.5;
const CORNER_ROUNDING_DISTANCE = 8;

const appendLinearSamples = (
  samples: Cesium.Cartesian3[],
  from: Cesium.Cartesian3,
  to: Cesium.Cartesian3,
) => {
  const distance = Cesium.Cartesian3.distance(from, to);
  const count = Math.max(1, Math.ceil(distance / ROUTE_SAMPLE_STEP));
  for (let index = 1; index <= count; index += 1) {
    samples.push(
      Cesium.Cartesian3.lerp(
        from,
        to,
        index / count,
        new Cesium.Cartesian3(),
      ),
    );
  }
};

// Keep each original segment straight and round only a short neighborhood around corners.
const buildCornerSmoothedRoute = (
  controlPoints: Cesium.Cartesian3[],
): Cesium.Cartesian3[] => {
  const samples: Cesium.Cartesian3[] = [
    Cesium.Cartesian3.clone(controlPoints[0], new Cesium.Cartesian3()),
  ];

  for (let index = 1; index < controlPoints.length - 1; index += 1) {
    const previous = controlPoints[index - 1];
    const current = controlPoints[index];
    const next = controlPoints[index + 1];
    const incomingLength = Cesium.Cartesian3.distance(previous, current);
    const outgoingLength = Cesium.Cartesian3.distance(current, next);
    const roundingDistance = Math.min(
      CORNER_ROUNDING_DISTANCE,
      incomingLength * 0.2,
      outgoingLength * 0.2,
    );

    if (roundingDistance < 1) {
      appendLinearSamples(samples, samples[samples.length - 1], current);
      continue;
    }

    const entry = Cesium.Cartesian3.lerp(
      current,
      previous,
      roundingDistance / incomingLength,
      new Cesium.Cartesian3(),
    );
    const exit = Cesium.Cartesian3.lerp(
      current,
      next,
      roundingDistance / outgoingLength,
      new Cesium.Cartesian3(),
    );
    appendLinearSamples(samples, samples[samples.length - 1], entry);

    let previousCurvePoint = entry;
    const curveSteps = 8;
    for (let step = 1; step <= curveSteps; step += 1) {
      const ratio = step / curveSteps;
      const oneMinusRatio = 1 - ratio;
      const curvePoint = new Cesium.Cartesian3(
        oneMinusRatio * oneMinusRatio * entry.x +
          2 * oneMinusRatio * ratio * current.x +
          ratio * ratio * exit.x,
        oneMinusRatio * oneMinusRatio * entry.y +
          2 * oneMinusRatio * ratio * current.y +
          ratio * ratio * exit.y,
        oneMinusRatio * oneMinusRatio * entry.z +
          2 * oneMinusRatio * ratio * current.z +
          ratio * ratio * exit.z,
      );
      appendLinearSamples(samples, previousCurvePoint, curvePoint);
      previousCurvePoint = curvePoint;
    }
  }

  appendLinearSamples(
    samples,
    samples[samples.length - 1],
    controlPoints[controlPoints.length - 1],
  );
  return samples;
};

const clearSceneEntities = () => {
  if (!viewer) return;
  if (modelEntity) viewer.entities.remove(modelEntity);
  if (lineEntity) viewer.entities.remove(lineEntity);
  pointEntities.forEach((entity) => viewer?.entities.remove(entity));
  modelEntity = null;
  lineEntity = null;
  pointEntities = [];
};

const setModelVisibility = (visible: boolean) => {
  if (!modelEntity?.model) return;
  modelEntity.model.show = new Cesium.ConstantProperty(visible);
};

const rebuildTrack = (resetTime = true) => {
  if (!viewer) return;
  const preservedSeconds = resetTime ? 0 : currentSeconds.value;
  cancelPlaybackLoop();
  clearSceneEntities();
  positionProperty = null;
  orientationProperty = null;
  startTime = null;
  stopTime = null;
  followHeading = null;
  pathDuration.value = 0;
  progress.value = 0;
  currentSeconds.value = 0;
  isPlaying.value = false;
  cameraTourEnabled.value = false;
  viewer.clock.shouldAnimate = false;

  if (pathPositions.value.length < 2) return;

  const nextStart = Cesium.JulianDate.fromDate(new Date());
  const sampledPosition = new Cesium.SampledPositionProperty();
  const controlPoints = pathPositions.value.map(getPointCartesian);
  const sampledRoutePositions = buildCornerSmoothedRoute(controlPoints);
  let elapsed = 0;
  sampledPosition.addSample(nextStart, sampledRoutePositions[0]);
  for (let index = 1; index < sampledRoutePositions.length; index += 1) {
    elapsed += Math.max(
      0.05,
      Cesium.Cartesian3.distance(
        sampledRoutePositions[index - 1],
        sampledRoutePositions[index],
      ) / ROUTE_SPEED,
    );
    sampledPosition.addSample(
      Cesium.JulianDate.addSeconds(nextStart, elapsed, new Cesium.JulianDate()),
      sampledRoutePositions[index],
    );
  }

  sampledPosition.setInterpolationOptions({
    interpolationAlgorithm: Cesium.LinearApproximation,
    interpolationDegree: 1,
  });

  startTime = nextStart;
  stopTime = Cesium.JulianDate.addSeconds(
    nextStart,
    Math.max(elapsed, 1),
    new Cesium.JulianDate(),
  );
  pathDuration.value = Math.max(elapsed, 1);
  positionProperty = sampledPosition;
  orientationProperty = new Cesium.VelocityOrientationProperty(sampledPosition);

  viewer.clock.startTime = nextStart.clone();
  viewer.clock.stopTime = stopTime.clone();
  viewer.clock.currentTime = nextStart.clone();
  viewer.clock.clockRange = loopEnabled.value
    ? Cesium.ClockRange.LOOP_STOP
    : Cesium.ClockRange.CLAMPED;
  viewer.clock.multiplier = 1;

  modelEntity = viewer.entities.add({
    position: sampledPosition,
    orientation: orientationProperty,
    name: "轨迹目标",
    model: {
      uri: "./models/Cesium_Man.glb",
      scale: MODEL_SCALE,
      clampAnimations: true,
      heightReference: Cesium.HeightReference.NONE,
      color: Cesium.Color.fromCssColorString("#f04f78"),
      colorBlendMode: Cesium.ColorBlendMode.MIX,
      colorBlendAmount: 0.35,
      silhouetteColor: Cesium.Color.fromCssColorString("#7cecff"),
      silhouetteSize: 2,
    },
  });
  setModelVisibility(followMode.value !== "first");

  lineEntity = viewer.entities.add({
    polyline: {
      positions: sampledRoutePositions,
      width: 4,
      clampToGround: true,
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString("#48d7e8").withAlpha(0.85),
      ),
    },
  });

  pointEntities = pathPositions.value.map((point, index) =>
    viewer!.entities.add({
      id: `track-point-${index}`,
      position: getPointCartesian(point),
      point: {
        pixelSize: 9,
        color: Cesium.Color.fromCssColorString("#ffe66d"),
        outlineColor: Cesium.Color.fromCssColorString("#10242d"),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    }),
  );

  updatePlayback(resetTime ? 0 : Math.min(preservedSeconds, pathDuration.value));
};

const getCurrentPosition = (time: Cesium.JulianDate) => {
  return positionProperty?.getValue(time, new Cesium.Cartesian3()) ?? null;
};

const getBearing = (
  from: Cesium.Cartesian3,
  to: Cesium.Cartesian3,
): number | null => {
  const fromCartographic = Cesium.Cartographic.fromCartesian(
    from,
    Cesium.Ellipsoid.WGS84,
    new Cesium.Cartographic(),
  );
  const toCartographic = Cesium.Cartographic.fromCartesian(
    to,
    Cesium.Ellipsoid.WGS84,
    new Cesium.Cartographic(),
  );
  if (!fromCartographic || !toCartographic) return null;
  let deltaLongitude = toCartographic.longitude - fromCartographic.longitude;
  while (deltaLongitude > Math.PI) deltaLongitude -= Math.PI * 2;
  while (deltaLongitude < -Math.PI) deltaLongitude += Math.PI * 2;
  const y = Math.sin(deltaLongitude) * Math.cos(toCartographic.latitude);
  const x =
    Math.cos(fromCartographic.latitude) * Math.sin(toCartographic.latitude) -
    Math.sin(fromCartographic.latitude) *
      Math.cos(toCartographic.latitude) *
      Math.cos(deltaLongitude);
  return Math.atan2(y, x);
};

const getCurrentHeading = (time: Cesium.JulianDate): number => {
  if (!startTime || !stopTime) return followHeading ?? 0;
  const seconds = Math.max(
    0,
    Math.min(
      pathDuration.value,
      Cesium.JulianDate.secondsDifference(time, startTime),
    ),
  );
  const current = getCurrentPosition(time);
  if (!current) return followHeading ?? 0;

  const lookAheadSeconds = Math.min(
    pathDuration.value,
    seconds + HEADING_LOOK_AHEAD_SECONDS,
  );
  let from = current;
  let to = getCurrentPosition(
    Cesium.JulianDate.addSeconds(
      startTime,
      lookAheadSeconds,
      new Cesium.JulianDate(),
    ),
  );

  if (!to || lookAheadSeconds <= seconds + 0.01) {
    const previousSeconds = Math.max(0, seconds - HEADING_LOOK_AHEAD_SECONDS);
    from =
      getCurrentPosition(
        Cesium.JulianDate.addSeconds(
          startTime,
          previousSeconds,
          new Cesium.JulianDate(),
        ),
      ) ?? current;
    to = current;
  }

  const rawHeading = getBearing(from, to);
  if (rawHeading === null) return followHeading ?? 0;
  followHeading =
    followHeading === null
      ? rawHeading
      : interpolateAngle(followHeading, rawHeading, HEADING_SMOOTHING);
  return followHeading;
};

const getLocalCameraPosition = (
  origin: Cesium.Cartesian3,
  east: number,
  north: number,
  up: number,
) => {
  const localFrame = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  return Cesium.Matrix4.multiplyByPoint(
    localFrame,
    new Cesium.Cartesian3(east, north, up),
    new Cesium.Cartesian3(),
  );
};

const updateFollowCamera = (time: Cesium.JulianDate) => {
  if (!viewer || !positionProperty || followMode.value === "free") return;
  const position = getCurrentPosition(time);
  if (!position) return;
  const heading = getCurrentHeading(time);

  if (followMode.value === "third") {
    viewer.camera.lookAt(
      position,
      new Cesium.HeadingPitchRange(
        heading + Math.PI,
        Cesium.Math.toRadians(-25),
        followDistance.value,
      ),
    );
    return;
  }

  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  const cameraPosition = getLocalCameraPosition(
    position,
    Math.sin(heading) * FIRST_PERSON_FORWARD_OFFSET,
    Math.cos(heading) * FIRST_PERSON_FORWARD_OFFSET,
    FIRST_PERSON_HEIGHT,
  );
  viewer.camera.setView({
    destination: cameraPosition,
    orientation: {
      heading,
      pitch: Cesium.Math.toRadians(-2),
      roll: 0,
    },
  });
};

const interpolateAngle = (from: number, to: number, ratio: number) => {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * ratio;
};

const applyCameraTour = (seconds: number) => {
  if (!viewer || keyframes.value.length < 2) return;
  const sorted = keyframes.value;
  let from = sorted[0];
  let to = sorted[sorted.length - 1];
  for (let index = 1; index < sorted.length; index += 1) {
    if (seconds <= sorted[index].seconds) {
      from = sorted[index - 1];
      to = sorted[index];
      break;
    }
  }
  const span = Math.max(to.seconds - from.seconds, 0.001);
  const ratio = Math.max(0, Math.min(1, (seconds - from.seconds) / span));
  const position = Cesium.Cartesian3.lerp(
    from.position,
    to.position,
    ratio,
    new Cesium.Cartesian3(),
  );
  viewer.camera.setView({
    destination: position,
    orientation: {
      heading: interpolateAngle(from.heading, to.heading, ratio),
      pitch: interpolateAngle(from.pitch, to.pitch, ratio),
      roll: interpolateAngle(from.roll, to.roll, ratio),
    },
  });
};

const updatePlayback = (seconds = currentSeconds.value) => {
  if (!viewer || !startTime || !stopTime) return;
  const elapsed = Math.max(0, Math.min(pathDuration.value, seconds));
  viewer.clock.currentTime = Cesium.JulianDate.addSeconds(
    startTime,
    elapsed,
    new Cesium.JulianDate(),
  );
  currentSeconds.value = elapsed;
  progress.value = pathDuration.value
    ? (elapsed / pathDuration.value) * 100
    : 0;

  if (cameraTourEnabled.value) {
    applyCameraTour(elapsed);
  } else {
    updateFollowCamera(viewer.clock.currentTime);
  }

  viewer.scene.requestRender();
};

const cancelPlaybackLoop = () => {
  if (playbackFrameId !== null) {
    cancelAnimationFrame(playbackFrameId);
    playbackFrameId = null;
  }
  lastPlaybackTimestamp = null;
};

const playbackFrame = (timestamp: number) => {
  if (!isPlaying.value || !viewer) {
    playbackFrameId = null;
    lastPlaybackTimestamp = null;
    return;
  }
  const previousTimestamp = lastPlaybackTimestamp ?? timestamp;
  const deltaSeconds = Math.min(
    0.1,
    Math.max(0, (timestamp - previousTimestamp) / 1000),
  );
  lastPlaybackTimestamp = timestamp;
  let nextSeconds = currentSeconds.value + deltaSeconds * playbackRate.value;
  if (loopEnabled.value && pathDuration.value > 0) {
    nextSeconds %= pathDuration.value;
  } else if (nextSeconds >= pathDuration.value) {
    nextSeconds = pathDuration.value;
    isPlaying.value = false;
  }
  updatePlayback(nextSeconds);
  if (isPlaying.value) {
    playbackFrameId = requestAnimationFrame(playbackFrame);
  } else {
    playbackFrameId = null;
    lastPlaybackTimestamp = null;
  }
};

const startPlaybackLoop = () => {
  cancelPlaybackLoop();
  lastPlaybackTimestamp = null;
  playbackFrameId = requestAnimationFrame(playbackFrame);
};

const togglePlayback = () => {
  if (!viewer || !canPlay.value) return;
  if (isPlaying.value) {
    isPlaying.value = false;
    cancelPlaybackLoop();
    return;
  }
  if (!loopEnabled.value && currentSeconds.value >= pathDuration.value) {
    seekPlayback(0);
  }
  isPlaying.value = true;
  startPlaybackLoop();
};

const stopPlayback = () => {
  if (!viewer || !startTime) return;
  isPlaying.value = false;
  cancelPlaybackLoop();
  cameraTourEnabled.value = false;
  viewer.clock.shouldAnimate = false;
  updatePlayback(0);
};

const restartPlayback = () => {
  stopPlayback();
  togglePlayback();
};

const seekPlayback = (value: number | number[]) => {
  if (!viewer || !startTime) return;
  const nextProgress = Array.isArray(value) ? value[0] : value;
  if (!Number.isFinite(nextProgress)) return;
  const nextSeconds =
    (Math.max(0, Math.min(100, nextProgress)) / 100) * pathDuration.value;
  lastPlaybackTimestamp = null;
  followHeading = null;
  updatePlayback(nextSeconds);
};

const handleRateChange = (value: number) => {
  if (!viewer || !Number.isFinite(value)) return;
  playbackRate.value = value;
};

const handleLoopChange = () => {
  if (!viewer) return;
  if (!loopEnabled.value && currentSeconds.value >= pathDuration.value) {
    updatePlayback(pathDuration.value);
  }
};

const handleFollowModeChange = (mode: FollowMode) => {
  cameraTourEnabled.value = false;
  if (!viewer) return;
  if (mode === "free") {
    followHeading = null;
    setModelVisibility(true);
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    return;
  }
  followHeading = null;
  setModelVisibility(mode !== "first");
  if (mode === "first") viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  updateFollowCamera(viewer.clock.currentTime);
};

const toggleAddPoint = () => {
  addPointMode.value = !addPointMode.value;
};

const pickMapPosition = (position: Cesium.Cartesian2): Cesium.Cartesian3 | null => {
  if (!viewer) return null;
  if (viewer.scene.pickPositionSupported) {
    const picked = viewer.scene.pickPosition(position);
    if (picked) return picked;
  }
  return viewer.camera.pickEllipsoid(position, viewer.scene.globe.ellipsoid);
};

const handleMapClick = (
  movement: Cesium.ScreenSpaceEventHandler.PositionedEvent,
) => {
  if (!addPointMode.value || isPlaying.value) return;
  const picked = pickMapPosition(movement.position);
  if (!picked) return;
  const cartographic = Cesium.Cartographic.fromCartesian(picked);
  pathPositions.value.push({
    longitude: Number(Cesium.Math.toDegrees(cartographic.longitude).toFixed(6)),
    latitude: Number(Cesium.Math.toDegrees(cartographic.latitude).toFixed(6)),
    height: 0,
  });
  addPointMode.value = false;
  rebuildTrack();
};

const handlePathEdit = () => {
  if (!isPlaying.value) rebuildTrack();
};

const removePathPoint = (index: number) => {
  pathPositions.value.splice(index, 1);
  rebuildTrack();
};

const clearPath = () => {
  addPointMode.value = false;
  pathPositions.value = [];
  rebuildTrack();
};

const restoreDefaultPath = () => {
  addPointMode.value = false;
  pathPositions.value = clonePath(DEFAULT_PATH);
  rebuildTrack();
  resetView();
};

const recordKeyframe = () => {
  if (!viewer) return;
  keyframes.value.push({
    id: nextKeyframeId++,
    seconds: currentSeconds.value,
    position: Cesium.Cartesian3.clone(viewer.camera.positionWC),
    heading: viewer.camera.heading,
    pitch: viewer.camera.pitch,
    roll: viewer.camera.roll,
  });
  keyframes.value.sort((a, b) => a.seconds - b.seconds);
};

const removeKeyframe = (index: number) => {
  keyframes.value.splice(index, 1);
  if (keyframes.value.length < 2) cameraTourEnabled.value = false;
};

const playCameraTour = () => {
  if (!viewer || keyframes.value.length < 2) return;
  followMode.value = "free";
  cameraTourEnabled.value = true;
  if (currentSeconds.value >= pathDuration.value) seekPlayback(0);
  isPlaying.value = true;
  startPlaybackLoop();
};

const resetView = () => {
  if (!viewer) return;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      cameraDestination.longitude,
      cameraDestination.latitude,
      cameraDestination.height,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(cameraOrientation.heading),
      pitch: Cesium.Math.toRadians(cameraOrientation.pitch),
      roll: 0,
    },
    duration: 0.8,
  });
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewerReady.value = true;
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
  viewer.clock.multiplier = 1;
  viewer.clock.shouldAnimate = false;
  eventHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  eventHandler.setInputAction(
    handleMapClick,
    Cesium.ScreenSpaceEventType.LEFT_CLICK,
  );
  rebuildTrack();
};

onUnmounted(() => {
  cancelPlaybackLoop();
  viewerReady.value = false;
  eventHandler?.destroy();
  eventHandler = null;
  if (viewer) {
    viewer.clock.shouldAnimate = false;
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
  viewer = null;
});
</script>

<style scoped lang="scss">
.track-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.track-panel {
  position: absolute;
  top: 72px;
  left: 16px;
  z-index: 2001;
  width: 390px;
  max-height: calc(100vh - 88px);
  padding: 16px;
  overflow-y: auto;
  color: #f5fbff;
  background: rgba(8, 18, 26, 0.92);
  border: 1px solid rgba(190, 226, 240, 0.18);
  border-radius: 8px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.32);
  backdrop-filter: blur(12px);
  user-select: none;

  &.collapsed {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    background: rgba(10, 133, 151, 0.95);
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.panel-heading,
.status-row,
.section-heading,
.setting-row,
.timeline-labels,
.keyframe-row {
  display: flex;
  align-items: center;
}

.panel-heading,
.section-heading,
.setting-row,
.timeline-labels,
.keyframe-row {
  justify-content: space-between;
}

.panel-heading {
  padding-right: 38px;

  h1 {
    margin: 4px 0 0;
    font-size: 19px;
    letter-spacing: 0;
  }
}

.eyebrow {
  color: #73dbea;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.icon-button,
.panel-open,
.action-button,
.transport-button,
.table-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(211, 240, 247, 0.16);
  cursor: pointer;
}

.icon-button {
  width: 30px;
  height: 30px;
  padding: 0;
  color: #e3fbff;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.panel-close {
  position: absolute;
  top: 10px;
  right: 10px;
}

.panel-open {
  width: 44px;
  height: 44px;
  padding: 0;
  color: #f5fdff;
  background: transparent;
  border: 0;
}

.status-row {
  gap: 7px;
  color: rgba(229, 247, 251, 0.78);
  font-size: 12px;

  span:last-child {
    margin-left: auto;
    color: #7ddff1;
  }
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f0a33b;

  &.playing {
    background: #42d392;
    box-shadow: 0 0 0 4px rgba(66, 211, 146, 0.12);
  }
}

.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-heading {
  color: rgba(244, 251, 253, 0.94);
  font-size: 13px;
  font-weight: 600;
}

.section-caption {
  color: rgba(226, 246, 250, 0.48);
  font-size: 11px;
  font-weight: 400;
}

.button-row,
.transport-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-button {
  gap: 5px;
  min-height: 30px;
  padding: 0 8px;
  color: #dff9ff;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 5px;

  &:hover,
  &.active {
    color: #07171d;
    background: #73dbea;
    border-color: #73dbea;
  }

  &--muted {
    color: rgba(226, 246, 250, 0.64);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }
}

.path-table {
  width: 100%;
  color: rgba(245, 251, 253, 0.88);
  background: rgba(255, 255, 255, 0.04);
}

.table-icon-button {
  width: 24px;
  height: 24px;
  padding: 0;
  color: rgba(226, 246, 250, 0.58);
  background: transparent;
  border-color: transparent;
  border-radius: 4px;

  &:hover {
    color: #ff8d8d;
    background: rgba(255, 255, 255, 0.08);
  }
}

.transport-controls {
  justify-content: center;
  padding: 2px 0;
}

.transport-button {
  width: 34px;
  height: 34px;
  padding: 0;
  color: #dff9ff;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  &--primary {
    width: 44px;
    height: 44px;
    color: #07171d;
    background: #73dbea;
    border-color: #73dbea;
  }
}

.timeline-labels,
.setting-row {
  color: rgba(226, 246, 250, 0.66);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.setting-row {
  gap: 12px;

  :deep(.el-select),
  :deep(.el-input-number) {
    width: 118px;
  }
}

.keyframe-list {
  display: flex;
  max-height: 118px;
  flex-direction: column;
  gap: 3px;
  overflow-y: auto;
}

.keyframe-row {
  min-height: 30px;
  padding: 0 4px 0 8px;
  color: rgba(226, 246, 250, 0.72);
  font-size: 11px;
  background: rgba(255, 255, 255, 0.045);
  border-radius: 4px;
}

.keyframe-index {
  width: 30px;
  color: rgba(226, 246, 250, 0.4);
}

.keyframe-label {
  flex: 1;
  font-variant-numeric: tabular-nums;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72px;
  gap: 8px;
  color: rgba(226, 246, 250, 0.56);
  font-size: 12px;
  text-align: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(226, 246, 250, 0.13);
  border-radius: 5px;

  &--compact {
    min-height: 48px;
  }
}

:deep(.el-table),
:deep(.el-table tr),
:deep(.el-table th.el-table__cell),
:deep(.el-table td.el-table__cell) {
  background: transparent;
}

:deep(.el-table th.el-table__cell) {
  color: rgba(226, 246, 250, 0.56);
  font-size: 11px;
}

:deep(.el-table td.el-table__cell) {
  padding: 4px 0;
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

:deep(.el-table::before) {
  background-color: rgba(255, 255, 255, 0.08);
}

:deep(.el-input-number) {
  width: 100%;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  padding: 0 5px;
  color: #e7fbff;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(209, 238, 247, 0.12) inset;
}

:deep(.el-input__inner),
:deep(.el-select__selected-item) {
  color: #e7fbff;
  font-size: 11px;
}

:deep(.el-radio-group) {
  display: flex;
  width: 100%;
}

:deep(.el-radio-button) {
  flex: 1;
}

:deep(.el-radio-button__inner) {
  width: 100%;
  padding: 7px 4px;
  color: rgba(226, 246, 250, 0.72);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(226, 246, 250, 0.14);
  box-shadow: none;
}

:deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  color: #07171d;
  background: #73dbea;
  border-color: #73dbea;
  box-shadow: -1px 0 0 0 #73dbea;
}

:deep(.el-slider) {
  margin: 0 4px;
}

:deep(.el-slider__runway) {
  height: 4px;
  margin: 8px 0;
  background: rgba(255, 255, 255, 0.14);
}

:deep(.el-slider__bar) {
  height: 4px;
  background: #5ed6e9;
}

:deep(.el-slider__button) {
  width: 12px;
  height: 12px;
  border-color: #8be8f5;
}

@media (max-width: 640px) {
  .track-panel {
    top: 64px;
    left: 10px;
    width: min(390px, calc(100vw - 20px));
  }
}
</style>
