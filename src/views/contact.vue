<template>
    <div class="contact-page">
        <Header active-num="6"></Header>

        <div class="contact-container">
            <!-- 页头 -->
            <div class="contact-hero">
                <h1 class="contact-title">合作联系</h1>
                <p class="contact-subtitle">志同道合，方能行远 · 期待与您携手合作</p>
            </div>

            <el-row :gutter="40" class="contact-main">
                <!-- 二维码卡片 -->
                <el-col :xs="24" :md="9">
                    <div class="qr-card">
                        <img src="@/assets/images/home/qrCode.jpg" alt="微信二维码" class="qr-image">
                        <h3>扫码添加微信</h3>
                        <p>一起交流 Cesium / GIS / 三维可视化开发</p>
                    </div>
                </el-col>

                <!-- 合作介绍 -->
                <el-col :xs="24" :md="15">
                    <div class="intro-card">
                        <h2 class="intro-title">关于我</h2>
                        <p class="intro-text">
                            一名专注于 3D 可视化与 GIS 开发的前端工程师，深耕 Cesium 生态多年，
                            创建并维护 axy-cesium 开源案例平台，致力于分享通俗易懂的 Cesium 学习资料与实战案例，
                            希望与更多志同道合的朋友共同进步。
                        </p>

                        <h2 class="intro-title">合作方向</h2>
                        <el-row :gutter="20">
                            <el-col :xs="24" :sm="12" v-for="item in cooperations" :key="item.title">
                                <div class="coop-item">
                                    <el-icon class="coop-icon">
                                        <component :is="item.icon" />
                                    </el-icon>
                                    <div class="coop-content">
                                        <h4>{{ item.title }}</h4>
                                        <p>{{ item.description }}</p>
                                    </div>
                                </div>
                            </el-col>
                        </el-row>

                        <h2 class="intro-title">开源项目</h2>
                        <div class="project-links">
                            <a v-for="link in projectLinks" :key="link.name" :href="link.url" target="_blank"
                                rel="noopener noreferrer">
                                <el-icon><Link /></el-icon>
                                {{ link.name }}
                            </a>
                        </div>
                    </div>
                </el-col>
            </el-row>
        </div>
    </div>
</template>

<script setup lang="ts">
import { DataAnalysis, Monitor, MagicStick, School, Link } from '@element-plus/icons-vue'
import Header from "./header.vue"

interface Cooperation {
    icon: any;
    title: string;
    description: string;
}

const cooperations: Cooperation[] = [
    {
        icon: DataAnalysis,
        title: '三维可视化开发',
        description: 'Cesium / Three.js 三维场景搭建与功能定制'
    },
    {
        icon: Monitor,
        title: '数字孪生解决方案',
        description: '智慧城市、园区、工厂等场景的数字孪生建设'
    },
    {
        icon: MagicStick,
        title: '组件库与工具封装',
        description: '基于 Vue3 的通用组件与地图工具封装'
    },
    {
        icon: School,
        title: '技术咨询与培训',
        description: 'Cesium 入门到进阶的学习路线规划与答疑'
    }
]

interface ProjectLink {
    name: string;
    url: string;
}

const projectLinks: ProjectLink[] = [
    { name: 'axy-cesium (GitHub)', url: 'https://github.com/whanxueyu/axy-cesium' },
    { name: 'axy-cesium (Gitee)', url: 'https://gitee.com/whaxy/axy-cesium' },
    { name: 'axy-cesium 在线演示', url: 'https://axy-cesium.netlify.app' },
    { name: 'axy-demo', url: 'https://axydemo.netlify.app' },
    { name: 'free-dialog', url: 'https://free-dialog.netlify.app' },
    { name: 'cyberpunk-ui', url: 'https://cyberpunk-ui.netlify.app' },
    { name: 'axy-mars3d-demo', url: 'https://axy-mars3d-demo.netlify.app' }
]
</script>

<style scoped lang="scss">
.contact-page {
    min-height: 100vh;
    background: #000;
    color: #fff;
}

.contact-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 140px 20px 80px;
}

.contact-hero {
    text-align: center;
    margin-bottom: 60px;
}

.contact-title {
    font-size: 2.8rem;
    font-weight: bold;
    margin-bottom: 1rem;
    background: linear-gradient(120deg, #409EFF, #fff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

.contact-subtitle {
    color: #909399;
    font-size: 1.1rem;
}

.contact-main {
    align-items: stretch;
}

.qr-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    transition: transform 0.3s;

    &:hover {
        transform: translateY(-10px);
        border-color: #409EFF;
    }

    .qr-image {
        width: 240px;
        height: auto;
        border-radius: 12px;
        margin-bottom: 1.5rem;
        box-shadow: 0 0 30px rgba(64, 158, 255, 0.3);
    }

    h3 {
        color: #409EFF;
        margin-bottom: 0.5rem;
    }

    p {
        color: #c0c4cc;
        font-size: 0.9rem;
    }
}

.intro-card {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    padding: 40px;
    height: 100%;
}

.intro-title {
    font-size: 1.3rem;
    color: #409EFF;
    margin: 1.5rem 0 1rem;
    padding-left: 12px;
    border-left: 4px solid #409EFF;

    &:first-child {
        margin-top: 0;
    }
}

.intro-text {
    color: #c0c4cc;
    line-height: 1.8;
}

.coop-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: rgba(64, 158, 255, 0.08);
    border: 1px solid rgba(64, 158, 255, 0.2);
    border-radius: 10px;
    padding: 16px;
    margin-bottom: 16px;
    transition: transform 0.3s, border-color 0.3s;

    &:hover {
        transform: translateY(-5px);
        border-color: #409EFF;
    }

    .coop-icon {
        font-size: 28px;
        color: #40d9ff;
        flex-shrink: 0;
        margin-top: 2px;
    }

    .coop-content {
        h4 {
            color: #fff;
            margin-bottom: 6px;
        }

        p {
            color: #c0c4cc;
            font-size: 0.85rem;
            line-height: 1.5;
        }
    }
}

.project-links {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;

    a {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid #409EFF;
        border-radius: 20px;
        color: #409EFF;
        font-size: 0.9rem;
        text-decoration: none;
        transition: background-color 0.3s, color 0.3s;

        &:hover {
            background-color: #409EFF;
            color: #fff;
        }
    }
}

@media (max-width: 768px) {
    .qr-card {
        margin-bottom: 24px;
    }
}
</style>
