console.log("main.js loaded");

function copyToClipboard(text, type) {
    navigator.clipboard.writeText(text).then(() => {
        alert(type + " has been copied to clipboard! \n\n" + type + ": " + text);
    }).catch(err => {
        console.error("Failed to copy: ", err);
    });
}

/* ------------------------------------------------------------
   Footer init (auto-year)
------------------------------------------------------------ */
function initFooter() {
    const yearSpan = document.getElementById("current-year");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

/* Run after the page HTML is loaded */
initFooter();
document.addEventListener("DOMContentLoaded", initFooter);