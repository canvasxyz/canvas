<script setup lang="ts">
import type { DefaultTheme } from 'vitepress/theme'
import { VPImage } from 'vitepress/theme'

defineProps<{
  icon?: DefaultTheme.FeatureIcon
  title: string
  details?: string
  soon?: string
  link?: string
  linkText?: string
  rel?: string
  target?: string
}>()
</script>

<template>
  <div class="item grid-3">
    <div class="FeatureCard">
      <article class="box">
        <div v-if="typeof icon === 'object' && icon.wrap" class="icon">
          <VPImage
            :image="icon"
            :alt="icon.alt"
            :height="icon.height || 48"
            :width="icon.width || 48"
          />
        </div>
        <VPImage
          v-else-if="typeof icon === 'object'"
          :image="icon"
          :alt="icon.alt"
          :height="icon.height || 48"
          :width="icon.width || 48"
        />
        <div v-else-if="icon" class="icon" v-html="icon"></div>
        <h2 class="title" v-html="title"></h2>
        <p v-if="details" class="details" v-html="details"></p>

        <div v-if="link" class="link-text">
          <p class="link-text-value">
            <a :href="link" target="blank">
              {{ linkText || 'Link' }} <span class="external-link">↗</span>
            </a>
          </p>
        </div>
        <div v-if="soon" class="link-text">
          <p class="soon-text-value">
            {{ soon }}
          </p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.FeatureCard {
  display: block;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
  transition: border-color 0.25s, background-color 0.25s;
}

.FeatureCard.link:hover {
  border-color: var(--vp-c-brand-1);
}

.box {
  display: flex;
  flex-direction: column;
  padding: 24px;
  height: 100%;
}

.box > :deep(.VPImage) {
  margin-bottom: 20px;
}

.icon {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 20px;
  border-radius: 6px;
  background-color: var(--vp-c-default-soft);
  width: 48px;
  height: 48px;
  font-size: 24px;
  transition: background-color 0.25s;
}

.title {
  line-height: 24px;
  font-size: 17px;
  font-weight: 600;
}

.details {
  flex-grow: 1;
  padding-top: 8px;
  line-height: 22px;
  font-size: 16px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.link-text {
  padding-top: 8px;
}

.link-text-value {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.link-text-value a:hover {
  text-decoration: underline;
}

.soon-text-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-3);
}

.external-link {
  display: inline-block;
  position: relative;
  top: 2px;
  left: -2px;
  line-height: 1;
}
</style>
