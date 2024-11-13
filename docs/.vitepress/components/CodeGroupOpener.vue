<script setup>
import { ref, onMounted } from 'vue'

const el = ref()

onMounted(() => {
  document.querySelectorAll('.vp-code-group > .blocks').forEach((el) => {
    Array.from(el.children).forEach((child) => {
      child.classList.remove('active')
    })
    el.children[0].classList.add('active')
  })
})
</script>

<template>
  <div ref="el"></div>
</template>
