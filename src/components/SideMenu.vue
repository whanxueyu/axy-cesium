<template>
    <div class="side-menu-section">
        <div class="logo" @click="backHome">
            <img src="@/assets/images/home/fishshell.svg?height=40&width=40" alt="Logo" class="mr-2">
            <span class="text-xl font-bold">AXY-Cesium</span>
        </div>
        <div v-for="cat in caseList" :class="['menu-item', { active: activeSection === cat.type }]" :key="cat.type">
            <!-- <a :href="`#${cat.type}`">{{ cat.title }}</a> -->
            <div  class="menu-item"  @click.prevent="handleMenuClick(cat.type)"  :class="{ active: activeSection === cat.type }" >
            {{ cat.title }}
            </div>
        </div>
        <div class="github">
            <a href="https://github.com/whanxueyu/axy-cesium" target="_blank">
                <img src="https://img.shields.io/github/stars/whanxueyu/axy-cesium?style=social" alt="GitHub stars">
            </a>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { caseList } from '@/data/caseList';

const router = useRouter();
const route = useRoute();

const activeSection = ref<string | null>(null);

const observer = ref<IntersectionObserver | null>(null);
console.log(caseList);
const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            activeSection.value = entry.target.id;
        }
    });
};
const handleMenuClick = (sectionId: string) => {
  // 更新路由哈希（Vue Router会自动监听）
  router.replace(`#${sectionId}`);
  
  // 手动滚动到目标元素
  const targetElement = document.getElementById(sectionId);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth' });
  }
};
// 监听路由变化
// watch(() => route.hash, (newHash) => {
//     if (newHash) {
//         activeSection.value = newHash.slice(1);
//     }
// });

onMounted(() => {
    observer.value = new IntersectionObserver(handleIntersection, {
        root: null,
        rootMargin: '0px',
        threshold: 0.5
    });

    caseList.forEach(cat => {
        const element = document.getElementById(cat.type);
        if (element) {
            observer.value?.observe(element);
        }
    });

    // 初始化时根据路由设置 activeSection
    if (route.hash) {
        activeSection.value = route.hash.slice(1);
    }
});

onUnmounted(() => {
    observer.value?.disconnect();
});

const backHome = () => {
    router.push('/');
};
</script>

<style scoped lang="scss">
.side-menu-section {
    width: 200px;
    color: #fff;
    height: calc(100vh - 60px);
    padding: 10px;
}

.github {
    position: absolute;
    bottom: 20px;
}

.logo {
    display: flex;
    align-items: center;
    color: white;
    justify-content: center;
    margin-bottom: 10px;
    padding: 10px;
    border-bottom: 1px solid #409EFF;
}

.logo img {
    margin-right: 10px;
    height: 50px;
}

.font-bold {
    font-weight: bolder;
}

.menu-item {
    padding: 10px;
    cursor: pointer;
    transition: background-color 0.3s ease, color 0.3s ease;

    &:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    &.active {
        background-color: #233c4a;
        color: #409EFF;
        font-weight: bold;
    }

    a {
        color: #fff;
        width: 100%;
        display: block;
    }
}
</style>