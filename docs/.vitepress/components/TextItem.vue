<script setup lang="ts">
defineProps<{
  prefix?: string
}>()
</script>

<template>
  <div class="TextItem">
    <span v-if="prefix"><strong>{{ prefix }}</strong>: </span><slot></slot>
  </div>
</template>

<style>
.TextItem {
  margin-bottom: 11px;
}
.TextItem strong {
  color: var(--vp-c-text-1);
}
</style>