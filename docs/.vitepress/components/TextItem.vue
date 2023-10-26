<script setup lang="ts">
defineProps<{
  prefix: string
}>()
</script>

<template>
  <div class="TextItem">
    <strong>{{ prefix }}</strong>: <slot></slot>
  </div>
</template>

<style>
.TextItem {
  margin-bottom: 9px;
}
</style>