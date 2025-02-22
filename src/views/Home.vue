<template>
  <div class="homepage">
    <!-- Navigation Bar -->
    <el-header class="nav-header">
      <div class="nav-content">
        <div class="logo">
          <img src="@/assets/images/home/fishshell.svg?height=40&width=40" alt="Logo" class="mr-2">
          <span class="text-xl font-bold">AXY-Cesium</span>
        </div>
        <el-menu mode="horizontal" class="nav-menu" :default-active="activeIndex" @select="handleSelect">
          <el-menu-item index="1">Home</el-menu-item>
          <el-menu-item index="2">Example</el-menu-item>
          <el-menu-item index="3">Projects</el-menu-item>
          <el-menu-item index="4">Documentation</el-menu-item>
          <el-menu-item index="5">Download</el-menu-item>
          <el-menu-item index="6">Support</el-menu-item>
        </el-menu>
      </div>
    </el-header>

    <!-- Hero Section -->
    <div class="hero-section">
      <div class="hero-content">
        <h1 class="hero-title">3D Visualization Case Platform</h1>
        <h2 class="hero-subtitle">Digital Twin · GIS Development · Learning Improvement</h2>
        <div class="hero-description">
          Basic Cesium Demo · Advanced Learning · Comprehensive Case Presentation · Common Communication & Exchange
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
      <h2 class="section-title">Continuously Updated Features and Cases</h2>
      <p class="section-subtitle">Years of technical accumulation, innovative products, forming technical advantages</p>

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
import { InfoFilled, Comment, Monitor, Finished, MagicStick, ElementPlus } from '@element-plus/icons-vue'
import { ref } from 'vue'
import router from '@/router';
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

const features: Feature[] = [
  {
    icon: Monitor,
    title: 'Easy to Read',
    description: 'The function of the code is concise and easy to understand'
  },
  {
    icon: Finished,
    title: 'Friendly Guidance',
    description: 'From difficult to easy, step by step to guide the progress'
  },
  {
    icon: MagicStick,
    title: 'Simple Popularization',
    description: 'Using Vue3 based on element-plus framework'
  },
  {
    icon: ElementPlus,
    title: 'Innovative Ideas',
    description: 'Creative ideas and implementation methods'
  }
]

const services: Service[] = [
  {
    image: 'case',
    title: 'Lots of cases',
    description: 'A large number of use cases, combined with practical application scenarios'
  },
  {
    image: 'understand',
    title: 'In-depth understanding',
    description: 'Step-by-step difficulty and easy-to-understand code'
  },
  {
    image: 'communicate',
    title: 'Online Community',
    description: 'On-line technology exchange group with like-minded friends together exchange'
  }
]
const activeIndex = ref('1')
const handleSelect = (key: string) => {
  console.log(key)
  if (key === '1') {
    router.push('/');
  } else if (key === '2') {
    const url = router.resolve({
      path: '/basicCase/layers',
    });
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

.nav-header {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  position: fixed;
  width: 100%;
  z-index: 100;
}

.nav-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.logo {
  display: flex;
  align-items: center;
  color: white;
}

.logo img {
  margin-right: 10px;
  height: 50px;
}

.font-bold {
  font-weight: bolder;
}

.nav-menu {
  background: transparent;
  border: none;
}

:deep(.el-menu--horizontal .el-menu-item) {
  color: white;
}

:deep(.el-menu--horizontal .el-menu-item:hover) {
  color: #409EFF;
  background: rgba(64, 158, 255, 0.1);
}

:deep(.el-menu--horizontal .el-menu-item:not(.is-disabled):focus, .el-menu--horizontal .el-menu-item:not(.is-disabled):hover) {
  background: rgba(64, 158, 255, 0.1);
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