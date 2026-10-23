// Shared behaviour for every page: footer year and scroll reveal.

(function () {
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();
