<script>
  const timer = setInterval(() => {
    try {
      const firstBlogPost = document.querySelector('.VPSidebarItem a').getAttribute('href')
      window.history.replaceState({}, "", firstBlogPost)
      document.location = firstBlogPost
      clearInterval(timer)
    } catch {}
  }, 100)
</script>

<style>
  .prev-next { display: none !important; }
</style>