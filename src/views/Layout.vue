<template>
  <div class="layout-container">
    <div class="side-menu">
      <SideMenu />
    </div>
    <div class="content">
      <router-view />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import SideMenu from '@/components/SideMenu.vue';

export default defineComponent({
  name: 'Layout',
  components: {
    SideMenu
  }
});
</script>

<style scoped>
.layout-container {
  display: flex;
  height: 100vh;
  background: #000;
  /* 更新背景渐变 */
  color: #fff;
}

.side-menu {
  background-color: rgba(27, 37, 48, 0.411);
  /* 更新侧边栏背景色 */
  /* padding: 20px; */
}

.content {
  flex: 1;
  padding: 20px;
  overflow: auto;
  /* 更新内容区域背景色 */
}

/* 自定义滚动条样式 */
.content::-webkit-scrollbar {
  width: 10px;
  /* 滚动条宽度 */
}

.content::-webkit-scrollbar-track {
  background: rgba(255, 244, 244, 0.5);
  /* 滚动条轨道背景色 */
}

.content::-webkit-scrollbar-thumb {
  background: #fff;
  /* 滚动条滑块背景色 */
  border-radius: 5px;
  /* 滑块圆角 */
}

.content::-webkit-scrollbar-thumb:hover {
  background: #ff7e5f;
  /* 滑块悬停时的背景色 */
}

/* Firefox 的滚动条样式 */
.content {
  scrollbar-width: thin;
  /* 滚动条宽度 */
  scrollbar-color: #fff rgba(255, 244, 244, 0.5);
  /* 滑块颜色 轨道颜色 */
}
</style>