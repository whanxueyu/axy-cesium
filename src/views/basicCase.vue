<!-- src/views/Case2.vue -->
<template>
  <div class="case_list">
    <div class="case_item" v-for="(item, index) in caselist" :key="item.title" @click="showDetails(index)">
      <div class="case_item_img">
      <img :src="item.imgurl" :alt="item.title">
    </div>
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
import { ref, onMounted, watch } from 'vue';
import { ArrowLeft, ArrowRight } from "@element-plus/icons-vue";
import { caseList } from '@/data/caseList';
import router from '@/router';
import { ElMessage } from 'element-plus';
interface Props {
  type: 'layers' | 'billboard'; // 只允许 'layer' 或 'billboard'
}
const props = defineProps<Props>();
const selectedIndex = ref<number | null>(null)
const caselist = ref<any>([])
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
  if (selectedCase.value.path) {
    const url = router.resolve({
      path: selectedCase.value.path,
    });
    window.open(url.href);
  } else {
    ElMessage.warning('该功能暂未完成，待开发')
  }
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
// 监听 props.type 的变化
watch(
  () => props.type,
  (newType) => {
    updateCaselist(newType);
  }
);

function updateCaselist(type: 'layers' | 'billboard' = props.type) {
  console.log(type, caseList);
  caselist.value = caseList[type];
  console.log(caseList[type]);
}
onMounted(() => {
  updateCaselist();
})
</script>

<style scoped>
.case_list {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: space-evenly;
}

.dialog_content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* 添加间距 */
}

.case_prev,
.case_next {
  width: 40px;
  /* 统一样式 */
  cursor: pointer;
}

.case_item {
  padding: 15px;
  /* 统一样式 */
  width: 360px;
  cursor: pointer;
  /* 添加圆角 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  transition: transform 0.3s;
  /* 添加阴影 */
}
.case_item_img{
  width: 360px;
  height: 172px;
  overflow: hidden;
}
.case_item:hover {
  transform: scale(1.05);
}
.case_item:hover img {
  transform: scale(1.4);
  transition: transform 0.3s;
  transition-delay: 0.2s;
}
.case_item img {
  max-width: 100%;
  height: auto;
  transition: transform 0.2s;
}

.case_item_title {
  font-weight: bold;
  margin-top: 10px;
  font-size: 18px;
  /* 统一样式 */
}

.case_item_description {
  text-align: start;
  color: #666;
  margin-top: 5px;
  /* 添加间距 */
  width: 100%;
  /* 确保容器有宽度 */
  display: -webkit-box;
  /* 使用弹性盒模型 */
  -webkit-box-orient: vertical;
  /* 设置盒模型的方向为垂直 */
  -webkit-line-clamp: 1;
  /* 设置显示的行数 */
  line-clamp: 1;
  overflow: hidden;
}

.case_details {
  margin-top: 20px;
  text-align: start;
  border: 1px solid #ccc;
  padding: 20px;
  background-color: #f9f9f9;
  border-radius: 8px;
  /* 添加圆角 */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  /* 添加阴影 */
}

.case_details img {
  max-width: 100%;
  height: auto;
}

.el-button {
  font-size: 14px;
  /* 统一样式 */
  padding: 10px 20px;
  /* 统一样式 */
  border-radius: 4px;
  /* 添加圆角 */
}

.el-dialog__header {
  font-size: 18px;
  /* 统一样式 */
  font-weight: bold;
}
</style>