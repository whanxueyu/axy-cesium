<template>
  <div class="animation-page">
    <aside :class="['animation-panel', { collapsed: !showPanel }]">
      <button
        v-if="showPanel"
        class="icon-button panel-close"
        type="button"
        title="收起面板"
        @click="togglePanel"
      >
        <el-icon size="18">
          <Close />
        </el-icon>
      </button>
      <button
        v-else
        class="panel-open"
        type="button"
        title="打开面板"
        @click="togglePanel"
      >
        <el-icon size="24">
          <Grid />
        </el-icon>
      </button>

      <div v-if="showPanel" class="panel-content">
        <div class="panel-heading">
          <div>
            <div class="eyebrow">GLB 内置动画</div>
            <h1>{{ selectedModel.name }}</h1>
          </div>
          <button
            class="icon-button"
            type="button"
            title="重新加载模型"
            :disabled="loading"
            @click="loadModel"
          >
            <el-icon size="17">
              <RefreshRight />
            </el-icon>
          </button>
        </div>

        <div class="model-select-row">
          <span>动画模型</span>
          <el-select
            v-model="selectedModelId"
            class="model-select"
            size="small"
            :disabled="loading"
            @change="handleModelChange"
          >
            <el-option
              v-for="modelOption in MODEL_CATALOG"
              :key="modelOption.id"
              :label="modelOption.name"
              :value="modelOption.id"
            />
          </el-select>
        </div>

        <div class="model-card">
          <img
            :src="selectedModelImageUrl"
            :alt="selectedModel.name"
            class="model-preview"
          />
          <div class="model-card__info">
            <div class="model-status">
              <span :class="['status-dot', { ready: modelReady, loading }]"></span>
              {{ statusText }}
            </div>
            <strong>{{ animationDefinitions.length || "--" }} 个动画片段</strong>
            <span>{{ selectedModel.fileName }}</span>
          </div>
        </div>

        <div class="model-scale-row">
          <span>模型缩放</span>
          <el-input-number
            v-model="modelScale"
            :min="1"
            :max="10000000"
            :step="1000"
            :precision="0"
            controls-position="right"
            size="small"
            :disabled="loading || !selectedModel"
            @change="handleScaleChange"
          />
        </div>

        <div v-if="loadError" class="error-message">
          {{ loadError }}
        </div>

        <div class="section-heading">
          <span>动画片段</span>
          <span v-if="animationDefinitions.length" class="section-count">
            {{ selectedAnimation?.label || "未选择" }}
          </span>
        </div>

        <div v-if="loading && !animationDefinitions.length" class="animation-loading">
          <el-icon class="spin" size="18">
            <Loading />
          </el-icon>
          <span>正在读取模型动画...</span>
        </div>
        <div v-else-if="!animationDefinitions.length" class="animation-empty">
          暂未读取到内置动画
        </div>
        <div v-else class="animation-list">
          <button
            v-for="(animation, index) in animationDefinitions"
            :key="animation.name"
            :class="['animation-item', { active: index === selectedAnimationIndex }]"
            type="button"
            :aria-pressed="index === selectedAnimationIndex"
            @click="selectAnimation(index)"
          >
            <span class="animation-index">{{ String(index + 1).padStart(2, "0") }}</span>
            <span class="animation-item__name">
              <strong>{{ animation.label }}</strong>
              <small>{{ animation.name }}</small>
            </span>
            <span class="animation-item__duration">
              {{ formatDuration(animation.duration) }}
            </span>
          </button>
        </div>

        <div class="playback-section">
          <div class="playback-header">
            <span>播放控制</span>
            <span class="playback-state">{{ isPlaying ? "播放中" : "已暂停" }}</span>
          </div>

          <div class="transport-controls">
            <button
              class="transport-button"
              type="button"
              title="停止并回到起点"
              :disabled="!modelReady || !selectedAnimation"
              @click="stopAnimation"
            >
              <el-icon size="16">
                <CircleClose />
              </el-icon>
            </button>
            <button
              class="transport-button transport-button--primary"
              type="button"
              :title="isPlaying ? '暂停动画' : '播放动画'"
              :disabled="!modelReady || !selectedAnimation"
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
              title="重新播放当前动画"
              :disabled="!modelReady || !selectedAnimation"
              @click="restartAnimation"
            >
              <el-icon size="16">
                <Refresh />
              </el-icon>
            </button>
          </div>

          <div class="timeline-labels">
            <span>{{ formatDuration(currentSeconds) }}</span>
            <span>{{ formatDuration(selectedAnimation?.duration || 0) }}</span>
          </div>
          <el-slider
            v-model="progress"
            :min="0"
            :max="100"
            :step="0.1"
            :disabled="!modelReady || !selectedAnimation"
            :show-tooltip="false"
            @change="handleSeek"
          />

          <div class="setting-row">
            <span>播放速度</span>
            <strong>{{ playbackRate.toFixed(2) }}×</strong>
          </div>
          <el-slider
            v-model="playbackRate"
            :min="0.25"
            :max="2"
            :step="0.25"
            :disabled="!modelReady || !selectedAnimation"
            :show-tooltip="false"
            @change="handleRateChange"
          />

          <div class="setting-row">
            <span>循环播放</span>
            <el-switch
              v-model="loopEnabled"
              inline-prompt
              active-text="循环"
              inactive-text="单次"
              :disabled="!modelReady || !selectedAnimation"
              @change="handleLoopChange"
            />
          </div>
        </div>

        <div class="panel-footer">
          <span>模型状态</span>
          <span>{{ modelReady ? "已加载" : loading ? "加载中" : "未加载" }}</span>
        </div>
      </div>
    </aside>

    <Map
      mapType="gd"
      :loadTerrain="false"
      :showLayerSelect="false"
      :destination="cameraDestination"
      :orientation="cameraOrientation"
      :duration="1"
      @loaded="handleMapLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import * as Cesium from "cesium";
import {
  CircleClose,
  Close,
  Grid,
  Loading,
  Refresh,
  RefreshRight,
  VideoPause,
  VideoPlay,
} from "@element-plus/icons-vue";
import Map from "@/components/cesium/map.vue";

interface AnimationDefinition {
  name: string;
  label: string;
  duration: number;
}

interface AnimationModelDefinition {
  id: string;
  name: string;
  fileName: string;
  imageFileName: string;
  defaultScale: number;
  defaultCameraHeight: number;
}

// 新增动画模型时，在这里补充对应的 GLB 和预览图即可。
const MODEL_CATALOG: AnimationModelDefinition[] = [
  {
    id: "breakdancer",
    name: "Breakdancer",
    fileName: "Breakdancer.glb",
    imageFileName: "Breakdancer.png",
    defaultScale: 100000,
    defaultCameraHeight: 1000,
  },
  {
    id: "curious-skeleton",
    name: "Curious Skeleton",
    fileName: "Curious skeleton.glb",
    imageFileName: "Curious skeleton.png",
    defaultScale: 100000,
    defaultCameraHeight: 1000,
  },
  {
    id: "dancing-troll",
    name: "Dancing Troll",
    fileName: "Dancing troll.glb",
    imageFileName: "Dancing troll.png",
    defaultScale: 100000,
    defaultCameraHeight: 1000,
  },
  {
    id: "playful-dog",
    name: "Playful Dog",
    fileName: "Playful dog.glb",
    imageFileName: "Playful dog.png",
    defaultScale: 100000,
    defaultCameraHeight: 1000,
  },
  {
    id: "rampaging-t-rex",
    name: "Rampaging T-Rex",
    fileName: "Rampaging T-Rex.glb",
    imageFileName: "Rampaging T-Rex.png",
    defaultScale: 100000,
    defaultCameraHeight: 1000,
  },
];

const DEFAULT_MODEL_ID = "rampaging-t-rex";
const MODEL_POSITION = {
  longitude: 116.391257,
  latitude: 39.907204,
  height: 0,
};

const ANIMATION_LABELS: Record<string, string> = {
  run: "奔跑",
  bite: "撕咬",
  roar: "咆哮",
  attack_tail: "尾部攻击",
  idle: "待机",
  walk: "行走",
  robot: "机械舞",
  jump: "跳跃",
  ground_spins: "地面旋转",
  dance: "跳舞",
  standing: "站立",
  sitting: "坐下",
  shake: "抖动",
  rollover: "翻滚",
  play_dead: "装死",
};

const cameraDestination = {
  longitude: MODEL_POSITION.longitude,
  latitude: MODEL_POSITION.latitude,
  height: 1000,
};

const cameraOrientation = {
  heading: 0,
  pitch: -35,
  roll: 0,
};

const showPanel = ref(true);
const loading = ref(false);
const modelReady = ref(false);
const loadError = ref("");
const selectedModelId = ref(DEFAULT_MODEL_ID);
const modelScale = ref(
  MODEL_CATALOG.find((modelOption) => modelOption.id === DEFAULT_MODEL_ID)?.defaultScale
    ?? 1000,
);
const animationDefinitions = ref<AnimationDefinition[]>([]);
const selectedAnimationIndex = ref(0);
const isPlaying = ref(false);
const loopEnabled = ref(true);
const playbackRate = ref(1);
const progress = ref(0);
const currentSeconds = ref(0);

const getModelAssetUrl = (fileName: string) => {
  return `/models/animation/${encodeURIComponent(fileName)}`;
};

const selectedModel = computed(
  () => MODEL_CATALOG.find((modelOption) => modelOption.id === selectedModelId.value)
    ?? MODEL_CATALOG[0],
);
const selectedModelImageUrl = computed(
  () => getModelAssetUrl(selectedModel.value.imageFileName),
);
const selectedAnimation = computed(
  () => animationDefinitions.value[selectedAnimationIndex.value],
);
const statusText = computed(() => {
  if (loading.value) return "正在加载模型";
  if (modelReady.value) return isPlaying.value ? "动画播放中" : "模型已就绪";
  return "等待加载模型";
});

let viewer: Cesium.Viewer | null = null;
let model: Cesium.Model | null = null;
let activeAnimation: Cesium.ModelAnimation | null = null;
let animationStartTime: Cesium.JulianDate | null = null;
let removeTickListener: (() => void) | null = null;
let loadRequestId = 0;
let suppressStopEvent = false;

const togglePanel = () => {
  showPanel.value = !showPanel.value;
};

const handleMapLoaded = (mapViewer: Cesium.Viewer) => {
  viewer = mapViewer;
  viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
  viewer.clock.multiplier = 1;
  viewer.clock.shouldAnimate = false;
  viewer.scene.globe.depthTestAgainstTerrain = false;
  removeTickListener = viewer.clock.onTick.addEventListener(updateProgress);
  loadModel();
};

const loadModel = async () => {
  if (!viewer || loading.value) return;

  const requestId = ++loadRequestId;
  loading.value = true;
  modelReady.value = false;
  loadError.value = "";
  animationDefinitions.value = [];
  selectedAnimationIndex.value = 0;
  progress.value = 0;
  currentSeconds.value = 0;
  isPlaying.value = false;
  clearModel();

  const position = Cesium.Cartesian3.fromDegrees(
    MODEL_POSITION.longitude,
    MODEL_POSITION.latitude,
    MODEL_POSITION.height,
  );
  const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
    position,
    new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(180), 0, 0),
  );
  const modelDefinition = selectedModel.value;

  try {
    const loadedModel = await Cesium.Model.fromGltfAsync({
      url: getModelAssetUrl(modelDefinition.fileName),
      modelMatrix,
      scale: modelScale.value,
      minimumPixelSize: 64,
      clampAnimations: true,
      shadows: Cesium.ShadowMode.ENABLED,
      silhouetteColor: Cesium.Color.fromCssColorString("#44e5ff"),
      silhouetteSize: 2,
      gltfCallback: (gltf: any) => {
        animationDefinitions.value = extractAnimationDefinitions(gltf);
      },
    });

    if (requestId !== loadRequestId || !viewer) {
      loadedModel.destroy();
      return;
    }

    model = loadedModel;
    viewer.scene.primitives.add(model);

    await waitForModelReady(model);

    if (requestId !== loadRequestId || !viewer) {
      const staleModel = model;
      const removed = viewer?.scene.primitives.remove(staleModel) ?? false;
      if (!removed && !staleModel.isDestroyed()) {
        staleModel.destroy();
      }
      model = null;
      return;
    }

    modelReady.value = true;
    centerModelAtTarget();

    const idleIndex = animationDefinitions.value.findIndex(
      (animation) => animation.name === "idle",
    );
    selectedAnimationIndex.value = idleIndex >= 0 ? idleIndex : 0;
    focusModel();

    if (selectedAnimation.value) {
      startAnimationAt(0, true);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`恐龙动画模型加载失败: ${message}`, error);
    clearModel();
    loadError.value = "模型加载失败，请检查本地 GLB 文件";
  } finally {
    if (requestId === loadRequestId) {
      loading.value = false;
    }
  }
};

const handleModelChange = (modelId: string) => {
  const modelDefinition = MODEL_CATALOG.find((modelOption) => modelOption.id === modelId);
  if (!modelDefinition) return;

  modelScale.value = modelDefinition.defaultScale;
  loadModel();
};

const handleScaleChange = (value: number | undefined) => {
  if (!Number.isFinite(value) || !value || value <= 0) return;

  modelScale.value = value;
  if (!model) return;

  model.scale = value;
  centerModelAtTarget();
  focusModel();
  viewer?.scene.requestRender();
};

const waitForModelReady = (candidate: Cesium.Model) => {
  if (candidate.ready) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let timeoutId: number | undefined;
    let removeReadyListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;

    const cleanup = () => {
      removeReadyListener?.();
      removeErrorListener?.();
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };

    const resolveReady = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const rejectReady = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    removeReadyListener = candidate.readyEvent.addEventListener(resolveReady);
    removeErrorListener = candidate.errorEvent.addEventListener(rejectReady);
    timeoutId = window.setTimeout(() => {
      rejectReady(new Error("模型资源加载超时"));
    }, 15000);

    if (candidate.ready) {
      resolveReady();
    }
  });
};

const extractAnimationDefinitions = (gltf: any): AnimationDefinition[] => {
  const animations = Array.isArray(gltf?.animations) ? gltf.animations : [];
  return animations.map((animation: any, index: number) => {
    const durations = (animation.samplers || [])
      .map((sampler: any) => gltf.accessors?.[sampler.input])
      .map((accessor: any) => {
        const min = accessor?.min?.[0];
        const max = accessor?.max?.[0];
        return Number.isFinite(min) && Number.isFinite(max) ? max - min : 0;
      })
      .filter((duration: number) => duration > 0);

    return {
      name: animation.name || `animation-${index + 1}`,
      label: ANIMATION_LABELS[animation.name] || `动画 ${index + 1}`,
      duration: durations.length ? Math.max(...durations) : 0,
    };
  });
};

const centerModelAtTarget = () => {
  if (!model) return;

  const targetCenter = Cesium.Cartesian3.fromDegrees(
    MODEL_POSITION.longitude,
    MODEL_POSITION.latitude,
    MODEL_POSITION.height,
  );
  const modelCenter = model.boundingSphere.center;
  const translationOffset = Cesium.Cartesian3.subtract(
    targetCenter,
    modelCenter,
    new Cesium.Cartesian3(),
  );
  const currentTranslation = Cesium.Matrix4.getTranslation(
    model.modelMatrix,
    new Cesium.Cartesian3(),
  );
  const nextTranslation = Cesium.Cartesian3.add(
    currentTranslation,
    translationOffset,
    new Cesium.Cartesian3(),
  );
  const nextModelMatrix = Cesium.Matrix4.clone(
    model.modelMatrix,
    new Cesium.Matrix4(),
  );

  Cesium.Matrix4.setTranslation(nextModelMatrix, nextTranslation, nextModelMatrix);
  model.modelMatrix = nextModelMatrix;
};

const focusModel = () => {
  if (!viewer || !model) return;

  const modelDefinition = selectedModel.value;
  const scaleRatio = modelDefinition.defaultScale > 0
    ? modelScale.value / modelDefinition.defaultScale
    : 1;
  const cameraHeight = Math.max(
    120,
    Math.min(modelDefinition.defaultCameraHeight * scaleRatio, 20000),
  );

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      MODEL_POSITION.longitude,
      MODEL_POSITION.latitude,
      MODEL_POSITION.height + cameraHeight,
    ),
    orientation: {
      heading: Cesium.Math.toRadians(cameraOrientation.heading),
      pitch: Cesium.Math.toRadians(cameraOrientation.pitch),
      roll: Cesium.Math.toRadians(cameraOrientation.roll),
    },
    duration: 1.2,
  });
};

const clearModel = () => {
  if (!model) {
    activeAnimation = null;
    animationStartTime = null;
    return;
  }

  suppressStopEvent = true;
  model.activeAnimations.removeAll();
  suppressStopEvent = false;
  if (viewer) {
    viewer.scene.primitives.remove(model);
  }
  model = null;
  activeAnimation = null;
  animationStartTime = null;
};

const startAnimationAt = (seconds: number, shouldPlay: boolean) => {
  if (!viewer || !model || !selectedAnimation.value) return;

  const definition = selectedAnimation.value;
  const duration = definition.duration;
  const safeSeconds = duration > 0
    ? Math.max(0, Math.min(seconds, duration))
    : 0;
  const startTime = Cesium.JulianDate.addSeconds(
    viewer.clock.currentTime,
    -safeSeconds / playbackRate.value,
    new Cesium.JulianDate(),
  );

  suppressStopEvent = true;
  model.activeAnimations.removeAll();
  suppressStopEvent = false;

  animationStartTime = startTime;
  activeAnimation = model.activeAnimations.add({
    name: definition.name,
    startTime,
    multiplier: playbackRate.value,
    loop: loopEnabled.value
      ? Cesium.ModelAnimationLoop.REPEAT
      : Cesium.ModelAnimationLoop.NONE,
    removeOnStop: false,
  });
  activeAnimation.stop.addEventListener(() => {
    if (suppressStopEvent) return;
    currentSeconds.value = definition.duration;
    progress.value = 100;
    isPlaying.value = false;
    if (viewer) viewer.clock.shouldAnimate = false;
  });

  currentSeconds.value = safeSeconds;
  progress.value = duration > 0 ? (safeSeconds / duration) * 100 : 0;
  isPlaying.value = shouldPlay;
  viewer.clock.shouldAnimate = shouldPlay;
};

const togglePlayback = () => {
  if (!viewer || !model || !selectedAnimation.value) return;

  if (isPlaying.value) {
    pauseAnimation();
    return;
  }

  if (
    !activeAnimation
    || (!loopEnabled.value && currentSeconds.value >= (selectedAnimation.value.duration || 0))
  ) {
    startAnimationAt(0, true);
    return;
  }

  isPlaying.value = true;
  viewer.clock.shouldAnimate = true;
};

const pauseAnimation = () => {
  if (!viewer) return;
  updateProgress();
  isPlaying.value = false;
  viewer.clock.shouldAnimate = false;
};

const stopAnimation = () => {
  if (!viewer || !model || !selectedAnimation.value) return;
  startAnimationAt(0, false);
};

const restartAnimation = () => {
  if (!model || !selectedAnimation.value) return;
  startAnimationAt(0, true);
};

const selectAnimation = (index: number) => {
  if (index < 0 || index >= animationDefinitions.value.length) return;
  selectedAnimationIndex.value = index;
  if (modelReady.value) {
    startAnimationAt(0, true);
  }
};

const handleLoopChange = () => {
  if (!activeAnimation || !selectedAnimation.value) return;
  const seconds = getAnimationSeconds();
  startAnimationAt(seconds, isPlaying.value);
};

const handleRateChange = (value: number | number[]) => {
  const nextRate = Array.isArray(value) ? value[0] : value;
  if (!Number.isFinite(nextRate)) return;
  playbackRate.value = nextRate;
  if (!activeAnimation || !selectedAnimation.value) return;
  const seconds = getAnimationSeconds();
  startAnimationAt(seconds, isPlaying.value);
};

const handleSeek = (value: number | number[]) => {
  if (!selectedAnimation.value) return;
  const nextProgress = Array.isArray(value) ? value[0] : value;
  if (!Number.isFinite(nextProgress)) return;

  const duration = selectedAnimation.value.duration;
  const seconds = duration > 0
    ? (Math.max(0, Math.min(nextProgress, 100)) / 100) * duration
    : 0;
  progress.value = nextProgress;
  currentSeconds.value = seconds;

  if (modelReady.value) {
    startAnimationAt(seconds, isPlaying.value);
  }
};

const getAnimationSeconds = () => {
  if (!viewer || !animationStartTime || !selectedAnimation.value) {
    return currentSeconds.value;
  }

  const elapsed = Math.max(
    0,
    Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, animationStartTime)
      * playbackRate.value,
  );
  const duration = selectedAnimation.value.duration;
  if (!duration) return 0;
  return loopEnabled.value ? elapsed % duration : Math.min(elapsed, duration);
};

const updateProgress = () => {
  if (!isPlaying.value || !selectedAnimation.value) return;

  const seconds = getAnimationSeconds();
  const duration = selectedAnimation.value.duration;
  currentSeconds.value = seconds;
  progress.value = duration > 0 ? (seconds / duration) * 100 : 0;

  if (!loopEnabled.value && duration > 0 && seconds >= duration) {
    isPlaying.value = false;
    progress.value = 100;
    currentSeconds.value = duration;
    if (viewer) viewer.clock.shouldAnimate = false;
  }
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0.00 s";
  return `${seconds.toFixed(2)} s`;
};

onUnmounted(() => {
  loadRequestId += 1;
  removeTickListener?.();
  removeTickListener = null;
  if (viewer) {
    viewer.clock.shouldAnimate = false;
  }
  clearModel();
  viewer = null;
});
</script>

<style scoped lang="scss">
.animation-page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.animation-panel {
  position: absolute;
  top: 72px;
  left: 16px;
  z-index: 2001;
  width: 364px;
  padding: 16px;
  color: #f7fbff;
  background: rgba(10, 18, 25, 0.88);
  border: 1px solid rgba(198, 226, 238, 0.18);
  border-radius: 8px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(12px);
  max-height: calc(100vh - 88px);
  overflow-y: auto;
  user-select: none;

  &.collapsed {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    background: rgba(13, 123, 144, 0.94);
  }
}

.panel-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.model-select-row,
.model-scale-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: rgba(230, 246, 250, 0.72);
  font-size: 12px;
}

.model-select {
  flex: 1;
  min-width: 0;
}

.model-scale-row {
  :deep(.el-input-number) {
    width: 132px;
  }
}

.panel-close {
  position: absolute;
  top: 10px;
  right: 10px;
}

.panel-open,
.icon-button,
.transport-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  color: #dff8ff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(209, 238, 247, 0.16);
  border-radius: 6px;
  cursor: pointer;
}

.panel-open {
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
}

.icon-button:disabled,
.transport-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-right: 38px;

  h1 {
    margin: 3px 0 0;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0;
  }
}

.eyebrow {
  color: #7ddff1;
  font-size: 11px;
  letter-spacing: 0;
  text-transform: uppercase;
}

.model-card {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
}

.model-preview {
  width: 104px;
  height: 78px;
  object-fit: cover;
  border-radius: 4px;
  background: #6d6d6d;
}

.model-card__info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 5px;

  strong {
    color: #fff;
    font-size: 15px;
  }

  > span:last-child {
    color: rgba(230, 246, 250, 0.62);
    font-size: 12px;
  }
}

.model-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(230, 246, 250, 0.82);
  font-size: 12px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f0a33b;

  &.ready {
    background: #42d392;
  }

  &.loading {
    background: #55c8ec;
    box-shadow: 0 0 0 4px rgba(85, 200, 236, 0.12);
  }
}

.error-message {
  padding: 8px 10px;
  color: #ffd0d0;
  font-size: 12px;
  line-height: 1.45;
  background: rgba(183, 55, 55, 0.22);
  border: 1px solid rgba(255, 142, 142, 0.28);
  border-radius: 5px;
}

.section-heading,
.playback-header,
.setting-row,
.timeline-labels,
.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-heading,
.playback-header {
  color: rgba(241, 249, 252, 0.92);
  font-size: 13px;
  font-weight: 600;
}

.section-count,
.playback-state {
  color: #7ddff1;
  font-size: 12px;
  font-weight: 400;
}

.animation-list {
  display: flex;
  max-height: 206px;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  padding-right: 2px;
}

.animation-item {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 7px 9px;
  color: rgba(241, 249, 252, 0.86);
  text-align: left;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  cursor: pointer;
  transition: border-color 0.16s ease, background 0.16s ease;

  &:hover,
  &.active {
    background: rgba(48, 190, 213, 0.16);
    border-color: rgba(93, 220, 239, 0.72);
  }
}

.animation-index {
  color: rgba(230, 246, 250, 0.46);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.animation-item__name {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;

  strong {
    overflow: hidden;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    color: rgba(230, 246, 250, 0.52);
    font-size: 11px;
  }
}

.animation-item__duration {
  color: rgba(230, 246, 250, 0.7);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.animation-loading,
.animation-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
  gap: 8px;
  color: rgba(230, 246, 250, 0.68);
  font-size: 13px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
}

.spin {
  animation: rotate 1s linear infinite;
}

.playback-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 2px;
}

.transport-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 4px 0 2px;
}

.transport-button {
  width: 34px;
  height: 34px;
  border-radius: 50%;
}

.transport-button--primary {
  width: 44px;
  height: 44px;
  color: #07171d;
  background: #70e2f1;
  border-color: #70e2f1;
}

.timeline-labels,
.setting-row {
  color: rgba(230, 246, 250, 0.68);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.setting-row {
  margin-top: 1px;

  strong {
    color: #fff;
    font-size: 12px;
    font-weight: 600;
  }
}

.panel-footer {
  padding-top: 2px;
  color: rgba(230, 246, 250, 0.52);
  font-size: 11px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.panel-footer span:last-child {
  color: rgba(230, 246, 250, 0.84);
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

:deep(.el-select__wrapper),
:deep(.el-input-number__decrease),
:deep(.el-input-number__increase),
:deep(.el-input__wrapper) {
  color: #e7fbff;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(209, 238, 247, 0.16) inset;
}

:deep(.el-select__selected-item),
:deep(.el-input__inner) {
  color: #e7fbff;
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 640px) {
  .animation-panel {
    top: 64px;
    left: 10px;
    width: min(364px, calc(100vw - 20px));
  }
}
</style>
