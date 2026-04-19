/**
 * RelationshipScan — wspólny skrypt dla wszystkich stron
 * Odpowiada za: nawigację mobilną, animacje, test (pytania + wynik),
 * zapis/odczyt localStorage, checkout/upsell.
 */

(function () {
  "use strict";

  // --- Stałe: klucz localStorage dla wyniku testu ---
  const STORAGE_KEY = "wynik";

  /** Po udanej płatności P24 (sessionStorage — zakładka) */
  const P24_PAID_KEY = "relationshipscan_p24_paid";

  /**
   * Struktura testu: 20 pytań w 4 sekcjach (5+5+5+5).
   * Skala 1–5: wyższa wartość = większe subiektywne napięcie / niepewność (wyższy wynik).
   * Suma min 20, max 100 → normalizacja do 0–100.
   */
  const TEST_SECTIONS = [
    {
      id: "komunikacja",
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
      id: "zachowanie",
      title: "Zachowanie",
      questions: [
        "Jak bardzo zmienił się dla Ciebie rytm wspólnego czasu (w porównaniu do tego, co bywało wygodne)?",
        "Jak często odczuwasz brak przewidywalności w codziennych sprawach partnerskich?",
        "Jak często odczuwasz dystans w codziennych aktywnościach, które wcześniej budowały bliskość?",
        "Jak bardzo często masz poczucie, że gesty bliskości są mniej naturalne niż wcześniej?",
        "Jak bardzo czujesz niespójność między słowami partnera/k a codziennymi zachowaniami?",
      ],
    },
    {
      id: "emocje",
      title: "Emocje",
      questions: [
        "Jak często budzisz się lub kładziesz spać z napięciem związanym z relacją?",
        "Jak bardzo czujesz lęk przed „nieodpowiednim” momentem na trudną rozmowę?",
        "Jak bardzo często odczuwasz jednocześnie tęsknotę i niepewność?",
        "Jak często Twoje emocje wobec relacji wydają Ci się chaotyczne lub trudne do nazwania?",
        "Jak bardzo często odczuwasz zmęczenie emocjonalne związane z dynamiką związku?",
      ],
    },
    {
      id: "zaufanie",
      title: "Zaufanie",
      questions: [
        "Jak często zastanawiasz się, czy jesteście naprawdę w zgodzie co do tego, co dla Was ważne?",
        "Jak często brakuje Ci poczucia psychologicznego bezpieczeństwa w tej relacji?",
        "Jak często odczuwasz, że ustalenia między Wami są zapomniane lub nierealne w praktyce?",
        "Jak często obawiasz się, że w trudnym momencie trudno wam stanąć po jednej stronie problemu?",
        "Jak bardzo często czujesz, że zaufanie wymaga od Ciebie stałej uwagi — zamiast być spokojną podstawą?",
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
      headline: "Twoja relacja wygląda stabilnie",
      label: "Stabilniejsza perspektywa relacji",
      lead:
        "Z Twojej perspektywy sygnały są spokojniejsze — przynajmniej w skali, którą mierzymy. To nie jest gwarancja „idealnie”, tylko obraz z ostatnich tygodni.",
      interpretation: [
        "Często tak jest, gdy macie miejsce na rozmowę albo gdy napięcia są krótkie i da się je domknąć. To też może być moment, kdy po prostu masz mniej „alarmów” w głowie — i to jest informacja, nie nagroda.",
        "Pamiętaj: wynik opiera się na ostatnich tygodniach — zmęczenie, stres czy choroba potrafią chwilowo zmienić odczucia bez „problemu w związku”.",
      ],
      tips: [
        "Utrzymujcie małe rytuały kontaktu — nawet krótkie sprawdzenie „jak minął dzień”.",
        "Gdy pojawi się drobna niezgoda, wróćcie do tematu w zaplanowanym terminie zamiast go odkładać w nieskończoność.",
        "Co jakiś czas nazwijcie wspólnie jedną rzecz, która Wam dobrze działa — wzmacnia to poczucie wspólnej sprawy.",
      ],
    },
    napiecia: {
      headline: "Coś zacznie się zmieniać",
      label: "Napięcia do uporządkowania",
      lead:
        "Widać wyraźniejsze tarcie albo zmęczenie — i częstsze kręcenie się w domysłach. To nie musi być „koniec”; to sygnał, że przyda się więcej klarowności.",
      interpretation: [
        "Napięcie często rośnie przy zmianie rytmu życia, rodzicielstwie, pracy, zdrowiu albo po serii niezamkniętych rozmów. Warto nie zamieniać go w pośpiechu w „koniec”, tylko potraktować jak informację: gdzie bolą granice i komunikacja.",
        "W praktyce pomaga jeden temat na raz — np. przewidywalność kontaktu albo sposób wracania po sporze.",
      ],
      tips: [
        "Umówcie się na krótką rozmowę (z limitem czasu), z zasadą: obserwacja i potrzeba zamiast oceny charakteru.",
        "Zadbaj o sen i ruch — regulacja układu nerwowego ułatwia spokojniejsze rozmowy.",
        "Rozważ wsparcie mediacyjne lub terapeutyczne, jeśli kręcicie się w kółko przy tych samych tematach.",
      ],
    },
    niepewnosc: {
      headline: "Twoje poczucie niepewności jest wysokie",
      label: "Wysoka niepewność w relacji",
      lead:
        "To zwykle duży koszt emocjonalny: wątpliwości, zmęczenie albo niestabilność. To nie jest dowód na konkretne zachowanie drugiej osoby — to informacja z Twojej strony, że potrzebujesz większego bezpieczeństwa i jasności.",
      interpretation: [
        "Taki wynik często idzie w parze ze stresem, nieporozumieniami albo długim odkładaniem trudnych tematów. Twoje ciało i głowa mogą mówić wprost: „potrzebuję przestrzeni, w której da się spokojnie porozmawiać”.",
        "Jeśli masz lęk, bezsenność lub poczucie zagrożenia — rozważ rozmowę ze specjalistą także przed dużymi decyzjami o związku.",
      ],
      tips: [
        "Ogranicz „testowanie” partnera/k — zamiast tego formułuj konkretne prośby o to, czego potrzebujesz w najbliższych dniach.",
        "Oddziel fakty od interpretacji: zapisz dwie obserwacje i dwie interpretacje — sprawdź, które są weryfikowalne.",
        "Jeśli czujesz się nieswojo lub zagrożenie — skorzystaj z lokalnych linii wsparcia lub konsultacji kryzysowej.",
      ],
    },
  };

  /** Stałe zdanie pod wynikiem (nie zastępuje interpretacji) */
  const RESULT_SIGNAL_LINE =
    "To nie jest diagnoza — ale sygnał, że warto przyjrzeć się sytuacji bliżej.";

  /** Raport pogłębiony: podsumowanie i profil (wg pasma wyniku) */
  const REPORT_SUMMARY = {
    stabilna: [
      "Twój wynik jest w niższym zakresie — w skali subiektywnego napięcia, którą mierzymy, wygląda to na spokojniejszą perspektywę.",
      "To zwykle oznacza, że łatwiej jest wracać do rozmów albo że napięcia są krótsze i da się je domykać — albo że masz mniej „alarmów” w głowie w ostatnich tygodniach.",
      "To nie jest potwierdzenie „wszystko idealnie” — raczej informacja, że z Twojej strony dynamika wygląda na mniej chaotyczną.",
      "Jeśli czujesz inaczej niż wynik sugeruje, zaufaj swojemu doświadczeniu: test opiera się na ostatnich tygodniach i Twojej skali odpowiedzi.",
    ],
    napiecia: [
      "Twój wynik jest w średnim zakresie — czyli widać realne napięcie albo zmęczenie, które warto nazwać, zanim urośnie domysłów.",
      "Często tak jest przy zmianach rytmu życia, rodzicielstwie, pracy albo po serii niezamkniętych rozmów. To nie musi oznaczać kryzysu — ale oznacza, że temat wymaga uwagi, nie odkładania w nieskończoność.",
      "Największe ryzyko w tym paśmie to spirala: krótkie domysły zamiast jednego konkretu i jednego małego kroku.",
      "Sens ma uporządkowanie: jeden temat, jeden termin rozmowy, jedna prośba — zamiast próby „naprawy wszystkiego naraz”.",
    ],
    niepewnosc: [
      "Twój wynik jest w wyższym zakresie — to zwykle silne obciążenie emocjonalne, częste wątpliwości albo poczucie niestabilności.",
      "Taki wynik często pojawia się przy długotrwałym stresie w relacji, skumulowanych nieporozumieniach albo braku poczucia bezpieczeństwa w codzienności.",
      "Nie jest to automatycznie informacja o konkretnym zachowaniu drugiej osoby — to mapa Twojego subiektywnego doświadczenia: gdzie bolą granice i jak bardzo kosztuje Cię ta dynamika.",
      "Jeśli pojawia się lęk, bezsenność albo poczucie zagrożenia — rozważ wsparcie specjalisty równolegle do decyzji o związku.",
    ],
  };

  const REPORT_PROFILE = {
    stabilna: [
      "Poziom napięcia: zwykle niższy lub krótkotrwały — masz więcej przestrzeni na codzienność bez ciągłego monitorowania relacji.",
      "Komunikacja: łatwiej utrzymać kontakt albo wracać do tematów bez poczucia, że każda rozmowa jest „albo teraz, albo nigdy”.",
      "Emocjonalna dostępność: częściej jest miejsce na bliskość albo na spokojne ustalenia — nawet jeśli macie trudniejsze okresy.",
    ],
    napiecia: [
      "Poziom napięcia: wyraźniejszy — czujesz tarcie, zmęczenie albo powtarzalne nieporozumienia, które nie znikają same z siebie.",
      "Komunikacja: tematy potrafią wracać w kółko albo ginąć w pośpiechu; rośnie poczucie niedopowiedzenia.",
      "Emocjonalna dostępność: bywa mniej miejsca na spokój — częściej jesteś „na baczności”, nawet w zwykłych sprawach.",
    ],
    niepewnosc: [
      "Poziom napięcia: wysoki — relacja może zajmować dużo uwagi emocjonalnej i być źródłem stałego niepokoju.",
      "Komunikacja: trudniej o poczucie bezpieczeństwa w rozmowie; łatwiej o eskalację albo ucieczkę w ciszę.",
      "Emocjonalna dostępność: często rośnie dystans, chaos emocji albo poczucie, że trudno o przewidywalność i domknięcia.",
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

  // --- Checkout: Przelewy24 (meta p24-api-base) lub przejście do testu bez opłaty ---
  function initCheckout() {
    const btn = document.getElementById("btn-pay");
    const emailEl = document.getElementById("checkout-email");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const api = document.querySelector('meta[name="p24-api-base"]')?.getAttribute("content")?.trim();
      const next = btn.getAttribute("data-next") || "test.html";
      if (!api) {
        window.location.href = next;
        return;
      }
      btn.disabled = true;
      try {
        const r = await fetch(`${api.replace(/\/$/, "")}/api/p24/init`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: (emailEl && emailEl.value) ? emailEl.value.trim() : "" }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || j.details || String(r.status));
        if (!j.redirectUrl) throw new Error("brak redirectUrl");
        window.location.href = j.redirectUrl;
      } catch (e) {
        alert(
          "Nie udało się uruchomić Przelewy24. Sprawdź adres bramki (meta p24-api-base), CORS i logi serwera.\n\n" +
            (e && e.message ? e.message : e)
        );
        btn.disabled = false;
      }
    });
  }

  /**
   * Gdy ustawiono p24-api-base: wymaga potwierdzenia płatności (polling ?sid= lub flaga sesji).
   */
  async function ensureP24AccessBeforeTest(stepLabel, btnNext, btnPrev) {
    const api = document.querySelector('meta[name="p24-api-base"]')?.getAttribute("content")?.trim();
    if (!api) return true;

    try {
      if (sessionStorage.getItem(P24_PAID_KEY) === "1") return true;
    } catch (e) {
      /* ignore */
    }

    const params = new URLSearchParams(window.location.search || "");
    const sid = params.get("sid");
    if (sid) {
      if (stepLabel) stepLabel.textContent = "Weryfikacja płatności…";
      if (btnNext) btnNext.disabled = true;
      if (btnPrev) btnPrev.disabled = true;
      for (let i = 0; i < 45; i++) {
        try {
          const r = await fetch(
            `${api.replace(/\/$/, "")}/api/p24/status?sessionId=${encodeURIComponent(sid)}`,
            { credentials: "omit" }
          );
          const j = await r.json().catch(() => ({}));
          if (j.paid) {
            try {
              sessionStorage.setItem(P24_PAID_KEY, "1");
            } catch (e2) {
              /* ignore */
            }
            history.replaceState({}, "", window.location.pathname);
            if (btnNext) btnNext.disabled = false;
            if (btnPrev) btnPrev.disabled = false;
            return true;
          }
        } catch (e) {
          /* kolejna próba */
        }
        await new Promise((res) => setTimeout(res, 1000));
      }
    }

    try {
      if (sessionStorage.getItem(P24_PAID_KEY) === "1") return true;
    } catch (e) {
      /* ignore */
    }

    return false;
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
      stepLabel.textContent = `Pytanie ${step} z ${total}`;

      const selected = answers[index];
      root.innerHTML = `
        <p class="question-card__section">${escapeHtml(q.sectionTitle)}</p>
        <p class="question-card__text">${escapeHtml(q.text)}</p>
        <div class="scale-options" role="radiogroup" aria-label="Skala odpowiedzi">
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
        <p class="scale-legend"><span>mniej pasuje</span><span>bardziej pasuje</span></p>
      `;

      btnPrev.hidden = index === 0;
      btnNext.textContent = index === total - 1 ? "Zobacz wynik" : "Dalej";

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
        console.warn("localStorage niedostępny", e);
      }
      const overlay = document.createElement("div");
      overlay.className = "test-loading-overlay is-active";
      overlay.setAttribute("role", "status");
      overlay.setAttribute("aria-live", "polite");
      overlay.setAttribute("aria-busy", "true");
      overlay.innerHTML =
        '<div class="test-loading-overlay__spinner" aria-hidden="true"></div><p class="test-loading-overlay__text">Liczenie wyniku…</p>';
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

    (async () => {
      const ok = await ensureP24AccessBeforeTest(stepLabel, btnNext, btnPrev);
      if (!ok) {
        progressBar.style.width = "0%";
        stepLabel.textContent = "Dostęp";
        root.innerHTML = `
          <div class="question-card paywall-card">
            <p class="question-card__section">Płatność</p>
            <p class="question-card__text">Żeby rozpocząć test, wykup dostęp (Przelewy24). Jeśli już opłaciłeś/aś, odśwież stronę za chwilę lub wróć z linku po płatności.</p>
            <p class="checkout-card__fake" style="margin-top:1rem"><a class="btn btn--primary" href="checkout.html">Przejdź do płatności</a></p>
          </div>`;
        btnNext.hidden = true;
        btnPrev.hidden = true;
        return;
      }
      render();
    })();
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
      if (headlineEl) headlineEl.textContent = "Nie mamy jeszcze Twojego wyniku";
      if (signalEl) {
        signalEl.textContent = "";
        signalEl.hidden = true;
      }
      scoreEl.textContent = "—";
      bandEl.textContent = "Brak wyniku";
      leadEl.textContent = "Wróć do testu — wtedy zobaczysz jasną interpretację i wskazówki.";
      interpEl.innerHTML = "";
      tipsEl.innerHTML = "";
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.innerHTML = '<a class="btn btn--primary" href="test.html">Przejdź do testu</a>';
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

  // --- Upsell: przycisk kupna → raport ---
  function initUpsellButton() {
    const btn = document.getElementById("btn-buy-report");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-next") || "report.html";
      window.location.href = next;
    });
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
    scoreStrong.textContent = score != null ? `${score}/100` : "wykonaj najpierw test";

    if (score == null) {
      summaryEl.innerHTML =
        "<p>Wykonaj test na stronie głównej — wtedy w tym miejscu pojawi się podsumowanie dopasowane do Twojego wyniku.</p>";
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
    initCheckout();
    initUpsellButton();

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
