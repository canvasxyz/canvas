<script setup lang="ts">
defineProps<{
  title: string
  details?: string
}>()
</script>

<template>
  <div class="TextRow">
    <h1 class="title">{{ title }}</h1>
    <div v-if="details" class="details">{{ details.replace(/\\n/g, '\n') }}</div>
    <div class="container">
      <slot></slot>
    </div>
  </div>
</template>

<style>
.TextRow {
  position: relative;
  padding: 30px 24px;
  line-height: 1.45;
}

.TextRow h1 {
  font-size: 32px;
  font-weight: 700;
  padding: 24px 0 36px;
  text-align: center;
}

.TextRow .details {
  white-space: pre-line;
  padding-bottom: 34px;
  margin: 0 auto;
  max-width: 610px;
  font-size: 17.75px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.TextRow .container {
  margin: 0 auto;
  max-width: 610px;
  font-size: 17.75px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}
</style>
