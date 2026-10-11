// JalDrishti: shared site behaviour (all pages)
// Navigation menu, header state, entrance reveal and shared constants.

const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

// Hindi site names, taken from the bilingual administrative brief
const HINDI_NAMES = {
  "Bairagarh (Sant Hirdaram) kund": "संत हिरदाराम (बैरागढ़) विसर्जन कुंड",
  "Malikhedi kund": "मालीखेड़ी विसर्जन कुंड",
  "Khatlapura ghat": "खटलापुरा घाट",
  "Shahpura lake ghat": "शाहपुरा झील घाट",
  "Rani Kamlapati ghat / Kamla Park kund": "रानी कमलापति / कमला पार्क",
  "Hathaikheda dam / kund": "हथाईखेड़ा बांध / कुंड",
  "Prempura ghat": "प्रेमपुरा घाट"
};

function siteEsc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

// Responsive navigation
function closeNavMenu() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("siteNav");
  if (!toggle || !nav) return;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open navigation menu");
  nav.classList.remove("is-open");
}

function initNavigation() {
  const nav = document.getElementById("siteNav");
  const toggle = document.getElementById("navToggle");
  if (!nav || !toggle) return;

  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    nav.classList.toggle("is-open", open);
  });

  nav.querySelectorAll(".nav-links a").forEach(a => a.addEventListener("click", closeNavMenu));

  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeNavMenu();
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeNavMenu();
  });
}

// Entrance reveal (skipped entirely when reduced motion is preferred)
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (reduceMotionQuery.matches || !("IntersectionObserver" in window)) {
    items.forEach(el => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  items.forEach((el, i) => {
    el.style.setProperty("--i", i % 6);
    io.observe(el);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initReveal();
});
