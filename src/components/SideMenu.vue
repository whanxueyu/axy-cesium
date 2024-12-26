<template>
    <div class="side-menu-section">
        <div class="logo" @click="backHome">
            <img src="@/assets/images/home/fishshell.svg?height=40&width=40" alt="Logo" class="mr-2">
            <span class="text-xl font-bold">AXY-Cesium</span>
        </div>
        <div v-for="item in menuItems" :key="item.name" :class="['menu-item', { active: isCurrentRoute(item.path) }]"
            @click="navigateTo(item.path)">
            {{ item.name }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

interface MenuItem {
    name: string;
    path: string;
}


const route = useRoute();
const router = useRouter();

const menuItems: MenuItem[] = [
    { name: 'ImagerLayer案例', path: '/basicCase/layers' },
    { name: '标牌案例', path: '/basicCase/billboard' },
    { name: '模型案例', path: '/basicCase/model' },
    { name: '自定义材质案例', path: '/basicCase/material' },
    { name: '综合案例', path: '/ComprehensiveCase' },
];

const isCurrentRoute = (path: string): boolean => {
    return route.path === path;
};

const navigateTo = (path: string): void => {
    router.push(path);
};
const backHome = () => {
    router.push('/');
}

</script>

<style scoped lang="scss">
.side-menu-section {
    width: 200px;
    color: #fff;
    /* 文字颜色改为白色 */
    // padding: 20px;
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
        /* 鼠标悬停时的背景颜色 */
    }

    &.active {
        background-color: #233c4a;
        /* 激活状态下的背景颜色 */
        color: #409EFF;
        /* 激活状态下的文字颜色 */
        font-weight: bold;
    }
}
</style>