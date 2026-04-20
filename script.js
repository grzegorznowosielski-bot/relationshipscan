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
  const STRIPE_LINK = "https://buy.stripe.com/test_14AdRbbpqeFJbJIffH1ck00";
  const LOCALE_PATHS = {
    en: "/index.html",
    de: "/de/",
    es: "/es/",
    pl: "/pl/",
    pt: "/pt/",
    in: "/in/",
  };
  const LANG_KEY = "lang";
  const LEGAL_PATHS = {
    en: { terms: "/en/terms.html", privacy: "/en/privacy.html", contact: "/contact.html" },
    pl: { terms: "/pl/regulamin.html", privacy: "/pl/polityka-prywatnosci.html", contact: "/contact.html" },
    de: { terms: "/de/agb.html", privacy: "/de/datenschutz.html", contact: "/contact.html" },
    es: { terms: "/es/terminos.html", privacy: "/es/privacidad.html", contact: "/contact.html" },
    pt: { terms: "/pt/termos.html", privacy: "/pt/privacidade.html", contact: "/contact.html" },
    in: { terms: "/in/terms.html", privacy: "/in/privacy.html", contact: "/contact.html" },
  };
  const LEGAL_FOOTER_COPY = {
    en: {
      lines: [
        "Outstanding Studios Ltd.",
        "Grzegorzecka 67c",
        "31-559 Krakow, Poland",
        "VAT ID: PL6762443271",
      ],
      contact: "Contact: help@relationshipscan.app",
      terms: "Terms",
      privacy: "Privacy",
      contactLink: "Contact",
      trust: "Secure payments powered by Stripe",
    },
    pl: {
      lines: [
        "Outstanding Studios sp. z o.o.",
        "ul. Grzegorzecka 67c",
        "31-559 Krakow, Polska",
        "NIP: 6762443271",
      ],
      contact: "Kontakt: help@relationshipscan.app",
      terms: "Regulamin",
      privacy: "Polityka prywatnosci",
      contactLink: "Kontakt",
      trust: "Bezpieczne platnosci obslugiwane przez Stripe",
    },
    de: {
      lines: [
        "Outstanding Studios GmbH",
        "Grzegorzecka 67c",
        "31-559 Krakau, Polen",
        "USt-IdNr.: PL6762443271",
      ],
      contact: "Kontakt: help@relationshipscan.app",
      terms: "AGB",
      privacy: "Datenschutz",
      contactLink: "Kontakt",
      trust: "Sichere Zahlungen mit Stripe",
    },
    es: {
      lines: [
        "Outstanding Studios Sp. z o.o.",
        "Grzegorzecka 67c",
        "31-559 Cracovia, Polonia",
        "NIF: PL6762443271",
      ],
      contact: "Contacto: help@relationshipscan.app",
      terms: "Terminos",
      privacy: "Privacidad",
      contactLink: "Contacto",
      trust: "Pagos seguros procesados por Stripe",
    },
    pt: {
      lines: [
        "Outstanding Studios Sp. z o.o.",
        "Grzegorzecka 67c",
        "31-559 Cracovia, Polonia",
        "NIF: PL6762443271",
      ],
      contact: "Contato: help@relationshipscan.app",
      terms: "Termos",
      privacy: "Privacidade",
      contactLink: "Contato",
      trust: "Pagamentos seguros processados pela Stripe",
    },
    in: {
      lines: [
        "Outstanding Studios",
        "Grzegorzecka 67c",
        "31-559 Krakow, Poland",
      ],
      contact: "Contact: help@relationshipscan.app",
      terms: "Terms",
      privacy: "Privacy",
      contactLink: "Contact",
      trust: "Secure payments powered by Stripe",
    },
  };

  const AREA_TITLES = {
    en: {
      communication: "Communication",
      emotional: "Emotional",
      behavior: "Behavior",
      trust: "Trust",
    },
    pl: {
      communication: "Komunikacja",
      emotional: "Emocje",
      behavior: "Zachowanie",
      trust: "Zaufanie",
    },
    de: {
      communication: "Kommunikation",
      emotional: "Emotionen",
      behavior: "Verhalten",
      trust: "Vertrauen",
    },
    es: {
      communication: "Comunicacion",
      emotional: "Emociones",
      behavior: "Comportamiento",
      trust: "Confianza",
    },
    pt: {
      communication: "Comunicacao",
      emotional: "Emocional",
      behavior: "Comportamento",
      trust: "Confianca",
    },
    in: {
      communication: "Communication",
      emotional: "Emotional",
      behavior: "Behavior",
      trust: "Trust",
    },
  };

  const QUESTION_POOL = [
    {
      id: 1,
      area: "communication",
      reverse: false,
      text: {
        en: "I can talk about difficult things with my partner without feeling tense.",
        pl: "Mogę rozmawiać z partnerem o trudnych sprawach bez napięcia.",
        de: "Ich fuehle mich wohl dabei, mit meinem Partner ueber schwierige Themen zu sprechen.",
        es: "Me siento comodo al hablar de temas dificiles con mi pareja.",
        pt: "Eu me sinto confortavel ao discutir temas dificeis com meu parceiro.",
        in: "I feel comfortable discussing difficult topics with my partner.",
      },
    },
    {
      id: 2,
      area: "behavior",
      reverse: true,
      text: {
        en: "Lately, my partner’s behavior feels less predictable than before.",
        pl: "Ostatnio zachowanie mojego partnera wydaje się mniej przewidywalne niż wcześniej.",
        de: "Das Verhalten meines Partners ist mit der Zeit weniger vorhersehbar geworden.",
        es: "El comportamiento de mi pareja se ha vuelto menos predecible con el tiempo.",
        pt: "O comportamento do meu parceiro ficou menos previsivel com o tempo.",
        in: "My partner's behavior has become less predictable over time.",
      },
    },
    {
      id: 3,
      area: "communication",
      reverse: false,
      text: {
        en: "We’re clear about what we expect from each other.",
        pl: "Mamy jasność co do tego, czego od siebie oczekujemy.",
        de: "Wir sprechen offen ueber unsere Erwartungen in der Beziehung.",
        es: "Hablamos abiertamente sobre nuestras expectativas en la relacion.",
        pt: "Falamos abertamente sobre nossas expectativas no relacionamento.",
        in: "We openly talk about our expectations in the relationship.",
      },
    },
    {
      id: 4,
      area: "emotional",
      reverse: true,
      text: {
        en: "Sometimes I feel a distance between us, even when we’re together.",
        pl: "Czasami czuję między nami dystans, nawet gdy jesteśmy razem.",
        de: "Ich fuehle mich manchmal emotional von meinem Partner distanziert.",
        es: "A veces me siento emocionalmente distante de mi pareja.",
        pt: "As vezes me sinto emocionalmente distante do meu parceiro.",
        in: "I sometimes feel emotionally distant from my partner.",
      },
    },
    {
      id: 5,
      area: "communication",
      reverse: false,
      text: {
        en: "When something feels off, we actually talk about it.",
        pl: "Gdy coś jest nie tak, potrafimy o tym naprawdę porozmawiać.",
        de: "Wenn sich etwas falsch anfuehlt, sprechen wir es direkt an.",
        es: "Cuando algo se siente mal, lo abordamos directamente.",
        pt: "Quando algo parece errado, nos lidamos com isso diretamente.",
        in: "When something feels wrong, we address it directly.",
      },
    },
    {
      id: 6,
      area: "behavior",
      reverse: true,
      text: {
        en: "I’ve noticed small changes in how my partner communicates.",
        pl: "Zauważam drobne zmiany w sposobie komunikacji mojego partnera.",
        de: "Ich bemerke Veraenderungen im Kommunikationsstil meines Partners.",
        es: "Noto cambios en el estilo de comunicacion de mi pareja.",
        pt: "Eu noto mudancas no estilo de comunicacao do meu parceiro.",
        in: "I notice changes in my partner's communication style.",
      },
    },
    {
      id: 7,
      area: "emotional",
      reverse: false,
      text: {
        en: "I feel confident about where this relationship is going.",
        pl: "Mam poczucie, że wiem, dokąd zmierza ta relacja.",
        de: "Ich fuehle mich sicher, wohin sich unsere Beziehung entwickelt.",
        es: "Me siento seguro sobre hacia donde va nuestra relacion.",
        pt: "Eu me sinto seguro sobre para onde nosso relacionamento esta indo.",
        in: "I feel secure about where our relationship is going.",
      },
    },
    {
      id: 8,
      area: "trust",
      reverse: true,
      text: {
        en: "There are topics my partner seems to avoid.",
        pl: "Są tematy, których mój partner unika.",
        de: "Mein Partner vermeidet bestimmte Themen oder Gespraeche.",
        es: "Mi pareja evita ciertos temas o conversaciones.",
        pt: "Meu parceiro evita certos assuntos ou conversas.",
        in: "My partner avoids certain topics or conversations.",
      },
    },
    {
      id: 9,
      area: "communication",
      reverse: false,
      text: {
        en: "We can disagree without things getting out of control.",
        pl: "Potrafimy się nie zgadzać bez eskalacji.",
        de: "Wir koennen Konflikte loesen, ohne dass sie eskalieren.",
        es: "Podemos resolver conflictos sin escalada.",
        pt: "Conseguimos resolver conflitos sem escalada.",
        in: "We are able to resolve conflicts without escalation.",
      },
    },
    {
      id: 10,
      area: "emotional",
      reverse: true,
      text: {
        en: "At times, I’m not sure how my partner really feels about me.",
        pl: "Bywają momenty, gdy nie jestem pewien/pewna, co partner naprawdę czuje.",
        de: "Ich bin unsicher, was mein Partner wirklich fuer mich empfindet.",
        es: "Me siento inseguro sobre lo que realmente siente mi pareja por mi.",
        pt: "Eu me sinto inseguro sobre o que meu parceiro realmente sente por mim.",
        in: "I feel unsure how my partner truly feels about me.",
      },
    },
    {
      id: 11,
      area: "behavior",
      reverse: false,
      text: {
        en: "What my partner says usually matches what they do.",
        pl: "To, co mówi partner, zwykle pokrywa się z tym, co robi.",
        de: "Die Handlungen meines Partners stimmen mit seinen Worten ueberein.",
        es: "Las acciones de mi pareja son consistentes con sus palabras.",
        pt: "As acoes do meu parceiro sao consistentes com suas palavras.",
        in: "My partner's actions are consistent with their words.",
      },
    },
    {
      id: 12,
      area: "trust",
      reverse: true,
      text: {
        en: "I sometimes question what’s really behind my partner’s actions.",
        pl: "Czasami zastanawiam się, co naprawdę stoi za jego/jej zachowaniem.",
        de: "Ich hinterfrage manchmal die Absichten meines Partners.",
        es: "A veces cuestiono las intenciones de mi pareja.",
        pt: "As vezes eu questiono as intencoes do meu parceiro.",
        in: "I sometimes question my partner's intentions.",
      },
    },
    {
      id: 13,
      area: "emotional",
      reverse: false,
      text: {
        en: "We still spend time together that actually feels meaningful.",
        pl: "Nadal spędzamy razem czas, który ma dla mnie znaczenie.",
        de: "Wir verbringen regelmaessig bedeutungsvolle Zeit miteinander.",
        es: "Pasamos tiempo de calidad juntos con regularidad.",
        pt: "Passamos tempo significativo juntos regularmente.",
        in: "We spend meaningful time together regularly.",
      },
    },
    {
      id: 14,
      area: "behavior",
      reverse: true,
      text: {
        en: "My partner gets defensive even in simple conversations.",
        pl: "Mój partner potrafi się bronić nawet przy prostych pytaniach.",
        de: "Mein Partner reagiert defensiv, wenn einfache Fragen gestellt werden.",
        es: "Mi pareja se pone a la defensiva cuando se le hacen preguntas simples.",
        pt: "Meu parceiro fica defensivo quando recebe perguntas simples.",
        in: "My partner becomes defensive when asked simple questions.",
      },
    },
    {
      id: 15,
      area: "emotional",
      reverse: false,
      text: {
        en: "I feel emotionally supported when it matters.",
        pl: "Czuję wsparcie emocjonalne wtedy, gdy jest potrzebne.",
        de: "Ich fuehle mich in dieser Beziehung emotional unterstuetzt.",
        es: "Me siento emocionalmente apoyado en esta relacion.",
        pt: "Eu me sinto emocionalmente apoiado neste relacionamento.",
        in: "I feel emotionally supported in this relationship.",
      },
    },
    {
      id: 16,
      area: "behavior",
      reverse: true,
      text: {
        en: "Some behaviors don’t fully make sense to me.",
        pl: "Niektóre zachowania partnera są dla mnie trudne do zrozumienia.",
        de: "Es gibt Verhaltensweisen, die ich schwer erklaeren kann.",
        es: "Hay comportamientos que me resulta dificil explicar.",
        pt: "Ha comportamentos que eu acho dificil explicar.",
        in: "There are behaviors that I find difficult to explain.",
      },
    },
    {
      id: 17,
      area: "trust",
      reverse: false,
      text: {
        en: "I trust what my partner tells me without overthinking it.",
        pl: "Ufam temu, co mówi partner, bez nadmiernego analizowania.",
        de: "Ich vertraue den Erklaerungen meines Partners ohne Zoegern.",
        es: "Confio en las explicaciones de mi pareja sin dudar.",
        pt: "Eu confio nas explicacoes do meu parceiro sem hesitar.",
        in: "I trust my partner's explanations without hesitation.",
      },
    },
    {
      id: 18,
      area: "trust",
      reverse: true,
      text: {
        en: "I feel like something in the dynamic has shifted.",
        pl: "Mam poczucie, że coś w tej relacji się zmieniło.",
        de: "Ich spuere eine Veraenderung darin, wie mein Partner mich behandelt.",
        es: "Siento un cambio en la forma en que mi pareja me trata.",
        pt: "Sinto uma mudanca na forma como meu parceiro me trata.",
        in: "I feel a shift in how my partner treats me.",
      },
    },
    {
      id: 19,
      area: "communication",
      reverse: false,
      text: {
        en: "We are clear about boundaries and respect them.",
        pl: "Mamy jasno określone granice i ich przestrzegamy.",
        de: "Wir kommunizieren klar ueber Grenzen.",
        es: "Nos comunicamos con claridad sobre los limites.",
        pt: "Nos comunicamos com clareza sobre limites.",
        in: "We communicate clearly about boundaries.",
      },
    },
    {
      id: 20,
      area: "trust",
      reverse: true,
      text: {
        en: "I feel more uncertainty in this relationship than before.",
        pl: "Czuję więcej niepewności niż wcześniej.",
        de: "Ich fuehle in dieser Beziehung eine wachsende Unsicherheit.",
        es: "Siento una creciente sensacion de incertidumbre en esta relacion.",
        pt: "Sinto uma crescente sensacao de incerteza neste relacionamento.",
        in: "I feel a growing sense of uncertainty in this relationship.",
      },
    },
  ];

  const TEST_UI_COPY = {
    en: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Question ${step} of ${total}`,
      scaleLabels: {
        1: "Strongly disagree",
        2: "Disagree",
        3: "Not sure",
        4: "Agree",
        5: "Strongly agree",
      },
      next: "Next",
      seeResult: "See result",
      back: "Back",
      backHome: "Back to home",
      loading: "Calculating your result…",
      disclaimer: "This takes about 2 minutes. Answer instinctively — don’t overthink.",
      progress1: "Quick check — you're almost done",
      progress2: "30 seconds left",
      micro: "There are no right or wrong answers.",
    },
    pl: {
      title: "Skan — RelationshipScan",
      stepLabel: (step, total) => `Pytanie ${step} z ${total}`,
      scaleLabels: {
        1: "Zdecydowanie nie",
        2: "Raczej nie",
        3: "Trudno powiedzieć",
        4: "Raczej tak",
        5: "Zdecydowanie tak",
      },
      next: "Dalej",
      seeResult: "Zobacz wynik",
      back: "Wstecz",
      backHome: "Powrót na stronę główną",
      loading: "Liczymy Twój wynik…",
      disclaimer: "To zajmie około 2 minut. Odpowiadaj intuicyjnie — bez analizowania.",
      progress1: "Jeszcze chwila — już prawie koniec",
      progress2: "Zostało około 30 sekund",
      micro: "Nie ma tu dobrych ani złych odpowiedzi.",
    },
    de: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Frage ${step} von ${total}`,
      scaleLabels: {
        1: "Stimme überhaupt nicht zu",
        2: "Stimme eher nicht zu",
        3: "Unsicher",
        4: "Stimme eher zu",
        5: "Stimme voll zu",
      },
      next: "Weiter",
      seeResult: "Ergebnis sehen",
      back: "Zurück",
      backHome: "Zur Startseite",
      loading: "Dein Ergebnis wird berechnet…",
      disclaimer: "Das dauert etwa 2 Minuten. Antworte intuitiv — nicht zu viel nachdenken.",
      progress1: "Kurzer Check — du bist fast fertig",
      progress2: "Noch etwa 30 Sekunden",
      micro: "Es gibt hier keine richtigen oder falschen Antworten.",
    },
    es: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Pregunta ${step} de ${total}`,
      scaleLabels: {
        1: "Totalmente en desacuerdo",
        2: "En desacuerdo",
        3: "No estoy seguro",
        4: "De acuerdo",
        5: "Totalmente de acuerdo",
      },
      next: "Siguiente",
      seeResult: "Ver resultado",
      back: "Atras",
      backHome: "Volver al inicio",
      loading: "Calculando tu resultado…",
      disclaimer: "Esto toma unos 2 minutos. Responde de forma intuitiva — sin pensarlo demasiado.",
      progress1: "Un momento — ya casi terminas",
      progress2: "Quedan unos 30 segundos",
      micro: "No hay respuestas correctas o incorrectas.",
    },
    pt: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Pergunta ${step} de ${total}`,
      scaleLabels: {
        1: "Discordo totalmente",
        2: "Discordo",
        3: "Não tenho certeza",
        4: "Concordo",
        5: "Concordo totalmente",
      },
      next: "Proximo",
      seeResult: "Ver resultado",
      back: "Voltar",
      backHome: "Voltar ao inicio",
      loading: "Calculando seu resultado…",
      disclaimer: "Isso leva cerca de 2 minutos. Responda de forma intuitiva — sem pensar demais.",
      progress1: "Só mais um pouco — já está quase",
      progress2: "Faltam cerca de 30 segundos",
      micro: "Não há respostas certas ou erradas.",
    },
    in: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Question ${step} of ${total}`,
      scaleLabels: {
        1: "Strongly disagree",
        2: "Disagree",
        3: "Not sure",
        4: "Agree",
        5: "Strongly agree",
      },
      next: "Next",
      seeResult: "See result",
      back: "Back",
      backHome: "Back to home",
      loading: "Calculating your result…",
      disclaimer: "This takes about 2 minutes. Answer instinctively — don’t overthink.",
      progress1: "Quick check — you're almost done",
      progress2: "30 seconds left",
      micro: "There are no right or wrong answers.",
    },
  };

  function getLocaleFromPath(pathname) {
    const path = String(pathname || "").toLowerCase();
    if (path === "/pl" || path.startsWith("/pl/")) return "pl";
    if (path === "/de" || path.startsWith("/de/")) return "de";
    if (path === "/es" || path.startsWith("/es/")) return "es";
    if (path === "/pt" || path.startsWith("/pt/")) return "pt";
    if (path === "/in" || path.startsWith("/in/")) return "in";
    if (path === "/en" || path.startsWith("/en/")) return "en";
    return "en";
  }

  function getCurrentLocale() {
    const paramLang = new URLSearchParams(window.location.search).get("lang");
    if (paramLang && LOCALE_PATHS[String(paramLang).toLowerCase()]) {
      return String(paramLang).toLowerCase();
    }
    const byPath = getLocaleFromPath(window.location.pathname || "/");
    if (byPath) return byPath;
    try {
      const saved = localStorage.getItem(LOCALE_KEY);
      if (saved && LOCALE_PATHS[saved]) return saved;
    } catch (e) {
      // Ignore storage issues.
    }
    return "en";
  }

  function normalizeLocale(locale) {
    const value = String(locale || "").toLowerCase();
    return LOCALE_PATHS[value] ? value : "en";
  }

  function setLang(locale) {
    const normalized = normalizeLocale(locale);
    try {
      localStorage.setItem(LANG_KEY, normalized);
    } catch (e) {
      // Ignore storage issues.
    }
    return normalized;
  }

  function getStoredLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && LOCALE_PATHS[saved]) return saved;
    } catch (e) {
      // Ignore storage issues.
    }
    return null;
  }

  function getFlowLocale() {
    const stored = getStoredLang();
    if (stored) return stored;
    const paramLang = new URLSearchParams(window.location.search).get("lang");
    if (paramLang && LOCALE_PATHS[String(paramLang).toLowerCase()]) {
      return setLang(paramLang);
    }
    return setLang(getLocaleFromPath(window.location.pathname || "/"));
  }

  function getTestLocale() {
    const paramLang = new URLSearchParams(window.location.search).get("lang");
    if (paramLang && LOCALE_PATHS[String(paramLang).toLowerCase()]) {
      return setLang(paramLang);
    }
    const stored = getStoredLang();
    if (stored) return setLang(stored);
    const byPath = getLocaleFromPath(window.location.pathname || "/");
    if (byPath && LOCALE_PATHS[byPath]) return setLang(byPath);
    return setLang(getFlowLocale());
  }

  function getFlowPageUrl(pageName, locale) {
    const normalizedLocale = normalizeLocale(locale);
    const path = String(window.location.pathname || "").toLowerCase();
    const localizedPrefix = `/${normalizedLocale}/`;
    if (path.startsWith(localizedPrefix)) {
      return `${localizedPrefix}${pageName}.html?lang=${encodeURIComponent(normalizedLocale)}`;
    }
    return `${pageName}.html?lang=${encodeURIComponent(normalizedLocale)}`;
  }

  function buildQuestionList(locale) {
    const lang = AREA_TITLES[locale] ? locale : "en";
    return QUESTION_POOL.map((question) => ({
      id: String(question.id),
      sectionId: question.area,
      sectionTitle: AREA_TITLES[lang][question.area],
      text: question.text[lang] || question.text.en,
      reverse: Boolean(question.reverse),
    }));
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

    const sections = ["communication", "emotional", "behavior", "trust"];
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
      localStorage.setItem(TEST_SESSION_KEY, JSON.stringify(payload));
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
      const raw = localStorage.getItem(TEST_SESSION_KEY);
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

  function normalizeAnswer(value, reverse) {
    const clamped = Math.max(1, Math.min(5, Number(value) || 1));
    return reverse ? 6 - clamped : clamped;
  }

  function getScoreLabel(score) {
    if (score <= 39) return "fragile";
    if (score <= 69) return "mixed";
    return "stable";
  }

  function getAreaSegment(score) {
    if (score <= 39) return "low";
    if (score <= 69) return "mid";
    return "high";
  }

  function getAreaSegmentLabel(locale, segment) {
    const labels = {
      en: { low: "Fragile", mid: "Mixed", high: "Stable" },
      pl: { low: "Kruche", mid: "Mieszane", high: "Stabilne" },
    };
    const lang = locale === "pl" ? "pl" : "en";
    return labels[lang][segment] || labels[lang].mid;
  }

  function calculateStructuredScores(questions, answers) {
    const areaBuckets = {
      communication: [],
      emotional: [],
      behavior: [],
      trust: [],
    };

    questions.forEach((question, idx) => {
      const value = answers[idx];
      if (value == null || !areaBuckets[question.sectionId]) return;
      areaBuckets[question.sectionId].push(normalizeAnswer(value, question.reverse));
    });

    const areaScores = {};
    Object.keys(areaBuckets).forEach((areaKey) => {
      const values = areaBuckets[areaKey];
      const avg = values.length
        ? values.reduce((sum, val) => sum + val, 0) / values.length
        : 3;
      areaScores[areaKey] = Math.max(0, Math.min(100, Math.round(((avg - 1) / 4) * 100)));
    });

    const scoreValues = Object.values(areaScores);
    const trustIndex = Math.round(scoreValues.reduce((sum, val) => sum + val, 0) / scoreValues.length);
    const sortedAreas = Object.entries(areaScores).sort((a, b) => a[1] - b[1]);

    return {
      trustIndex,
      areaScores,
      weakestArea: sortedAreas[0][0],
      strongestArea: sortedAreas[sortedAreas.length - 1][0],
    };
  }

  function getBand(score) {
    const label = getScoreLabel(score);
    if (label === "stable") return "stabilna";
    if (label === "mixed") return "napiecia";
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

  const RESULT_COPY_PL = {
    stabilna: {
      headline: "Twoja relacja wygląda stabilnie",
      label: "Stabilne sygnały zaufania",
      lead:
        "Twoje odpowiedzi sugerują większą stabilność w relacji na ten moment. To obraz aktualnej sytuacji, a nie ostateczny werdykt.",
      interpretation: [
        "Może być u Was wystarczająco dużo spójności i komunikacji, aby utrzymywać niższą niepewność.",
        "Wynik może się zmieniać wraz ze stresem i presją codzienności - traktuj go jako uporządkowany punkt odniesienia.",
      ],
      tips: [
        "Podtrzymuj krótkie, regularne momenty kontaktu nawet w napiętym tygodniu.",
        "Gdy pojawia się napięcie, umawiaj powrót do tematu zamiast go odkładać.",
        "Nazwij jedną rzecz, która działa, i świadomie ją powtarzaj.",
      ],
    },
    napiecia: {
      headline: "Coś zaczyna się zmieniać",
      label: "Mieszane sygnały zaufania",
      lead:
        "Wynik pokazuje więcej tarcia i niepewności niż zakres pełnej stabilności. To zwykle sygnał, że potrzebna jest większa klarowność i struktura.",
      interpretation: [
        "Zmiany w rytmie rozmów, dostępności emocjonalnej lub codziennych zachowaniach mogą podnosić poziom niepewności.",
        "Najbardziej pomaga redukcja chaosu: jeden temat naraz, jedna prośba i jeden konkretny follow-up.",
      ],
      tips: [
        "Stawiaj na krótkie rozmowy strukturalne zamiast długich debat emocjonalnych.",
        "Przez tydzień obserwuj wzorce zanim wyciągniesz duże wnioski.",
        "Skup się na uzgodnieniach, które da się zobaczyć w praktyce.",
      ],
    },
    niepewnosc: {
      headline: "Poziom Twojej niepewności jest wysoki",
      label: "Wysokie sygnały niepewności",
      lead:
        "Odpowiedzi wskazują na podwyższoną niepewność i obciążenie emocjonalne. To sygnał, że potrzebujesz więcej jasności, granic i poczucia bezpieczeństwa.",
      interpretation: [
        "Wysoka niepewność często pojawia się, gdy trudne tematy pozostają bez domknięcia, a sygnały zaufania są niespójne.",
        "Przed większymi decyzjami warto ustabilizować codzienny rytm, oddzielić fakty od domysłów i zadbać o wsparcie.",
      ],
      tips: [
        "Zapisz fakty osobno od interpretacji, aby zmniejszyć przeciążenie poznawcze.",
        "Poproś o jedną konkretną zmianę możliwą do zauważenia w ciągu 7 dni.",
        "Jeśli napięcie utrzymuje się wysoko, rozważ profesjonalne wsparcie.",
      ],
    },
  };

  const RESULT_COPY_DE = {
    stabilna: {
      headline: "Deine Beziehung wirkt stabil",
      label: "Stabile Vertrauenssignale",
      lead: "Deine Antworten deuten derzeit auf mehr Stabilität hin. Das ist ein aktueller Eindruck, kein endgültiges Urteil.",
      interpretation: [
        "Kommunikation und Alltagssignale wirken eher konsistent.",
        "Nutze das Ergebnis als strukturierte Orientierung und nicht als endgültige Definition.",
      ],
      tips: [
        "Halte regelmäßige kurze Klärungsmomente aufrecht.",
        "Kehre nach Spannung gezielt zum Thema zurück.",
        "Stärke, was bereits zuverlässig funktioniert.",
      ],
    },
    napiecia: {
      headline: "Etwas könnte sich verändern",
      label: "Gemischte Vertrauenssignale",
      lead: "Das Ergebnis zeigt eine gemischte Lage mit spürbarer Unsicherheit in einzelnen Bereichen.",
      interpretation: [
        "Teilweise klare, teilweise wiederkehrend offene Schleifen können die Lage unübersichtlich machen.",
        "Am stärksten hilft Struktur: ein Thema, ein Ziel, ein sichtbarer nächster Schritt.",
      ],
      tips: [
        "Fokussiere auf wiederkehrende Muster statt Einzelmomente.",
        "Trenne Fakten von Annahmen schriftlich.",
        "Vermeide große Entscheidungen im Emotionshöhepunkt.",
      ],
    },
    niepewnosc: {
      headline: "Dein Unsicherheitsniveau ist hoch",
      label: "Hohe Unsicherheitssignale",
      lead: "Deine Antworten deuten auf erhöhte Unsicherheit und emotionale Belastung hin.",
      interpretation: [
        "Unklare Reparatur nach Konflikten und inkonsistente Signale erhöhen den Druck.",
        "Mehr Klarheit entsteht durch Grenzen, Faktenprüfung und beobachtbare Vereinbarungen.",
      ],
      tips: [
        "Sammle konkrete Beobachtungen über 7 Tage.",
        "Bitte um eine klar sichtbare Verhaltensänderung.",
        "Treffe große Entscheidungen erst mit stabileren Daten.",
      ],
    },
  };

  const RESULT_COPY_ES = {
    stabilna: {
      headline: "Tu relación parece estable",
      label: "Señales de confianza estables",
      lead: "Tus respuestas sugieren mayor estabilidad en este momento. Es una foto actual, no un juicio definitivo.",
      interpretation: [
        "La comunicación y las señales cotidianas parecen más consistentes.",
        "Tómalo como una referencia estructurada, no como una etiqueta final.",
      ],
      tips: [
        "Mantén pequeños momentos de claridad de forma regular.",
        "Vuelve al tema después de la tensión para cerrarlo.",
        "Refuerza lo que ya funciona de manera estable.",
      ],
    },
    napiecia: {
      headline: "Algo podría estar cambiando",
      label: "Señales de confianza mixtas",
      lead: "El resultado muestra una dinámica mixta con incertidumbre visible en algunas áreas.",
      interpretation: [
        "La mezcla de avances y temas sin cierre puede aumentar la confusión.",
        "Ayuda más la estructura: un tema, un objetivo, un siguiente paso observable.",
      ],
      tips: [
        "Busca patrones repetidos, no momentos aislados.",
        "Separa hechos de suposiciones por escrito.",
        "Evita decisiones grandes en pico emocional.",
      ],
    },
    niepewnosc: {
      headline: "Tu nivel de incertidumbre es alto",
      label: "Señales de alta incertidumbre",
      lead: "Tus respuestas indican mayor carga emocional y menor claridad relacional.",
      interpretation: [
        "La falta de cierre y señales inconsistentes elevan el riesgo de interpretación.",
        "La claridad mejora con límites, verificación de hechos y acuerdos observables.",
      ],
      tips: [
        "Registra observaciones concretas durante 7 días.",
        "Solicita un cambio conductual claro y medible.",
        "Pospone decisiones grandes hasta tener señales más estables.",
      ],
    },
  };

  const RESULT_COPY_PT = {
    stabilna: {
      headline: "Sua relação parece estável",
      label: "Sinais de confiança estáveis",
      lead: "Suas respostas sugerem mais estabilidade neste momento. É um retrato atual, não um veredito final.",
      interpretation: [
        "Comunicação e sinais do dia a dia parecem mais consistentes.",
        "Use o resultado como referência estruturada, não como definição final.",
      ],
      tips: [
        "Mantenha momentos curtos e regulares de alinhamento.",
        "Retome assuntos após tensão para fechar o ciclo.",
        "Fortaleça o que já funciona com consistência.",
      ],
    },
    napiecia: {
      headline: "Algo pode estar mudando",
      label: "Sinais de confiança mistos",
      lead: "O resultado mostra uma dinâmica mista, com incerteza visível em alguns pontos.",
      interpretation: [
        "Avanços parciais e temas sem fechamento aumentam a ambiguidade.",
        "Estrutura ajuda mais: um tema, um objetivo, um próximo passo observável.",
      ],
      tips: [
        "Observe padrões repetidos, não momentos isolados.",
        "Separe fatos de suposições por escrito.",
        "Evite decisão grande em pico emocional.",
      ],
    },
    niepewnosc: {
      headline: "Seu nível de incerteza está alto",
      label: "Sinais de alta incerteza",
      lead: "Suas respostas indicam carga emocional elevada e menor clareza no vínculo.",
      interpretation: [
        "Falta de fechamento e sinais inconsistentes aumentam o risco de erro de leitura.",
        "A clareza melhora com limites, validação de fatos e acordos observáveis.",
      ],
      tips: [
        "Registre observações concretas por 7 dias.",
        "Peça uma mudança comportamental clara e mensurável.",
        "Adie decisões grandes até ter sinais mais estáveis.",
      ],
    },
  };

  const RESULT_SIGNAL_LINE_BY_LOCALE = {
    en: "This tool provides interpretative insights and is not psychological, medical or legal advice.",
    pl: "To narzędzie dostarcza interpretacyjnych wskazówek i nie stanowi porady psychologicznej, medycznej ani prawnej.",
    de: "Dieses Tool liefert interpretative Hinweise und ist keine psychologische, medizinische oder rechtliche Beratung.",
    es: "Esta herramienta ofrece perspectivas interpretativas y no constituye asesoramiento psicológico, médico ni legal.",
    pt: "Esta ferramenta fornece insights interpretativos e não constitui aconselhamento psicológico, médico ou jurídico.",
    in: "This tool provides interpretative insights and is not psychological, medical or legal advice.",
  };

  const RESULT_PAGE_UI = {
    en: {
      eyebrow: "Free result",
      title: "Your Trust Index",
      interpretationTitle: "Short interpretation",
      tipsTitle: "What this might mean",
      premiumEyebrow: "Premium section",
      premiumTitle: "See what you might be missing",
      premiumSubhead: "Understand the pattern before it repeats.",
      premiumIntroA:
        "Your answers already point in a certain direction - but without the full analysis, it is easy to misread what they actually mean.",
      premiumIntroB: "The full report helps you see:",
      premiumBullets: [
        "what may really be behind these changes",
        "which signals matter, and which may be misleading",
        "how your situation looks as a whole, not in fragments",
      ],
      premiumIncludesTitle: "In the full report you'll see:",
      premiumIncludes: [
        "detailed Trust Index breakdown",
        "visual score dashboard and area-by-area chart",
        "analysis of behavior and changes over time",
        "possible scenarios and what they may mean",
        "common points where people misread the situation",
        "practical guidance on what you can do next",
      ],
      premiumValueLabels: [
        "What is changing most?",
        "Where is decision risk?",
        "What to do first?",
      ],
      cta: "See what you might be missing",
      note1: "One-time payment. Secure checkout via Stripe. Instant access after payment.",
      note2: "Most people in your situation choose to see the full report.",
    },
    pl: {
      eyebrow: "Darmowy wynik",
      title: "Twój Trust Index",
      interpretationTitle: "Krótka interpretacja",
      tipsTitle: "Co to może oznaczać",
      premiumEyebrow: "Sekcja premium",
      premiumTitle: "Zobacz, co możesz przeoczyć",
      premiumSubhead: "Zrozum wzorzec, zanim znów się powtórzy.",
      premiumIntroA:
        "Twoje odpowiedzi pokazują już pewien kierunek - ale bez pełnej analizy łatwo błędnie ocenić, co to naprawdę oznacza.",
      premiumIntroB: "Pełny raport pomaga zobaczyć:",
      premiumBullets: [
        "co może naprawdę stać za tymi zmianami",
        "które sygnały są istotne, a które mogą być mylące",
        "jak wygląda sytuacja jako całość, a nie we fragmentach",
      ],
      premiumIncludesTitle: "W pełnym raporcie zobaczysz:",
      premiumIncludes: [
        "szczegółowy rozkład Trust Index",
        "panel wyników i wizualną analizę obszarów",
        "analizę zachowań i zmian w czasie",
        "możliwe scenariusze i ich znaczenie",
        "najczęstsze punkty błędnej interpretacji",
        "praktyczne wskazówki co robić dalej",
      ],
      premiumValueLabels: [
        "Co zmienia się najmocniej?",
        "Gdzie jest największe ryzyko decyzji?",
        "Od czego zacząć?",
      ],
      cta: "Zobacz, co możesz przeoczyć",
      note1: "Płatność jednorazowa. Bezpieczny checkout przez Stripe. Natychmiastowy dostęp po płatności.",
      note2: "Większość osób w podobnej sytuacji wybiera pełny raport.",
    },
  };

  const REPORT_UI = {
    en: {
      eyebrow: "Full Relationship Analysis",
      title: "Your premium report",
      subhead:
        "A structured, data-driven view of your current relationship dynamics. The goal is clarity: what looks stable, what needs attention, and what to do next.",
      indexLabel: "Your Trust Index:",
      scoreOverviewTitle: "Score overview",
      scaleLow: "Low uncertainty",
      scaleMid: "Medium",
      scaleHigh: "High uncertainty",
      roadmapTitle: "9. 14-day action roadmap",
      matrixTitle: "10. Priority matrix",
      matrixLabels: ["High impact / start now", "Medium impact / this week", "Track and review"],
      dayLabels: ["Days 1-3", "Days 4-7", "Days 8-14"],
      sectionTitles: {
        analysis: "4-area analysis",
        charts: "Visual analysis",
        summary: "1. Summary",
        profile: "2. Your Relationship Profile",
        communication: "3. Communication Patterns",
        emotional: "4. Emotional Distance",
        behavior: "5. Behavioral Changes",
        trust: "6. Trust Signals",
        scenarios: "7. Possible Scenarios",
        next: "8. What You Can Do Next",
      },
      disclaimer:
        "This tool provides interpretative insights and is not psychological, medical or legal advice.",
      backLink: "Back to result",
    },
    pl: {
      eyebrow: "Pełna analiza relacji",
      title: "Twój raport premium",
      subhead:
        "To uporządkowany, analityczny obraz obecnej dynamiki relacji. Celem jest większa jasność: co jest stabilne, co wymaga uwagi i jaki powinien być kolejny krok.",
      indexLabel: "Twój Trust Index:",
      scoreOverviewTitle: "Przegląd wyniku",
      scaleLow: "Niska niepewność",
      scaleMid: "Średnia",
      scaleHigh: "Wysoka niepewność",
      roadmapTitle: "9. Plan działań na 14 dni",
      matrixTitle: "10. Macierz priorytetów",
      matrixLabels: ["Wysoki wpływ / zacznij teraz", "Średni wpływ / ten tydzień", "Monitoruj i wróć"],
      dayLabels: ["Dni 1-3", "Dni 4-7", "Dni 8-14"],
      sectionTitles: {
        analysis: "Analiza 4 obszarów",
        charts: "Analiza wizualna",
        summary: "1. Podsumowanie",
        profile: "2. Profil relacji",
        communication: "3. Wzorce komunikacji",
        emotional: "4. Dystans emocjonalny",
        behavior: "5. Zmiany zachowań",
        trust: "6. Sygnały zaufania",
        scenarios: "7. Możliwe scenariusze",
        next: "8. Co możesz zrobić dalej",
      },
      disclaimer:
        "To narzedzie dostarcza interpretacyjnych wskazowek i nie stanowi porady psychologicznej, medycznej ani prawnej.",
      backLink: "Wróć do wyniku",
    },
  };

  const AREA_CONTENT = {
    en: {
      communication: {
        low: {
          title: "Communication appears strained",
          body:
            "Your responses suggest that difficult topics may not be addressed openly or clearly enough. This can increase misunderstanding and make small tensions grow over time.",
        },
        mid: {
          title: "Communication shows mixed signals",
          body:
            "Some parts of your communication may still be working well, but there are also moments where clarity or openness seems weaker. This often creates uncertainty rather than open conflict.",
        },
        high: {
          title: "Communication appears relatively stable",
          body:
            "Your answers suggest that communication is one of the stronger parts of the relationship. Even if tension appears, there seems to be a foundation for direct and constructive dialogue.",
        },
      },
      emotional: {
        low: {
          title: "Emotional distance may be increasing",
          body:
            "Your responses suggest that emotional closeness may feel weaker or less consistent right now. This can make the relationship feel less secure, even without a clear external reason.",
        },
        mid: {
          title: "Emotional connection feels uneven",
          body:
            "There may still be moments of closeness, but they do not always feel steady or predictable. This often creates mixed feelings - part reassurance, part uncertainty.",
        },
        high: {
          title: "Emotional connection looks strong",
          body:
            "Your answers suggest that emotional support and closeness are still present in a meaningful way. This does not remove every difficulty, but it creates an important sense of stability.",
        },
      },
      behavior: {
        low: {
          title: "Behavior feels difficult to read",
          body:
            "Your responses suggest that changes in behavior may be creating confusion or tension. When actions feel inconsistent, it becomes harder to interpret the relationship with confidence.",
        },
        mid: {
          title: "Behavior shows some inconsistency",
          body:
            "There may be some stable patterns, but also moments where behavior feels less predictable. This can create doubt even if not every signal is negative.",
        },
        high: {
          title: "Behavior appears consistent",
          body:
            "Your answers suggest that actions and patterns feel relatively steady. This usually supports a stronger sense of predictability and emotional clarity.",
        },
      },
      trust: {
        low: {
          title: "Trust feels fragile",
          body:
            "Your responses suggest that trust may currently be under pressure. This does not automatically mean a major problem, but it does suggest that uncertainty may be shaping how you read the relationship.",
        },
        mid: {
          title: "Trust feels mixed",
          body:
            "There may still be a basis for trust, but it does not feel fully settled. This often happens when reassurance exists, but doubt has not fully disappeared.",
        },
        high: {
          title: "Trust appears relatively stable",
          body:
            "Your answers suggest that trust remains one of the more stable foundations of the relationship. That creates resilience, even if other areas still need attention.",
        },
      },
    },
    pl: {
      communication: {
        low: {
          title: "Komunikacja wydaje się osłabiona",
          body:
            "Twoje odpowiedzi sugerują, że trudne tematy nie zawsze są omawiane wystarczająco otwarcie i jasno. To może zwiększać ryzyko nieporozumień i sprawiać, że drobne napięcia narastają.",
        },
        mid: {
          title: "Komunikacja jest niejednoznaczna",
          body:
            "Niektóre elementy komunikacji nadal mogą działać dobrze, ale są też momenty, w których brakuje jasności albo otwartości. Taki układ częściej buduje niepewność niż otwarty konflikt.",
        },
        high: {
          title: "Komunikacja wygląda względnie stabilnie",
          body:
            "Twoje odpowiedzi sugerują, że komunikacja należy do mocniejszych stron tej relacji. Nawet jeśli pojawia się napięcie, istnieje podstawa do bezpośredniej i konstruktywnej rozmowy.",
        },
      },
      emotional: {
        low: {
          title: "Emocjonalny dystans może się pogłębiać",
          body:
            "Twoje odpowiedzi sugerują, że poczucie bliskości emocjonalnej może być teraz słabsze albo mniej stabilne. To może osłabiać poczucie bezpieczeństwa, nawet jeśli nie ma jednej wyraźnej przyczyny.",
        },
        mid: {
          title: "Bliskość emocjonalna jest nierówna",
          body:
            "Bliskość może się pojawiać, ale nie zawsze w sposób stały i przewidywalny. Taki układ często daje mieszane odczucia - częściowe uspokojenie, ale też niepewność.",
        },
        high: {
          title: "Bliskość emocjonalna wygląda na mocną",
          body:
            "Twoje odpowiedzi sugerują, że wsparcie emocjonalne i poczucie bliskości są nadal wyraźnie obecne. To nie usuwa wszystkich trudności, ale daje ważny fundament stabilności.",
        },
      },
      behavior: {
        low: {
          title: "Zachowanie jest trudne do odczytania",
          body:
            "Twoje odpowiedzi sugerują, że zmiany w zachowaniu mogą budzić napięcie albo dezorientację. Gdy działania wydają się niespójne, trudniej interpretować relację z poczuciem pewności.",
        },
        mid: {
          title: "Zachowanie bywa niespójne",
          body:
            "W relacji mogą występować zarówno stabilne schematy, jak i momenty mniej przewidywalne. To może budzić wątpliwości, nawet jeśli nie każdy sygnał ma negatywny charakter.",
        },
        high: {
          title: "Zachowanie wygląda na spójne",
          body:
            "Twoje odpowiedzi sugerują, że działania i codzienne wzorce są względnie stabilne. To zwykle wzmacnia poczucie przewidywalności i emocjonalnej jasności.",
        },
      },
      trust: {
        low: {
          title: "Zaufanie wydaje się kruche",
          body:
            "Twoje odpowiedzi sugerują, że zaufanie może być obecnie pod presją. Nie oznacza to automatycznie poważnego problemu, ale pokazuje, że niepewność może wpływać na sposób, w jaki odczytujesz relację.",
        },
        mid: {
          title: "Zaufanie jest niejednoznaczne",
          body:
            "Podstawa zaufania może nadal istnieć, ale nie wydaje się w pełni stabilna. Taki stan często pojawia się wtedy, gdy obok uspokojenia nadal obecne są wątpliwości.",
        },
        high: {
          title: "Zaufanie wygląda na względnie stabilne",
          body:
            "Twoje odpowiedzi sugerują, że zaufanie pozostaje jednym z mocniejszych fundamentów tej relacji. To daje większą odporność, nawet jeśli inne obszary nadal wymagają uwagi.",
        },
      },
    },
  };

  function getAreaContent(locale, areaKey, segment) {
    const lang = locale === "pl" ? "pl" : "en";
    const langContent = AREA_CONTENT[lang] || AREA_CONTENT.en;
    return langContent[areaKey][segment];
  }

  const RESULT_LAYOUT_UI = {
    en: {
      eyebrow: "Your result",
      title: "Your Trust Index",
      visualTitle: "Visual score",
      scaleLow: "Low",
      scaleMid: "Medium",
      scaleHigh: "High",
      visualSub: "Structured view of your responses",
      freeHeading: "What this may suggest",
      tipsHeading: "Practical tips",
      premiumEyebrow: "Premium section",
      premiumTitle: "Your full result is ready",
      premiumSubhead: "You can already see the first signals. The full picture starts below.",
      premiumIntro:
        "Your answers already point in a certain direction - but without the full analysis, it is easy to misread what they actually mean.",
      lockedTitles: [
        "Communication patterns",
        "Emotional distance",
        "Behavioral changes",
        "Trust signals",
        "Possible scenarios",
        "What you can do next",
      ],
      lockedTeaser: "We found a recurring pattern worth looking at more closely.",
      lockedLabel: "Locked",
      previewLabels: ["Communication", "Stability", "Transparency", "Emotional safety"],
      previewOverlay: "Locked preview",
      ctaHeading: "Unlock full report",
      ctaBody:
        "At this stage, most people still rely on intuition. The full report helps you step back and see the situation more clearly.",
      priceLine: "One-time access - 39 zł",
      ctaButton: "Unlock full report",
      unlockedTitle: "Full insights unlocked",
      unlockedBody: "You now have access to the complete analysis. Continue to your premium report.",
      unlockedButton: "Go to full report",
      notes: [
        "Secure payment via Stripe",
        "Instant access after payment",
        "Most people in your situation choose to see the full report",
      ],
      disclaimer: "This tool provides interpretative insights and is not psychological, medical or legal advice.",
      freeTips: [
        "Look for repeated patterns, not single moments",
        "Separate facts from assumptions",
        "Avoid making a major decision in peak emotion",
      ],
    },
    pl: {
      eyebrow: "Twój wynik",
      title: "Twój Trust Index",
      visualTitle: "Wizualny obraz wyniku",
      scaleLow: "Niski",
      scaleMid: "Sredni",
      scaleHigh: "Wysoki",
      visualSub: "Uporzadkowany obraz Twoich odpowiedzi",
      freeHeading: "Co może z tego wynikać",
      tipsHeading: "Praktyczne wskazówki",
      premiumEyebrow: "Sekcja premium",
      premiumTitle: "Twój pełny wynik jest gotowy",
      premiumSubhead: "Widzisz już pierwsze sygnały. Pełny obraz zaczyna się dopiero poniżej.",
      premiumIntro:
        "Twoje odpowiedzi pokazują już pewien kierunek - ale bez pełnej analizy łatwo źle zinterpretować, co naprawdę znaczą.",
      lockedTitles: [
        "Wzorce komunikacji",
        "Dystans emocjonalny",
        "Zmiany w zachowaniu",
        "Sygnały zaufania",
        "Możliwe scenariusze",
        "Co możesz zrobić dalej",
      ],
      lockedTeaser: "Zidentyfikowaliśmy powtarzający się wzorzec, któremu warto przyjrzeć się bliżej.",
      lockedLabel: "Zablokowane",
      previewLabels: ["Komunikacja", "Stabilność", "Przejrzystość", "Bezpieczeństwo emocjonalne"],
      previewOverlay: "Podgląd zablokowany",
      ctaHeading: "Odblokuj pełny raport",
      ctaBody:
        "Na tym etapie większość osób nadal działa intuicyjnie. Pełny raport pomaga spojrzeć na sytuację z większym dystansem i większą jasnością.",
      priceLine: "Jednorazowy dostęp - 39 zł",
      ctaButton: "Odblokuj pełny raport",
      unlockedTitle: "Pelny wglad odblokowany",
      unlockedBody: "Masz teraz dostep do pelnej analizy. Przejdz do swojego raportu premium.",
      unlockedButton: "Przejdz do pelnego raportu",
      notes: [
        "Bezpieczna płatność przez Stripe",
        "Natychmiastowy dostęp po płatności",
        "Większość osób w podobnej sytuacji decyduje się zobaczyć pełny raport",
      ],
      disclaimer:
        "To narzędzie dostarcza interpretacyjnych wskazówek i nie stanowi porady psychologicznej, medycznej ani prawnej.",
      freeTips: [
        "Patrz na powtarzające się schematy, nie pojedyncze sytuacje",
        "Oddziel fakty od domysłów",
        "Nie podejmuj dużej decyzji w szczycie emocji",
      ],
    },
    de: {
      eyebrow: "Dein Ergebnis",
      title: "Dein Trust Index",
      visualTitle: "Visuelle Bewertung",
      scaleLow: "Niedrig",
      scaleMid: "Mittel",
      scaleHigh: "Hoch",
      visualSub: "Strukturierte Sicht auf deine Antworten",
      freeHeading: "Was das nahelegen kann",
      tipsHeading: "Praktische Hinweise",
      premiumEyebrow: "Premium-Bereich",
      premiumTitle: "Dein vollständiges Ergebnis ist bereit",
      premiumSubhead: "Du siehst bereits erste Signale. Das volle Bild beginnt erst unten.",
      premiumIntro:
        "Deine Antworten zeigen bereits eine Richtung - aber ohne vollständige Analyse ist eine Fehlinterpretation sehr leicht.",
      lockedTitles: [
        "Kommunikationsmuster",
        "Emotionale Distanz",
        "Verhaltensänderungen",
        "Vertrauenssignale",
        "Mögliche Szenarien",
        "Was du als Nächstes tun kannst",
      ],
      lockedTeaser: "Wir haben ein wiederkehrendes Muster erkannt, das genauer betrachtet werden sollte.",
      lockedLabel: "Gesperrt",
      previewLabels: ["Kommunikation", "Stabilität", "Transparenz", "Emotionale Sicherheit"],
      previewOverlay: "Gesperrte Vorschau",
      ctaHeading: "Vollständigen Bericht freischalten",
      ctaBody:
        "In dieser Phase handeln viele Menschen noch intuitiv. Der vollständige Bericht hilft dir, klarer und mit mehr Abstand zu sehen.",
      priceLine: "Einmaliger Zugang - 39 zł",
      ctaButton: "Vollständigen Bericht freischalten",
      unlockedTitle: "Voller Einblick freigeschaltet",
      unlockedBody: "Du hast jetzt Zugriff auf die vollständige Analyse. Weiter zu deinem Premium-Bericht.",
      unlockedButton: "Zum vollständigen Bericht",
      notes: [
        "Sichere Zahlung über Stripe",
        "Sofortiger Zugriff nach Zahlung",
        "Die meisten Menschen in deiner Situation wählen den vollständigen Bericht",
      ],
      disclaimer: "Dieses Tool liefert interpretative Hinweise und ist keine psychologische, medizinische oder rechtliche Beratung.",
      freeTips: [
        "Achte auf wiederkehrende Muster, nicht auf einzelne Momente",
        "Trenne Fakten von Annahmen",
        "Treffe keine große Entscheidung im Emotionshöhepunkt",
      ],
    },
    es: {
      eyebrow: "Tu resultado",
      title: "Tu Trust Index",
      visualTitle: "Puntuación visual",
      scaleLow: "Bajo",
      scaleMid: "Medio",
      scaleHigh: "Alto",
      visualSub: "Vista estructurada de tus respuestas",
      freeHeading: "Qué puede sugerir",
      tipsHeading: "Consejos prácticos",
      premiumEyebrow: "Sección premium",
      premiumTitle: "Tu resultado completo está listo",
      premiumSubhead: "Ya ves las primeras señales. El panorama completo empieza abajo.",
      premiumIntro:
        "Tus respuestas ya muestran una dirección, pero sin análisis completo es fácil interpretar mal lo que realmente significan.",
      lockedTitles: [
        "Patrones de comunicación",
        "Distancia emocional",
        "Cambios de comportamiento",
        "Señales de confianza",
        "Escenarios posibles",
        "Qué puedes hacer ahora",
      ],
      lockedTeaser: "Hemos identificado un patrón recurrente que vale la pena revisar de cerca.",
      lockedLabel: "Bloqueado",
      previewLabels: ["Comunicación", "Estabilidad", "Transparencia", "Seguridad emocional"],
      previewOverlay: "Vista previa bloqueada",
      ctaHeading: "Desbloquear informe completo",
      ctaBody:
        "En esta etapa, la mayoría de personas aún decide por intuición. El informe completo te ayuda a ver la situación con más claridad.",
      priceLine: "Acceso único - 39 zł",
      ctaButton: "Desbloquear informe completo",
      unlockedTitle: "Análisis completo desbloqueado",
      unlockedBody: "Ahora tienes acceso al análisis completo. Continúa a tu informe premium.",
      unlockedButton: "Ir al informe completo",
      notes: [
        "Pago seguro por Stripe",
        "Acceso inmediato después del pago",
        "La mayoría de personas en tu situación elige ver el informe completo",
      ],
      disclaimer: "Esta herramienta ofrece perspectivas interpretativas y no constituye asesoramiento psicológico, médico ni legal.",
      freeTips: [
        "Busca patrones repetidos, no momentos aislados",
        "Separa hechos de suposiciones",
        "Evita una decisión grande en el pico emocional",
      ],
    },
    pt: {
      eyebrow: "Seu resultado",
      title: "Seu Trust Index",
      visualTitle: "Pontuação visual",
      scaleLow: "Baixo",
      scaleMid: "Médio",
      scaleHigh: "Alto",
      visualSub: "Visão estruturada das suas respostas",
      freeHeading: "O que isso pode sugerir",
      tipsHeading: "Dicas práticas",
      premiumEyebrow: "Seção premium",
      premiumTitle: "Seu resultado completo está pronto",
      premiumSubhead: "Você já vê os primeiros sinais. O panorama completo começa abaixo.",
      premiumIntro:
        "Suas respostas já apontam uma direção, mas sem análise completa é fácil interpretar mal o que realmente significam.",
      lockedTitles: [
        "Padrões de comunicação",
        "Distância emocional",
        "Mudanças de comportamento",
        "Sinais de confiança",
        "Cenários possíveis",
        "O que você pode fazer a seguir",
      ],
      lockedTeaser: "Identificamos um padrão recorrente que merece uma análise mais próxima.",
      lockedLabel: "Bloqueado",
      previewLabels: ["Comunicação", "Estabilidade", "Transparência", "Segurança emocional"],
      previewOverlay: "Prévia bloqueada",
      ctaHeading: "Desbloquear relatório completo",
      ctaBody:
        "Nesta fase, a maioria das pessoas ainda age pela intuição. O relatório completo ajuda você a enxergar a situação com mais clareza.",
      priceLine: "Acesso único - 39 zł",
      ctaButton: "Desbloquear relatório completo",
      unlockedTitle: "Análise completa desbloqueada",
      unlockedBody: "Agora você tem acesso à análise completa. Continue para o seu relatório premium.",
      unlockedButton: "Ir para o relatório completo",
      notes: [
        "Pagamento seguro via Stripe",
        "Acesso imediato após o pagamento",
        "A maioria das pessoas na sua situação escolhe ver o relatório completo",
      ],
      disclaimer: "Esta ferramenta fornece insights interpretativos e não constitui aconselhamento psicológico, médico ou jurídico.",
      freeTips: [
        "Observe padrões repetidos, não momentos isolados",
        "Separe fatos de suposições",
        "Evite decisão grande no pico emocional",
      ],
    },
    in: {
      eyebrow: "Your result",
      title: "Your Trust Index",
      visualTitle: "Visual score",
      scaleLow: "Low",
      scaleMid: "Medium",
      scaleHigh: "High",
      visualSub: "Structured view of your responses",
      freeHeading: "What this may suggest",
      tipsHeading: "Practical tips",
      premiumEyebrow: "Premium section",
      premiumTitle: "Your full result is ready",
      premiumSubhead: "You can already see the first signals. The full picture starts below.",
      premiumIntro:
        "Your answers already point in a certain direction - but without the full analysis, it is easy to misread what they actually mean.",
      lockedTitles: [
        "Communication patterns",
        "Emotional distance",
        "Behavioral changes",
        "Trust signals",
        "Possible scenarios",
        "What you can do next",
      ],
      lockedTeaser: "We found a recurring pattern worth looking at more closely.",
      lockedLabel: "Locked",
      previewLabels: ["Communication", "Stability", "Transparency", "Emotional safety"],
      previewOverlay: "Locked preview",
      ctaHeading: "Unlock full report",
      ctaBody:
        "At this stage, most people still rely on intuition. The full report helps you step back and see the situation more clearly.",
      priceLine: "One-time access - 39 zł",
      ctaButton: "Unlock full report",
      unlockedTitle: "Full insights unlocked",
      unlockedBody: "You now have access to the complete analysis. Continue to your premium report.",
      unlockedButton: "Go to full report",
      notes: [
        "Secure payment via Stripe",
        "Instant access after payment",
        "Most people in your situation choose to see the full report",
      ],
      disclaimer: "This tool provides interpretative insights and is not psychological, medical or legal advice.",
      freeTips: [
        "Look for repeated patterns, not single moments",
        "Separate facts from assumptions",
        "Avoid making a major decision in peak emotion",
      ],
    },
  };

  function getResultLocale(locale) {
    return RESULT_PAGE_UI[locale] ? locale : "en";
  }

  function getResultCopyByLocale(locale, band) {
    if (locale === "pl") return RESULT_COPY_PL[band];
    if (locale === "de") return RESULT_COPY_DE[band];
    if (locale === "es") return RESULT_COPY_ES[band];
    if (locale === "pt") return RESULT_COPY_PT[band];
    if (locale === "in") return RESULT_COPY[band];
    return RESULT_COPY[band];
  }

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

  const REPORT_SUMMARY_PL = {
    stabilna: [
      "Twój Trust Index jest w niższym zakresie niepewności, co zwykle oznacza większą przewidywalność komunikacji i sygnałów emocjonalnych.",
      "To często wskazuje na mniej niedomkniętych pętli i więcej praktycznej spójności w codziennych interakcjach.",
      "Nie oznacza to, że wszystko jest idealne - raczej że obecne wzorce są łatwiejsze do regulacji i zrozumienia.",
    ],
    napiecia: [
      "Twój Trust Index jest w zakresie średnim, co sugeruje mieszany wzorzec: część stabilności i część powtarzalnej niepewności.",
      "Taki wynik często pojawia się, gdy część rozmów działa, ale trudniejsze tematy wracają bez pełnego domknięcia.",
      "Kluczowe ryzyko w tym paśmie to działanie wyłącznie intuicją bez konkretnych ustaleń.",
    ],
    niepewnosc: [
      "Twój Trust Index jest w wyższym zakresie niepewności, co zwykle odzwierciedla większe obciążenie emocjonalne i mniejszą klarowność sygnałów.",
      "Często dzieje się tak, gdy naprawa po napięciu jest nieregularna, a codzienne sygnały zaufania są niespójne.",
      "W tym paśmie najwięcej daje wzmocnienie granic, porządkowanie faktów i stabilizacja procesu decyzyjnego.",
    ],
  };

  const REPORT_PROFILE_PL = {
    stabilna: [
      "Poziom komunikacji: raczej spójny, z większą gotowością do spokojnego wracania do tematów.",
      "Poziom emocjonalny: relatywnie stabilny, z mniejszą liczbą gwałtownych skoków napięcia.",
      "Poziom zaufania: w większości stabilny, budowany przez codzienną przewidywalność.",
    ],
    napiecia: [
      "Poziom komunikacji: częściowo skuteczny, ale z tematami wracającymi bez pełnego domknięcia.",
      "Poziom emocjonalny: mieszany, z okresami kontaktu i okresami dystansu.",
      "Poziom zaufania: umiarkowany, z równoległymi sygnałami wspierającymi i niepewnymi.",
    ],
    niepewnosc: [
      "Poziom komunikacji: niższa przewidywalność i mniejsza pewność w trudnych rozmowach.",
      "Poziom emocjonalny: podwyższone obciążenie i mniejsza równowaga.",
      "Poziom zaufania: bardziej kruche, wymagające aktywnej odbudowy.",
    ],
  };

  const AREA_CONFIG = {
    communication: { title: "Communication" },
    emotional: { title: "Emotional connection" },
    behavior: { title: "Behavioral changes" },
    trust: { title: "Trust signals" },
  };

  function getSeverity(score) {
    if (score <= 40) return "Low";
    if (score <= 70) return "Medium";
    return "High";
  }

  function getSeverityLabel(score, locale) {
    const severity = getSeverity(score);
    const labels = {
      en: { Low: "Low", Medium: "Medium", High: "High" },
      pl: { Low: "Niski", Medium: "Sredni", High: "Wysoki" },
      de: { Low: "Niedrig", Medium: "Mittel", High: "Hoch" },
      es: { Low: "Bajo", Medium: "Medio", High: "Alto" },
      pt: { Low: "Baixo", Medium: "Medio", High: "Alto" },
      in: { Low: "Low", Medium: "Medium", High: "High" },
    };
    const map = labels[locale] || labels.en;
    return map[severity];
  }

  function getAreaInterpretation(areaKey, score) {
    const severity = getSeverity(100 - score);
    const byArea = {
      communication: {
        Low: "Conversations likely stay clearer and easier to repair after tension.",
        Medium: "Communication may be mixed: some clarity, with repeated unresolved loops.",
        High: "Communication strain is elevated and may require more structure and boundaries.",
      },
      emotional: {
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

  function getAreaInterpretationByLocale(areaKey, score, locale) {
    if (locale === "in" || locale === "en") return getAreaInterpretation(areaKey, score);
    const severity = getSeverity(100 - score);
    if (locale === "de") {
      const byAreaDe = {
        communication: {
          Low: "Gespräche wirken klarer und lassen sich nach Spannung eher schließen.",
          Medium: "Kommunikation ist gemischt: teils klar, teils mit offenen Schleifen.",
          High: "Kommunikativer Druck ist erhöht und braucht mehr Struktur.",
        },
        emotional: {
          Low: "Emotionale Verbindung wirkt stabiler und vorhersehbarer.",
          Medium: "Die Nähe schwankt zwischen Verbindung und Distanz.",
          High: "Emotionale Distanz und Erschöpfung sind erhöht.",
        },
        behavior: {
          Low: "Alltagsverhalten wirkt konsistenter mit Erwartungen und Absprachen.",
          Medium: "Verschiebungen im Alltag erhöhen teilweise Unsicherheit.",
          High: "Verhaltensinkonsistenz ist aktuell eine zentrale Stressquelle.",
        },
        trust: {
          Low: "Vertrauenssignale wirken im Alltag relativ stabil.",
          Medium: "Vertrauen ist gemischt mit stabilen und unsicheren Signalen.",
          High: "Vertrauen benötigt aktive Reparatur und klare Verbindlichkeit.",
        },
      };
      return byAreaDe[areaKey][severity];
    }
    if (locale === "es") {
      const byAreaEs = {
        communication: {
          Low: "Las conversaciones parecen más claras y reparables tras tensión.",
          Medium: "La comunicación es mixta: claridad parcial con bucles abiertos.",
          High: "La presión comunicativa es alta y requiere más estructura.",
        },
        emotional: {
          Low: "La conexión emocional parece más estable y predecible.",
          Medium: "La cercanía fluctúa entre conexión y distancia.",
          High: "La distancia emocional y el desgaste están elevados.",
        },
        behavior: {
          Low: "La conducta diaria parece más consistente con acuerdos.",
          Medium: "Algunos cambios de rutina aumentan la incertidumbre.",
          High: "La inconsistencia conductual es una fuente importante de estrés.",
        },
        trust: {
          Low: "Las señales de confianza se ven relativamente estables.",
          Medium: "La confianza aparece mixta con señales opuestas.",
          High: "La confianza requiere reparación activa y seguimiento visible.",
        },
      };
      return byAreaEs[areaKey][severity];
    }
    if (locale === "pt") {
      const byAreaPt = {
        communication: {
          Low: "Conversas parecem mais claras e reparáveis após tensão.",
          Medium: "Comunicação mista: parte clara, parte com ciclos em aberto.",
          High: "Pressão comunicativa elevada, exigindo mais estrutura.",
        },
        emotional: {
          Low: "Conexão emocional parece mais estável e previsível.",
          Medium: "A proximidade oscila entre conexão e distância.",
          High: "Distância emocional e desgaste estão elevados.",
        },
        behavior: {
          Low: "Comportamento diário parece mais consistente com acordos.",
          Medium: "Mudanças de rotina elevam parcialmente a incerteza.",
          High: "Inconsistência comportamental é fonte central de estresse.",
        },
        trust: {
          Low: "Sinais de confiança parecem relativamente estáveis no dia a dia.",
          Medium: "Confiança mista com sinais estáveis e incertos.",
          High: "Confiança exige reparo ativo e acompanhamento visível.",
        },
      };
      return byAreaPt[areaKey][severity];
    }
    const byArea = {
      communication: {
        Low: "Rozmowy najpewniej są bardziej klarowne i łatwiej wracać do tematów po napięciu.",
        Medium: "Komunikacja może być mieszana: część spraw jest jasna, część wraca bez domknięcia.",
        High: "Napięcie komunikacyjne jest podwyższone i wymaga większej struktury rozmów.",
      },
      emotional: {
        Low: "Poziom bliskości emocjonalnej wygląda na bardziej stabilny i przewidywalny.",
        Medium: "Bliskość może się wahać między kontaktem a dystansem.",
        High: "Dystans emocjonalny może być podwyższony, co zwiększa zmęczenie i niepewność.",
      },
      behavior: {
        Low: "Codzienne zachowania wydają się bardziej spójne z oczekiwaniami i ustaleniami.",
        Medium: "Część zmian w rytmie i dostępności może zwiększać niepewność.",
        High: "Niespójność zachowań może być teraz jednym z głównych źródeł stresu.",
      },
      trust: {
        Low: "Sygnały zaufania wyglądają relatywnie stabilnie w codziennych interakcjach.",
        Medium: "Sygnały zaufania są mieszane: część buduje pewność, część ją osłabia.",
        High: "Zaufanie wymaga aktywnej odbudowy i większej przewidywalności działań.",
      },
    };
    return byArea[areaKey][severity];
  }

  function buildReportDetails(score, band, questions, answers) {
    const scoreData = calculateStructuredScores(questions, answers);
    const areas = {
      communication: scoreData.areaScores.communication,
      emotional: scoreData.areaScores.emotional,
      behavior: scoreData.areaScores.behavior,
      trust: scoreData.areaScores.trust,
    };

    return {
      version: 1,
      score: scoreData.trustIndex,
      trustIndex: scoreData.trustIndex,
      scoreLabel: getScoreLabel(scoreData.trustIndex),
      band: getBand(scoreData.trustIndex),
      questionCount: answers.length,
      areas,
      areaScores: scoreData.areaScores,
      weakestArea: scoreData.weakestArea,
      strongestArea: scoreData.strongestArea,
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
        emotional: Math.max(0, Math.min(100, score - 3)),
        behavior: Math.max(0, Math.min(100, score + 2)),
        trust: Math.max(0, Math.min(100, score + 1)),
      },
      areaScores: {
        communication: score,
        emotional: Math.max(0, Math.min(100, score - 3)),
        behavior: Math.max(0, Math.min(100, score + 2)),
        trust: Math.max(0, Math.min(100, score + 1)),
      },
      weakestArea: "emotional",
      strongestArea: "behavior",
      scoreLabel: getScoreLabel(score),
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
          localStorage.setItem(LANG_KEY, lang);
        } catch (e) {
          // Ignore storage issues (private mode, blocked storage).
        }
      });
    });
  }

  function initLegalFooter() {
    const locale = getFlowLocale();
    const ui = LEGAL_FOOTER_COPY[locale] || LEGAL_FOOTER_COPY.en;
    const links = LEGAL_PATHS[locale] || LEGAL_PATHS.en;
    const body = document.body;
    const path = String(window.location.pathname || "").toLowerCase();
    const showFullCompanyDetails = Boolean(
      (body && body.classList.contains("page--landing")) ||
      path.endsWith("/contact.html") ||
      path.endsWith("/contact")
    );
    const footers = document.querySelectorAll(".site-footer");
    footers.forEach((footer) => {
      const inner = footer.querySelector(".site-footer__inner");
      if (!inner) return;

      let linksEl = inner.querySelector(".site-footer__links");
      if (!linksEl) {
        linksEl = document.createElement("p");
        linksEl.className = "site-footer__links";
        inner.appendChild(linksEl);
      }
      linksEl.innerHTML =
        `<a href="${links.terms}">${ui.terms}</a> · <a href="${links.privacy}">${ui.privacy}</a> · <a href="${links.contact}">${ui.contactLink}</a>`;

      let companyEl = inner.querySelector(".site-footer__company");
      if (showFullCompanyDetails) {
        if (!companyEl) {
          companyEl = document.createElement("p");
          companyEl.className = "site-footer__company";
          inner.appendChild(companyEl);
        }
        companyEl.innerHTML = `${ui.lines.map((line) => escapeHtml(line)).join("<br />")}<br />${escapeHtml(ui.contact)}`;
      } else if (companyEl) {
        companyEl.remove();
      }

      let trustEl = inner.querySelector(".site-footer__trust");
      if (showFullCompanyDetails) {
        if (!trustEl) {
          trustEl = document.createElement("p");
          trustEl.className = "site-footer__trust";
          inner.appendChild(trustEl);
        }
        trustEl.textContent = ui.trust;
      } else if (trustEl) {
        trustEl.remove();
      }
    });
  }

  function persistPageLocale() {
    const pageLocale = document.body && document.body.getAttribute("data-locale");
    if (!pageLocale || !LOCALE_PATHS[pageLocale]) return;
    try {
      localStorage.setItem(LOCALE_KEY, pageLocale);
      localStorage.setItem(LANG_KEY, pageLocale);
    } catch (e) {
      // Ignore storage issues.
    }
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
      if (savedLocale !== "en") redirectToLocale(savedLocale);
      return;
    }

    const locale = mapNavigatorToLocale();
    if (locale !== "en") redirectToLocale(locale);
  }

  function appendLangToStripeLinks() {
    const locale = getFlowLocale();
    const links = document.querySelectorAll(`a[href^="${STRIPE_LINK}"]`);
    links.forEach((a) => {
      try {
        const url = new URL(a.getAttribute("href"), window.location.origin);
        url.searchParams.set("lang", locale);
        a.setAttribute("href", url.toString());
      } catch (e) {
        // Ignore malformed URLs.
      }
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
    const disclaimerEl = document.getElementById("test-disclaimer");

    if (!root || !form || !progressBar || !stepLabel || !btnNext || !btnPrev) return;

    const locale = getTestLocale();
    const allQuestions = buildQuestionList(locale);
    const sessionQuestions = getSessionQuestions(allQuestions, locale);
    const uiCopy = TEST_UI_COPY[locale] || TEST_UI_COPY.en;

    document.documentElement.lang = locale;
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
      if (disclaimerEl) {
        disclaimerEl.textContent =
          step === 7
            ? uiCopy.progress1
            : step >= 8 && step <= 9
              ? uiCopy.progress2
              : uiCopy.disclaimer;
      }

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
        <ul class="scale-label-list" aria-hidden="true">
          ${[1, 2, 3, 4, 5]
            .map((val) => `<li><strong>${val}</strong> — ${escapeHtml(uiCopy.scaleLabels[val])}</li>`)
            .join("")}
        </ul>
        <p class="scale-micro">${escapeHtml(uiCopy.micro)}</p>
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
        const homePath = LOCALE_PATHS[locale] || LOCALE_PATHS.en;
        window.location.href = homePath;
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
      const scoreData = calculateStructuredScores(sessionQuestions, answers);
      const score = scoreData.trustIndex;
      const band = getBand(score);
      const details = buildReportDetails(score, band, sessionQuestions, answers);
      try {
        localStorage.setItem(STORAGE_KEY, String(score));
        localStorage.setItem(STORAGE_DETAILS_KEY, JSON.stringify(details));
      } catch (e) {
        console.warn("localStorage unavailable", e);
      }
      try {
        localStorage.removeItem(TEST_SESSION_KEY);
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
        setLang(locale);
        window.location.href = getFlowPageUrl("result", locale);
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

  function localizeResultPageUi(locale) {
    const lang = RESULT_LAYOUT_UI[locale] ? locale : "en";
    const ui = RESULT_LAYOUT_UI[lang];
    setText("result-eyebrow", ui.eyebrow);
    setText("result-title", ui.title);
    setText("result-visual-title", ui.visualTitle);
    setText("result-scale-low", ui.scaleLow);
    setText("result-scale-mid", ui.scaleMid);
    setText("result-scale-high", ui.scaleHigh);
    setText("result-visual-sub", ui.visualSub);
    setText("result-free-heading", ui.freeHeading);
    setText("result-tips-heading", ui.tipsHeading);
    setText("premium-eyebrow", ui.premiumEyebrow);
    setText("premium-title", ui.premiumTitle);
    setText("premium-subhead", ui.premiumSubhead);
    setText("premium-intro-a", ui.premiumIntro);
    setText("locked-title-1", ui.lockedTitles[0]);
    setText("locked-title-2", ui.lockedTitles[1]);
    setText("locked-title-3", ui.lockedTitles[2]);
    setText("locked-title-4", ui.lockedTitles[3]);
    setText("locked-title-5", ui.lockedTitles[4]);
    setText("locked-title-6", ui.lockedTitles[5]);
    setText("locked-teaser-1", ui.lockedTeaser);
    setText("locked-teaser-2", ui.lockedTeaser);
    setText("locked-teaser-3", ui.lockedTeaser);
    setText("locked-teaser-4", ui.lockedTeaser);
    setText("locked-teaser-5", ui.lockedTeaser);
    setText("locked-teaser-6", ui.lockedTeaser);
    setText("locked-label-1", ui.lockedLabel);
    setText("locked-label-2", ui.lockedLabel);
    setText("locked-label-3", ui.lockedLabel);
    setText("locked-label-4", ui.lockedLabel);
    setText("locked-label-5", ui.lockedLabel);
    setText("locked-label-6", ui.lockedLabel);
    setText("preview-bar-label-1", ui.previewLabels[0]);
    setText("preview-bar-label-2", ui.previewLabels[1]);
    setText("preview-bar-label-3", ui.previewLabels[2]);
    setText("preview-bar-label-4", ui.previewLabels[3]);
    setText("locked-preview-label", ui.previewOverlay);
    setText("premium-cta-heading", ui.ctaHeading);
    setText("premium-cta-body", ui.ctaBody);
    setText("premium-price-line", ui.priceLine);
    setText("premium-cta", ui.ctaButton);
    setText("premium-note-1", ui.notes[0]);
    setText("premium-note-2", ui.notes[1]);
    setText("premium-note-3", ui.notes[2]);
    setText("premium-unlocked-title", ui.unlockedTitle);
    setText("premium-unlocked-body", ui.unlockedBody);
    setText("go-report-link", ui.unlockedButton);
    setText("result-signal-line", ui.disclaimer);
  }

  function localizeReportPageUi(locale) {
    const uiMap = {
      en: {
        eyebrow: "Premium report",
        title: "Your full relationship analysis",
        subhead: "A structured premium view of your current relationship signals and decision risk.",
        overview: "Overview cards",
        charts: "Main charts",
        scale: ["Low uncertainty", "Medium", "High uncertainty"],
        areas: ["Communication", "Behavioral Consistency", "Trust Stability", "Emotional Connection"],
        sections: [
          "1. Summary",
          "2. Your Relationship Profile",
          "3. Communication",
          "4. Emotional Connection",
          "5. Behavioral Consistency",
          "6. Trust Stability",
          "7. Possible Scenarios",
          "8. What You Can Do Next",
        ],
        signal: ["Signal intensity", "High attention", "Monitor"],
        back: "Back to result",
      },
      pl: {
        eyebrow: "Raport premium",
        title: "Twoja pełna analiza relacji",
        subhead: "Uporządkowany widok premium sygnałów relacyjnych i ryzyka decyzyjnego.",
        overview: "Karty podsumowania",
        charts: "Główne wykresy",
        scale: ["Niska niepewność", "Średnia", "Wysoka niepewność"],
        areas: ["Komunikacja", "Spójność zachowań", "Stabilność zaufania", "Bliskość emocjonalna"],
        sections: [
          "1. Podsumowanie",
          "2. Profil Twojej relacji",
          "3. Komunikacja",
          "4. Bliskość emocjonalna",
          "5. Spójność zachowań",
          "6. Stabilność zaufania",
          "7. Możliwe scenariusze",
          "8. Co możesz zrobić dalej",
        ],
        signal: ["Intensywność sygnałów", "Wysoki priorytet", "Do obserwacji"],
        back: "Wróć do wyniku",
      },
      de: {
        eyebrow: "Premium-Bericht",
        title: "Deine vollständige Beziehungsanalyse",
        subhead: "Strukturierte Premium-Sicht auf Beziehungssignale und Entscheidungsrisiko.",
        overview: "Übersichtskarten",
        charts: "Hauptdiagramme",
        scale: ["Niedrige Unsicherheit", "Mittel", "Hohe Unsicherheit"],
        areas: ["Kommunikation", "Stabilität", "Transparenz", "Emotionale Sicherheit"],
        sections: [
          "1. Zusammenfassung",
          "2. Dein Beziehungsprofil",
          "3. Kommunikationsmuster",
          "4. Emotionale Distanz",
          "5. Verhaltensänderungen",
          "6. Vertrauenssignale",
          "7. Mögliche Szenarien",
          "8. Was du als Nächstes tun kannst",
        ],
        signal: ["Signalintensität", "Hohe Aufmerksamkeit", "Beobachten"],
        back: "Zurück zum Ergebnis",
      },
      es: {
        eyebrow: "Informe premium",
        title: "Tu análisis completo de la relación",
        subhead: "Vista premium estructurada de señales relacionales y riesgo de decisión.",
        overview: "Tarjetas de resumen",
        charts: "Gráficos principales",
        scale: ["Baja incertidumbre", "Media", "Alta incertidumbre"],
        areas: ["Comunicación", "Estabilidad", "Transparencia", "Seguridad emocional"],
        sections: [
          "1. Resumen",
          "2. Perfil de tu relación",
          "3. Patrones de comunicación",
          "4. Distancia emocional",
          "5. Cambios de comportamiento",
          "6. Señales de confianza",
          "7. Escenarios posibles",
          "8. Qué puedes hacer ahora",
        ],
        signal: ["Intensidad de señales", "Alta atención", "Monitorear"],
        back: "Volver al resultado",
      },
      pt: {
        eyebrow: "Relatório premium",
        title: "Sua análise completa de relacionamento",
        subhead: "Visão premium estruturada de sinais relacionais e risco de decisão.",
        overview: "Cartões de resumo",
        charts: "Gráficos principais",
        scale: ["Baixa incerteza", "Média", "Alta incerteza"],
        areas: ["Comunicação", "Estabilidade", "Transparência", "Segurança emocional"],
        sections: [
          "1. Resumo",
          "2. Perfil do relacionamento",
          "3. Padrões de comunicação",
          "4. Distância emocional",
          "5. Mudanças de comportamento",
          "6. Sinais de confiança",
          "7. Cenários possíveis",
          "8. O que você pode fazer agora",
        ],
        signal: ["Intensidade dos sinais", "Alta atenção", "Monitorar"],
        back: "Voltar ao resultado",
      },
      in: {
        eyebrow: "Premium report",
        title: "Your full relationship analysis",
        subhead: "A structured premium view of your current relationship signals and decision risk.",
        overview: "Overview cards",
        charts: "Main charts",
        scale: ["Low uncertainty", "Medium", "High uncertainty"],
        areas: ["Communication", "Stability", "Transparency", "Emotional safety"],
        sections: [
          "1. Summary",
          "2. Your Relationship Profile",
          "3. Communication Patterns",
          "4. Emotional Distance",
          "5. Behavioral Changes",
          "6. Trust Signals",
          "7. Possible Scenarios",
          "8. What You Can Do Next",
        ],
        signal: ["Signal intensity", "High attention", "Monitor"],
        back: "Back to result",
      },
    };
    const ui = uiMap[locale] || uiMap.en;
    setText("report-eyebrow", ui.eyebrow);
    setText("report-title", ui.title);
    setText("report-index-label", "Trust Index:");
    setText("report-subhead", ui.subhead);
    setText("report-overview-title", ui.overview);
    setText("report-score-overview-title", ui.charts);
    setText("report-scale-low", ui.scale[0]);
    setText("report-scale-mid", ui.scale[1]);
    setText("report-scale-high", ui.scale[2]);
    setText("report-area-title-communication", ui.areas[0]);
    setText("report-area-title-stability", ui.areas[1]);
    setText("report-area-title-transparency", ui.areas[2]);
    setText("report-area-title-safety", ui.areas[3]);
    setText("report-bar-title-communication", ui.areas[0]);
    setText("report-bar-title-stability", ui.areas[1]);
    setText("report-bar-title-transparency", ui.areas[2]);
    setText("report-bar-title-safety", ui.areas[3]);
    setText("report-summary-heading", ui.sections[0]);
    setText("report-profile-heading", ui.sections[1]);
    setText("report-comm-heading", ui.sections[2]);
    setText("report-emotion-heading", ui.sections[3]);
    setText("report-behavior-heading", ui.sections[4]);
    setText("report-trust-heading", ui.sections[5]);
    setText("report-scenarios-heading", ui.sections[6]);
    setText("report-next-heading", ui.sections[7]);
    setText("report-signals-heading", ui.signal[0]);
    setText("report-signal-label-1", ui.signal[1]);
    setText("report-signal-label-2", ui.signal[2]);
    setText("report-disclaimer-text", RESULT_SIGNAL_LINE_BY_LOCALE[locale] || RESULT_SIGNAL_LINE_BY_LOCALE.en);
    setText("report-back-link", ui.back);
  }

  // --- Wynik: odczyt localStorage i wypełnienie DOM ---
  function initResult() {
    const locale = getFlowLocale();
    const ui = RESULT_LAYOUT_UI[locale] || RESULT_LAYOUT_UI.en;
    const headlineEl = document.getElementById("result-headline");
    const scoreEl = document.getElementById("result-score-display");
    const leadEl = document.getElementById("result-lead");
    const interpEl = document.getElementById("result-interpretation");
    const insightsEl = document.getElementById("result-free-insights");
    const tipsEl = document.getElementById("result-tips");
    const donutEl = document.getElementById("result-donut");
    const donutValueEl = document.getElementById("result-donut-value");
    const rangeMarker = document.getElementById("result-range-marker");
    const ctaBlock = document.getElementById("upsell-block");
    const unlockedBlock = document.getElementById("premium-unlocked");
    const goReportLink = document.getElementById("go-report-link");
    if (!scoreEl || !headlineEl || !leadEl || !interpEl || !insightsEl || !tipsEl) return;

    document.documentElement.lang = locale;
    localizeResultPageUi(locale);

    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }
    if (raw === null || raw === "") {
      scoreEl.textContent = "—";
      headlineEl.textContent = locale === "pl" ? "Brak wyniku" : "No result yet";
      leadEl.textContent =
        locale === "pl"
          ? "Wroc do testu, aby zobaczyc swoj wynik."
          : "Return to the test to generate your Trust Index.";
      interpEl.innerHTML = "";
      insightsEl.innerHTML = "";
      tipsEl.innerHTML = "";
      return;
    }

    const score = Math.max(0, Math.min(100, parseInt(raw, 10)));
    const band = getBand(score);
    const copy = getResultCopyByLocale(locale, band);
    scoreEl.textContent = `${score}/100`;
    headlineEl.textContent = copy.headline;
    leadEl.textContent = copy.lead;
    interpEl.innerHTML = copy.interpretation.slice(0, 2).map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    insightsEl.innerHTML = copy.tips.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    tipsEl.innerHTML = ui.freeTips.map((item) => `<li>${escapeHtml(item)}</li>`).join("");

    if (donutValueEl) donutValueEl.textContent = String(score);
    if (donutEl) donutEl.style.setProperty("--result-percent", `${score}%`);
    if (rangeMarker) rangeMarker.style.left = `${score}%`;

    let hasPaid = false;
    try {
      hasPaid = Boolean(localStorage.getItem(PAID_KEY));
    } catch (e) {
      hasPaid = false;
    }
    if (hasPaid) {
      document.body.classList.add("has-paid");
      if (ctaBlock) ctaBlock.hidden = true;
      if (unlockedBlock) unlockedBlock.hidden = false;
      if (goReportLink) {
        const reportPath = getFlowPageUrl("report", locale);
        goReportLink.setAttribute("href", `${reportPath}&paid=true`);
      }
    } else {
      document.body.classList.remove("has-paid");
      if (ctaBlock) ctaBlock.hidden = false;
      if (unlockedBlock) unlockedBlock.hidden = true;
    }
  }

  // --- Raport: wynik z testu + podsumowanie i profil dopasowane do pasma ---
  function initReport() {
    const locale = getFlowLocale();
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "true") {
      try {
        localStorage.setItem(PAID_KEY, "true");
      } catch (e) {
        // Ignore storage issues.
      }
    }
    let hasPaid = false;
    try {
      hasPaid = Boolean(localStorage.getItem(PAID_KEY));
    } catch (e) {
      hasPaid = false;
    }
    if (!hasPaid) {
      window.location.href = getFlowPageUrl("result", locale);
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
    const donutEl = document.getElementById("report-donut");
    const donutValueEl = document.getElementById("report-donut-value");
    
    document.documentElement.lang = locale;
    localizeReportPageUi(locale);

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
    scoreStrong.textContent = score != null ? `${score}/100` : locale === "pl" ? "brak" : "n/a";
    if (score != null && donutEl) donutEl.style.setProperty("--result-percent", `${score}%`);
    if (score != null && donutValueEl) donutValueEl.textContent = String(score);

    if (score == null) {
      summaryEl.innerHTML =
        locale === "pl"
          ? "<p>Wykonaj test, aby wygenerować pełny raport premium.</p>"
          : "<p>Complete the test first to generate your premium report.</p>";
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

    const scorePosition = document.getElementById("report-score-position");
    if (scorePosition) scorePosition.style.left = `${score}%`;

    const areaScores = {
      communication: Math.max(0, Math.min(100, Number(details.areas.communication || score))),
      emotional: Math.max(0, Math.min(100, Number(details.areas.emotional || details.areas.emotions || score))),
      behavior: Math.max(0, Math.min(100, Number(details.areas.behavior || score))),
      trust: Math.max(0, Math.min(100, Number(details.areas.trust || score))),
    };

    const renderMap = [
      { domPrefix: "communication", areaKey: "communication" },
      { domPrefix: "safety", areaKey: "emotional" },
      { domPrefix: "stability", areaKey: "behavior" },
      { domPrefix: "transparency", areaKey: "trust" },
    ];

    renderMap.forEach((entry) => {
      const scoreValue = areaScores[entry.areaKey];
      const segment = getAreaSegment(scoreValue);
      const content = getAreaContent(locale, entry.areaKey, segment);
      const segmentLabel = getAreaSegmentLabel(locale, segment);

      setText(`report-area-${entry.domPrefix}-score`, `${scoreValue}/100`);
      setText(`report-area-${entry.domPrefix}-label`, segmentLabel);
      setText(`report-area-${entry.domPrefix}-insight`, content.title);
      setText(`report-area-${entry.domPrefix}-text`, content.body);
      setText(`report-bar-label-${entry.domPrefix}`, segmentLabel);

      const bar = document.getElementById(`report-bar-${entry.domPrefix}`);
      if (bar) bar.style.width = `${scoreValue}%`;
    });

    const contentByLocale = {
      en: {
        summary: `Your score indicates ${escapeHtml(RESULT_COPY[band].label.toLowerCase())} and highlights where decision risk is currently concentrated.`,
        summary2: "This report combines communication, emotional and behavior signals into one structured view.",
        profile1: "Your relationship profile shows the current balance between closeness, predictability and trust stability.",
        profile2: "The model focuses on recurring trends, not isolated moments.",
        comm2: "Critical point: what happens after tension, and whether key topics are actually closed.",
        emo2: "Higher emotional load can distort interpretation and increase reactivity.",
        beh2: "Repeated observable behaviors are more reliable than one-time declarations.",
        trust2: "Trust improves when words and actions stay aligned over time.",
        scenarios: [
          "<strong>Stabilization:</strong> clearer agreements and regular follow-through lower uncertainty.",
          "<strong>Mixed pattern:</strong> temporary progress alternates with recurring unresolved loops.",
          "<strong>Escalation risk:</strong> deeper distance and more inconsistent trust signals.",
        ],
        next: [
          "<strong>Choose one priority topic</strong> and define one measurable 7-day step.",
          "<strong>Separate facts from assumptions</strong> before major decisions.",
          "<strong>Review trend in one week</strong> and verify if signals become more consistent.",
        ],
        signal1: "Highest pressure currently appears in communication and predictability.",
        signal2: "Track whether difficult conversations produce stable follow-through.",
      },
      pl: {
        summary: `Wynik wskazuje na ${escapeHtml(RESULT_COPY_PL[band].label.toLowerCase())} i pokazuje, gdzie ryzyko decyzji jest najwyzsze.`,
        summary2: "Raport łączy sygnały komunikacyjne, emocjonalne i behawioralne w jeden uporządkowany obraz.",
        profile1: "Profil relacji wskazuje, jak obecnie wygląda balans między bliskością, stabilnością i przewidywalnością.",
        profile2: "To narzędzie pokazuje trendy, a nie pojedyncze zdarzenia.",
        comm2: "Krytyczne są momenty po napięciu: czy wracacie do tematu i domykacie rozmowę.",
        emo2: "Wysokie obciążenie emocjonalne utrudnia klarowną ocenę faktów i intencji.",
        beh2: "Najwięcej mówi powtarzalność codziennych zachowań, a nie jednorazowe deklaracje.",
        trust2: "Zaufanie rośnie, gdy słowa i działania pozostają spójne przez czas.",
        scenarios: [
          "<strong>Stabilizacja:</strong> jasne ustalenia i regularny follow-up zmniejszają niepewność.",
          "<strong>Wzorzec mieszany:</strong> okresy poprawy przeplatają się z powrotem do starych pętli.",
          "<strong>Ryzyko eskalacji:</strong> narastanie dystansu i niespójnych sygnałów.",
        ],
        next: [
          "<strong>Wybierz jeden temat priorytetowy</strong> i ustal jeden mierzalny krok na 7 dni.",
          "<strong>Oddziel fakty od domysłów</strong> przed podjęciem większej decyzji.",
          "<strong>Sprawdź trend po tygodniu</strong> i oceń, czy sygnały są bardziej spójne.",
        ],
        signal1: "Największe napięcie widoczne jest w obszarze komunikacji i przewidywalności.",
        signal2: "Obserwuj, czy po rozmowach pojawiają się konkretne, stabilne zmiany.",
      },
      de: {
        summary: `Dein Ergebnis zeigt ${escapeHtml(RESULT_COPY_DE[band].label.toLowerCase())} und markiert die Bereiche mit dem höchsten Entscheidungsrisiko.`,
        summary2: "Der Bericht verbindet Kommunikations-, Emotions- und Verhaltenssignale in einer strukturierten Übersicht.",
        profile1: "Das Profil zeigt das aktuelle Gleichgewicht zwischen Nähe, Stabilität und Vorhersehbarkeit.",
        profile2: "Fokus liegt auf wiederkehrenden Mustern, nicht auf Einzelfällen.",
        comm2: "Entscheidend ist, ob Themen nach Spannung sauber geschlossen werden.",
        emo2: "Hohe emotionale Last erhöht Reaktivität und erschwert klare Bewertung.",
        beh2: "Wiederholte beobachtbare Handlungen sind verlässlicher als einmalige Aussagen.",
        trust2: "Vertrauen steigt, wenn Worte und Handlungen über Zeit konsistent bleiben.",
        scenarios: [
          "<strong>Stabilisierung:</strong> klarere Absprachen und Follow-up senken Unsicherheit.",
          "<strong>Gemischtes Muster:</strong> Fortschritte wechseln sich mit offenen Schleifen ab.",
          "<strong>Eskalationsrisiko:</strong> mehr Distanz und inkonsistente Signale.",
        ],
        next: [
          "<strong>Wähle ein Prioritätsthema</strong> mit einem messbaren 7-Tage-Schritt.",
          "<strong>Trenne Fakten von Annahmen</strong> vor größeren Entscheidungen.",
          "<strong>Prüfe den Trend nach einer Woche</strong> anhand beobachtbarer Signale.",
        ],
        signal1: "Höchster Druck zeigt sich aktuell bei Kommunikation und Vorhersehbarkeit.",
        signal2: "Beobachte, ob Gespräche zu stabilen Folgehandlungen führen.",
      },
      es: {
        summary: `Tu resultado muestra ${escapeHtml(RESULT_COPY_ES[band].label.toLowerCase())} y señala dónde se concentra el mayor riesgo de decisión.`,
        summary2: "El informe integra señales de comunicación, emoción y conducta en una vista estructurada.",
        profile1: "El perfil refleja el equilibrio actual entre cercanía, estabilidad y previsibilidad.",
        profile2: "El enfoque está en patrones repetidos, no en casos aislados.",
        comm2: "Clave: si los temas difíciles se cierran después de la tensión.",
        emo2: "Mayor carga emocional aumenta reactividad y reduce claridad.",
        beh2: "Las conductas repetidas observables pesan más que declaraciones puntuales.",
        trust2: "La confianza mejora cuando palabras y acciones se mantienen alineadas.",
        scenarios: [
          "<strong>Estabilización:</strong> acuerdos claros y seguimiento constante reducen incertidumbre.",
          "<strong>Patrón mixto:</strong> avances parciales con bucles sin cierre.",
          "<strong>Riesgo de escalada:</strong> más distancia y señales inconsistentes.",
        ],
        next: [
          "<strong>Elige un tema prioritario</strong> y define un paso medible de 7 días.",
          "<strong>Separa hechos de suposiciones</strong> antes de decisiones grandes.",
          "<strong>Revisa el patrón en una semana</strong> con señales observables.",
        ],
        signal1: "La presión más alta aparece en comunicación y previsibilidad.",
        signal2: "Observa si las conversaciones generan cambios estables.",
      },
      pt: {
        summary: `Seu resultado indica ${escapeHtml(RESULT_COPY_PT[band].label.toLowerCase())} e aponta onde o risco de decisão está mais concentrado.`,
        summary2: "O relatório integra sinais de comunicação, emoção e comportamento em uma visão estruturada.",
        profile1: "O perfil mostra o equilíbrio atual entre proximidade, estabilidade e previsibilidade.",
        profile2: "O foco está em padrões recorrentes, não em eventos isolados.",
        comm2: "Ponto crítico: se temas difíceis são realmente fechados após tensão.",
        emo2: "Carga emocional alta aumenta reatividade e reduz clareza.",
        beh2: "Comportamentos repetidos observáveis são mais confiáveis que declarações pontuais.",
        trust2: "A confiança melhora quando palavras e ações ficam alinhadas no tempo.",
        scenarios: [
          "<strong>Estabilização:</strong> acordos claros e follow-up reduzem incerteza.",
          "<strong>Padrão misto:</strong> avanço parcial com ciclos sem fechamento.",
          "<strong>Risco de escalada:</strong> mais distância e sinais inconsistentes.",
        ],
        next: [
          "<strong>Escolha um tema prioritário</strong> com um passo mensurável de 7 dias.",
          "<strong>Separe fatos de suposições</strong> antes de decisões grandes.",
          "<strong>Revise o padrão em uma semana</strong> com sinais observáveis.",
        ],
        signal1: "A maior pressão aparece em comunicação e previsibilidade.",
        signal2: "Observe se conversas geram mudanças estáveis.",
      },
      in: null,
    };
    const content = contentByLocale[locale] || contentByLocale.en;
    const communicationSegment = getAreaSegment(areaScores.communication);
    const emotionalSegment = getAreaSegment(areaScores.emotional);
    const behaviorSegment = getAreaSegment(areaScores.behavior);
    const trustSegment = getAreaSegment(areaScores.trust);
    const communicationContent = getAreaContent(locale, "communication", communicationSegment);
    const emotionalContent = getAreaContent(locale, "emotional", emotionalSegment);
    const behaviorContent = getAreaContent(locale, "behavior", behaviorSegment);
    const trustContent = getAreaContent(locale, "trust", trustSegment);

    summaryEl.innerHTML = `<p>${content.summary}</p><p>${content.summary2}</p>`;
    profileEl.innerHTML = `<p>${content.profile1}</p><p>${content.profile2}</p>`;
    communicationEl.innerHTML = `<p><strong>${escapeHtml(communicationContent.title)}</strong></p><p>${escapeHtml(communicationContent.body)}</p>`;
    emotionalEl.innerHTML = `<p><strong>${escapeHtml(emotionalContent.title)}</strong></p><p>${escapeHtml(emotionalContent.body)}</p>`;
    behaviorEl.innerHTML = `<p><strong>${escapeHtml(behaviorContent.title)}</strong></p><p>${escapeHtml(behaviorContent.body)}</p>`;
    trustEl.innerHTML = `<p><strong>${escapeHtml(trustContent.title)}</strong></p><p>${escapeHtml(trustContent.body)}</p>`;
    scenariosEl.innerHTML = content.scenarios.map((item) => `<li>${item}</li>`).join("");
    nextStepsEl.innerHTML = content.next.map((item) => `<li>${item}</li>`).join("");
    setText("report-signal-text-1", content.signal1);
    setText("report-signal-text-2", content.signal2);
  }

  // --- Bootstrap wg adresu strony ---
  function boot() {
    document.documentElement.classList.add("js");
    initLocaleByLocation();
    persistPageLocale();
    appendLangToStripeLinks();
    setYear();
    initLegalFooter();
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
