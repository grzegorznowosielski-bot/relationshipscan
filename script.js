/**
 * RelationshipScan — wspólny skrypt dla wszystkich stron
 * Odpowiada za: nawigację mobilną, animacje, test (pytania + wynik),
 * oraz zapis/odczyt localStorage.
 */

(function () {
  "use strict";

  // --- Local storage keys used in funnel ---
  const STORAGE_KEY = "wynik";
  const STORAGE_DETAILS_KEY = "wynik_details";
  const PAID_KEY = "paid";
  const LOCALE_KEY = "relationshipscan_locale";
  const TEST_SESSION_KEY = "relationshipscan_test_session_v1";
  const LOCALE_PATHS = {
    en: "/en/",
    de: "/de/",
    es: "/es/",
    pl: "/index.html",
    pt: "/pt/",
    in: "/in/",
  };

  /**
   * Test structure: 20 questions in 4 sections (5+5+5+5).
   * Scale 1-5: higher value = higher perceived tension/uncertainty.
   * Sum min 20, max 100 -> normalized to 0-100.
   */
  const TEST_SECTIONS_EN = [
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

  const TEST_SECTIONS_PL = [
    {
      id: "communication",
      title: "Komunikacja",
      questions: [
        "Jak często masz wrażenie, że ważne dla Ciebie tematy są odkładane lub omijane?",
        "Jak bardzo trudno jest Wam wrócić do niedokończonej rozmowy po napięciu?",
        "Jak często czujesz, że Twoje potrzeby w rozmowie są pomijane lub niedosłyszane?",
        "Jak często kończysz rozmowę z poczuciem niedopowiedzenia?",
        "Jak bardzo martwisz się o to, czy możecie spokojnie mówić o granicach i oczekiwaniach?",
      ],
    },
    {
      id: "behavior",
      title: "Zachowanie",
      questions: [
        "Jak bardzo zmienił się dla Ciebie rytm wspólnego czasu (w porównaniu do tego, co bywało wygodne)?",
        "Jak często odczuwasz brak przewidywalności w codziennych sprawach partnerskich?",
        "Jak często odczuwasz dystans w codziennych aktywnościach, które wcześniej budowały bliskość?",
        "Jak bardzo często masz poczucie, że gesty bliskości są mniej naturalne niż wcześniej?",
        "Jak bardzo czujesz niespójność między słowami partnera a codziennymi zachowaniami?",
      ],
    },
    {
      id: "emotions",
      title: "Emocje",
      questions: [
        "Jak często budzisz się lub kładziesz spać z napięciem związanym z relacją?",
        "Jak bardzo czujesz lęk przed wybraniem nieodpowiedniego momentu na trudną rozmowę?",
        "Jak bardzo często odczuwasz jednocześnie tęsknotę i niepewność?",
        "Jak często Twoje emocje wobec relacji wydają Ci się chaotyczne lub trudne do nazwania?",
        "Jak bardzo często odczuwasz zmęczenie emocjonalne związane z dynamiką związku?",
      ],
    },
    {
      id: "trust",
      title: "Zaufanie",
      questions: [
        "Jak często zastanawiasz się, czy jesteście naprawdę w zgodzie co do tego, co jest dla Was ważne?",
        "Jak często brakuje Ci poczucia psychologicznego bezpieczeństwa w tej relacji?",
        "Jak często odczuwasz, że ustalenia między Wami są zapominane lub nierealne w praktyce?",
        "Jak często obawiasz się, że w trudnym momencie trudno wam stanąć po jednej stronie problemu?",
        "Jak bardzo często czujesz, że zaufanie wymaga od Ciebie stałej uwagi zamiast być spokojną podstawą?",
      ],
    },
  ];

  const TEST_UI_COPY = {
    en: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Question ${step} of ${total}`,
      scaleMin: "less true",
      scaleMax: "more true",
      next: "Next",
      seeResult: "See result",
      back: "Back",
      backHome: "Back to home",
      loading: "Calculating your result…",
      disclaimer: "Answer based on recent weeks. There are no right or wrong answers.",
    },
    pl: {
      title: "Skan — RelationshipScan",
      stepLabel: (step, total) => `Pytanie ${step} z ${total}`,
      scaleMin: "mniej pasuje",
      scaleMax: "bardziej pasuje",
      next: "Dalej",
      seeResult: "Zobacz wynik",
      back: "Wstecz",
      backHome: "Powrót na stronę główną",
      loading: "Liczymy Twój wynik…",
      disclaimer: "Odpowiadaj na podstawie ostatnich tygodni. Nie ma dobrych ani złych odpowiedzi.",
    },
  };

  function getTestLocale() {
    const paramLang = new URLSearchParams(window.location.search).get("lang");
    if (paramLang && String(paramLang).toLowerCase() === "pl") return "pl";
    try {
      return localStorage.getItem(LOCALE_KEY) === "pl" ? "pl" : "en";
    } catch (e) {
      return "en";
    }
  }

  /** Flattens questions into one list with section metadata */
  function buildQuestionList(sections) {
    const list = [];
    sections.forEach((section) => {
      section.questions.forEach((text, idx) => {
        list.push({
          id: `${section.id}-${idx + 1}`,
          sectionId: section.id,
          sectionTitle: section.title,
          text,
        });
      });
    });
    return list;
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickRandomUnique(items, count) {
    const copy = items.slice();
    shuffleInPlace(copy);
    return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
  }

  function buildSessionQuestionSet(allQuestions, locale) {
    const byId = {};
    const bySection = {};

    allQuestions.forEach((q) => {
      byId[q.id] = q;
      if (!bySection[q.sectionId]) bySection[q.sectionId] = [];
      bySection[q.sectionId].push(q);
    });

    const sections = Object.keys(bySection);
    const selected = [];
    const selectedIdSet = new Set();

    sections.forEach((sectionId) => {
      const picks = pickRandomUnique(bySection[sectionId], 2);
      picks.forEach((q) => {
        if (!selectedIdSet.has(q.id)) {
          selected.push(q);
          selectedIdSet.add(q.id);
        }
      });
    });

    const remaining = allQuestions.filter((q) => !selectedIdSet.has(q.id));
    pickRandomUnique(remaining, 10 - selected.length).forEach((q) => {
      selected.push(q);
      selectedIdSet.add(q.id);
    });

    shuffleInPlace(selected);
    const questionIds = selected.map((q) => q.id);
    const payload = { locale, questionIds };
    try {
      sessionStorage.setItem(TEST_SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
      // Ignore storage issues.
    }
    return selected;
  }

  function getSessionQuestions(allQuestions, locale) {
    const byId = {};
    allQuestions.forEach((q) => {
      byId[q.id] = q;
    });
    try {
      const raw = sessionStorage.getItem(TEST_SESSION_KEY);
      if (!raw) return buildSessionQuestionSet(allQuestions, locale);
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.locale !== locale || !Array.isArray(parsed.questionIds)) {
        return buildSessionQuestionSet(allQuestions, locale);
      }
      const restored = parsed.questionIds.map((id) => byId[id]).filter(Boolean);
      if (restored.length !== 10) return buildSessionQuestionSet(allQuestions, locale);
      return restored;
    } catch (e) {
      return buildSessionQuestionSet(allQuestions, locale);
    }
  }

  /**
   * Normalizes summed answers to 0-100.
   * @param {number} sum
   * @param {number} questionCount
   */
  function normalizeScore(sum, questionCount) {
    const count = Math.max(1, questionCount || 20);
    const min = count;
    const max = count * 5;
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

  const AREA_CONFIG = {
    communication: { title: "Communication" },
    emotions: { title: "Emotional connection" },
    behavior: { title: "Behavioral changes" },
    trust: { title: "Trust signals" },
  };

  function toAreaScore(sum, count) {
    if (!count) return 50;
    const avg = sum / count;
    const normalized = ((avg - 1) / 4) * 100;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  }

  function getSeverity(score) {
    if (score <= 40) return "Low";
    if (score <= 70) return "Medium";
    return "High";
  }

  function getAreaInterpretation(areaKey, score) {
    const severity = getSeverity(score);
    const byArea = {
      communication: {
        Low: "Conversations likely stay clearer and easier to repair after tension.",
        Medium: "Communication may be mixed: some clarity, with repeated unresolved loops.",
        High: "Communication strain is elevated and may require more structure and boundaries.",
      },
      emotions: {
        Low: "Emotional connection appears more regulated and predictable across recent weeks.",
        Medium: "Connection may fluctuate between closeness and distance.",
        High: "Emotional distance may be higher, with increased fatigue or uncertainty.",
      },
      behavior: {
        Low: "Daily behavior likely feels more consistent with expectations and agreements.",
        Medium: "Some shifts in routines or availability may be creating uncertainty.",
        High: "Behavioral inconsistency may be a major source of stress right now.",
      },
      trust: {
        Low: "Trust signals look relatively stable in everyday interactions.",
        Medium: "Trust appears mixed, with both reassuring and uncertain signals.",
        High: "Trust currently needs active repair and more observable follow-through.",
      },
    };
    return byArea[areaKey][severity];
  }

  function buildReportDetails(score, band, questions, answers) {
    const sums = { communication: 0, emotions: 0, behavior: 0, trust: 0 };
    const counts = { communication: 0, emotions: 0, behavior: 0, trust: 0 };

    questions.forEach((q, idx) => {
      const value = answers[idx];
      if (value == null || typeof sums[q.sectionId] !== "number") return;
      sums[q.sectionId] += value;
      counts[q.sectionId] += 1;
    });

    const areas = {};
    Object.keys(AREA_CONFIG).forEach((key) => {
      areas[key] = toAreaScore(sums[key], counts[key]);
    });

    return {
      version: 1,
      score,
      band,
      questionCount: answers.length,
      areas,
      createdAt: new Date().toISOString(),
    };
  }

  function getFallbackReportDetails(score) {
    return {
      version: 1,
      score,
      band: getBand(score),
      questionCount: 10,
      areas: {
        communication: score,
        emotions: Math.max(0, Math.min(100, score - 3)),
        behavior: Math.max(0, Math.min(100, score + 2)),
        trust: Math.max(0, Math.min(100, score + 1)),
      },
    };
  }

  // --- Wspólne: rok w stopce ---
  function setYear() {
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = String(new Date().getFullYear());
    });
  }

  // --- Wspólne: przełącznik języka na landingach ---
  function initLangSwitcher() {
    const links = document.querySelectorAll(".lang-switch a[data-lang][href]");
    if (!links.length) return;

    links.forEach((a) => {
      a.addEventListener("click", () => {
        const lang = a.getAttribute("data-lang");
        if (!lang) return;
        try {
          localStorage.setItem(LOCALE_KEY, lang);
        } catch (e) {
          // Ignore storage issues (private mode, blocked storage).
        }
      });
    });
  }

  function persistPageLocale() {
    const pageLocale = document.body && document.body.getAttribute("data-locale");
    if (!pageLocale || !LOCALE_PATHS[pageLocale]) return;
    try {
      localStorage.setItem(LOCALE_KEY, pageLocale);
    } catch (e) {
      // Ignore storage issues.
    }
  }

  function mapCountryToLocale(countryCode) {
    const cc = String(countryCode || "").toUpperCase();
    if (["DE", "AT", "CH", "LI", "LU"].includes(cc)) return "de";
    if (
      [
        "ES",
        "MX",
        "AR",
        "CO",
        "CL",
        "PE",
        "VE",
        "EC",
        "GT",
        "CU",
        "BO",
        "DO",
        "HN",
        "PY",
        "SV",
        "NI",
        "CR",
        "PA",
        "UY",
        "PR",
        "GQ",
      ].includes(cc)
    ) {
      return "es";
    }
    if (["PT", "BR", "AO", "MZ", "CV", "GW", "ST", "TL"].includes(cc)) return "pt";
    if (cc === "IN") return "in";
    if (cc === "PL") return "pl";
    return "en";
  }

  function mapNavigatorToLocale() {
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (let i = 0; i < langs.length; i += 1) {
      const tag = String(langs[i] || "").toLowerCase();
      const parts = tag.split("-");
      const base = parts[0] || "";
      const region = (parts[1] || "").toUpperCase();
      if (base === "de") return "de";
      if (base === "es") return "es";
      if (base === "pl") return "pl";
      if (base === "pt") return "pt";
      if (region === "IN" && base === "en") return "in";
      if (base === "en") return "en";
    }
    return "en";
  }

  async function fetchCountryCode() {
    const resp = await fetch("https://ipwho.is/?fields=success,country_code", { cache: "no-store" });
    if (!resp.ok) throw new Error("geo lookup failed");
    const data = await resp.json();
    if (!data || !data.success || !data.country_code) throw new Error("geo country unavailable");
    return String(data.country_code).toUpperCase();
  }

  function redirectToLocale(locale) {
    const targetPath = LOCALE_PATHS[locale] || LOCALE_PATHS.en;
    const currentPath = window.location.pathname || "/";
    if (currentPath === targetPath) return;
    window.location.replace(`${targetPath}${window.location.search}${window.location.hash}`);
  }

  function isMainEntryPath(pathname) {
    return pathname === "/" || pathname === "/index.html";
  }

  async function initLocaleByLocation() {
    const path = (window.location.pathname || "").toLowerCase();
    if (!isMainEntryPath(path)) return;

    let savedLocale = null;
    try {
      savedLocale = localStorage.getItem(LOCALE_KEY);
    } catch (e) {
      savedLocale = null;
    }

    if (savedLocale && LOCALE_PATHS[savedLocale]) {
      if (savedLocale !== "pl") redirectToLocale(savedLocale);
      return;
    }

    let locale = "en";
    try {
      const countryCode = await fetchCountryCode();
      locale = mapCountryToLocale(countryCode);
    } catch (e) {
      locale = mapNavigatorToLocale();
    }

    if (locale !== "pl") redirectToLocale(locale);
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
    const disclaimerEl = document.getElementById("test-disclaimer");

    if (!root || !form || !progressBar || !stepLabel || !btnNext || !btnPrev) return;

    const locale = getTestLocale();
    const testSections = locale === "pl" ? TEST_SECTIONS_PL : TEST_SECTIONS_EN;
    const allQuestions = buildQuestionList(testSections);
    const sessionQuestions = getSessionQuestions(allQuestions, locale);
    const uiCopy = TEST_UI_COPY[locale];

    document.documentElement.lang = locale === "pl" ? "pl" : "en";
    document.title = uiCopy.title;
    if (disclaimerEl) disclaimerEl.textContent = uiCopy.disclaimer;

    /** @type {number[]} odpowiedzi 1–5 na indeks pytania */
    const answers = new Array(sessionQuestions.length).fill(null);
    let index = 0;

    function render() {
      const q = sessionQuestions[index];
      const total = sessionQuestions.length;
      const step = index + 1;

      progressBar.style.width = `${(step / total) * 100}%`;
      stepLabel.textContent = uiCopy.stepLabel(step, total);

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
        <p class="scale-legend"><span>${uiCopy.scaleMin}</span><span>${uiCopy.scaleMax}</span></p>
      `;

      btnPrev.hidden = false;
      btnPrev.textContent = index === 0 ? uiCopy.backHome : uiCopy.back;
      btnNext.textContent = index === total - 1 ? uiCopy.seeResult : uiCopy.next;

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
      if (index < sessionQuestions.length - 1) {
        index += 1;
        render();
      } else {
        submitTest();
      }
    }

    function goPrev() {
      if (index === 0) {
        window.location.href = "index.html";
        return;
      }
      index -= 1;
      render();
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
      const score = normalizeScore(sum, answers.length);
      const band = getBand(score);
      const details = buildReportDetails(score, band, sessionQuestions, answers);
      try {
        localStorage.setItem(STORAGE_KEY, String(score));
        localStorage.setItem(STORAGE_DETAILS_KEY, JSON.stringify(details));
      } catch (e) {
        console.warn("localStorage unavailable", e);
      }
      try {
        sessionStorage.removeItem(TEST_SESSION_KEY);
      } catch (e) {
        // Ignore storage issues.
      }
      const overlay = document.createElement("div");
      overlay.className = "test-loading-overlay is-active";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.setAttribute("aria-busy", "true");
      overlay.innerHTML =
        `<div class="test-loading-overlay__spinner" aria-hidden="true"></div><p class="test-loading-overlay__text">${uiCopy.loading}</p>`;
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

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
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
    let hasPaid = false;
    try {
      hasPaid = Boolean(localStorage.getItem(PAID_KEY));
    } catch (e) {
      hasPaid = false;
    }
    if (!hasPaid) {
      window.location.href = "result.html";
      return;
    }

    const scoreStrong = document.getElementById("report-score");
    const summaryEl = document.getElementById("report-summary-body");
    const profileEl = document.getElementById("report-profile-body");
    const communicationEl = document.getElementById("report-communication-body");
    const emotionalEl = document.getElementById("report-emotional-body");
    const behaviorEl = document.getElementById("report-behavior-body");
    const trustEl = document.getElementById("report-trust-body");
    const scenariosEl = document.getElementById("report-scenarios-body");
    const nextStepsEl = document.getElementById("report-next-steps-body");
    if (
      !scoreStrong ||
      !summaryEl ||
      !profileEl ||
      !communicationEl ||
      !emotionalEl ||
      !behaviorEl ||
      !trustEl ||
      !scenariosEl ||
      !nextStepsEl
    ) {
      return;
    }

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
      communicationEl.innerHTML = "";
      emotionalEl.innerHTML = "";
      behaviorEl.innerHTML = "";
      trustEl.innerHTML = "";
      scenariosEl.innerHTML = "";
      nextStepsEl.innerHTML = "";
      return;
    }

    const band = getBand(score);
    let details = null;
    try {
      const detailsRaw = localStorage.getItem(STORAGE_DETAILS_KEY);
      details = detailsRaw ? JSON.parse(detailsRaw) : null;
    } catch (e) {
      details = null;
    }
    if (!details || !details.areas) {
      details = getFallbackReportDetails(score);
    }

    summaryEl.innerHTML = REPORT_SUMMARY[band].map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    profileEl.innerHTML = REPORT_PROFILE[band].map((p) => `<p>${escapeHtml(p)}</p>`).join("");

    setText("report-score-band", RESULT_COPY[band].label);
    setText(
      "report-overview-summary",
      `Your current score suggests ${RESULT_COPY[band].label.toLowerCase()}. This reflects how relationship signals felt to you in this session.`
    );
    setText(
      "report-overview-note",
      `Based on ${details.questionCount || 10} randomized questions from the full RelationshipScan pool.`
    );

    const scorePosition = document.getElementById("report-score-position");
    if (scorePosition) scorePosition.style.left = `${score}%`;

    const areaToDomPrefix = {
      communication: "communication",
      emotions: "emotional",
      behavior: "behavior",
      trust: "trust",
    };

    Object.keys(areaToDomPrefix).forEach((areaKey) => {
      const scoreValue = Math.max(0, Math.min(100, Number(details.areas[areaKey] || 0)));
      const severity = getSeverity(scoreValue);
      const prefix = areaToDomPrefix[areaKey];

      setText(`report-area-${prefix}-score`, `${scoreValue}/100`);
      setText(`report-area-${prefix}-label`, severity);
      setText(`report-bar-label-${prefix}`, severity);
      setText(`report-area-${prefix}-text`, getAreaInterpretation(areaKey, scoreValue));

      const bar = document.getElementById(`report-bar-${prefix}`);
      if (bar) bar.style.width = `${scoreValue}%`;
    });

    communicationEl.innerHTML = `<p>${escapeHtml(
      getAreaInterpretation("communication", details.areas.communication)
    )}</p><p>Use one-topic conversations, clear time windows, and one concrete follow-up to reduce ambiguity.</p>`;
    emotionalEl.innerHTML = `<p>${escapeHtml(
      getAreaInterpretation("emotions", details.areas.emotions)
    )}</p><p>Emotional steadiness usually improves when difficult topics happen at calmer moments and with shorter loops.</p>`;
    behaviorEl.innerHTML = `<p>${escapeHtml(
      getAreaInterpretation("behavior", details.areas.behavior)
    )}</p><p>Track visible patterns over 7-14 days to separate temporary stress from stable trends.</p>`;
    trustEl.innerHTML = `<p>${escapeHtml(
      getAreaInterpretation("trust", details.areas.trust)
    )}</p><p>Trust rebuilds through small repeated behaviors: reliability, transparency, and repair after tension.</p>`;

    scenariosEl.innerHTML = `
      <li><strong>Stabilization:</strong> clearer agreements and repeated follow-through lower uncertainty over time.</li>
      <li><strong>Mixed pattern:</strong> partial progress with recurring unresolved topics keeps stress in the middle range.</li>
      <li><strong>Escalation risk:</strong> unresolved loops and inconsistent signals increase emotional load and confusion.</li>
    `;
    nextStepsEl.innerHTML = `
      <li><strong>Pick one priority topic</strong> and define one measurable next step for this week.</li>
      <li><strong>Separate facts from assumptions</strong> in writing before making major decisions.</li>
      <li><strong>Review the pattern after 7 days</strong> and adjust boundaries or requests based on observable behavior.</li>
    `;
  }

  // --- Bootstrap wg adresu strony ---
  function boot() {
    document.documentElement.classList.add("js");
    initLocaleByLocation();
    persistPageLocale();
    setYear();
    initLangSwitcher();
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
