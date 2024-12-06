<!-- src/views/Case2.vue -->
<template>
  <div>
    <h1>Cesium 案例集合</h1>
    <p>这是案例集合的内容。</p>
  </div>
  <div class="case_list">
    <div class="case_item" v-for="(item, index) in caselist" :key="item.title" @click="showDetails(index)">
      <img :src="item.imgurl" :alt="item.title">
      <div class="case_item_title">{{ item.title }}</div>
      <div class="case_item_description">{{ item.description }}</div>
    </div>
  </div>
  <el-dialog :title="selectedCase.title" v-model="showCase" @close="closeDetails">
    <div class="dialog_content">
      <div class="case_prev" @click="prevCase">
        <el-icon :size="38">
          <ArrowLeft />
        </el-icon>
      </div>
      <div class="case_details" @click="openSource">
        <img :src="selectedCase.imgurl" :alt="selectedCase.title">
        <p>{{ selectedCase.description }}</p>
      </div>
      <div class="case_next" @click="nextCase">
        <el-icon :size="38">
          <ArrowRight />
        </el-icon>
      </div>
    </div>
    <template #footer>
      <div class="dialog-footer">
        <el-button size="small" @click="closeDetails">关 闭</el-button>
        <el-button size="small" type="primary" @click="openSource">查 看</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" name="Case2">
import { ref } from 'vue';
import { ArrowLeft, ArrowRight } from "@element-plus/icons-vue";
import { caseList } from '@/data/caseList';
import router from '@/router';
const selectedIndex = ref<number | null>(null)
const caselist = ref(caseList)
const showCase = ref(false)
const selectedCase = ref<{
  imgurl: string;
  title: string;
  description: string;
  path: string
}>({

  imgurl: '',
  title: '',
  description: '',
  path: ''
})
function closeDetails() {
  showCase.value = false
  selectedIndex.value = null
}
function openSource() {
  const url = router.resolve({
    path: selectedCase.value.path,
  });
  window.open(url.href);
}
function prevCase() {
  if (selectedIndex.value !== null) {
    selectedIndex.value = (selectedIndex.value - 1 + caselist.value.length) % caselist.value.length
    selectedCase.value = caselist.value[selectedIndex.value]
  }
}

function nextCase() {
  if (selectedIndex.value !== null) {
    selectedIndex.value = (selectedIndex.value + 1) % caselist.value.length
    selectedCase.value = caselist.value[selectedIndex.value]
  }
}
function showDetails(index: number) {
  selectedIndex.value = index;
  showCase.value = true;
  selectedCase.value = caselist.value[index];
}
</script>

<style scoped>
.case_list {
  display: flex;
  flex-wrap: wrap;
  gap: 30px;
  justify-content: space-between;
}

.dialog_content {
  display: flex;
  align-items: center;

  .case_prew {
    width: 20px;
  }

  .case_next {
    width: 40px;
  }
}

.case_item {
  border: 1px solid #ccc;
  padding: 10px;
  width: 360px;
  cursor: pointer;
  transition: transform 0.2s;
}

.case_item:hover {
  transform: scale(1.05);
}

.case_item img {
  max-width: 100%;
  height: auto;
}

.case_item_title {
  font-weight: bold;
  margin-top: 10px;
}

.case_item_description {
  color: #666;
}

.case_details {
  margin-top: 20px;
  border: 1px solid #ccc;
  padding: 20px;
  background-color: #f9f9f9;
}

.case_details img {
  max-width: 100%;
  height: auto;
}
</style>