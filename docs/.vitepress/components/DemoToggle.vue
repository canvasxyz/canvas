<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  defaultOption?: string,
  options: string[]
}>(), {
  options: []
})

const selection = ref(props.defaultOption)

function setSelection(event) {
  event.preventDefault()
  event.stopPropagation()
  const option = event.target.attributes.getNamedItem("option").textContent
  selection.value = option

  const els = document.querySelectorAll('.named-fence-filename')
  for (const el of els) {
    if (el.innerText === selection.value) {
      el.parentElement.style.display = "block"
    } else {
      el.parentElement.style.display = "none"
    }
  }
}

onMounted(() => {
  const els = document.querySelectorAll('.named-fence-filename')
  for (const el of els) {
    if (el.innerText === selection.value) {
      el.parentElement.style.display = "block"
    } else {
      el.parentElement.style.display = "none"
    }
  }
})
</script>

<template>
  <div class="DemoToggle">
    <div class="option" :class="{ active: selection === option }" v-for="option in options" v-on:click="setSelection" v-bind:option="option">
      {{ option }} Demo
    </div>
  </div>
</template>

<style>
.DemoToggle {
  text-align: center;
  margin-bottom: 24px;
}

.DemoToggle .option {
  display: inline-block;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-bg-soft);
  border-radius: 12px;
  height: 100%;
  background-color: var(--vp-c-bg-soft);
  transition: opacity 0.25s, border-color 0.25s, background-color 0.25s;
  cursor: pointer;
  opacity: 0.4;
  font-weight: 700;
  margin: 0 6px;
}
.DemoToggle .option.active,
.DemoToggle .option:hover {
  border-color: var(--vp-c-brand-1);
  opacity: 1;
}
</style>
