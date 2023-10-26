<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <div class="TextRow">
    <div class="container">
      <h1 class="title">{{ title }}</h1>
      <slot></slot>
    </div>
  </div>
</template>

<style>
.TextRow {
  position: relative;
  padding: 30px 24px;
}

.TextRow h1 {
  font-size: 32px;
  font-weight: 700;
  padding: 24px 0 36px;
  text-align: center;
}

.TextRow .container {
  margin: 0 auto;
  max-width: 640px;
}
</style>
