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

/* ------------------------------------------------------------
  Init
------------------------------------------------------------ */
async function init() {
  // 1) Load header/footer/highlights first
  await loadPartials();

  // 2) After footer is injected, set the year
  initFooterYear();

  // 3) Load config once and apply all config links
  try {
    const config = await loadJSON("/data/config.json");
    applyConfigLinks(config);
  } catch (e) {
    console.warn("Config load failed:", e);
  }
}

document.addEventListener("DOMContentLoaded", init);