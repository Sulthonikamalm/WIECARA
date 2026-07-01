document.addEventListener('DOMContentLoaded', async () => {
  // Mobile Menu Toggle
  const mobileMenuToggle = document.querySelector('.hamburger, .mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (mobileMenuToggle && navLinks) {
    mobileMenuToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navLinks.classList.toggle('active', isOpen);
      mobileMenuToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Header Scroll Effect
  const navbar = document.querySelector('.navbar');
  const syncNavbarState = () => {
    navbar?.classList.toggle('scrolled', window.scrollY > 50);
  };
  syncNavbarState();
  window.addEventListener('scroll', syncNavbarState, { passive: true });

  // Global Lapor Button Handler
  const laporButtons = document.querySelectorAll('.js-lapor-nav, .js-lapor-hero, .js-lapor-monitoring, .js-lapor-wawasan');
  laporButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Because all these pages are 1 folder deep (e.g. Landing Page/, Monitoring/),
      // the relative path to Lapor/lapor.html is ../Lapor/lapor.html
      window.location.href = '../Lapor/lapor.html';
    });
  });

  // FAQ Accordion
  const faqButtons = document.querySelectorAll('.faq-button');
  faqButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const answerId = button.getAttribute('aria-controls');
      const answer = answerId ? document.getElementById(answerId) : null;
      if (!answer) return;

      const willOpen = button.getAttribute('aria-expanded') !== 'true';
      faqButtons.forEach((item) => {
        const itemAnswerId = item.getAttribute('aria-controls');
        const itemAnswer = itemAnswerId ? document.getElementById(itemAnswerId) : null;
        item.setAttribute('aria-expanded', 'false');
        itemAnswer?.classList.remove('show');
      });

      button.setAttribute('aria-expanded', String(willOpen));
      answer.classList.toggle('show', willOpen);
    });
  });

  // Fetch Public Stats
  try {
    const statsRes = await fetch('/api/cases/get_public_stats.php');
    const statsData = await statsRes.json();
    if (statsData.status === 'success') {
      const stats = statsData.data;
      animateCounter("statTotalReports", stats.total_cases, 2000);
      animateCounter("statResolved", stats.resolved_cases, 2000);
      animateCounter("statPsikolog", stats.psikolog_count, 2000);
      animateCounter("statHukum", stats.hukum_count, 2000);
    }
  } catch (e) {
    console.error('Gagal mengambil statistik', e);
  }
});

function animateCounter(id, target, duration) {
  const element = document.getElementById(id);
  if (!element) return;
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      clearInterval(timer);
      element.innerText = target + "+";
    } else {
      element.innerText = Math.floor(current) + "+";
    }
  }, 16);
}
