<template>
  <div class="home">
    <header class="hero">
      <nav class="navbar">
        <div class="logo">AXY-Cesium</div>
        <ul class="nav-links">
          <li><a href="#about">关于我们</a></li>
          <li><a href="#services">服务</a></li>
          <li><a href="#contact">联系我们</a></li>
        </ul>
      </nav>
      <div class="hero-content">
        <h1 class="title">欢迎来到 AXY-Cesium</h1>
        <p class="subtitle">探索未来科技，共创美好明天</p>
        <button class="cta-button">了解更多</button>
      </div>
      <div class="hero-animation"></div>
    </header>
    <section id="about" class="section">
      <h2>关于我们</h2>
      <p>我们是一家专注于前沿科技的公司，致力于提供最优质的解决方案。</p>
    </section>
    <section id="services" class="section">
      <h2>我们的服务</h2>
      <p>我们提供多种服务，包括但不限于软件开发、数据分析和人工智能。</p>
    </section>
    <section id="contact" class="section">
      <h2>联系我们</h2>
      <p>如果您有任何问题或需求，请随时联系我们。</p>
    </section>
  </div>
</template>

<script setup lang="ts" name="Home">
</script>

<style scoped lang="scss">
.home {
  font-family: 'Arial', sans-serif;
  margin: 0;
  padding: 0;
  color: #fff;
}

.hero {
  position: relative;
  height: 100vh;
  background: linear-gradient(135deg, #ff7e5f, #feb47b);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.navbar {
  position: absolute;
  top: 20px;
  left: 20px;
  display: flex;
  align-items: center;
}

.logo {
  font-size: 24px;
  font-weight: bold;
  margin-right: 20px;
}

.nav-links {
  list-style: none;
  display: flex;
}

.nav-links li {
  margin-right: 20px;
}

.nav-links a {
  text-decoration: none;
  color: #fff;
  transition: color 0.3s ease;
}

.nav-links a:hover {
  color: #ff7e5f;
}

.hero-content {
  text-align: center;
}

.title {
  font-size: 48px;
  margin-bottom: 20px;
}

.subtitle {
  font-size: 24px;
  margin-bottom: 40px;
}

.cta-button {
  background-color: #fff;
  color: #ff7e5f;
  border: none;
  padding: 10px 20px;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.cta-button:hover {
  background-color: #ff7e5f;
  color: #fff;
}

.hero-animation {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 100px;
  background: url('https://via.placeholder.com/1500x100') repeat-x;
  animation: moveBackground 10s linear infinite;
}

@keyframes moveBackground {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-1500px);
  }
}

.section {
  padding: 60px 20px;
  text-align: center;
  background-color: #1a1a1a;
}

.section h2 {
  font-size: 36px;
  margin-bottom: 20px;
}

.section p {
  font-size: 18px;
  line-height: 1.6;
}
</style>