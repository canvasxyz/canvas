<script setup lang="ts">
import type { DefaultTheme } from 'vitepress/theme'
import { VPImage } from 'vitepress/theme'
import { FiExternalLink } from 'vue3-icons/fi'

defineProps<{
  icon?: DefaultTheme.FeatureIcon
  iconName?: string
  title: string
  details?: string
  soon?: string
  link?: string
  linkText?: string
  secondaryLink?: string
  secondaryLinkText?: string
  rel?: string
  target?: string
}>()
</script>

<template>
  <div class="item grid-3">
    <div class="FeatureCard" :class="{ 'feature-soon': soon }">
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
        <component v-else-if="iconName" :is="iconName" class="icon" size="24" />
        <h2 class="title" v-html="title"></h2>
        <p v-if="details" class="details" v-html="details"></p>

        <div v-if="link || soon" class="link-text">
          <p class="link-text-value">
            <a v-if="link" :href="link" target="blank">
              {{ linkText || 'Link' }}&nbsp;<FiExternalLink class="external-link" size="16" />
            </a>
            <a v-if="secondaryLink" :href="secondaryLink" target="blank">
              {{ secondaryLinkText || 'Link' }}&nbsp;<FiExternalLink class="external-link" size="16" />
            </a>
            <span v-if="soon" class="feature-tag-soon">
              Soon
            </span>
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
  box-shadow: 0px 1px 4px rgba(0, 0, 0, 0.07)
}

.FeatureCard p {
  margin: 0;
  text-align: left;
}

.FeatureCard.link:hover {
  border-color: var(--vp-c-brand-1);
}

.VPContent.is-home .FeatureCard h2 {
  font-family: var(--vp-font-family-base);
  letter-spacing: 0.1px;
  margin-bottom: 2px;
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
  line-height: 22px;
  font-size: 16px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

h2.title {
  padding-top: 0px !important;
}

p.details {
  margin: 10px 0;
}

.link-text {
  padding-top: 8px;
  max-height: 50px;
}

.link-text-value {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  margin: 0;
}
.link-text-value a {
  text-decoration: none;
}

.feature-tag-soon {
  margin-left: 6px;
  font-size: 12px;
  opacity: 0.7;
  background-color: var(--vp-c-brand-soft);
  padding: 1px 6px;
  border-radius: 10px;
}

.feature-soon {
  opacity: 0.8;
  border: 1px dashed var(--vp-c-border);
}

.external-link {
  display: inline-block;
  position: relative;
  top: 1px;
  line-height: 1;
  margin-right: 15px;
  margin-left: 1px;
}
</style>
