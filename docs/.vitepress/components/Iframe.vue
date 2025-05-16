<script setup>
defineProps({
  src: {
    type: String,
    required: true
  }
})
</script>

<template>
  <iframe :src="src" class="iframe-container"></iframe>
</template>

<style scoped>
.iframe-container {
  width: 100%;
  min-height: 400px;
  border: 1px solid rgba(128,128,128,0.2);
  margin: 30px 0;
}
</style>