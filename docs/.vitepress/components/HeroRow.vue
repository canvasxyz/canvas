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
        <div v-if="tagline" v-html="tagline" class="prefix"></div>
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
                      height: "32px",
                      width: "19px",
                      position: "absolute",
                      bottom: "4px",
                      backgroundColor: "var(--vp-c-brand-1)",
                      display: "inline-block",
                      borderRadius: "2px",
                    }'
                    :initial='{ opacity: 0, scale: 1 }'
                    :enter='{ to: { backgroundColor: "#fff" }, opacity: 0.9, scale: 0.98, transition: { repeat: 2, repeatType: "mirror", duration: 800, ease: "easeOut" } }'
></span>
</p>
          <div v-if="bullets" class="bullets">
            <ul>
              <li class="bullet" v-for="bullet in bullets">
                {{ bullet }}
              </li>
            </ul>
          </div>
        </slot>
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
.HeroRow .prefix {
  color: #989FE4;
  font-size: 80%;
  font-weight: 500;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  margin-bottom: 30px;
}

.HeroRow {
  margin-top: calc((var(--vp-nav-height) + var(--vp-layout-top-height, 0px)) * -1);
  padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 24px) 0 14px;
}

@media (min-width: 640px) {
  .HeroRow {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 0px) 0 14px;
  }
}

@media (min-width: 960px) {
  .HeroRow {
    padding: calc(var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 10px) 0 10px;
  }
}

.HeroRow p {
  max-width: none !important;
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
  .HeroRow.has-image .main {
  }
}

.name,
.text {
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
    padding-top: 54px;
  }
}

@media (min-width: 960px) {
  .HeroRow.has-image .actions {
    justify-content: flex-start;
  }
}

.image-container {
  display: none;
  position: absolute;
  right: -80px;
  margin: 0 auto;
  margin-top: 0;
  width: 320px;
  height: 320px;
}

@media (min-width: 1230px) {
  .image-container {
    display: block;
  }
}

.image-bg {
  border-radius: 50%;
  width: 192px;
  height: 192px;
  background-image: var(--vp-home-hero-image-background-image);
  filter: var(--vp-home-hero-image-filter);
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
  top: 0;
  left: 0;
  max-width: 320px;
  max-height: 320px;
}

.vue-motion {
    margin-top: 5px;
    margin-left: 8px;
}

@media (min-width: 960px) {
    .vue-motion {
        margin-top: 10px;
        margin-left: 8px;
        bottom: 8px !important;
    }
}
</style>