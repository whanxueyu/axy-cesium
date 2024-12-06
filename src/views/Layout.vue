<!-- src/views/Layout.vue -->
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
  }
  
  .side-menu {
    background-color: #f0f0f0;
  }
  
  .content {
    flex: 1;
    padding: 20px;
    overflow: auto;
  }
  
/* 自定义滚动条样式 */
.content::-webkit-scrollbar {
  width: 10px; /* 滚动条宽度 */
}

.content::-webkit-scrollbar-track {
  background: #f1f1f1; /* 滚动条轨道背景色 */
}

.content::-webkit-scrollbar-thumb {
  background: #888; /* 滚动条滑块背景色 */
  border-radius: 5px; /* 滑块圆角 */
}

.content::-webkit-scrollbar-thumb:hover {
  background: #555; /* 滑块悬停时的背景色 */
}

/* Firefox 的滚动条样式 */
.content {
  scrollbar-width: thin; /* 滚动条宽度 */
  scrollbar-color: #888 #f1f1f1; /* 滑块颜色 轨道颜色 */
}
  </style>