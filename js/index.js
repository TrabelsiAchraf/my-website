// Footer year
const yearSpan = document.getElementById("year");
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// Mobile nav toggle
const nav = document.querySelector(".site-nav");
const toggle = document.querySelector(".nav-toggle");
if (nav && toggle) {
    toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", open);
    });
    nav.querySelectorAll(".nav-links a").forEach((link) => {
        link.addEventListener("click", () => {
            nav.classList.remove("nav-open");
            toggle.setAttribute("aria-expanded", "false");
        });
    });
}

// Scroll reveal
const revealed = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1 }
    );
    revealed.forEach((el) => observer.observe(el));
} else {
    revealed.forEach((el) => el.classList.add("visible"));
}

// Hidden entry to the Mario game: type "mario" anywhere
let typed = "";
document.addEventListener("keydown", (event) => {
    typed = (typed + event.key.toLowerCase()).slice(-5);
    if (typed === "mario") {
        window.location.href = "games/mario/";
    }
});

// Hidden entries: 6 quick taps on an element
// (counter resets if more than 1.5s passes between taps)
function tapSecret(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;
    let taps = 0;
    let lastTap = 0;
    el.addEventListener("click", () => {
        const now = Date.now();
        taps = now - lastTap > 1500 ? 1 : taps + 1;
        lastTap = now;
        if (taps >= 6) {
            window.location.href = url;
        }
    });
}
tapSecret(".hero-avatar", "stats.html"); // stats page
tapSecret(".footer-copy", "games/mario/"); // Mario game (mobile-friendly)