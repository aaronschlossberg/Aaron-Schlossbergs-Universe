console.log("main.js loaded");

/* ------------------------------------------------------------
  Helpers
------------------------------------------------------------ */
async function loadText(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.text();
}

async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return await res.json();
}

function safeStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

/* ------------------------------------------------------------
  Partials loader (header/footer/highlights)
  - If a placeholder exists on the page, this injects the partial.
------------------------------------------------------------ */
async function loadPartials() {
  const jobs = [];

  const headerHost = document.getElementById("header-placeholder");
  if (headerHost) {
    jobs.push(
      loadText("/_partials/header.html").then((html) => {
        headerHost.innerHTML = html;
      })
    );
  }

  const footerHost = document.getElementById("footer-placeholder");
  if (footerHost) {
    jobs.push(
      loadText("/_partials/footer.html").then((html) => {
        footerHost.innerHTML = html;
      })
    );
  }

  const highlightsHost = document.getElementById("highlights-placeholder");
  if (highlightsHost) {
    jobs.push(
      loadText("/_partials/highlights.html").then((html) => {
        highlightsHost.innerHTML = html;
      })
    );
  }

  const pageConstructionHost = document.getElementById("page-construction-placeholder");
  if (pageConstructionHost) {
    jobs.push(
      loadText("/_partials/page-construction.html").then((html) => {
        pageConstructionHost.innerHTML = html;
      })
    );
  }

  // Don’t fail the whole page if one partial fails
  await Promise.allSettled(jobs);
}

/* ------------------------------------------------------------
  Config-driven links
  Usage: <a data-config-link="instagram">Instagram</a>
------------------------------------------------------------ */
function applyConfigLinks(config) {
  const linkMap = config?.links || {};

  document.querySelectorAll("[data-config-link]").forEach((el) => {
    const key = safeStr(el.getAttribute("data-config-link"));
    const url = safeStr(linkMap[key]);

    // If no URL exists, hide it if requested
    const shouldHide = el.hasAttribute("data-hide-if-missing");

    if (!url) {
      if (shouldHide) el.style.display = "none";
      return;
    }

    // If it's an anchor, set href; otherwise, set textContent
    if (el.tagName.toLowerCase() === "a") {
      el.setAttribute("href", url);

      // Optional: new tab behavior
      if (el.hasAttribute("data-external")) {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
    } else {
      el.textContent = url;
    }
  });
}

/* ------------------------------------------------------------
  Config-driven text and URLs

  Usage note:
  <span data-config-text="siteName">Fallback text</span>
  <a data-config-href="baseUrl" href="/">Fallback link</a>
------------------------------------------------------------ */
function getConfigValue(config, path) {
  return path
    .split(".")
    .reduce((current, key) => current?.[key], config);
}

function applyConfigValues(config) {
  document.querySelectorAll("[data-config-text]").forEach((el) => {
    const path = safeStr(el.getAttribute("data-config-text"));
    const value = safeStr(getConfigValue(config, path));

    if (value) {
      el.textContent = value;
    }
  });

  document.querySelectorAll("[data-config-href]").forEach((el) => {
    const path = safeStr(el.getAttribute("data-config-href"));
    const value = safeStr(getConfigValue(config, path));

    if (value && el.tagName.toLowerCase() === "a") {
      el.setAttribute("href", value);
    }
  });
}

/* ------------------------------------------------------------
  Footer init (auto-year)
------------------------------------------------------------ */
function initFooterYear() {
  const yearSpan = document.getElementById("current-year");
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

/* ------------------------------------------------------------
  Copy helper (kept from your original)
------------------------------------------------------------ */
function copyToClipboard(text, type) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      alert(`${type} has been copied to clipboard!\n\n${type}: ${text}`);
    })
    .catch((err) => {
      console.error("Failed to copy: ", err);
    });
}

// Expose globally so existing onclick handlers keep working
window.copyToClipboard = copyToClipboard;

function initCarousels() {
    document.querySelectorAll("[data-carousel]").forEach((carousel) => {
        const track = carousel.querySelector(".carousel-track");
        const prev = carousel.querySelector(".carousel-btn-prev");
        const next = carousel.querySelector(".carousel-btn-next");

        if (
            !track ||
            !prev ||
            !next ||
            track.dataset.carouselReady === "true"
        ) {
            return;
        }

        const items = Array.from(track.children);

        if (items.length <= 1) {
            prev.hidden = true;
            next.hidden = true;
            return;
        }

        track.dataset.carouselReady = "true";

        function getStep() {
            const item = items[0];

            if (!item) {
                return 320;
            }

            const gap =
                parseFloat(getComputedStyle(track).gap) || 0;

            return item.getBoundingClientRect().width + gap;
        }

        function updateButtons() {
            const maximum =
                track.scrollWidth - track.clientWidth;

            prev.hidden = next.hidden = maximum <= 1;
            prev.disabled = track.scrollLeft <= 1;
            next.disabled =
                track.scrollLeft >= maximum - 1;
        }

        next.addEventListener("click", () => {
            track.scrollBy({
                left: getStep()
            });
        });

        prev.addEventListener("click", () => {
            track.scrollBy({
                left: -getStep()
            });
        });

        track.addEventListener("scroll", updateButtons, { passive: true });
        window.addEventListener("resize", updateButtons);
        updateButtons();
    });
}

/* ------------------------------------------------------------
  Reveal the header on upward scrolling and while it is in use
------------------------------------------------------------ */
function initSmartHeader(header) {
    const stickyElement = header.closest("#header-placeholder") || header;
    const root = document.documentElement;
    let previousWidth = root.clientWidth;
    let direction = 0;
    let distance = 0;
    let framePending = false;

    function scrollPosition() {
        const maximum = Math.max(0, root.scrollHeight - window.innerHeight);
        return Math.min(maximum, Math.max(0, window.scrollY));
    }

    let previousY = scrollPosition();

    function revealHeader() {
        stickyElement.removeAttribute("data-header-hidden");
        previousY = scrollPosition();
        direction = 0;
        distance = 0;
    }

    function updateScroll() {
        framePending = false;
        const currentY = scrollPosition();
        const movement = currentY - previousY;
        previousY = currentY;

        if (
            currentY <= 16 ||
            header.querySelector(":focus-visible") ||
            header.querySelector(".nav-dropdown[data-open]")
        ) {
            revealHeader();
            return;
        }

        if (Math.abs(movement) < 1) return;

        const nextDirection = movement > 0 ? 1 : -1;
        distance = nextDirection === direction
            ? distance + Math.abs(movement)
            : Math.abs(movement);
        direction = nextDirection;

        // Small thresholds avoid flicker from tiny trackpad movements.
        if (distance >= (direction > 0 ? 12 : 4)) {
            stickyElement.toggleAttribute("data-header-hidden", direction > 0);
        }
    }

    window.addEventListener("scroll", () => {
        if (!framePending) {
            framePending = true;
            requestAnimationFrame(updateScroll);
        }
    }, { passive: true });

    header.addEventListener("focusin", revealHeader);
    window.addEventListener("pageshow", revealHeader);
    window.addEventListener("resize", () => {
        // Mobile address-bar height changes should not reveal the header.
        if (root.clientWidth !== previousWidth) {
            previousWidth = root.clientWidth;
            revealHeader();
        }
    });

    return revealHeader;
}

/* ------------------------------------------------------------
  Shared navigation: disclosure controls and current section
------------------------------------------------------------ */
function initSiteNavigation() {
    const nav = document.querySelector(".site-header .site-nav");
    if (!nav || nav.hasAttribute("data-nav-ready")) return;

    const header = nav.closest(".site-header");
    function updateHeaderHeight() {
        document.documentElement.style.setProperty(
            "--site-header-height",
            `${Math.ceil(header.getBoundingClientRect().height)}px`
        );
    }
    updateHeaderHeight();

    if ("ResizeObserver" in window) {
        new ResizeObserver(updateHeaderHeight).observe(header);
    } else {
        window.addEventListener("resize", updateHeaderHeight);
    }

    const revealHeader = initSmartHeader(header);
    const dropdowns = Array.from(nav.querySelectorAll(".nav-dropdown"));
    const hoverPointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    function positionMenu(dropdown) {
        const menu = dropdown.querySelector(".nav-dropdown-menu");
        menu.style.removeProperty("--nav-menu-shift");
        const bounds = menu.getBoundingClientRect();
        const gutter = 12;
        const width = document.documentElement.clientWidth;
        const shift = Math.max(
            gutter - bounds.left,
            Math.min(0, width - gutter - bounds.right)
        );
        menu.style.setProperty("--nav-menu-shift", `${shift}px`);
    }

    function closeMenu(dropdown) {
        dropdown.removeAttribute("data-open");
        dropdown.querySelector(".nav-dropdown-toggle")
            .setAttribute("aria-expanded", "false");
    }

    function openMenu(dropdown) {
        revealHeader();
        dropdowns.forEach((other) => {
            if (other !== dropdown) closeMenu(other);
        });
        dropdown.setAttribute("data-open", "");
        dropdown.querySelector(".nav-dropdown-toggle")
            .setAttribute("aria-expanded", "true");
        positionMenu(dropdown);
    }

    function normalizedPath(pathname) {
        return pathname.replace(/\/index\.html$/, "/").replace(/\/+$/, "") || "/";
    }

    const currentPath = normalizedPath(window.location.pathname);
    nav.querySelectorAll("a[href]").forEach((link) => {
        const linkPath = normalizedPath(new URL(link.href).pathname);
        const isCurrent = currentPath === linkPath;
        const isSection = linkPath !== "/" && currentPath.startsWith(`${linkPath}/`);

        if (isCurrent) link.setAttribute("aria-current", "page");
        if (!isCurrent && !isSection) return;

        if (link.classList.contains("nav-top-link")) {
            link.classList.add("is-current-section");
        } else {
            const dropdown = link.closest(".nav-dropdown");
            const parent = dropdown?.querySelector(".nav-top-link, .nav-more-toggle");
            parent?.classList.add("is-current-section");
        }
    });

    dropdowns.forEach((dropdown) => {
        const toggle = dropdown.querySelector(".nav-dropdown-toggle");
        const links = Array.from(dropdown.querySelectorAll(".nav-dropdown-menu a"));

        toggle.addEventListener("click", () => {
            if (dropdown.hasAttribute("data-open")) closeMenu(dropdown);
            else openMenu(dropdown);
        });

        dropdown.addEventListener("pointerenter", (event) => {
            if (event.pointerType === "mouse" && hoverPointer.matches) openMenu(dropdown);
        });

        dropdown.addEventListener("pointerleave", () => {
            if (!dropdown.contains(document.activeElement)) closeMenu(dropdown);
        });

        dropdown.addEventListener("focusout", (event) => {
            if (!dropdown.contains(event.relatedTarget)) closeMenu(dropdown);
        });

        dropdown.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && dropdown.hasAttribute("data-open")) {
                event.preventDefault();
                closeMenu(dropdown);
                toggle.focus();
            } else if (
                event.key === "ArrowDown" &&
                event.target.closest(".nav-dropdown-control, .nav-more-toggle")
            ) {
                event.preventDefault();
                openMenu(dropdown);
                links[0]?.focus();
            }
        });
    });

    document.addEventListener("click", (event) => {
        dropdowns.forEach((dropdown) => {
            if (!dropdown.contains(event.target)) closeMenu(dropdown);
        });
    });

    window.addEventListener("resize", () => {
        dropdowns.forEach((dropdown) => {
            if (dropdown.hasAttribute("data-open")) positionMenu(dropdown);
        });
    });

    nav.setAttribute("data-nav-ready", "");
}

/* Init */
async function init() {
    // 1) Load header/footer/highlights first
    await loadPartials();
    initSiteNavigation();
    initCarousels();

    // 2) After footer is injected, set the year
    initFooterYear();

    // 3) Load config once and apply all config links
    try {
        const config = await loadJSON("/data/config.json");
        applyConfigLinks(config);
        applyConfigValues(config);
    } catch (e) {
        console.warn("Config load failed:", e);
    }
}

document.addEventListener("DOMContentLoaded", init);
