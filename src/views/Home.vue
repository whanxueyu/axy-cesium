<template>
  <div class="home">
    <header class="hero">
      <nav class="navbar">
        <div class="logo">My Blog</div>
        <ul class="nav-links">
          <li><a href="#about">关于我</a></li>
          <li><a href="#projects">项目案例</a></li>
          <li><a href="#contact">联系我</a></li>
        </ul>
      </nav>
      <div class="hero-content">
        <h1 class="title">欢迎来到我的博客</h1>
        <p class="subtitle">分享技术心得，记录成长点滴</p>
        <button class="cta-button">查看文章</button>
      </div>
      <div class="hero-animation"></div>
    </header>
    <section id="about" class="section">
      <h2>关于我</h2>
      <p>我是一名前端开发者，热爱编程和技术分享。在这里，我会记录我的学习历程和项目经验。</p>
    </section>
    <section id="projects" class="section">
      <h2>项目案例</h2>
      <div class="project-list">
        <div class="project-item">
          <h3>项目一：AXY-Cesium</h3>
          <p>一个基于Cesium的三维地球可视化项目。</p>
        </div>
        <div class="project-item">
          <h3>项目二：Vue.js 博客系统</h3>
          <p>一个使用Vue.js构建的个人博客系统。</p>
        </div>
      </div>
    </section>
    <section id="contact" class="section">
      <h2>联系我</h2>
      <p>如果您有任何问题或建议，欢迎通过以下方式联系我：</p>
      <ul class="contact-links">
        <li><a href="mailto:your-email@example.com">Email</a></li>
        <li><a href="https://github.com/your-github">GitHub</a></li>
        <li><a href="https://twitter.com/your-twitter">Twitter</a></li>
      </ul>
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
  background: linear-gradient(135deg, #6a11cb, #2575fc);
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
  color: #6a11cb;
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
  color: #6a11cb;
  border: none;
  padding: 10px 20px;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.cta-button:hover {
  background-color: #6a11cb;
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

.project-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.project-item {
  background-color: #2c2c2c;
  padding: 20px;
  border-radius: 8px;
}

.contact-links {
  list-style: none;
  display: flex;
  justify-content: center;
  gap: 20px;
}

.contact-links a {
  text-decoration: none;
  color: #6a11cb;
  transition: color 0.3s ease;
}

.contact-links a:hover {
  color: #fff;
}
</style>