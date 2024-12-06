<template>
    <div class="side-menu">
        <div v-for="item in menuItems" :key="item.name" :class="['menu-item', { active: isCurrentRoute(item.path) }]"
            @click="navigateTo(item.path)">
            {{ item.name }}
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';

interface MenuItem {
    name: string;
    path: string;
}

export default defineComponent({
    setup() {
        const route = useRoute();
        const router = useRouter();

        const menuItems: MenuItem[] = [
            { name: 'Home', path: '/' },
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

        return {
            menuItems,
            isCurrentRoute,
            navigateTo,
        };
    },
});
</script>

<style scoped lang="scss">
.side-menu {
    width: 200px;
}

.menu-item {
    padding: 10px;
    cursor: pointer;
    transition: background-color 0.3s ease;

    &.active {
        background-color: #f0f0f0;
        font-weight: bold;
    }
}
</style>