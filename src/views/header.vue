<template>
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import router from '@/router';
const activeIndex = ref('2')
const handleSelect = (key: string) => {
    console.log(key)
    if (key === '1') {
        router.push('/');
    } else if (key === '2') {
        // const url = router.resolve({
        //   path: '/basicCase',
        // });
        // window.open(url.href);
        router.push('/basicCase');
    } else if (key === '3') {
        router.push('/projects');
    }
    // else if (key === '4') {
    //   router.push('/documentation');
    // } else if (key === '5') {
    //   router.push('/download');
    // } else if (key === '6') {
    //   router.push('/support');
    // }
}
</script>

<style scoped lang="scss">
.nav-header {
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(10px);
    position: fixed;
    width: 100%;
    z-index: 100;
    box-shadow: 0px 0px 3px 0px #656565;
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
</style>