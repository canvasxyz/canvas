<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  const timer = setInterval(() => {
    const firstBlogPost = document.querySelector('.VPSidebarItem a')
    if (!firstBlogPost) return

    window.history.replaceState({}, "", firstBlogPost.href)
    document.location = firstBlogPost.href
    clearInterval(timer)
  }, 50)
})
</script>

<template>
</template>