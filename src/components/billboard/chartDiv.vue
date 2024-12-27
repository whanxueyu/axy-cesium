<template>
    <div :id="id" class="chartDiv" ref="chartDivRef">
    </div>
</template>
<script setup>
import { defineProps, onMounted, ref } from 'vue';
import * as echarts from 'echarts'
const props = defineProps({
    id: {
        type: String,
        required: true
    },
    htmlContent: {
        type: String,
        required: true
    }
});
const chartDivRef = ref(null);
var option;
const initChart = () => {
    var myChart = echarts.init(chartDivRef.value);
option = {
    backgroundColor: '#fff',
    color: ['#3398DB'],
    title: {
        tezt: props.htmlContent
    },
    tooltip: {
        trigger: "axis",
        axisPointer: {
            type: "shadow",
            shadowStyle: {
                color: "rgba(210,219,238,0.2)",
            },
        },
    },
    grid: {
        top:'5%',
        left: "4%",
        right: "4%",
        bottom: "5%",
        containLabel: true,
    },
  xAxis: {
    type: 'category',
    data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      data: [120, 200, 150, 80, 70, 110, 130],
      type: 'bar'
    }
  ]
};

option && myChart.setOption(option);
};
onMounted(() => {
    initChart();
});
</script>
<style lang="scss" scoped>
.chartDiv {
    position: relative;
    padding: 4px;
    transition: 0.5s;
    cursor: pointer;
    overflow: hidden;
    white-space: break-spaces;
    width:300px;
    height: 200px;
}
</style>