<ClientOnly>
  <script>
    const timer = setInterval(() => {
      try {
        const firstBlogPost = document.querySelector('.VPSidebarItem a').getAttribute('href')
        window.history.replaceState({}, "", firstBlogPost)
        document.location = firstBlogPost
        clearInterval(timer)
      } catch {}
    }, 10)
  </script>
</ClientOnly>

<style>
  .prev-next { display: none !important; }
</style>