<template>
    <div :id="id" class="iframediv">
        <div class="content">
            <iframe :src="htmlContent" width="1000" height="500" frameborder="0"  marginheight="0" marginwidth="0"></iframe>
        </div>
    </div>
</template>
<script setup>
import { defineProps } from 'vue';
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
</script>
<style lang="scss" scoped>
.iframediv {
    position: relative;
    padding: 4px;
    transition: 0.5s;
    cursor: pointer;
    overflow: hidden;
    white-space: break-spaces;

    .content {
        min-width: 1000px;
        height: 500px;;
    }
}
</style>