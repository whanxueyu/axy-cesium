<!-- src/App.vue -->
<template>
  <router-view />
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'App'
});
</script>
<style lang="scss">
@import '@/static/css/theme.scss';
@import '@/static/css/common.scss';
*{
    margin: 0;
    padding: 0;
}
html,body{
    width: 100%;
    height: 100%;
}
</style>