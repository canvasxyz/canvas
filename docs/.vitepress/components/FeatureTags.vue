<script setup lang="ts">
import { computed } from 'vue'
import { TbArrowBigLeftLines, TbDeviceMobileStar, TbGitMerge, TbDatabase, TbLockSquareRounded, TbDeviceDesktop, Tb123, TbAB, TbActivity, TbAdjustmentsHorizontal, TbAperture, TbApps, TbArchive, TbArrowGuide, TbArrowRampRight2, TbArrowsShuffle, TbArrowsSort, TbAtom, TbChartPie4, TbChartBar, TbCrown, TbGitCompare, TbThumbUp } from 'vue3-icons/tb'

interface FeatureTag {
  text: string;
  tooltip?: string;
  icon?: string;
  iconName?: string;
  disabled?: boolean;
}

const props = defineProps<{
  features: (string | FeatureTag)[]
}>()

const parsedFeatures = computed(() => {
  return props.features.map(feature => {
    if (typeof feature === 'string') {
      return { text: feature }
    }
    return feature
  })
})

const getIconComponent = (iconName: string) => {
  switch(iconName) {
    case 'database': return TbDatabase;
    case 'merge': return TbGitMerge;
    case 'mobile': return TbDeviceMobileStar;
    case 'rewind': return TbArrowBigLeftLines;
    case 'lock': return TbLockSquareRounded;
    case 'desktop': return TbDeviceDesktop;
    case '123': return Tb123;
    case 'ab': return TbAB;
    case 'activity': return TbActivity;
    case 'adjust': return TbAdjustmentsHorizontal;
    case 'aperture': return TbAperture;
    case 'apps': return TbApps;
    case 'archive': return TbArchive;
    case 'guide': return TbArrowGuide;
    case 'ramp': return TbArrowRampRight2;
    case 'shuffle': return TbArrowsShuffle;
    case 'sort': return TbArrowsSort;
    case 'atom': return TbAtom;
    case 'pie': return TbChartPie4;
    case 'bar': return TbChartBar;
    case 'crown': return TbCrown;
    case 'compare': return TbGitCompare;
    case 'thumbup': return TbThumbUp;
    default: return null;
  }
}
</script>

<template>
  <div class="feature-tags">
    <div
      v-for="(feature, index) in parsedFeatures"
      :key="index"
      class="feature-tag"
      :class="{ 'feature-tag-disabled': feature.disabled }"
      :title="feature.tooltip"
    >
      <span v-if="feature.icon || feature.iconName" class="feature-tag-icon">
        <component v-if="feature.iconName" :is="getIconComponent(feature.iconName)" size="16" />
        <span v-else-if="feature.icon" v-html="feature.icon"></span>
      </span>
      <span>{{ feature.text }}</span>
      <span v-if="feature.disabled" class="feature-tag-soon">Soon</span>
    </div>
  </div>
</template>

<style scoped>
.feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 36px auto;
  justify-content: center;
  max-width: 600px;
}

@media (min-width: 960px) {
  .feature-tags {
    justify-content: flex-start;
    margin: 36px 0;
  }
}

.feature-tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 15px;
  font-weight: 500;
  background-color: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  transition: background-color 0.2s, transform 0.2s;
  font-family: var(--space-font-family);
  cursor: default;
  position: relative;
}

.feature-tag:not(.feature-tag-disabled):hover {
  background-color: var(--vp-c-brand-soft);
  transform: translateY(-2px);
}

.feature-tag-disabled {
  opacity: 0.6;
  background-color: var(--vp-c-bg-soft);
  border: 1px dashed var(--vp-c-border);
}

.feature-tag-soon {
  margin-left: 6px;
  font-size: 12px;
  opacity: 0.7;
  background-color: var(--vp-c-brand-soft);
  padding: 1px 6px;
  border-radius: 10px;
}

.feature-tag-icon {
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
}

.dark .feature-tag {
  background-color: var(--vp-c-bg-soft);
}

.dark .feature-tag:not(.feature-tag-disabled):hover {
  background-color: var(--vp-c-brand-soft);
}
</style>