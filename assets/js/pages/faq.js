(() => {
    function revealAnswer() {
        let id;
        try {
            id = decodeURIComponent(window.location.hash.slice(1));
        } catch {
            return;
        }

        const answer = document.getElementById(id);
        if (!answer?.matches("details[data-faq-item]")) return;

        answer.open = true;
        requestAnimationFrame(() => {
            answer.scrollIntoView({ block: "start" });
            answer.querySelector("summary")?.focus({ preventScroll: true });
        });
    }

    window.addEventListener("hashchange", revealAnswer);
    revealAnswer();
})();
