<template>
  <div class="developing-container">
    <div class="content">
      <h1>🛠 正在开发中</h1>
      <p class="subtext">功能即将上线，敬请期待！</p>
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'Developing',
  setup() {
    return {};
  },
});
</script>

<style lang="scss" scoped>
.developing-container {
  background: linear-gradient(135deg, #0f0f0f, #1e1e2f);
  color: #fff;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

  .content {
    text-align: center;
    animation: fadeIn 1.5s ease-in-out;

    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .subtext {
      font-size: 1.2rem;
      color: #aaa;
      margin-bottom: 2rem;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #fff;
      border-top: 4px solid #42b883;
      border-radius: 50%;
      margin: 0 auto;
      animation: spin 1s linear infinite;
    }
  }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>