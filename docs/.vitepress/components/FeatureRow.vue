<script setup lang="ts">
defineProps<{
  title: string
  detail?: string
}>()
</script>

<template>
  <div class="FeatureRow">
    <h1 class="title">{{ title }}</h1>
    <div v-if="detail" class="detail">{{ detail }}</div>
    <div class="container">
      <div class="items">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<style>
.FeatureRow {
  position: relative;
}

.FeatureRow h1 {
  font-size: 32px;
  line-height: 1.3;
  font-weight: 700;
  padding: 24px 0 26px;
  text-align: center;
}

.FeatureRow .details {
  margin: 0 auto 40px;
  max-width: 640px;
  color: var(--vp-c-text-2);
  text-align: center;
}

@media (min-width: 640px) {
  .FeatureRow {
  }
}

@media (min-width: 960px) {
  .FeatureRow {
  }
}

.FeatureRow .container {
  margin: 0 auto;
  max-width: 1020px;
}

.FeatureRow .items {
  display: flex;
  flex-wrap: wrap;
  margin: -8px;
  justify-content: center;
}

.FeatureRow .item {
  padding: 8px;
  width: 100%;
}

@media (min-width: 640px) {
  .item.grid-2,
  .item.grid-4,
  .item.grid-6 {
    width: calc(100% / 2);
  }
}

@media (min-width: 768px) {
  .item.grid-2,
  .item.grid-4 {
    width: calc(100% / 2);
  }

  .item.grid-3,
  .item.grid-6 {
    width: calc(100% / 3);
  }
}


@media (min-width: 960px) {
  .item.grid-2,
  .item.grid-3,
  .item.grid-4,
  .item.grid-5,
  .item.grid-6 {
    width: calc(100% / 2);
  }
}

</style>