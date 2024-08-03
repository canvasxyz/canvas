<script setup lang="ts">
import { type Ref, inject } from 'vue'
import type { DefaultTheme } from 'vitepress/theme'
import HeroImage from './HeroImage.vue'

defineProps<{
  name?: string
  text?: string
  tagline?: string
  bullets?: string[]
  image?: DefaultTheme.ThemeableImage
}>()

const heroImageSlotExists = inject('hero-image-slot-exists') as Ref<boolean>
</script>

<template>
  <div class="HeroRow" :class="{ 'has-image': image || heroImageSlotExists }">
    <div class="container">
      <div class="main">
        <slot name="home-hero-info">
          <h1 v-if="name" class="name">
            <span v-html="name" class="clip"></span>
          </h1>
          <p class="text">
          <span v-if="text" v-html="text"></span>
          <span
            class="vue-motion"
            v-motion
                    :style='{
                      height: "30px",
                      width: "19px",
                      position: "absolute",
                      backgroundColor: "var(--vp-c-brand-1)",
                      display: "inline-block",
                      borderRadius: "2px",
                    }'
                    :initial='{ opacity: 0, scale: 1 }'
                    :enter='{ to: { backgroundColor: "#fff" }, opacity: 0.9, scale: 0.98, transition: { repeat: Infinity, repeatType: "mirror", duration: 800, ease: "easeOut" } }'
></span>
</p>
          <p v-if="tagline" v-html="tagline" class="tagline"></p>
          <p v-if="bullets" class="bullets">
            <ul>
              <li class="bullet" v-for="bullet in bullets">
                {{ bullet }}
              </li>
            </ul>
          </p>
        </slot>

        <div class="actions">
          <slot></slot>
        </div>
      </div>

      <div v-if="image || heroImageSlotExists" class="image">
        <div class="image-container">
          <div class="image-bg" />
          <slot name="home-hero-image">
            <HeroImage v-if="image" class="image-src" :image="image" />
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.HeroRow {
  margin-top: calc((var(--vp-nav-height) + var(--vp-layout-top-height, 0px)) * -1);
  padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 48px) 24px 48px;
}

@media (min-width: 640px) {
  .HeroRow {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 100px) 48px 64px;
  }
}

@media (min-width: 960px) {
  .HeroRow {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 100px) 64px 64px;
  }
}

.HeroRow .actions {
  margin-left: -6px;
  margin-right: -6px;
}

.container {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  max-width: 1020px;
}

@media (min-width: 960px) {
  .container {
    flex-direction: row;
  }
}

.main {
  position: relative;
  z-index: 10;
  order: 2;
  flex-grow: 1;
  flex-shrink: 0;
}

.HeroRow.has-image .container {
  text-align: center;
}

@media (min-width: 960px) {
  .HeroRow.has-image .container {
    text-align: left;
  }
}

@media (min-width: 960px) {
  .main {
    order: 1;
    width: calc((100% / 3) * 2);
  }

  .HeroRow.has-image .main {
    max-width: 560px;
  }
}

.name,
.text {
  max-width: 600px;
  letter-spacing: -0.4px;
  line-height: 1.2;
  font-size: 32px;
  font-weight: 700;
  white-space: pre-wrap;
}

.HeroRow.has-image .name,
.HeroRow.has-image .text {
  margin: 0 auto;
}

.name {
  color: var(--vp-home-hero-name-color);
}

.clip {
  background: var(--vp-home-hero-name-background);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: var(--vp-home-hero-name-color);
}

@media (min-width: 640px) {
  .name,
  .text {
    line-height: 1.18;
    font-size: 34px;
  }
}

@media (min-width: 960px) {
  .name,
  .text {
    font-size: 40px;
  }

  .HeroRow.has-image .name,
  .HeroRow.has-image .text {
    margin: 0;
  }
}

.tagline {
  padding-top: 20px;
  max-width: 400px;
  line-height: 1.4;
  font-size: 18px;
  font-weight: 500;
  white-space: pre-wrap;
  color: var(--vp-c-text-2);
}

.bullets {
  padding-top: 2px;
  max-width: 450px;
  font-size: 17.5px;
  font-weight: 500;
  white-space: pre-wrap;
  color: var(--vp-c-text-2);
  text-align: left;
  margin: 0 auto;
  line-height: 1.4;
}
.bullets ul {
  list-style-type: disc;
  padding-left: 18px;
}
.bullets ul li {
  padding-left: 6px;
  margin: 4px 0;
}
@media (min-width: 960px) {
  .bullets {
    margin: 0;
  }
}

.HeroRow.has-image .tagline {
  margin: 0 auto;
}
@media (min-width: 640px) {
  .tagline {
    padding-top: 22px;
    /*max-width: 500px;*/
    font-size: 18px;
  }
}

@media (min-width: 960px) {
  .tagline {
    font-size: 18px;
    padding-top: 24px;
    line-height: 1.4 !important;
  }

  .HeroRow.has-image .tagline {
    margin: 0;
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  margin: -6px;
  padding-top: 36px;
}

.HeroRow.has-image .actions {
  justify-content: center;
}

@media (min-width: 640px) {
  .actions {
    padding-top: 20px;
  }
}

@media (min-width: 960px) {
  .HeroRow.has-image .actions {
    justify-content: flex-start;
  }
}

.image {
  order: 1;
  margin: -76px -24px -48px;
}

@media (min-width: 640px) {
  .image {
    margin: -108px -24px -48px;
  }
}

@media (min-width: 960px) {
  .image {
    flex-grow: 1;
    order: 2;
    margin: 0;
    min-height: 100%;
  }
}

.image-container {
  position: relative;
  margin: 0 auto;
  width: 320px;
  height: 320px;
}

@media (min-width: 640px) {
  .image-container {
    width: 392px;
    height: 392px;
  }
}

@media (min-width: 960px) {
  .image-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    /*rtl:ignore*/
    transform: translate(-32px, -32px);
  }
}

.image-bg {
  position: absolute;
  top: 50%;
  /*rtl:ignore*/
  left: 50%;
  border-radius: 50%;
  width: 192px;
  height: 192px;
  background-image: var(--vp-home-hero-image-background-image);
  filter: var(--vp-home-hero-image-filter);
  /*rtl:ignore*/
  transform: translate(-50%, -50%);
}

@media (min-width: 640px) {
  .image-bg {
    width: 256px;
    height: 256px;
  }
}

@media (min-width: 960px) {
  .image-bg {
    width: 320px;
    height: 320px;
  }
}

:deep(.image-src) {
  position: absolute;
  top: 50%;
  /*rtl:ignore*/
  left: 50%;
  max-width: 192px;
  max-height: 192px;
  /*rtl:ignore*/
  transform: translate(-50%, -50%) scale(1.25);
}

@media (min-width: 640px) {
  :deep(.image-src) {
    max-width: 256px;
    max-height: 256px;
  }
}

@media (min-width: 960px) {
  :deep(.image-src) {
    max-width: 320px;
    max-height: 320px;
    transform: translate(-50%, -50%) scale(1.5);
    margin-top: 45px;
  }
}

.vue-motion {
    margin-top: 5px;
    margin-left: 7px;
}

@media (min-width: 960px) {
    .vue-motion {
        margin-top: 10px;
        margin-left: 9px;
    }
}
</style>