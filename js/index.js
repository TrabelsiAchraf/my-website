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