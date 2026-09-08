<template>
  <div class="homepage">
    <!-- Navigation Bar -->
    <Header active-num="1"></Header>
    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">3D可视化案例平台</h1>
        <h2 class="hero-subtitle">数字孪生 · GIS开发 · 学习进阶</h2>
        <div class="hero-description">
          Cesium基础示例 · 进阶学习 · 综合案例展示 · 共同交流探讨
        </div>
      </div>
    </div>
    <!-- Feature Cards -->
    <div class="feature-cards">
      <el-row :gutter="20">
        <el-col :span="6" v-for="(feature, index) in features" :key="index">
          <el-card class="feature-card">
            <div class="feature-icon">
              <el-icon>
                <component :is="feature.icon" />
              </el-icon>
            </div>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Innovation Section -->
    <div class="innovation-section">
      <h2 class="section-title">持续更新的功能与案例</h2>
      <p class="section-subtitle">多年的技术积累，创新的产品，形成技术优势</p>

      <el-row :gutter="20" class="mt-8">
        <el-col :span="8" v-for="(service, index) in services" :key="index">
          <el-card class="service-card">
            <div :class="['service-image', service.image]"></div>
            <h3>{{ service.title }}</h3>
            <p>{{ service.description }}</p>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Case Showcase Section -->
    <div class="case-showcase-section">
      <h2 class="section-title">精选功能示例</h2>
      <p class="section-subtitle">从基础图层到复杂特效，丰富示例等你探索</p>

      <el-row :gutter="20">
        <el-col :xs="24" :sm="12" :md="6" v-for="caseItem in showcaseCases" :key="caseItem.title">
          <el-card class="showcase-card" shadow="hover" @click="openCase(caseItem.path)">
            <div class="showcase-image-wrapper">
              <img :src="caseItem.imgurl" :alt="caseItem.title" class="showcase-image" loading="lazy">
            </div>
            <h3>{{ caseItem.title }}</h3>
            <p>{{ caseItem.description }}</p>
          </el-card>
        </el-col>
      </el-row>

      <div class="showcase-more">
        <el-button type="primary" round size="large" @click="goToCases">
          查看更多案例
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- Floating Action Buttons -->
    <div class="floating-buttons">
      <el-popover placement="top" :width="340" trigger="click">
        <img width="300px" src="@/assets/images/home/qrCode.jpg" alt="" srcset="">
        <template #reference>
          <el-button type="primary" circle :icon="Comment">
          </el-button>
        </template>
      </el-popover>
      <el-popover placement="top" :width="240" trigger="click">
        很多地方都点不了，没想好呢，暂时只是一个架子，等待后续开源吧
        <template #reference>
          <el-button type="primary" circle :icon="InfoFilled">
          </el-button>
        </template>
      </el-popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import { InfoFilled, Comment, Monitor, Finished, MagicStick, ElementPlus, ArrowRight } from '@element-plus/icons-vue'
import Header from "./header.vue"
import router from '@/router'
import { caseList } from '@/data/caseList'
interface Feature {
  icon: any;
  title: string;
  description: string;
}

interface Service {
  image: string;
  title: string;
  description: string;
}

interface ShowcaseCase {
  imgurl: string;
  title: string;
  description: string;
  path: string;
}

const features: Feature[] = [
  {
    icon: Monitor,
    title: '通俗易懂',
    description: '代码功能简洁明了，易于理解'
  },
  {
    icon: Finished,
    title: '友好指引',
    description: '由难到易，循序渐进引导学习进度'
  },
  {
    icon: MagicStick,
    title: '简单普及',
    description: '基于 Vue3 + element-plus 框架开发'
  },
  {
    icon: ElementPlus,
    title: '创新思维',
    description: '富有创意的想法和实现方式'
  }
]

const services: Service[] = [
  {
    image: 'case',
    title: '案例丰富',
    description: '大量使用案例，结合实际应用场景'
  },
  {
    image: 'understand',
    title: '深入理解',
    description: '难度循序渐进，代码通俗易懂'
  },
  {
    image: 'communicate',
    title: '在线社区',
    description: '线上技术交流群，与志同道合的朋友一起交流'
  }
]

const getCaseItem = (type: string, title: string) => {
  return caseList.find(c => c.type === type)?.list.find(i => i.title === title)
}

const showcaseCases: ShowcaseCase[] = [
  getCaseItem('radar', '电光球体雷达'),
  getCaseItem('polyline', '边界发光线'),
  getCaseItem('model', '倾斜摄影模型加载'),
  getCaseItem('model', '模型编辑'),
  getCaseItem('billboard', 'entity标牌聚合效果'),
  getCaseItem('camera', '相机平滑飞入'),
  getCaseItem('skybox', '天空盒'),
  getCaseItem('layers', '夜晚地图')
].filter((item): item is ShowcaseCase => Boolean(item))

const goToCases = () => {
  router.push('/basicCase')
}

const openCase = (path: string) => {
  if (path) {
    const url = router.resolve({ path });
    window.open(url.href);
  }
}
</script>

<style scoped lang="scss">
.homepage {
  min-height: 100vh;
  background-color: #000;
  color: white;
  position: relative;
  overflow: hidden;
}

.hero-section {
  height: 100vh;
  background-image: url('@/assets/images/home/bg.png');
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: bold;
  margin-bottom: 1rem;
  text-shadow: 0 0 20px rgba(64, 158, 255, 0.5);
}

.hero-subtitle {
  font-size: 2rem;
  margin-bottom: 1rem;
  color: #409EFF;
}

.hero-description {
  font-size: 1.2rem;
  color: #ffffff;
}

.feature-cards {
  max-width: 1200px;
  margin: -100px auto 0;
  padding: 0 20px;
  position: relative;
  z-index: 2;
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  transition: transform 0.3s;
}

.feature-card:hover {
  transform: translateY(-10px);

  .feature-icon {
    color: #40d9ff;
    transition: transform 0.3s;
  }
}

.feature-icon {
  font-size: 100px;
  color: #409EFF;
  transition: transform 0.3s;
  margin-bottom: 1rem;
}

.innovation-section {
  max-width: 1200px;
  margin: 100px auto;
  padding: 0 20px;
  text-align: center;
}

.section-title {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  background: linear-gradient(120deg, #409EFF, #fff);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.section-subtitle {
  color: #909399;
  margin-bottom: 2rem;
}

.service-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  transition: transform 0.3s;
}

.service-card:hover {
  transform: translateY(-10px);
}

.service-image {
  width: 100%;
  height: 120px;
  object-fit: cover;
  margin-bottom: 1rem;
  background-repeat: no-repeat;
  background-size: contain;
  background-position: center;

  &.case {
    background-image: url('@/assets/images/home/case.png');
  }

  &.communicate {
    background-image: url('@/assets/images/home/communicate.png');
  }

  &.understand {
    background-image: url('@/assets/images/home/understand.png');
  }
}

.case-showcase-section {
  max-width: 1200px;
  margin: 100px auto;
  padding: 0 20px;
  text-align: center;
}

.showcase-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  transition: transform 0.3s;
  cursor: pointer;
  margin-bottom: 20px;
}

.showcase-card:hover {
  transform: translateY(-10px);
  border-color: #409EFF;
}

.showcase-image-wrapper {
  width: 100%;
  height: 140px;
  overflow: hidden;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.showcase-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.showcase-card:hover .showcase-image {
  transform: scale(1.1);
}

.showcase-card h3 {
  color: #409EFF;
  margin-bottom: 0.5rem;
}

.showcase-card p {
  font-size: 0.9rem;
  color: #c0c4cc;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.showcase-more {
  margin-top: 3rem;
}

.floating-buttons {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 100;
}

:deep(.el-button.is-circle) {
  width: 50px;
  height: 50px;
  font-size: 24px;
  background: rgba(64, 158, 255, 0.9);
  backdrop-filter: blur(10px);
}
</style>