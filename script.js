/**
 * RelationshipScan — wspólny skrypt dla wszystkich stron
 * Odpowiada za: nawigację mobilną, animacje, test (pytania + wynik),
 * oraz zapis/odczyt localStorage.
 */

(function () {
  "use strict";

  // --- Stałe: klucz localStorage dla wyniku testu ---
  const STORAGE_KEY = "wynik";

  /**
   * Struktura testu: 20 pytań w 4 sekcjach (5+5+5+5).
   * Skala 1–5: wyższa wartość = większe subiektywne napięcie / niepewność (wyższy wynik).
   * Suma min 20, max 100 → normalizacja do 0–100.
   */
  const TEST_SECTIONS = [
    {
      id: "communication",
      title: "Communication",
      questions: [
        "How often do you feel that topics important to you are postponed or avoided?",
        "How difficult is it for you to return to an unfinished conversation after tension?",
        "How often do you feel your needs are ignored or not fully heard in conversations?",
        "How often do you end a conversation feeling there is unfinished business?",
        "How much do you worry about whether you can calmly discuss boundaries and expectations?",
      ],
    },
    {
      id: "behavior",
      title: "Behavior",
      questions: [
        "How much has the rhythm of your shared time changed compared with what used to feel natural?",
        "How often do you feel there is less predictability in everyday relationship matters?",
        "How often do you feel distance in daily activities that used to build closeness?",
        "How often do you feel that gestures of closeness are less natural than before?",
        "How much inconsistency do you feel between your partner's words and daily behavior?",
      ],
    },
    {
      id: "emotions",
      title: "Emotions",
      questions: [
        "How often do you wake up or go to sleep with tension related to the relationship?",
        "How much anxiety do you feel about choosing the wrong moment for a difficult conversation?",
        "How often do you feel longing and uncertainty at the same time?",
        "How often do your emotions about the relationship feel chaotic or hard to name?",
        "How often do you feel emotionally exhausted by the relationship dynamic?",
      ],
    },
    {
      id: "trust",
      title: "Trust",
      questions: [
        "How often do you wonder whether you are truly aligned on what matters most?",
        "How often do you feel a lack of psychological safety in this relationship?",
        "How often does it feel like agreements between you are forgotten or unrealistic in practice?",
        "How often do you worry that in difficult moments you cannot stand on the same side of the problem?",
        "How often do you feel trust requires constant effort instead of being a calm foundation?",
      ],
    },
  ];

  /** Spłaszczenie pytań do listy z metadanymi (indeks globalny, sekcja) */
  function buildQuestionList() {
    const list = [];
    TEST_SECTIONS.forEach((section) => {
      section.questions.forEach((text) => {
        list.push({ sectionId: section.id, sectionTitle: section.title, text });
      });
    });
    return list;
  }

  const ALL_QUESTIONS = buildQuestionList();

  /**
   * Normalizacja sumy punktów (20–100) do skali 0–100.
   * @param {number} sum — suma odpowiedzi 1–5 dla 20 pytań
   */
  function normalizeScore(sum) {
    const min = 20;
    const max = 100;
    const raw = (sum - min) / (max - min);
    return Math.max(0, Math.min(100, Math.round(raw * 100)));
  }

  /**
   * Interpretacja zakresów wyniku:
   * 0–40 stabilna relacja, 41–70 napięcia, 71–100 wysoka niepewność
   */
  function getBand(score) {
    if (score <= 40) return "stabilna";
    if (score <= 70) return "napiecia";
    return "niepewnosc";
  }

  const RESULT_COPY = {
    stabilna: {
      headline: "Your relationship looks stable",
      label: "Stable trust signals",
      lead:
        "Your answers suggest more stability in the relationship right now. This is a snapshot of your recent experience, not a final verdict.",
      interpretation: [
        "There may be enough consistency and communication to keep uncertainty lower. Small misunderstandings can still happen, but they may feel more manageable.",
        "This score can also shift with stress, workload, or life pressure. Treat it as a structured check-in rather than a fixed identity of your relationship.",
      ],
      tips: [
        "Keep short, regular moments of connection, even on busy days.",
        "When tension appears, schedule a return to the topic instead of avoiding it.",
        "Name one thing that is working well and keep repeating it.",
      ],
    },
    napiecia: {
      headline: "Something may be shifting",
      label: "Mixed trust signals",
      lead:
        "Your result shows more friction or uncertainty than a fully stable range. This often means the relationship needs clearer structure and calmer communication.",
      interpretation: [
        "Shifts in communication rhythm, emotional availability, or daily behavior can increase uncertainty. It does not automatically mean a major crisis.",
        "What helps most is reducing noise: one topic at a time, one clear request, and one agreed follow-up.",
      ],
      tips: [
        "Use short structured conversations instead of long emotional debates.",
        "Track patterns in behavior and communication for one week before big conclusions.",
        "Focus on practical agreements that are observable in daily life.",
      ],
    },
    niepewnosc: {
      headline: "Your level of uncertainty is high",
      label: "High uncertainty signals",
      lead:
        "Your responses indicate elevated uncertainty and emotional load. This suggests a stronger need for clarity, boundaries, and emotional safety.",
      interpretation: [
        "High uncertainty can emerge when difficult topics stay unresolved and trust signals feel inconsistent over time.",
        "Before major decisions, it helps to stabilize your routine, gather facts, and seek grounded support if stress remains high.",
      ],
      tips: [
        "Separate facts from assumptions in writing to reduce mental overload.",
        "Ask for one concrete change you can observe in the next 7 days.",
        "If stress stays intense, consider professional support for clarity and regulation.",
      ],
    },
  };

  /** Stałe zdanie pod wynikiem (nie zastępuje interpretacji) */
  const RESULT_SIGNAL_LINE =
    "This is not a diagnosis - just a structured view of your responses.";

  /** Raport pogłębiony: podsumowanie i profil (wg pasma wyniku) */
  const REPORT_SUMMARY = {
    stabilna: [
      "Your Trust Index is in a lower uncertainty range, which usually reflects more predictable communication and clearer emotional signals.",
      "This often means daily interactions contain fewer unresolved loops and more moments of practical alignment.",
      "It does not mean everything is perfect. It means current patterns may be easier to understand and regulate.",
      "If your lived experience feels different than the score, trust your experience and use the score as one data point.",
    ],
    napiecia: [
      "Your Trust Index is in a middle range, suggesting mixed patterns: some stability with repeated moments of uncertainty.",
      "This range often appears when communication is partially effective but difficult topics still cycle without full closure.",
      "The main risk here is relying on intuition alone and delaying concrete agreements.",
      "Progress usually comes from structure: one topic, one decision, one measurable next step.",
    ],
    niepewnosc: [
      "Your Trust Index is in a higher uncertainty range, which often reflects sustained emotional strain and reduced clarity in relationship signals.",
      "This can happen when communication repair is inconsistent and daily trust cues feel unstable.",
      "The score does not define the entire relationship. It highlights where uncertainty is currently concentrated for you.",
      "In this range, clearer boundaries and support systems can significantly improve decision quality.",
    ],
  };

  const REPORT_PROFILE = {
    stabilna: [
      "Communication level: generally consistent, with more room to return to topics calmly.",
      "Emotional level: relatively regulated, with fewer sharp spikes of tension.",
      "Trust level: mostly steady, supported by repeated everyday reliability.",
    ],
    napiecia: [
      "Communication level: partly effective, but some key topics remain unresolved.",
      "Emotional level: mixed, with periods of connection and periods of strain.",
      "Trust level: moderate, with both supportive and uncertain signals present.",
    ],
    niepewnosc: [
      "Communication level: low predictability, with reduced confidence in difficult conversations.",
      "Emotional level: elevated strain and lower emotional steadiness.",
      "Trust level: fragile, with repeated uncertainty in key relational signals.",
    ],
  };

  // --- Wspólne: rok w stopce ---
  function setYear() {
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });
  }

  // --- Wspólne: menu mobilne ---
  function initMobileNav() {
    const toggle = document.querySelector(".nav-toggle");
    const panel = document.getElementById("mobile-nav");
    if (!toggle || !panel) return;

    function syncAria() {
      toggle.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
    }

    function closeMenu() {
      panel.hidden = true;
      syncAria();
    }

    function openMenu() {
      panel.hidden = false;
      syncAria();
    }

    syncAria();

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (panel.hidden) openMenu();
      else closeMenu();
    });

    panel.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", closeMenu);
    });

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && !panel.hidden) closeMenu();
      },
      true
    );

    document.addEventListener("click", (e) => {
      if (panel.hidden) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (toggle.contains(t) || panel.contains(t)) return;
      closeMenu();
    });
  }

  // --- Wspólne: delikatne pojawianie sekcji przy scrollu ---
  function initReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const els = document.querySelectorAll(".reveal");
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { root: null, threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    els.forEach((el) => io.observe(el));
  }

  // --- Test: stan i renderowanie ---
  function initTest() {
    const root = document.getElementById("question-root");
    const form = document.getElementById("test-form");
    const progressBar = document.getElementById("progress-bar");
    const stepLabel = document.getElementById("test-step-label");
    const btnNext = document.getElementById("btn-next");
    const btnPrev = document.getElementById("btn-prev");

    if (!root || !form || !progressBar || !stepLabel || !btnNext || !btnPrev) return;

    /** @type {number[]} odpowiedzi 1–5 na indeks pytania */
    const answers = new Array(ALL_QUESTIONS.length).fill(null);
    let index = 0;

    function render() {
      const q = ALL_QUESTIONS[index];
      const total = ALL_QUESTIONS.length;
      const step = index + 1;

      progressBar.style.width = `${(step / total) * 100}%`;
      stepLabel.textContent = `Question ${step} of ${total}`;

      const selected = answers[index];
      root.innerHTML = `
        <p class="question-card__section">${escapeHtml(q.sectionTitle)}</p>
        <p class="question-card__text">${escapeHtml(q.text)}</p>
        <div class="scale-options" role="radiogroup" aria-label="Answer scale">
          ${[1, 2, 3, 4, 5]
            .map(
              (val) => `
            <div class="scale-option">
              <input type="radio" name="scale" id="s${val}" value="${val}" ${selected === val ? "checked" : ""} />
              <label for="s${val}">${val}</label>
            </div>
          `
            )
            .join("")}
        </div>
        <p class="scale-legend"><span>less true</span><span>more true</span></p>
      `;

      btnPrev.hidden = index === 0;
      btnNext.textContent = index === total - 1 ? "See result" : "Next";

      root.classList.remove("reveal", "is-visible");
      void root.offsetWidth;
      root.classList.add("reveal", "is-visible");

      root.querySelectorAll('input[name="scale"]').forEach((input) => {
        input.addEventListener("change", () => {
          answers[index] = parseInt(input.value, 10);
        });
      });
    }

    function goNext() {
      if (answers[index] == null) {
        flashInvalid();
        return;
      }
      if (index < ALL_QUESTIONS.length - 1) {
        index += 1;
        render();
      } else {
        submitTest();
      }
    }

    function goPrev() {
      if (index > 0) {
        index -= 1;
        render();
      }
    }

    function flashInvalid() {
      const card = document.querySelector(".question-card");
      if (!card) return;
      card.style.animation = "none";
      void card.offsetWidth;
      card.style.animation = "shake 0.4s ease";
    }

    function submitTest() {
      const sum = answers.reduce((a, b) => a + b, 0);
      const score = normalizeScore(sum);
      try {
        localStorage.setItem(STORAGE_KEY, String(score));
      } catch (e) {
        console.warn("localStorage unavailable", e);
      }
      const overlay = document.createElement("div");
      overlay.className = "test-loading-overlay is-active";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.setAttribute("aria-busy", "true");
      overlay.innerHTML =
        '<div class="test-loading-overlay__spinner" aria-hidden="true"></div><p class="test-loading-overlay__text">Calculating your result…</p>';
      document.body.appendChild(overlay);
      window.setTimeout(() => {
        window.location.href = "result.html";
      }, 480);
    }

    btnNext.addEventListener("click", goNext);
    btnPrev.addEventListener("click", goPrev);

    // Styl animacji „shake” wstrzyknięty jednorazowo
    if (!document.getElementById("shake-style")) {
      const s = document.createElement("style");
      s.id = "shake-style";
      s.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`;
      document.head.appendChild(s);
    }

    render();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --- Wynik: odczyt localStorage i wypełnienie DOM ---
  function initResult() {
    const headlineEl = document.getElementById("result-headline");
    const scoreEl = document.getElementById("result-score-display");
    const signalEl = document.getElementById("result-signal-line");
    const bandEl = document.getElementById("result-band");
    const leadEl = document.getElementById("result-lead");
    const interpEl = document.getElementById("result-interpretation");
    const tipsEl = document.getElementById("result-tips");
    if (!scoreEl || !bandEl || !leadEl || !interpEl || !tipsEl) return;

    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }

    if (raw === null || raw === "") {
      if (headlineEl) headlineEl.textContent = "We do not have your result yet";
      if (signalEl) {
        signalEl.textContent = "";
        signalEl.hidden = true;
      }
      scoreEl.textContent = "—";
      bandEl.textContent = "No result";
      leadEl.textContent = "Return to the scan to see your Trust Index and interpretation.";
      interpEl.innerHTML = "";
      tipsEl.innerHTML = "";
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.innerHTML = '<a class="btn btn--primary btn--accent" href="test.html">Go to scan</a>';
      interpEl.appendChild(empty);
      return;
    }

    const score = Math.max(0, Math.min(100, parseInt(raw, 10)));
    const band = getBand(score);
    const copy = RESULT_COPY[band];

    if (headlineEl) headlineEl.textContent = copy.headline;
    if (signalEl) {
      signalEl.textContent = RESULT_SIGNAL_LINE;
      signalEl.hidden = false;
    }
    scoreEl.textContent = `${score}/100`;
    bandEl.textContent = copy.label;
    leadEl.textContent = copy.lead;

    interpEl.innerHTML = copy.interpretation.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    tipsEl.innerHTML = copy.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
  }

  // --- Raport: wynik z testu + podsumowanie i profil dopasowane do pasma ---
  function initReport() {
    const scoreStrong = document.getElementById("report-score");
    const summaryEl = document.getElementById("report-summary-body");
    const profileEl = document.getElementById("report-profile-body");
    if (!scoreStrong || !summaryEl || !profileEl) return;

    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }

    const score = raw != null && raw !== "" ? Math.max(0, Math.min(100, parseInt(raw, 10))) : null;
    scoreStrong.textContent = score != null ? `${score}/100` : "complete the scan first";

    if (score == null) {
      summaryEl.innerHTML =
        "<p>Complete the scan first to generate a personalized summary in this section.</p>";
      profileEl.innerHTML = "";
      return;
    }

    const band = getBand(score);
    summaryEl.innerHTML = REPORT_SUMMARY[band].map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    profileEl.innerHTML = REPORT_PROFILE[band].map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  }

  // --- Bootstrap wg adresu strony ---
  function boot() {
    document.documentElement.classList.add("js");
    setYear();
    initMobileNav();
    initReveal();

    const path = (window.location.pathname || "").toLowerCase();
    /** Obsługa zarówno plików *.html, jak i katalogów /test/ na hostingu statycznym */
    const isTestPage =
      path.endsWith("/test.html") || path.endsWith("/test") || path.endsWith("/test/index.html");
    const isResultPage =
      path.endsWith("/result.html") || path.endsWith("/result") || path.endsWith("/result/index.html");
    const isReportPage =
      path.endsWith("/report.html") || path.endsWith("/report") || path.endsWith("/report/index.html");

    if (isTestPage) initTest();
    else if (isResultPage) initResult();
    else if (isReportPage) initReport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
