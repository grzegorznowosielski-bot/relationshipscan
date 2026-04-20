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
  const TEST_SESSION_KEY = "relationshipscan_test_session_v1";
  const STRIPE_LINK = "https://buy.stripe.com/test_14AdRbbpqeFJbJIffH1ck00";

  function readPaidFlag() {
    try {
      if (localStorage.getItem(PAID_KEY) === "true") return true;
    } catch (e) {
      // Ignore storage issues.
    }
    try {
      return sessionStorage.getItem(PAID_KEY) === "true";
    } catch (e) {
      return false;
    }
  }

  function writePaidFlag() {
    try {
      localStorage.setItem(PAID_KEY, "true");
      localStorage.setItem("paidAt", Date.now().toString());
    } catch (e) {
      // Ignore storage issues.
    }
    try {
      sessionStorage.setItem(PAID_KEY, "true");
    } catch (e) {
      // Ignore storage issues.
    }
  }

  function clearPaidFlag() {
    try {
      localStorage.removeItem(PAID_KEY);
      localStorage.removeItem("paidAt");
    } catch (e) {
      // Ignore storage issues.
    }
    try {
      sessionStorage.removeItem(PAID_KEY);
    } catch (e) {
      // Ignore storage issues.
    }
  }

  /** Stripe po platnosci czesto wraca na report z session_id / payment_intent zamiast przez success.html. */
  function syncPaidFromStripeReturnUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id") || "";
      const paymentIntent = params.get("payment_intent") || "";
      const okStripe =
        (sessionId.startsWith("cs_") && sessionId.length >= 14) ||
        (paymentIntent.startsWith("pi_") && paymentIntent.length >= 14);
      if (!okStripe) return;
      writePaidFlag();
      params.delete("session_id");
      params.delete("payment_intent");
      params.delete("payment_intent_client_secret");
      const qs = params.toString();
      const path = window.location.pathname || "";
      window.history.replaceState({}, "", `${path}${qs ? `?${qs}` : ""}${window.location.hash || ""}`);
    } catch (e) {
      // Ignore malformed URLs / history API issues.
    }
  }
  const LOCALE_PATHS = {
    en: "/en/",
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
        1: "No",
        2: "Rather no",
        3: "Not sure",
        4: "Rather yes",
        5: "Yes",
      },
      progressHints: {
        early: "This takes less than a minute",
        mid: "You are already halfway through",
        late: "Just a moment — you are finishing",
      },
      scaleAria: "Answer scale",
      next: "Next",
      seeResult: "See result",
      back: "Back",
      backHome: "Back to home",
      loading: "Calculating your result…",
      disclaimer: "This takes about 2 minutes. Answer instinctively — don’t overthink.",
      micro: "There are no right or wrong answers.",
    },
    pl: {
      title: "Skan — RelationshipScan",
      stepLabel: (step, total) => `Pytanie ${step} z ${total}`,
      scaleLabels: {
        1: "Zdecydowanie nie",
        2: "Raczej nie",
        3: "Nie wiem",
        4: "Raczej tak",
        5: "Zdecydowanie tak",
      },
      progressHints: {
        early: "Zajmie to mniej niż minutę",
        mid: "Już połowa za Tobą",
        late: "Jeszcze chwila — kończysz",
      },
      scaleAria: "Skala odpowiedzi",
      next: "Dalej",
      seeResult: "Zobacz wynik",
      back: "Wstecz",
      backHome: "Powrót na stronę główną",
      loading: "Liczymy Twój wynik…",
      disclaimer: "To zajmie około 2 minut. Odpowiadaj intuicyjnie — bez analizowania.",
      micro: "Nie ma tu dobrych ani złych odpowiedzi.",
    },
    de: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Frage ${step} von ${total}`,
      scaleLabels: {
        1: "Nein",
        2: "Eher nein",
        3: "Unsicher",
        4: "Eher ja",
        5: "Ja",
      },
      progressHints: {
        early: "Das dauert weniger als eine Minute",
        mid: "Du bist schon zur Hälfte durch",
        late: "Nur noch kurz — du bist fast fertig",
      },
      scaleAria: "Antwortskala",
      next: "Weiter",
      seeResult: "Ergebnis sehen",
      back: "Zurück",
      backHome: "Zur Startseite",
      loading: "Dein Ergebnis wird berechnet…",
      disclaimer: "Das dauert etwa 2 Minuten. Antworte intuitiv — nicht zu viel nachdenken.",
      micro: "Es gibt hier keine richtigen oder falschen Antworten.",
    },
    es: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Pregunta ${step} de ${total}`,
      scaleLabels: {
        1: "No",
        2: "Mas bien no",
        3: "No se",
        4: "Mas bien si",
        5: "Si",
      },
      progressHints: {
        early: "Tarda menos de un minuto",
        mid: "Ya vas por la mitad",
        late: "Un momento más — ya casi terminas",
      },
      scaleAria: "Escala de respuestas",
      next: "Siguiente",
      seeResult: "Ver resultado",
      back: "Atras",
      backHome: "Volver al inicio",
      loading: "Calculando tu resultado…",
      disclaimer: "Esto toma unos 2 minutos. Responde de forma intuitiva — sin pensarlo demasiado.",
      micro: "No hay respuestas correctas o incorrectas.",
    },
    pt: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Pergunta ${step} de ${total}`,
      scaleLabels: {
        1: "Nao",
        2: "Mais para nao",
        3: "Nao sei",
        4: "Mais para sim",
        5: "Sim",
      },
      progressHints: {
        early: "Leva menos de um minuto",
        mid: "Voce ja chegou na metade",
        late: "So mais um pouco — voce esta terminando",
      },
      scaleAria: "Escala de respostas",
      next: "Proximo",
      seeResult: "Ver resultado",
      back: "Voltar",
      backHome: "Voltar ao inicio",
      loading: "Calculando seu resultado…",
      disclaimer: "Isso leva cerca de 2 minutos. Responda de forma intuitiva — sem pensar demais.",
      micro: "Não há respostas certas ou erradas.",
    },
    in: {
      title: "Scan — RelationshipScan",
      stepLabel: (step, total) => `Question ${step} of ${total}`,
      scaleLabels: {
        1: "No",
        2: "Rather no",
        3: "Not sure",
        4: "Rather yes",
        5: "Yes",
      },
      progressHints: {
        early: "This takes less than a minute",
        mid: "You are already halfway through",
        late: "Just a moment — you are finishing",
      },
      scaleAria: "Answer scale",
      next: "Next",
      seeResult: "See result",
      back: "Back",
      backHome: "Back to home",
      loading: "Calculating your result…",
      disclaimer: "This takes about 2 minutes. Answer instinctively — don’t overthink.",
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
    return null;
  }

  function getCurrentLocale() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
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
    const byPath = getLocaleFromPath(window.location.pathname || "/");
    if (byPath) return setLang(byPath);
    const stored = getStoredLang();
    if (stored) return stored;
    return setLang("en");
  }

  function getTestLocale() {
    return getFlowLocale();
  }

  function getFlowPageUrl(pageName, locale) {
    const normalizedLocale = normalizeLocale(locale);
    return `${pageName}.html?lang=${encodeURIComponent(normalizedLocale)}`;
  }

  function getQueryLang() {
    const value = new URLSearchParams(window.location.search).get("lang");
    if (!value) return null;
    const normalized = String(value).toLowerCase();
    return LOCALE_PATHS[normalized] ? normalized : null;
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
      de: { low: "Kritisch", mid: "Gemischt", high: "Stabil" },
      es: { low: "Fragil", mid: "Mixto", high: "Estable" },
      pt: { low: "Fragil", mid: "Misto", high: "Estavel" },
      in: { low: "Fragile", mid: "Mixed", high: "Stable" },
    };
    const lang = labels[locale] ? locale : "en";
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
    if (AREA_CONTENT[locale] && AREA_CONTENT[locale][areaKey] && AREA_CONTENT[locale][areaKey][segment]) {
      return AREA_CONTENT[locale][areaKey][segment];
    }

    const fallbackByLocale = {
      de: {
        names: {
          communication: "Kommunikation",
          emotional: "Emotionale Nahe",
          behavior: "Verhaltenskonsistenz",
          trust: "Klarheit und Vertrauen",
        },
        titles: { low: "unter Druck", mid: "gemischt", high: "stabiler" },
        body: {
          low: "In diesem Bereich ist die Unsicherheit derzeit hoch und beeinflusst Entscheidungen direkt.",
          mid: "Dieser Bereich zeigt gemischte Signale und braucht klarere Absprachen.",
          high: "Dieser Bereich wirkt derzeit stabiler und stutzt die Gesamtstruktur der Beziehung.",
        },
      },
      es: {
        names: {
          communication: "Comunicacion",
          emotional: "Cercania emocional",
          behavior: "Consistencia conductual",
          trust: "Claridad y confianza",
        },
        titles: { low: "bajo presion", mid: "mixto", high: "mas estable" },
        body: {
          low: "En esta area la incertidumbre es alta y ya afecta decisiones clave.",
          mid: "Esta area muestra señales mixtas y requiere acuerdos mas concretos.",
          high: "Esta area aparece mas estable y sostiene mejor la estructura general.",
        },
      },
      pt: {
        names: {
          communication: "Comunicacao",
          emotional: "Proximidade emocional",
          behavior: "Consistencia comportamental",
          trust: "Clareza e confianca",
        },
        titles: { low: "sob pressao", mid: "misto", high: "mais estavel" },
        body: {
          low: "Nesta area a incerteza esta alta e ja afeta decisoes importantes.",
          mid: "Esta area mostra sinais mistos e pede acordos mais claros.",
          high: "Esta area esta mais estavel e sustenta melhor a estrutura geral.",
        },
      },
      in: {
        names: {
          communication: "Communication",
          emotional: "Emotional closeness",
          behavior: "Behavior consistency",
          trust: "Clarity and trust",
        },
        titles: { low: "under pressure", mid: "mixed", high: "more stable" },
        body: {
          low: "Uncertainty in this area is high and already affects key decisions.",
          mid: "This area shows mixed signals and needs clearer agreements.",
          high: "This area looks more stable and supports the wider relationship structure.",
        },
      },
    };

    const localized = fallbackByLocale[locale] || fallbackByLocale.in;
    return {
      title: `${localized.names[areaKey]}: ${localized.titles[segment]}`,
      body: localized.body[segment],
    };
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
      paywallHook: "A partial score can hide the decision you actually need.",
      scoreLabel: "Current Trust Index",
      valueHeading: "What you unlock",
      valueItems: ["Full analysis", "Risk alerts", "Relationship trajectory", "Timeline (3-6 months)", "Action plan"],
      priceLine: "39 PLN · one-time payment",
      ctaButton: "Unlock full report",
      ctaSecondary: "See what changes the outcome",
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
      paywallHook: "Czesciowy wynik moze ukrywac decyzje, ktora i tak musisz podjac.",
      scoreLabel: "Aktualny Trust Index",
      valueHeading: "Co odblokowujesz",
      valueItems: ["Pelna analiza", "Alerty ryzyka", "Trajektoria relacji", "Timeline (3-6 miesiecy)", "Plan dzialania"],
      priceLine: "39 PLN · jednorazowa platnosc",
      ctaButton: "Odblokuj pełny raport",
      ctaSecondary: "Zobacz, co zmienia wynik",
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
      paywallHook: "Ein Teilwert zeigt nicht, welche Entscheidung wirklich ansteht.",
      scoreLabel: "Aktueller Trust Index",
      valueHeading: "Was du freischaltest",
      valueItems: ["Vollständige Analyse", "Risikohinweise", "Beziehungsverlauf", "Timeline (3-6 Monate)", "Aktionsplan"],
      priceLine: "39 PLN · einmalige Zahlung",
      ctaButton: "Vollständigen Bericht freischalten",
      ctaSecondary: "Sieh, was das Ergebnis verändert",
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
      paywallHook: "Un resultado parcial no muestra la decisión de fondo.",
      scoreLabel: "Trust Index actual",
      valueHeading: "Lo que desbloqueas",
      valueItems: ["Analisis completo", "Alertas de riesgo", "Trayectoria de la relacion", "Timeline (3-6 meses)", "Plan de accion"],
      priceLine: "39 PLN · pago unico",
      ctaButton: "Desbloquear informe completo",
      ctaSecondary: "Ver que cambia el resultado",
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
      paywallHook: "Um resultado parcial nao mostra a decisao real em jogo.",
      scoreLabel: "Trust Index atual",
      valueHeading: "O que voce desbloqueia",
      valueItems: ["Analise completa", "Alertas de risco", "Trajetoria do relacionamento", "Timeline (3-6 meses)", "Plano de acao"],
      priceLine: "39 PLN · pagamento unico",
      ctaButton: "Desbloquear relatório completo",
      ctaSecondary: "Veja o que muda o resultado",
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
      paywallHook: "A partial score can hide the decision you actually need.",
      scoreLabel: "Current Trust Index",
      valueHeading: "What you unlock",
      valueItems: ["Full analysis", "Risk alerts", "Relationship trajectory", "Timeline (3-6 months)", "Action plan"],
      priceLine: "39 PLN · one-time payment",
      ctaButton: "Unlock full report",
      ctaSecondary: "See what changes the outcome",
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

  const paywallModalText = {
    pl: {
      title: "Odblokuj pełny raport",
      subtitle: "Pełna analiza jest dostępna po płatności Stripe.",
      button: "Przejdź do płatności Stripe",
    },
    en: {
      title: "Unlock full report",
      subtitle: "Full analysis is available after Stripe payment.",
      button: "Continue to Stripe payment",
    },
    de: {
      title: "Vollständigen Bericht freischalten",
      subtitle: "Die vollständige Analyse ist nach der Stripe-Zahlung verfügbar.",
      button: "Weiter zur Stripe-Zahlung",
    },
    es: {
      title: "Desbloquea el informe completo",
      subtitle: "El análisis completo está disponible después del pago con Stripe.",
      button: "Continuar al pago con Stripe",
    },
    pt: {
      title: "Desbloquear relatório completo",
      subtitle: "A análise completa fica disponível após o pagamento via Stripe.",
      button: "Continuar para o pagamento com Stripe",
    },
    in: {
      title: "Unlock full report",
      subtitle: "Full analysis is available after Stripe payment.",
      button: "Continue to Stripe payment",
    },
  };

  const PAGE_CHROME_UI = {
    en: {
      resultPageTitle: "Your Trust Index — RelationshipScan",
      reportPageTitle: "Full Relationship Analysis — RelationshipScan",
      successPageTitle: "Payment success — RelationshipScan",
      donutLabel: "Trust Index",
      homeLink: "Home",
      retakeLink: "Retake scan",
      noResultTitle: "No result yet",
      noResultBody: "Return to the test to generate your Trust Index.",
      footerInfo: "Informational materials only.",
      footerDisclaimer: RESULT_SIGNAL_LINE_BY_LOCALE.en,
    },
    pl: {
      resultPageTitle: "Twój Trust Index — RelationshipScan",
      reportPageTitle: "Pelna analiza relacji — RelationshipScan",
      successPageTitle: "Płatność potwierdzona — RelationshipScan",
      donutLabel: "Trust Index",
      homeLink: "Start",
      retakeLink: "Powtórz skan",
      noResultTitle: "Brak wyniku",
      noResultBody: "Wroc do testu, aby zobaczyc swoj wynik.",
      footerInfo: "Materiały mają charakter informacyjny.",
      footerDisclaimer: RESULT_SIGNAL_LINE_BY_LOCALE.pl,
    },
    de: {
      resultPageTitle: "Dein Trust Index — RelationshipScan",
      reportPageTitle: "Vollständige Beziehungsanalyse — RelationshipScan",
      successPageTitle: "Zahlung bestätigt — RelationshipScan",
      donutLabel: "Trust Index",
      homeLink: "Startseite",
      retakeLink: "Scan wiederholen",
      noResultTitle: "Noch kein Ergebnis",
      noResultBody: "Gehe zum Scan zurueck, um deinen Trust Index zu erstellen.",
      footerInfo: "Nur Informationsmaterial.",
      footerDisclaimer: RESULT_SIGNAL_LINE_BY_LOCALE.de,
    },
    es: {
      resultPageTitle: "Tu Trust Index — RelationshipScan",
      reportPageTitle: "Analisis completo de la relacion — RelationshipScan",
      successPageTitle: "Pago confirmado — RelationshipScan",
      donutLabel: "Trust Index",
      homeLink: "Inicio",
      retakeLink: "Repetir scan",
      noResultTitle: "Aun no hay resultado",
      noResultBody: "Vuelve al test para generar tu Trust Index.",
      footerInfo: "Materiales solo informativos.",
      footerDisclaimer: RESULT_SIGNAL_LINE_BY_LOCALE.es,
    },
    pt: {
      resultPageTitle: "Seu Trust Index — RelationshipScan",
      reportPageTitle: "Analise completa do relacionamento — RelationshipScan",
      successPageTitle: "Pagamento confirmado — RelationshipScan",
      donutLabel: "Trust Index",
      homeLink: "Inicio",
      retakeLink: "Refazer scan",
      noResultTitle: "Ainda sem resultado",
      noResultBody: "Volte ao teste para gerar seu Trust Index.",
      footerInfo: "Materiais apenas informativos.",
      footerDisclaimer: RESULT_SIGNAL_LINE_BY_LOCALE.pt,
    },
    in: {
      resultPageTitle: "Your Trust Index — RelationshipScan",
      reportPageTitle: "Full Relationship Analysis — RelationshipScan",
      successPageTitle: "Payment success — RelationshipScan",
      donutLabel: "Trust Index",
      homeLink: "Home",
      retakeLink: "Retake scan",
      noResultTitle: "No result yet",
      noResultBody: "Return to the test to generate your Trust Index.",
      footerInfo: "Informational materials only.",
      footerDisclaimer: RESULT_SIGNAL_LINE_BY_LOCALE.in,
    },
  };

  function getModalLang() {
    const byPath = getLocaleFromPath(window.location.pathname || "/");
    if (byPath && paywallModalText[byPath]) return byPath;
    try {
      const lang = localStorage.getItem("lang");
      if (lang && paywallModalText[lang]) return lang;
    } catch (e) {
      // Ignore storage issues.
    }
    return "en";
  }

  function renderPaywallModalText(lang) {
    const text = paywallModalText[lang] || paywallModalText.en;
    setText("report-lock-title", text.title);
    setText("report-lock-body", text.subtitle);
    setText("report-lock-cta", text.button);
  }

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

  const BENCHMARK_SCORES = {
    overall: 68,
    communication: 70,
    emotional: 66,
    stability: 69,
    clarity: 65,
  };

  function getComparisonBand(score, average) {
    const diff = Number(score) - Number(average);
    if (Math.abs(diff) <= 4) return "around";
    return diff > 0 ? "above" : "below";
  }

  function getBenchmarkLabels(locale) {
    const map = {
      en: {
        heading: "How you compare",
        average: "Average",
        above: "Above average",
        around: "Around average",
        below: "Below average",
        dimensions: {
          overall: "Overall score",
          communication: "Communication",
          emotional: "Emotional closeness",
          stability: "Stability",
          clarity: "Clarity",
        },
      },
      pl: {
        heading: "Jak wypadasz na tle benchmarku",
        average: "Srednia",
        above: "Powyzej sredniej",
        around: "W okolicy sredniej",
        below: "Ponizej sredniej",
        dimensions: {
          overall: "Wynik ogolny",
          communication: "Komunikacja",
          emotional: "Bliskosc emocjonalna",
          stability: "Stabilnosc",
          clarity: "Klarownosc",
        },
      },
      de: {
        heading: "Vergleich mit dem Benchmark",
        average: "Durchschnitt",
        above: "Über dem Durchschnitt",
        around: "Nahe am Durchschnitt",
        below: "Unter dem Durchschnitt",
        dimensions: {
          overall: "Gesamtwert",
          communication: "Kommunikation",
          emotional: "Emotionale Nähe",
          stability: "Stabilität",
          clarity: "Klarheit",
        },
      },
      es: {
        heading: "Cómo te comparas",
        average: "Promedio",
        above: "Por encima del promedio",
        around: "Cerca del promedio",
        below: "Por debajo del promedio",
        dimensions: {
          overall: "Puntuación general",
          communication: "Comunicación",
          emotional: "Cercanía emocional",
          stability: "Estabilidad",
          clarity: "Claridad",
        },
      },
      pt: {
        heading: "Como você se compara",
        average: "Média",
        above: "Acima da média",
        around: "Perto da média",
        below: "Abaixo da média",
        dimensions: {
          overall: "Pontuação geral",
          communication: "Comunicação",
          emotional: "Proximidade emocional",
          stability: "Estabilidade",
          clarity: "Clareza",
        },
      },
      in: {
        heading: "How you compare",
        average: "Average",
        above: "Above average",
        around: "Around average",
        below: "Below average",
        dimensions: {
          overall: "Overall score",
          communication: "Communication",
          emotional: "Emotional closeness",
          stability: "Stability",
          clarity: "Clarity",
        },
      },
    };
    return map[locale] || map.en;
  }

  function getRiskAlertLabels(locale) {
    const map = {
      en: {
        heading: "Risk alerts",
        none: "No critical alert triggered based on current thresholds.",
        clarity: {
          title: "Clarity risk: unclear intent layer",
          body:
            "Your clarity score is below the critical threshold. This usually means you are forced to interpret too much between the lines, which increases decision friction. In this state, even neutral signals can be read as threat signals.",
        },
        emotional: {
          title: "Emotional risk: unstable emotional base",
          body:
            "Your emotional score is below the critical threshold. Connection may still be present, but it is not stable enough to regulate stress consistently. This increases reactivity and lowers confidence in difficult moments.",
        },
        inconsistency: {
          title: "Inconsistency risk: dimensions are out of sync",
          body:
            "The spread between your strongest and weakest dimensions exceeds 15 points. This indicates structural imbalance: one area may look stable while another keeps injecting uncertainty into the system. Without targeted correction, progress can feel temporary.",
        },
      },
      pl: {
        heading: "Alerty ryzyka",
        none: "Brak krytycznych alertow przy aktualnych progach.",
        clarity: {
          title: "Ryzyko klarownosci: niejasna warstwa intencji",
          body:
            "Wynik klarownosci jest ponizej progu krytycznego. To zwykle oznacza nadmiar domyslow i zbyt malo jawnych ustalen, co zwieksza ryzyko blednej oceny sytuacji. W tym stanie nawet neutralne sygnaly sa latwo odczytywane jako zagrozenie.",
        },
        emotional: {
          title: "Ryzyko emocjonalne: niestabilna baza emocjonalna",
          body:
            "Wynik bliskosci emocjonalnej jest ponizej progu krytycznego. Kontakt moze byc obecny, ale nie daje stabilnej regulacji stresu. To podnosi reaktywnosc i utrudnia spokojne domykanie trudnych tematow.",
        },
        inconsistency: {
          title: "Ryzyko niespojnosci: obszary dzialaja nierowno",
          body:
            "Roznica miedzy najsilniejszym i najslabszym obszarem przekracza 15 punktow. To sygnal nierownowagi strukturalnej: poprawa w jednym obszarze nie kompensuje kosztu w drugim. Bez precyzyjnej korekty efekt poprawy moze byc nietrwaly.",
        },
      },
      de: {
        heading: "Risikohinweise",
        none: "Bei den aktuellen Schwellen wurde kein kritischer Alarm ausgelöst.",
        clarity: {
          title: "Klarheitsrisiko: unklare Intentionsebene",
          body:
            "Der Klarheitswert liegt unter dem kritischen Schwellenwert. Das bedeutet meist zu viel Interpretation und zu wenig explizite Absprachen. Dadurch steigt das Risiko von Fehlentscheidungen deutlich.",
        },
        emotional: {
          title: "Emotionales Risiko: instabile emotionale Basis",
          body:
            "Der Wert für emotionale Nähe liegt unter dem kritischen Schwellenwert. Verbindung kann vorhanden sein, reguliert Stress aber nicht zuverlässig. Das erhöht Reaktivität in schwierigen Situationen.",
        },
        inconsistency: {
          title: "Inkonsistenzrisiko: Dimensionen laufen auseinander",
          body:
            "Die Differenz zwischen stärkster und schwächster Dimension liegt über 15 Punkten. Das spricht für ein strukturelles Ungleichgewicht. Fortschritt wirkt dann oft nur kurzfristig.",
        },
      },
      es: {
        heading: "Alertas de riesgo",
        none: "No se activó ninguna alerta crítica con los umbrales actuales.",
        clarity: {
          title: "Riesgo de claridad: capa de intención poco clara",
          body:
            "La puntuación de claridad está por debajo del umbral crítico. Esto suele implicar demasiada interpretación y pocos acuerdos explícitos. En ese estado aumentan los errores de lectura de señales.",
        },
        emotional: {
          title: "Riesgo emocional: base emocional inestable",
          body:
            "La puntuación emocional está por debajo del umbral crítico. Puede haber conexión, pero no con la estabilidad necesaria para regular el estrés. Eso incrementa la reactividad en momentos difíciles.",
        },
        inconsistency: {
          title: "Riesgo de inconsistencia: dimensiones desalineadas",
          body:
            "La diferencia entre la dimensión más fuerte y la más débil supera los 15 puntos. Esto indica desequilibrio estructural: una mejora parcial no compensa la presión del área más débil.",
        },
      },
      pt: {
        heading: "Alertas de risco",
        none: "Nenhum alerta crítico foi acionado com os limites atuais.",
        clarity: {
          title: "Risco de clareza: camada de intenção pouco clara",
          body:
            "A pontuação de clareza está abaixo do limite crítico. Isso costuma indicar interpretação excessiva e poucos acordos explícitos. Nesse cenário, o risco de leitura incorreta aumenta.",
        },
        emotional: {
          title: "Risco emocional: base emocional instável",
          body:
            "A pontuação emocional está abaixo do limite crítico. Pode haver conexão, mas sem consistência para regular o estresse. Isso eleva a reatividade em momentos de pressão.",
        },
        inconsistency: {
          title: "Risco de inconsistência: dimensões desalinhadas",
          body:
            "A diferença entre a dimensão mais forte e a mais fraca supera 15 pontos. Isso aponta desequilíbrio estrutural e tende a tornar avanços menos duráveis.",
        },
      },
      in: {
        heading: "Risk alerts",
        none: "No critical alert triggered based on current thresholds.",
        clarity: {
          title: "Clarity risk: unclear intent layer",
          body:
            "Your clarity score is below the critical threshold. This usually means you are forced to interpret too much between the lines, which increases decision friction. In this state, even neutral signals can be read as threat signals.",
        },
        emotional: {
          title: "Emotional risk: unstable emotional base",
          body:
            "Your emotional score is below the critical threshold. Connection may still be present, but it is not stable enough to regulate stress consistently. This increases reactivity and lowers confidence in difficult moments.",
        },
        inconsistency: {
          title: "Inconsistency risk: dimensions are out of sync",
          body:
            "The spread between your strongest and weakest dimensions exceeds 15 points. This indicates structural imbalance: one area may look stable while another keeps injecting uncertainty into the system. Without targeted correction, progress can feel temporary.",
        },
      },
    };
    return map[locale] || map.en;
  }

  function getTrajectoryContent(locale) {
    const map = {
      en: {
        heading: "Relationship trajectory",
        avgLabel: "avg",
        varianceLabel: "variance",
        stable: {
          label: "Stable",
          text:
            "Your relationship trajectory is currently stable. The average stays high and the spread between key areas is controlled, so the system is not pulled in opposite directions. You are not relying on one strong area to hide a weak one. Communication, emotional closeness, behavioral consistency and clarity are moving in a compatible way. This usually means the relationship can absorb tension without losing structure. The practical priority is maintenance: keep clear agreements, keep follow-through visible, and review whether signals remain aligned over time.",
        },
        unstableGrowth: {
          label: "Unstable growth",
          text:
            "Your relationship trajectory shows unstable growth. The overall level is high, but the distance between the strongest and weakest areas is wide enough to create friction. In practice, this means progress is real but uneven: one part of the relationship improves while another keeps reintroducing uncertainty. The risk is false confidence caused by strong headline scores. If you do not close the weak area, tension can return during stress peaks. The next step is precise correction in the lowest dimension and short weekly checks on visible behavior.",
        },
        unstable: {
          label: "Unstable",
          text:
            "Your relationship trajectory is unstable at this stage. The average is not strong enough to offset the internal spread, and the profile suggests uneven regulation across key areas. You may experience moments of closeness followed by periods of confusion or defensiveness. This pattern drains trust because outcomes become hard to predict. The issue is not one bad day but repeated inconsistency in the relationship system. Priority now is to reduce variance first: tighten expectations, define response rules for conflict, and track whether behavior becomes more coherent week by week.",
        },
        declining: {
          label: "Declining",
          text:
            "Your relationship trajectory is declining based on the current signal pattern. The overall average is below the stability threshold, which means uncertainty is now structurally dominant. In this state, even small ruptures can escalate because the baseline is already weak. Waiting passively usually deepens drift and increases emotional cost. The key risk is normalization of low-quality interaction: less clarity, less safety, and lower trust recovery. Immediate action is required: define non-negotiable boundaries, test for concrete follow-through, and reassess trajectory after a short, specific intervention window.",
        },
      },
      pl: {
        heading: "Trajektoria relacji",
        avgLabel: "srednia",
        varianceLabel: "rozrzut",
        stable: {
          label: "Stabilna",
          text:
            "Trajektoria tej relacji jest obecnie stabilna. Sredni wynik pozostaje wysoki, a roznice miedzy obszarami sa pod kontrola, wiec system nie rozjezdza sie wewnetrznie. Nie opierasz obrazu relacji na jednym mocnym punkcie, ktory maskuje slabosci. Komunikacja, bliskosc emocjonalna, przewidywalnosc zachowan i klarownosc poruszaja sie w zblizonym kierunku. Taki profil zwykle lepiej znosi napiecie bez utraty struktury. Priorytetem nie jest rewolucja, tylko utrzymanie standardu: jasne ustalenia, widoczny follow-through i regularna kontrola spojnosci sygnalow.",
        },
        unstableGrowth: {
          label: "Niestabilny wzrost",
          text:
            "Trajektoria pokazuje niestabilny wzrost. Wynik ogolny jest wysoki, ale rozrzut miedzy najmocniejszym i najslabszym obszarem jest na tyle duzy, ze generuje tarcie. W praktyce oznacza to realna poprawe, ale nierowna: jeden fragment relacji sie wzmacnia, a inny nadal produkuje niepewnosc. Najwiekszym ryzykiem jest falszywe poczucie bezpieczenstwa oparte na samym wyniku koncowym. Bez domkniecia najslabszego obszaru napiecie bedzie wracac w momentach presji. Kolejny krok to precyzyjna korekta tam, gdzie wynik jest najnizszy, i cotygodniowy pomiar zachowan.",
        },
        unstable: {
          label: "Niestabilna",
          text:
            "Trajektoria relacji jest na tym etapie niestabilna. Sredni poziom nie jest wystarczajaco mocny, by zrownowazyc wewnetrzny rozrzut sygnalow, a profil pokazuje nierowna regulacje kluczowych obszarow. Mozesz odczuwac okresy bliskosci, po ktorych wraca chaos interpretacyjny albo defensywnosc. Taki uklad oslabia zaufanie, bo efekty staja sie trudne do przewidzenia. Problemem nie jest pojedynczy incydent, tylko powtarzalna niespojnosc systemu relacji. Priorytet na teraz: najpierw zmniejszyc rozrzut, doprecyzowac oczekiwania i sprawdzac, czy zachowania staja sie bardziej spojne z tygodnia na tydzien.",
        },
        declining: {
          label: "Spadkowa",
          text:
            "Trajektoria relacji jest spadkowa wedlug aktualnego ukladu sygnalow. Srednia pozostaje ponizej progu stabilnosci, co oznacza, ze niepewnosc zaczyna dominowac strukturalnie. W takim stanie nawet drobne zaklocenia latwo eskaluja, bo baza jest oslabiona. Bierne czekanie zwykle poglebia dystans i podnosi koszt emocjonalny. Najwieksze ryzyko to normalizacja slabego standardu kontaktu: mniej klarownosci, mniej bezpieczenstwa i slabsza odbudowa zaufania. Potrzebna jest szybka interwencja: twarde granice, konkretne testy follow-through i ponowna ocena po krotkim okresie dzialania.",
        },
      },
      de: {
        heading: "Beziehungsverlauf",
        avgLabel: "durchschnitt",
        varianceLabel: "streuung",
        stable: {
          label: "Stabil",
          text:
            "Der Beziehungsverlauf ist aktuell stabil. Der Durchschnittswert bleibt hoch und die Differenz zwischen den Kernbereichen ist kontrolliert, daher zieht das System nicht in gegensätzliche Richtungen. Ein starker Bereich überdeckt keinen schwachen Bereich. Kommunikation, emotionale Nähe, Verhaltenskonsistenz und Klarheit entwickeln sich kompatibel. Dieses Profil kann Spannung in der Regel ohne strukturellen Verlust verarbeiten. Der nächste Schritt ist konsequente Pflege: klare Absprachen, sichtbares Follow-through und regelmäßige Prüfung der Signal-Konsistenz.",
        },
        unstableGrowth: {
          label: "Instabiles Wachstum",
          text:
            "Der Beziehungsverlauf zeigt instabiles Wachstum. Das Gesamtniveau ist hoch, aber der Abstand zwischen stärkster und schwächster Dimension erzeugt spürbare Reibung. Fortschritt ist vorhanden, jedoch ungleich verteilt. Eine starke Dimension kann dabei Unsicherheit in einer schwachen Dimension verdecken. Das Risiko ist ein zu positives Gesamtbild trotz struktureller Lücke. Wird die schwächste Dimension nicht gezielt stabilisiert, kehrt Druck in Belastungsphasen schnell zurück. Priorität hat jetzt die präzise Korrektur im schwächsten Bereich mit kurzen, messbaren Wochenchecks.",
        },
        unstable: {
          label: "Instabil",
          text:
            "Der Beziehungsverlauf ist derzeit instabil. Der Durchschnitt reicht nicht aus, um die interne Streuung zu kompensieren, und das Profil zeigt eine ungleichmäßige Regulation der wichtigsten Bereiche. Dadurch wechseln sich Nähe und Verunsicherung häufig ab. Diese Dynamik schwächt Vertrauen, weil Ergebnisse schwer planbar werden. Es geht nicht um einzelne Ereignisse, sondern um wiederkehrende Inkonsistenz im System. Der wirksamste Hebel ist zunächst die Streuung zu senken: Erwartungen klären, Konfliktregeln festlegen und beobachtbares Verhalten wöchentlich prüfen.",
        },
        declining: {
          label: "Abnehmend",
          text:
            "Der Beziehungsverlauf ist nach aktueller Datenlage abnehmend. Der Durchschnitt liegt unter der Stabilitätsschwelle, wodurch Unsicherheit strukturell dominiert. In diesem Zustand können selbst kleine Störungen überproportional eskalieren. Passives Abwarten verstärkt meist Distanz und emotionalen Aufwand. Das Kernrisiko ist die Gewöhnung an niedrige Interaktionsqualität: weniger Klarheit, weniger Sicherheit, schwächere Vertrauensregeneration. Notwendig ist sofortiges Gegensteuern mit klaren Grenzen, konkreten Follow-through-Tests und einer erneuten Bewertung nach einem kurzen Interventionsfenster.",
        },
      },
      es: {
        heading: "Trayectoria de la relacion",
        avgLabel: "promedio",
        varianceLabel: "variacion",
        stable: {
          label: "Estable",
          text:
            "La trayectoria de la relación es estable en este momento. El promedio se mantiene alto y la diferencia entre áreas clave está controlada, por lo que el sistema no se descompensa. No dependes de un área fuerte para tapar una débil. Comunicación, cercanía emocional, consistencia de conducta y claridad avanzan de forma compatible. Este perfil suele tolerar tensión sin perder estructura. La prioridad práctica es sostener el estándar: acuerdos claros, seguimiento visible y revisión periódica de coherencia entre señales.",
        },
        unstableGrowth: {
          label: "Crecimiento inestable",
          text:
            "La trayectoria muestra crecimiento inestable. El nivel general es alto, pero la distancia entre la dimensión más fuerte y la más débil genera fricción real. Hay progreso, pero no de manera uniforme. Una parte mejora mientras otra sigue introduciendo incertidumbre. El riesgo principal es una sensación de seguridad basada solo en el resultado global. Si no se corrige el punto más débil, la presión reaparece en momentos de estrés. El siguiente paso es intervenir de forma precisa en esa dimensión y medir cambios conductuales cada semana.",
        },
        unstable: {
          label: "Inestable",
          text:
            "La trayectoria de la relación es inestable en esta fase. El promedio no alcanza para compensar la dispersión interna y el perfil refleja regulación desigual en áreas críticas. Puedes notar fases de conexión seguidas por confusión o defensividad. Esa oscilación erosiona confianza porque los resultados dejan de ser previsibles. No es un problema aislado, sino una inconsistencia repetida del sistema relacional. La prioridad inmediata es reducir varianza: aclarar expectativas, definir reglas de respuesta en conflicto y comprobar si la conducta se alinea semana a semana.",
        },
        declining: {
          label: "En deterioro",
          text:
            "La trayectoria de la relación está en deterioro según el patrón actual. El promedio se mantiene por debajo del umbral de estabilidad y la incertidumbre pasa a dominar la estructura. En ese estado, incluso rupturas pequeñas pueden escalar con rapidez. Esperar sin intervenir suele ampliar la distancia y aumentar el costo emocional. El riesgo central es normalizar una interacción de baja calidad: menos claridad, menos seguridad y menor recuperación de confianza. Se requiere acción inmediata con límites firmes, pruebas concretas de cumplimiento y nueva evaluación en una ventana corta.",
        },
      },
      pt: {
        heading: "Trajetoria do relacionamento",
        avgLabel: "media",
        varianceLabel: "variacao",
        stable: {
          label: "Estavel",
          text:
            "A trajetória do relacionamento está estável no momento. A média permanece alta e a diferença entre áreas-chave está controlada, então o sistema não opera em direções opostas. Uma dimensão forte não está mascarando uma dimensão fraca. Comunicação, proximidade emocional, consistência de comportamento e clareza evoluem de forma compatível. Esse perfil costuma absorver tensão sem perder estrutura. O foco agora é manutenção disciplinada: acordos claros, follow-through visível e revisão periódica da coerência dos sinais.",
        },
        unstableGrowth: {
          label: "Crescimento instavel",
          text:
            "A trajetória indica crescimento instável. O nível geral é alto, mas a distância entre a dimensão mais forte e a mais fraca gera atrito relevante. Há progresso, porém de forma desigual. Uma parte melhora enquanto outra continua produzindo incerteza. O principal risco é confiar demais no placar final e ignorar a lacuna estrutural. Sem correção direcionada na área mais fraca, a pressão tende a voltar nos momentos de estresse. O próximo passo é intervenção precisa nesse ponto e checagens semanais com evidência comportamental.",
        },
        unstable: {
          label: "Instavel",
          text:
            "A trajetória do relacionamento está instável nesta fase. A média não é suficiente para compensar a variação interna e o perfil mostra regulação desigual nas áreas mais importantes. Isso cria ciclos de aproximação seguidos por confusão ou defensividade. Esse padrão reduz confiança porque os resultados ficam menos previsíveis. O problema não é um episódio isolado, mas uma inconsistência recorrente do sistema relacional. A prioridade é reduzir variação: alinhar expectativas, definir regras para conflito e monitorar se o comportamento fica mais coerente semana após semana.",
        },
        declining: {
          label: "Em declinio",
          text:
            "A trajetória do relacionamento está em declínio com base no padrão atual. A média fica abaixo do limiar de estabilidade e a incerteza passa a dominar a estrutura. Nesse estado, até rupturas pequenas podem escalar rapidamente. Esperar sem ação tende a ampliar distância e custo emocional. O risco central é normalizar uma interação de baixa qualidade: menos clareza, menos segurança e pior recuperação de confiança. É necessária ação imediata com limites objetivos, testes concretos de follow-through e reavaliação em uma janela curta de intervenção.",
        },
      },
      in: {
        heading: "Relationship trajectory",
        avgLabel: "avg",
        varianceLabel: "variance",
        stable: {
          label: "Stable",
          text:
            "Your relationship trajectory is currently stable. The average stays high and the spread between key areas is controlled, so the system is not pulled in opposite directions. You are not relying on one strong area to hide a weak one. Communication, emotional closeness, behavioral consistency and clarity are moving in a compatible way. This usually means the relationship can absorb tension without losing structure. The practical priority is maintenance: keep clear agreements, keep follow-through visible, and review whether signals remain aligned over time.",
        },
        unstableGrowth: {
          label: "Unstable growth",
          text:
            "Your relationship trajectory shows unstable growth. The overall level is high, but the distance between the strongest and weakest areas is wide enough to create friction. In practice, this means progress is real but uneven: one part of the relationship improves while another keeps reintroducing uncertainty. The risk is false confidence caused by strong headline scores. If you do not close the weak area, tension can return during stress peaks. The next step is precise correction in the lowest dimension and short weekly checks on visible behavior.",
        },
        unstable: {
          label: "Unstable",
          text:
            "Your relationship trajectory is unstable at this stage. The average is not strong enough to offset the internal spread, and the profile suggests uneven regulation across key areas. You may experience moments of closeness followed by periods of confusion or defensiveness. This pattern drains trust because outcomes become hard to predict. The issue is not one bad day but repeated inconsistency in the relationship system. Priority now is to reduce variance first: tighten expectations, define response rules for conflict, and track whether behavior becomes more coherent week by week.",
        },
        declining: {
          label: "Declining",
          text:
            "Your relationship trajectory is declining based on the current signal pattern. The overall average is below the stability threshold, which means uncertainty is now structurally dominant. In this state, even small ruptures can escalate because the baseline is already weak. Waiting passively usually deepens drift and increases emotional cost. The key risk is normalization of low-quality interaction: less clarity, less safety, and lower trust recovery. Immediate action is required: define non-negotiable boundaries, test for concrete follow-through, and reassess trajectory after a short, specific intervention window.",
        },
      },
    };

    const content = map[locale] || map.en;
    return {
      heading: content.heading,
      avgLabel: content.avgLabel,
      varianceLabel: content.varianceLabel,
      stable: content.stable,
      unstableGrowth: content.unstableGrowth,
      unstable: content.unstable,
      declining: content.declining,
    };
  }

  function getRelationshipTrajectory(areaScores) {
    const values = [
      Number(areaScores.communication || 0),
      Number(areaScores.emotional || 0),
      Number(areaScores.behavior || 0),
      Number(areaScores.trust || 0),
    ];
    const avgScore = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = Math.max(...values) - Math.min(...values);
    let label = "unstable";

    if (avgScore >= 70 && variance < 15) label = "stable";
    else if (avgScore >= 70 && variance >= 15) label = "unstableGrowth";
    else if (avgScore >= 40 && variance >= 15) label = "unstable";
    else if (avgScore < 40) label = "declining";

    return {
      label,
      avgScore: Math.round(avgScore),
      variance: Math.round(variance),
    };
  }

  function collectRiskAlerts(locale, benchmarkScores) {
    const alertsUi = getRiskAlertLabels(locale);
    const alertItems = [];
    const clarityScore = benchmarkScores.clarity;
    const emotionalScore = benchmarkScores.emotional;
    const areaSpreadValues = [
      benchmarkScores.communication,
      benchmarkScores.emotional,
      benchmarkScores.stability,
      benchmarkScores.clarity,
    ];
    const spread = Math.max(...areaSpreadValues) - Math.min(...areaSpreadValues);

    if (clarityScore < 60) {
      alertItems.push(alertsUi.clarity);
    }
    if (emotionalScore < 60) {
      alertItems.push(alertsUi.emotional);
    }
    if (spread > 15) {
      alertItems.push(alertsUi.inconsistency);
    }

    return { alertsUi, alertItems };
  }

  function getTimelineContent(locale) {
    const map = {
      en: {
        heading: "Timeline (3-6 months)",
        avgLabel: "avg",
        varianceLabel: "variance",
        alertsLabel: "alerts",
        positive: "Positive direction",
        stableSensitive: "Stable but sensitive",
        unstable: "Unstable direction",
        declining: "Declining direction",
        shortTerm: "Short-term (weeks)",
        midTerm: "Mid-term (2-3 months)",
        longTerm: "Longer-term (3-6 months)",
        high: {
          short:
            "Current dynamics should stay generally predictable if your current standards are maintained. Day-to-day friction can still appear, but repair is likely to be faster.",
          mid:
            "By month two or three, you should see stronger consistency between conversations and behavior. Trust recovery cycles should get shorter, not longer.",
          long:
            "In a 3-6 month window, the relationship can consolidate into a stable pattern with lower decision pressure. The main risk is complacency, not collapse.",
        },
        mid: {
          short:
            "In the next weeks, results will likely look mixed: some good days, then returns of old friction. You may notice uneven effort between areas.",
          mid:
            "Over 2-3 months, unresolved weak spots can start dictating the tone of the relationship. Improvements remain possible, but they will feel reversible.",
          long:
            "Within 3-6 months, the direction depends on whether weak areas are actively corrected. Without correction, uncertainty stays elevated and decisions stay harder.",
        },
        low: {
          short:
            "In the coming weeks, conflict cost is likely to rise faster than repair quality. Emotional load can increase even when conversations still happen.",
          mid:
            "By month two or three, distance and defensiveness may become the default response loop. Clear agreements become harder to hold.",
          long:
            "Over 3-6 months, structural decline becomes more likely: lower clarity, weaker trust repair and more unstable outcomes. Passive waiting usually worsens this path.",
        },
      },
      pl: {
        heading: "Timeline (3-6 miesiecy)",
        avgLabel: "srednia",
        varianceLabel: "rozrzut",
        alertsLabel: "alerty",
        positive: "Kierunek pozytywny",
        stableSensitive: "Stabilnie, ale wrazliwie",
        unstable: "Kierunek niestabilny",
        declining: "Kierunek spadkowy",
        shortTerm: "Krotki termin (tygodnie)",
        midTerm: "Sredni termin (2-3 miesiace)",
        longTerm: "Dluzszy termin (3-6 miesiecy)",
        high: {
          short:
            "Obecna dynamika powinna pozostac przewidywalna, jesli utrzymacie biezacy standard relacji. Tarcia beda sie pojawiac, ale domykanie napiec powinno byc szybsze.",
          mid:
            "Po 2-3 miesiacach powinno byc widac lepsza spojność miedzy rozmowami a zachowaniem. Cykle odbudowy zaufania powinny sie skaracac, a nie wydluzac.",
          long:
            "W perspektywie 3-6 miesiecy relacja moze wejsc w trwalszy, stabilny uklad z mniejsza presja decyzyjna. Najwiekszym ryzykiem jest rozluznienie dyscypliny, nie nagly kryzys.",
        },
        mid: {
          short:
            "W najblizszych tygodniach przebieg bedzie raczej mieszany: dobre dni beda przeplatac sie powrotem starych tarc. Wysilek miedzy obszarami moze pozostac nierowny.",
          mid:
            "W ciagu 2-3 miesiecy niedomkniete slabosci zaczna mocniej narzucac ton relacji. Poprawa jest mozliwa, ale bedzie odczuwana jako nietrwale zwyciestwo.",
          long:
            "W horyzoncie 3-6 miesiecy kierunek zalezy od tego, czy najslabsze obszary beda korygowane aktywnie. Bez korekty niepewnosc utrzyma sie na podwyzszonym poziomie.",
        },
        low: {
          short:
            "W kolejnych tygodniach koszt konfliktu prawdopodobnie bedzie rosnac szybciej niz jakosc naprawy. Obciazenie emocjonalne moze wzrastac mimo dalszych rozmow.",
          mid:
            "Po 2-3 miesiacach dystans i defensywnosc moga stac sie domyslnym wzorcem reakcji. Utrzymanie jasnych ustalen bedzie coraz trudniejsze.",
          long:
            "W perspektywie 3-6 miesiecy rosnie ryzyko dalszego spadku: mniej klarownosci, slabsza odbudowa zaufania i bardziej niestabilne rezultaty. Bierne czekanie zwykle pogarsza ten tor.",
        },
      },
      de: {
        heading: "Timeline (3-6 Monate)",
        avgLabel: "durchschnitt",
        varianceLabel: "streuung",
        alertsLabel: "alarme",
        positive: "Positive Richtung",
        stableSensitive: "Stabil, aber sensibel",
        unstable: "Instabile Richtung",
        declining: "Abnehmende Richtung",
        shortTerm: "Kurzfristig (Wochen)",
        midTerm: "Mittelfristig (2-3 Monate)",
        longTerm: "Langfristiger (3-6 Monate)",
        high: {
          short:
            "Die aktuelle Dynamik bleibt voraussichtlich berechenbar, wenn der jetzige Standard gehalten wird.",
          mid:
            "Nach zwei bis drei Monaten sollte die Konsistenz zwischen Gespräch und Verhalten sichtbar steigen.",
          long:
            "Im 3-6-Monatsfenster ist eine stabilere Gesamtstruktur wahrscheinlich, sofern Disziplin erhalten bleibt.",
        },
        mid: {
          short:
            "In den nächsten Wochen bleibt das Bild gemischt: Fortschritt wechselt mit alten Reibungsmustern.",
          mid:
            "Über 2-3 Monate prägen offene Schwachstellen den Beziehungston deutlich stärker.",
          long:
            "In 3-6 Monaten entscheidet gezielte Korrektur der Schwachstellen über Richtung und Stabilität.",
        },
        low: {
          short:
            "Kurzfristig steigt der Konfliktpreis vermutlich schneller als die Qualität der Reparatur.",
          mid:
            "Nach zwei bis drei Monaten können Distanz und Abwehr zur Standardschleife werden.",
          long:
            "In 3-6 Monaten wird struktureller Abbau wahrscheinlicher, wenn keine harte Korrektur erfolgt.",
        },
      },
      es: {
        heading: "Timeline (3-6 meses)",
        avgLabel: "promedio",
        varianceLabel: "variacion",
        alertsLabel: "alertas",
        positive: "Direccion positiva",
        stableSensitive: "Estable pero sensible",
        unstable: "Direccion inestable",
        declining: "Direccion de deterioro",
        shortTerm: "Corto plazo (semanas)",
        midTerm: "Medio plazo (2-3 meses)",
        longTerm: "Plazo mas largo (3-6 meses)",
        high: {
          short:
            "La dinamica actual deberia seguir predecible si se mantiene el estandar presente.",
          mid:
            "En 2-3 meses deberia verse mas consistencia entre lo que se habla y lo que se hace.",
          long:
            "En 3-6 meses es probable consolidar una estructura mas estable con menor presion decisional.",
        },
        mid: {
          short:
            "En las proximas semanas el resultado sera mixto: avance parcial y regreso de fricciones antiguas.",
          mid:
            "En 2-3 meses, los puntos debiles no corregidos marcaran el tono de la relacion.",
          long:
            "En 3-6 meses la direccion dependera de corregir de forma activa las areas debiles.",
        },
        low: {
          short:
            "A corto plazo, el costo del conflicto puede crecer mas rapido que la reparacion.",
          mid:
            "En 2-3 meses, distancia y defensividad pueden convertirse en patron dominante.",
          long:
            "En 3-6 meses aumenta el riesgo de deterioro estructural si no hay intervencion clara.",
        },
      },
      pt: {
        heading: "Timeline (3-6 meses)",
        avgLabel: "media",
        varianceLabel: "variacao",
        alertsLabel: "alertas",
        positive: "Direcao positiva",
        stableSensitive: "Estavel, mas sensivel",
        unstable: "Direcao instavel",
        declining: "Direcao de declinio",
        shortTerm: "Curto prazo (semanas)",
        midTerm: "Medio prazo (2-3 meses)",
        longTerm: "Prazo maior (3-6 meses)",
        high: {
          short:
            "A dinamica atual tende a permanecer previsivel se o padrao atual for mantido.",
          mid:
            "Em 2-3 meses, a consistencia entre conversa e comportamento deve aumentar.",
          long:
            "No horizonte de 3-6 meses, a relacao pode consolidar uma estrutura mais estavel.",
        },
        mid: {
          short:
            "Nas proximas semanas o quadro tende a ser misto, com avanços e recaidas.",
          mid:
            "Em 2-3 meses, pontos fracos nao resolvidos passam a definir o tom da relacao.",
          long:
            "Em 3-6 meses, a direcao depende da correcao ativa das areas mais fracas.",
        },
        low: {
          short:
            "No curto prazo, o custo do conflito pode subir mais rapido que o reparo.",
          mid:
            "Em 2-3 meses, distancia e defensividade podem virar o padrao dominante.",
          long:
            "Em 3-6 meses, cresce o risco de declinio estrutural sem intervencao objetiva.",
        },
      },
      in: {
        heading: "Timeline (3-6 months)",
        avgLabel: "avg",
        varianceLabel: "variance",
        alertsLabel: "alerts",
        positive: "Positive direction",
        stableSensitive: "Stable but sensitive",
        unstable: "Unstable direction",
        declining: "Declining direction",
        shortTerm: "Short-term (weeks)",
        midTerm: "Mid-term (2-3 months)",
        longTerm: "Longer-term (3-6 months)",
        high: {
          short:
            "Current dynamics should stay predictable if your current standards are maintained.",
          mid:
            "By month two or three, consistency between conversations and behaviour should improve.",
          long:
            "In 3-6 months, the relationship can consolidate into a more stable pattern.",
        },
        mid: {
          short:
            "In coming weeks, you may see mixed progress with returns of old friction.",
          mid:
            "Over 2-3 months, unresolved weak spots can start shaping the relationship tone.",
          long:
            "Within 3-6 months, direction depends on active correction of weak areas.",
        },
        low: {
          short:
            "In the short term, conflict cost may rise faster than repair quality.",
          mid:
            "By 2-3 months, distance and defensiveness may become the default loop.",
          long:
            "In 3-6 months, structural decline is likely without targeted intervention.",
        },
      },
    };

    const content = map[locale] || map.en;
    return {
      heading: content.heading,
      avgLabel: content.avgLabel,
      varianceLabel: content.varianceLabel,
      alertsLabel: content.alertsLabel,
      positive: content.positive || map.en.positive,
      stableSensitive: content.stableSensitive || map.en.stableSensitive,
      unstable: content.unstable || map.en.unstable,
      declining: content.declining || map.en.declining,
      shortTerm: content.shortTerm || map.en.shortTerm,
      midTerm: content.midTerm || map.en.midTerm,
      longTerm: content.longTerm || map.en.longTerm,
      high: content.high || map.en.high,
      mid: content.mid || map.en.mid,
      low: content.low || map.en.low,
    };
  }

  function getRelationshipTimeline(avgScore, alertCount) {
    let state = "unstable";
    let variant = "mid";

    if (avgScore >= 70 && alertCount === 0) {
      state = "positive";
      variant = "high";
    } else if (avgScore >= 70 && alertCount > 0) {
      state = "stableSensitive";
      variant = "mid";
    } else if (avgScore >= 40 && alertCount > 1) {
      state = "unstable";
      variant = "mid";
    } else if (avgScore < 40) {
      state = "declining";
      variant = "low";
    }

    return { state, variant };
  }

  function getScoreRange(score) {
    if (score >= 70) return "high";
    if (score >= 40) return "mid";
    return "low";
  }

  function getWeakestAreaKey(areaScores) {
    const normalized = {
      communication: Number(areaScores.communication || 0),
      emotional: Number(areaScores.emotional || 0),
      stability: Number(areaScores.behavior || areaScores.stability || 0),
      clarity: Number(areaScores.trust || areaScores.clarity || 0),
    };
    const sorted = Object.entries(normalized).sort((a, b) => a[1] - b[1]);
    return sorted[0] ? sorted[0][0] : "communication";
  }

  function getPersonalizedInsightSentence(locale, score, areaScores) {
    const range = getScoreRange(score);
    const weakestArea = getWeakestAreaKey(areaScores);
    const pool = {
      en: {
        high: {
          communication: "Your strong score still depends on unresolved communication repair.",
          emotional: "High results, yet emotional distance still drives your decision risk.",
          stability: "Strong score, but behavior consistency still threatens your momentum.",
          clarity: "Your profile is high, but unclear intent still weakens trust.",
        },
        mid: {
          communication: "Your momentum slows whenever hard conversations stay unfinished.",
          emotional: "Mid score, but emotional distance keeps stretching your uncertainty.",
          stability: "Your mixed result reflects inconsistent behavior after tense moments.",
          clarity: "Your uncertainty grows when intentions stay unclear week after week.",
        },
        low: {
          communication: "Low score and blocked conversations are accelerating disconnection.",
          emotional: "Low stability plus emotional distance is draining your repair capacity.",
          stability: "Your low result tracks repeated behavior breaks after conflict.",
          clarity: "Low score with unclear signals keeps you in constant doubt.",
        },
      },
      pl: {
        high: {
          communication: "Mocny wynik nadal oslabia brak domkniec w komunikacji.",
          emotional: "Wysoki wynik, ale dystans emocjonalny podnosi Twoje ryzyko decyzji.",
          stability: "Wysoki wynik, lecz niespojne zachowania oslabiaja obecny trend.",
          clarity: "Profil jest wysoki, ale niejasne intencje oslabiaja zaufanie.",
        },
        mid: {
          communication: "Twoj trend hamuje, gdy trudne rozmowy zostaja niedokonczone.",
          emotional: "Wynik sredni, ale dystans emocjonalny dalej zwieksza niepewnosc.",
          stability: "Mieszany wynik pokazuje niespojne zachowania po napieciach.",
          clarity: "Niepewnosc rosnie, gdy intencje pozostaja niejasne tygodniami.",
        },
        low: {
          communication: "Niski wynik i zablokowane rozmowy przyspieszaja oddalenie.",
          emotional: "Niska stabilnosc i dystans emocjonalny oslabiaja zdolnosc naprawy.",
          stability: "Niski wynik pokazuje powtarzalne pekniecia zachowan po konflikcie.",
          clarity: "Niski wynik i niejasne sygnaly utrzymuja Cię w watpliwosciach.",
        },
      },
      de: {
        high: {
          communication: "Dein starker Wert hängt weiter an offener Kommunikationsreparatur.",
          emotional: "Hoher Score, doch emotionale Distanz treibt weiter Entscheidungsrisiko.",
          stability: "Starker Score, aber Verhaltenskonsistenz gefährdet deinen aktuellen Fortschritt.",
          clarity: "Dein Profil ist hoch, doch unklare Intention schwächt Vertrauen.",
        },
        mid: {
          communication: "Dein Verlauf bremst, sobald schwierige Gespräche offen bleiben.",
          emotional: "Mittlerer Score, doch emotionale Distanz erhöht weiter Unsicherheit.",
          stability: "Dein gemischter Wert zeigt inkonsistentes Verhalten nach Spannung.",
          clarity: "Unsicherheit wächst, wenn Intentionen wochenlang unklar bleiben.",
        },
        low: {
          communication: "Niedriger Score und blockierte Gespräche beschleunigen die Entkopplung.",
          emotional: "Niedrige Stabilität plus Distanz schwächen deine Reparaturkapazität stark.",
          stability: "Dein niedriger Wert zeigt wiederholte Verhaltensbrüche nach Konflikten.",
          clarity: "Niedriger Score und unklare Signale halten dauerhaften Zweifel aktiv.",
        },
      },
      es: {
        high: {
          communication: "Tu puntaje alto aún depende de reparaciones comunicativas pendientes.",
          emotional: "Resultado alto, pero distancia emocional mantiene tu riesgo decisional.",
          stability: "Puntaje alto, aunque consistencia conductual amenaza tu avance actual.",
          clarity: "Perfil alto, pero intención poco clara sigue debilitando confianza.",
        },
        mid: {
          communication: "Tu avance se frena cuando conversaciones difíciles quedan abiertas.",
          emotional: "Puntaje medio, pero distancia emocional mantiene alta incertidumbre.",
          stability: "Tu resultado mixto refleja conductas inconsistentes tras tensión.",
          clarity: "La incertidumbre crece cuando las intenciones siguen poco claras.",
        },
        low: {
          communication: "Puntaje bajo y conversaciones bloqueadas aceleran el distanciamiento.",
          emotional: "Baja estabilidad y distancia emocional agotan capacidad de reparación.",
          stability: "Tu resultado bajo muestra rupturas conductuales repetidas tras conflicto.",
          clarity: "Puntaje bajo y señales confusas sostienen duda constante.",
        },
      },
      pt: {
        high: {
          communication: "Seu score alto ainda depende de reparo comunicacional pendente.",
          emotional: "Resultado alto, mas distância emocional mantém risco decisório elevado.",
          stability: "Score alto, porém consistência comportamental ameaça progresso atual.",
          clarity: "Perfil alto, mas intenção pouco clara enfraquece confiança.",
        },
        mid: {
          communication: "Seu ritmo cai quando conversas difíceis ficam sem fechamento.",
          emotional: "Score médio, mas distância emocional mantém incerteza elevada.",
          stability: "Resultado misto reflete comportamento inconsistente após tensão.",
          clarity: "A incerteza cresce quando intenções seguem pouco claras.",
        },
        low: {
          communication: "Score baixo e conversas bloqueadas aceleram afastamento relacional.",
          emotional: "Baixa estabilidade e distância emocional drenam capacidade de reparo.",
          stability: "Seu resultado baixo mostra rupturas comportamentais após conflitos.",
          clarity: "Score baixo e sinais confusos mantêm dúvida constante.",
        },
      },
      in: null,
    };

    const dictionary = pool[locale] || pool.en;
    const selected =
      (dictionary[range] && dictionary[range][weakestArea]) ||
      (pool.en[range] && pool.en[range][weakestArea]) ||
      pool.en.mid.communication;
    return {
      sentence: selected,
      logic: {
        scoreRange: range,
        weakestArea,
      },
    };
  }

  function getOutcomeActionsContent(locale) {
    const map = {
      en: {
        heading: "What changes the outcome",
        highImpact: "High impact actions",
        mediumImpact: "Medium impact actions",
        lowImpact: "Low impact actions",
        whyLabel: "Why",
        changeLabel: "Change",
        high: {
          highImpact: [
            {
              title: "Close one unresolved loop every week",
              explanation: "Pick one recurring conflict and document a concrete decision with owner and deadline.",
              why: "Unresolved loops recreate uncertainty even when overall scores are high.",
              change: "Lowers variance and keeps gains from being reversed.",
            },
            {
              title: "Run a weekly trust evidence check",
              explanation: "List two promises made and whether each was fully completed by week end.",
              why: "Trust shifts on visible follow-through, not intention.",
              change: "Strengthens clarity and behavioral consistency together.",
            },
          ],
          mediumImpact: [
            {
              title: "Set a conflict timeout protocol",
              explanation: "When escalation starts, pause for 20 minutes and restart with one defined agenda item.",
              why: "Fast escalation destroys repair quality.",
              change: "Improves emotional regulation during pressure moments.",
            },
          ],
          lowImpact: [
            {
              title: "Reduce passive irritation signals",
              explanation: "Replace sarcasm or silent withdrawal with one direct sentence about the issue.",
              why: "Low-level hostility compounds over time.",
              change: "Prevents background tension from eroding progress.",
            },
          ],
        },
        mid: {
          highImpact: [
            {
              title: "Define red-line behaviors with immediate consequence",
              explanation: "Agree on 2-3 behaviors that are not acceptable and what happens if they repeat.",
              why: "Ambiguous limits keep unstable dynamics alive.",
              change: "Creates predictability and reduces defensive cycling.",
            },
            {
              title: "Install a 14-day repair sprint",
              explanation: "For two weeks, track one weak area daily with a yes/no completion rule.",
              why: "Mid profiles improve only when weak spots are operationalized.",
              change: "Turns abstract intent into measurable correction.",
            },
            {
              title: "Use fact-assumption separation before major talks",
              explanation: "Write what was observed versus what is inferred before entering difficult discussions.",
              why: "Inference-heavy conversations inflate conflict.",
              change: "Raises clarity and lowers misinterpretation cost.",
            },
          ],
          mediumImpact: [
            {
              title: "Schedule one structured check-in weekly",
              explanation: "30 minutes, fixed order: facts, impact, next step, deadline.",
              why: "Unstructured talks drift and reopen closed topics.",
              change: "Increases communication efficiency and follow-through.",
            },
          ],
          lowImpact: [
            {
              title: "Limit third-party influence",
              explanation: "Avoid making core relationship decisions from outside opinions in reactive states.",
              why: "External noise amplifies uncertainty.",
              change: "Keeps decisions tied to observed dynamics, not pressure.",
            },
          ],
        },
        low: {
          highImpact: [
            {
              title: "Set a 30-day stabilization contract",
              explanation: "Define minimum behavior standards and review compliance twice per week.",
              why: "Low profiles need immediate structure to stop decline.",
              change: "Prevents further drift and creates a baseline for re-evaluation.",
            },
            {
              title: "Stop ambiguity at source",
              explanation: "Any contradiction between words and actions must be addressed within 24 hours.",
              why: "Delayed confrontation normalizes distrust.",
              change: "Cuts uncertainty accumulation and clarifies intent.",
            },
            {
              title: "Decide on threshold-based continuation",
              explanation: "Set 2-3 measurable conditions required to continue the relationship after 6 weeks.",
              why: "Open-ended waiting increases emotional and cognitive cost.",
              change: "Restores agency and decision clarity.",
            },
          ],
          mediumImpact: [
            {
              title: "Reduce conflict channel width",
              explanation: "Discuss one issue at a time; block multi-topic escalation.",
              why: "Topic stacking overwhelms repair capacity.",
              change: "Improves focus and short-term regulation.",
            },
            {
              title: "Use written follow-up after hard talks",
              explanation: "Summarize agreements in writing immediately after discussion.",
              why: "Memory drift recreates disputes.",
              change: "Increases accountability and lowers reinterpretation.",
            },
          ],
          lowImpact: [
            {
              title: "Adjust non-critical logistics first",
              explanation: "Remove small recurring stressors in schedule and routines.",
              why: "It does not fix structural issues alone.",
              change: "Frees bandwidth for higher-impact interventions.",
            },
          ],
        },
      },
      pl: {
        heading: "Co zmienia wynik",
        highImpact: "Dzialania o wysokim wplywie",
        mediumImpact: "Dzialania o srednim wplywie",
        lowImpact: "Dzialania o nizszym wplywie",
        whyLabel: "Dlaczego",
        changeLabel: "Zmiana",
        high: {
          highImpact: [
            {
              title: "Domykaj jeden niedomkniety temat tygodniowo",
              explanation: "Wybierz jeden powracajacy konflikt i zapisz konkretna decyzje z odpowiedzialnoscia i terminem.",
              why: "Niedomkniete petle odtwarzaja niepewnosc mimo dobrego wyniku ogolnego.",
              change: "Zmniejsza rozrzut miedzy obszarami i stabilizuje trend.",
            },
            {
              title: "Wprowadz tygodniowy audyt dowodow zaufania",
              explanation: "Sprawdzaj dwie obietnice z tygodnia i czy zostaly domkniete w 100 procentach.",
              why: "Zaufanie przesuwa sie przez widoczny follow-through, nie przez deklaracje.",
              change: "Wzmacnia jednoczesnie klarownosc i spojność zachowan.",
            },
          ],
          mediumImpact: [
            {
              title: "Ustal protokol timeoutu w konflikcie",
              explanation: "Przy eskalacji robicie 20 minut przerwy i wracacie do jednego, jasno zdefiniowanego tematu.",
              why: "Szybka eskalacja psuje jakosc naprawy.",
              change: "Poprawia regulacje emocjonalna pod presja.",
            },
          ],
          lowImpact: [
            {
              title: "Ogranicz sygnaly pasywnej irytacji",
              explanation: "Zamiast sarkazmu lub wycofania padnie jedno bezposrednie zdanie o problemie.",
              why: "Niski poziom wrogosci kumuluje koszt relacji.",
              change: "Chroni postep przed cichym cofaniem.",
            },
          ],
        },
        mid: {
          highImpact: [
            {
              title: "Ustal czerwone linie z natychmiastowa konsekwencja",
              explanation: "Uzgodnijcie 2-3 zachowania nieakceptowalne i co dzieje sie po ich powtorzeniu.",
              why: "Niejasne granice podtrzymuja niestabilna dynamike.",
              change: "Buduje przewidywalnosc i zmniejsza defensywne petle.",
            },
            {
              title: "Uruchom 14-dniowy sprint naprawczy",
              explanation: "Przez dwa tygodnie monitorujcie codziennie najslabszy obszar wedlug reguly wykonane/niewykonane.",
              why: "Profil mid poprawia sie dopiero po operacyjnym domknieciu slabosci.",
              change: "Zamienia intencje na mierzalna korekte.",
            },
            {
              title: "Oddziel fakty od domyslow przed trudna rozmowa",
              explanation: "Przed rozmowa zapiszcie co bylo obserwowalne, a co jest interpretacja.",
              why: "Rozmowy oparte na domyslach podnosza koszt konfliktu.",
              change: "Podnosi klarownosc i obniza ryzyko blednej interpretacji.",
            },
          ],
          mediumImpact: [
            {
              title: "Wprowadz jeden strukturalny check-in tygodniowo",
              explanation: "30 minut, stala kolejnosc: fakty, wplyw, nastepny krok, termin.",
              why: "Niestrukturalne rozmowy rozmywaja decyzje i otwieraja zamkniete tematy.",
              change: "Zwiksza efektywnosc komunikacji i domykania ustalen.",
            },
          ],
          lowImpact: [
            {
              title: "Ogranicz reaktywny wplyw osob trzecich",
              explanation: "Nie podejmuj kluczowych decyzji relacyjnych pod naciskiem opinii z zewnatrz.",
              why: "Szum zewnetrzny zwieksza niepewnosc.",
              change: "Utrzymuje decyzje na danych z relacji, nie na presji otoczenia.",
            },
          ],
        },
        low: {
          highImpact: [
            {
              title: "Ustal 30-dniowy kontrakt stabilizacyjny",
              explanation: "Zdefiniuj minimum zachowan i sprawdzaj wykonanie dwa razy w tygodniu.",
              why: "Profil low wymaga szybkiej struktury, by zatrzymac spadek.",
              change: "Zatrzymuje dalszy dryf i tworzy baze do ponownej oceny.",
            },
            {
              title: "Ucinaj niejednoznacznosc u zrodla",
              explanation: "Kazda rozbieznosc miedzy slowami a zachowaniem jest adresowana maksymalnie w 24 godziny.",
              why: "Odwlekanie konfrontacji normalizuje brak zaufania.",
              change: "Zmniejsza narastanie niepewnosci i porzadkuje intencje.",
            },
            {
              title: "Ustal warunki kontynuacji oparte na progach",
              explanation: "Wyznacz 2-3 mierzalne warunki utrzymania relacji po 6 tygodniach.",
              why: "Otwarte czekanie zwieksza koszt emocjonalny i decyzyjny.",
              change: "Przywraca sprawczosc i jasnosc decyzji.",
            },
          ],
          mediumImpact: [
            {
              title: "Zwez kanal konfliktu",
              explanation: "Omawiajcie jeden temat naraz i blokujcie eskalacje wielotematyczna.",
              why: "Nakladanie tematow przeciąza zdolnosc naprawy.",
              change: "Poprawia fokus i krotkoterminowa regulacje.",
            },
            {
              title: "Stosuj pisemny follow-up po trudnych rozmowach",
              explanation: "Po rozmowie od razu zapiszcie uzgodnienia w krotkiej formie.",
              why: "Rozjazd pamieci odtwarza spory.",
              change: "Zwiksza odpowiedzialnosc i ogranicza reinterpretacje.",
            },
          ],
          lowImpact: [
            {
              title: "Najpierw usuń drobne stresory organizacyjne",
              explanation: "Zredukuj powtarzalne drobne obciazenia w planie dnia i logistyce.",
              why: "To samo nie naprawia problemu strukturalnego.",
              change: "Uwalnia zasoby na dzialania o duzym wplywie.",
            },
          ],
        },
      },
      de: {
        heading: "Was das Ergebnis verandert",
        highImpact: "Massnahmen mit hoher Wirkung",
        mediumImpact: "Massnahmen mit mittlerer Wirkung",
        lowImpact: "Massnahmen mit niedriger Wirkung",
        whyLabel: "Warum",
        changeLabel: "Veranderung",
        high: {
          highImpact: [
            {
              title: "Eine offene Schleife pro Woche konsequent schliessen",
              explanation: "Nehmt einen wiederkehrenden Konflikt und haltet eine klare Entscheidung mit Verantwortlichkeit und Frist fest.",
              why: "Offene Schleifen erzeugen Unsicherheit trotz hoher Gesamtwerte.",
              change: "Reduziert Streuung und stabilisiert den positiven Trend.",
            },
            {
              title: "Wöchentlichen Evidenz-Check für Vertrauen einführen",
              explanation: "Prüft zwei Zusagen aus der Woche und ob sie vollständig umgesetzt wurden.",
              why: "Vertrauen verschiebt sich durch sichtbare Verbindlichkeit, nicht durch Absicht.",
              change: "Stärkt Klarheit und Verhaltenskonsistenz gleichzeitig.",
            },
          ],
          mediumImpact: [
            {
              title: "Timeout-Protokoll für Eskalation festlegen",
              explanation: "Bei Eskalation 20 Minuten Pause, dann Neustart mit genau einem Agenda-Punkt.",
              why: "Schnelle Eskalation senkt die Qualität der Reparatur.",
              change: "Verbessert emotionale Regulation unter Druck.",
            },
          ],
          lowImpact: [
            {
              title: "Passive Gereiztheit aktiv reduzieren",
              explanation: "Sarkasmus oder Rückzug durch einen direkten Satz zum Problem ersetzen.",
              why: "Niedrige Feindseligkeit akkumuliert langfristig Schaden.",
              change: "Schützt Fortschritt vor schleichender Erosion.",
            },
          ],
        },
        mid: {
          highImpact: [
            {
              title: "Rote Linien mit sofortiger Konsequenz definieren",
              explanation: "Legt 2-3 nicht akzeptable Verhaltensweisen und die direkte Konsequenz bei Wiederholung fest.",
              why: "Unklare Grenzen halten instabile Dynamik am Leben.",
              change: "Erhöht Vorhersehbarkeit und reduziert Abwehrschleifen.",
            },
            {
              title: "14-Tage-Reparatursprint starten",
              explanation: "Über zwei Wochen täglich den schwächsten Bereich mit Ja/Nein-Regel tracken.",
              why: "Mid-Profile verbessern sich erst durch operative Korrektur der Schwäche.",
              change: "Macht Absicht messbar und überprüfbar.",
            },
            {
              title: "Fakten und Annahmen vor harten Gesprächen trennen",
              explanation: "Vor dem Gespräch schriftlich festhalten: beobachtete Fakten versus Interpretation.",
              why: "Annahmen erhöhen Konfliktkosten unnötig.",
              change: "Steigert Klarheit und senkt Fehlinterpretationen.",
            },
          ],
          mediumImpact: [
            {
              title: "Einen strukturierten Wochen-Check-in einplanen",
              explanation: "30 Minuten, feste Reihenfolge: Fakten, Wirkung, nächster Schritt, Frist.",
              why: "Unstrukturierte Gespräche öffnen geschlossene Themen neu.",
              change: "Erhöht Effizienz und Umsetzungsquote.",
            },
          ],
          lowImpact: [
            {
              title: "Einfluss Dritter in Reaktivität begrenzen",
              explanation: "Keine Kernentscheidungen unter externem Druck und emotionalem Peak treffen.",
              why: "Externer Lärm verstärkt Unsicherheit.",
              change: "Bindet Entscheidungen wieder an beobachtbare Daten.",
            },
          ],
        },
        low: {
          highImpact: [
            {
              title: "30-Tage-Stabilisierungsvertrag setzen",
              explanation: "Mindeststandards für Verhalten definieren und zweimal pro Woche auf Einhaltung prüfen.",
              why: "Low-Profile brauchen sofortige Struktur, um Abwärtstrend zu stoppen.",
              change: "Stoppt weiteren Drift und schafft Basis für Neubewertung.",
            },
            {
              title: "Mehrdeutigkeit sofort adressieren",
              explanation: "Jede Diskrepanz zwischen Worten und Verhalten innerhalb von 24 Stunden klären.",
              why: "Verzögerung normalisiert Misstrauen.",
              change: "Senkt Unsicherheitsaufbau und schärft Intentionen.",
            },
            {
              title: "Fortsetzung an Schwellenwerte koppeln",
              explanation: "2-3 messbare Bedingungen festlegen, die nach sechs Wochen erfüllt sein müssen.",
              why: "Offenes Warten erhöht emotionalen und kognitiven Preis.",
              change: "Stellt Handlungsmacht und Entscheidungsklarheit wieder her.",
            },
          ],
          mediumImpact: [
            {
              title: "Konfliktkanal verengen",
              explanation: "Nur ein Thema pro Gespräch und konsequentes Stoppen von Themen-Stapeln.",
              why: "Themenstapel überlasten Reparaturfähigkeit.",
              change: "Verbessert Fokus und Kurzzeitregulation.",
            },
            {
              title: "Schriftliches Follow-up nach schwierigen Gesprächen",
              explanation: "Absprachen direkt nach dem Gespräch kurz schriftlich bestätigen.",
              why: "Erinnerungsdrift erzeugt alte Streitpunkte neu.",
              change: "Erhöht Verbindlichkeit und reduziert Reinterpretation.",
            },
          ],
          lowImpact: [
            {
              title: "Kleine organisatorische Stressoren zuerst reduzieren",
              explanation: "Wiederkehrende Mikro-Belastungen in Alltag und Logistik entfernen.",
              why: "Allein löst das keine strukturellen Probleme.",
              change: "Schafft Kapazität für Maßnahmen mit hoher Wirkung.",
            },
          ],
        },
      },
      es: {
        heading: "Que cambia el resultado",
        highImpact: "Acciones de alto impacto",
        mediumImpact: "Acciones de impacto medio",
        lowImpact: "Acciones de bajo impacto",
        whyLabel: "Por que",
        changeLabel: "Cambio",
        high: {
          highImpact: [
            {
              title: "Cerrar una disputa abierta por semana",
              explanation: "Tomad un conflicto recurrente y dejad una decision concreta con responsable y fecha.",
              why: "Los bucles abiertos recrean incertidumbre incluso con buena media.",
              change: "Reduce variacion y sostiene la tendencia positiva.",
            },
            {
              title: "Aplicar revision semanal de evidencia de confianza",
              explanation: "Revisad dos compromisos de la semana y si se cumplieron al 100 por cien.",
              why: "La confianza cambia por cumplimiento visible, no por intencion.",
              change: "Refuerza claridad y consistencia conductual al mismo tiempo.",
            },
          ],
          mediumImpact: [
            {
              title: "Definir protocolo de pausa en escalada",
              explanation: "Si sube la tension, pausa de 20 minutos y retorno con una sola agenda.",
              why: "La escalada rapida reduce la calidad de reparacion.",
              change: "Mejora regulacion emocional bajo presion.",
            },
          ],
          lowImpact: [
            {
              title: "Reducir señales de irritacion pasiva",
              explanation: "Sustituid sarcasmo o retiro silencioso por una frase directa del problema.",
              why: "La hostilidad baja se acumula y desgasta.",
              change: "Evita que el progreso se erosione en segundo plano.",
            },
          ],
        },
        mid: {
          highImpact: [
            {
              title: "Fijar lineas rojas con consecuencia inmediata",
              explanation: "Acordad 2-3 conductas no aceptables y que pasa si se repiten.",
              why: "Los limites ambiguos sostienen dinamicas inestables.",
              change: "Aumenta previsibilidad y baja bucles defensivos.",
            },
            {
              title: "Lanzar sprint de reparacion de 14 dias",
              explanation: "Durante dos semanas, seguid a diario el area mas debil con regla si/no.",
              why: "Los perfiles medios mejoran cuando la correccion es operativa.",
              change: "Convierte intencion en ajuste medible.",
            },
            {
              title: "Separar hechos y suposiciones antes de conversaciones duras",
              explanation: "Escribid que fue observable y que es inferencia antes de hablar.",
              why: "Las suposiciones elevan el costo del conflicto.",
              change: "Sube claridad y reduce errores de lectura.",
            },
          ],
          mediumImpact: [
            {
              title: "Programar un check-in estructurado semanal",
              explanation: "30 minutos con orden fijo: hechos, impacto, siguiente paso, fecha limite.",
              why: "Las conversaciones sin estructura reabren temas cerrados.",
              change: "Mejora eficiencia y tasa de cumplimiento.",
            },
          ],
          lowImpact: [
            {
              title: "Limitar influencia externa en modo reactivo",
              explanation: "No tomar decisiones clave de pareja bajo presion de terceros.",
              why: "El ruido externo amplifica incertidumbre.",
              change: "Mantiene decisiones basadas en datos de la relacion.",
            },
          ],
        },
        low: {
          highImpact: [
            {
              title: "Crear contrato de estabilizacion de 30 dias",
              explanation: "Definid estandares minimos de conducta y revisad cumplimiento dos veces por semana.",
              why: "Los perfiles bajos necesitan estructura inmediata para frenar deterioro.",
              change: "Detiene deriva y crea base para reevaluacion.",
            },
            {
              title: "Cortar la ambiguedad en origen",
              explanation: "Toda contradiccion entre palabras y actos se aborda en 24 horas.",
              why: "La demora normaliza desconfianza.",
              change: "Reduce acumulacion de incertidumbre y aclara intencion.",
            },
            {
              title: "Condicionar continuidad a umbrales medibles",
              explanation: "Definid 2-3 condiciones cuantificables para continuar tras seis semanas.",
              why: "Esperar sin marco aumenta costo emocional y decisional.",
              change: "Recupera agencia y claridad de decision.",
            },
          ],
          mediumImpact: [
            {
              title: "Estrechar canal del conflicto",
              explanation: "Un tema por conversacion y bloqueo de escalada multi-tema.",
              why: "Acumular temas supera la capacidad de reparacion.",
              change: "Mejora foco y regulacion de corto plazo.",
            },
            {
              title: "Usar seguimiento escrito tras conversaciones dificiles",
              explanation: "Documentad acuerdos por escrito justo despues de hablar.",
              why: "La deriva de memoria reabre disputas.",
              change: "Aumenta responsabilidad y baja reinterpretacion.",
            },
          ],
          lowImpact: [
            {
              title: "Quitar primero estresores logisticos menores",
              explanation: "Eliminad pequenas fricciones repetidas en horarios y rutinas.",
              why: "Por si solo no corrige problemas estructurales.",
              change: "Libera energia para intervenciones de alto impacto.",
            },
          ],
        },
      },
      pt: {
        heading: "O que muda o resultado",
        highImpact: "Acoes de alto impacto",
        mediumImpact: "Acoes de impacto medio",
        lowImpact: "Acoes de baixo impacto",
        whyLabel: "Por que",
        changeLabel: "Mudanca",
        high: {
          highImpact: [
            {
              title: "Fechar um conflito recorrente por semana",
              explanation: "Escolham um conflito repetido e registrem decisao concreta com responsavel e prazo.",
              why: "Ciclos abertos recriam incerteza mesmo com media alta.",
              change: "Reduz variacao e sustenta o movimento positivo.",
            },
            {
              title: "Fazer revisao semanal de evidencias de confianca",
              explanation: "Verifiquem duas promessas da semana e se foram cumpridas por completo.",
              why: "Confianca muda por cumprimento visivel, nao por intencao.",
              change: "Fortalece clareza e consistencia comportamental.",
            },
          ],
          mediumImpact: [
            {
              title: "Definir protocolo de pausa para escalada",
              explanation: "Quando houver escalada, pausa de 20 minutos e retorno com uma unica pauta.",
              why: "Escalada rapida reduz qualidade de reparo.",
              change: "Melhora regulacao emocional sob pressao.",
            },
          ],
          lowImpact: [
            {
              title: "Reduzir sinais de irritacao passiva",
              explanation: "Troquem sarcasmo ou silencio por uma frase direta sobre o problema.",
              why: "Hostilidade de baixa intensidade acumula desgaste.",
              change: "Evita erosao silenciosa do progresso.",
            },
          ],
        },
        mid: {
          highImpact: [
            {
              title: "Definir linhas vermelhas com consequencia imediata",
              explanation: "Acordem 2-3 comportamentos inaceitaveis e a consequencia quando se repetirem.",
              why: "Limites ambiguos mantem dinamica instavel.",
              change: "Aumenta previsibilidade e reduz ciclos defensivos.",
            },
            {
              title: "Executar sprint de reparo de 14 dias",
              explanation: "Durante duas semanas, monitorem diariamente a area mais fraca com regra sim/nao.",
              why: "Perfil medio melhora quando a correcao vira rotina operacional.",
              change: "Transforma intencao em ajuste mensuravel.",
            },
            {
              title: "Separar fatos de suposicoes antes de conversas dificeis",
              explanation: "Escrevam o que foi observado e o que e inferencia antes da conversa.",
              why: "Suposicoes elevam custo de conflito.",
              change: "Aumenta clareza e reduz erro de interpretacao.",
            },
          ],
          mediumImpact: [
            {
              title: "Agendar um check-in estruturado semanal",
              explanation: "30 minutos com ordem fixa: fatos, impacto, proximo passo, prazo.",
              why: "Conversa sem estrutura reabre temas ja fechados.",
              change: "Melhora eficiencia e taxa de execucao.",
            },
          ],
          lowImpact: [
            {
              title: "Limitar influencia externa em estado reativo",
              explanation: "Evitem decisao central da relacao sob pressao de terceiros.",
              why: "Ruido externo amplia incerteza.",
              change: "Mantem decisao baseada em dados reais da relacao.",
            },
          ],
        },
        low: {
          highImpact: [
            {
              title: "Criar contrato de estabilizacao de 30 dias",
              explanation: "Definam padroes minimos de comportamento e revisem cumprimento duas vezes por semana.",
              why: "Perfil low exige estrutura imediata para conter queda.",
              change: "Interrompe deriva e cria base para reavaliacao.",
            },
            {
              title: "Eliminar ambiguidade na origem",
              explanation: "Toda contradicao entre fala e acao deve ser tratada em ate 24 horas.",
              why: "Atraso normaliza desconfianca.",
              change: "Reduz acumulacao de incerteza e esclarece intencao.",
            },
            {
              title: "Vincular continuidade a limites mensuraveis",
              explanation: "Definam 2-3 condicoes objetivas para continuidade apos seis semanas.",
              why: "Esperar sem criterio aumenta custo emocional e decisorio.",
              change: "Recupera agencia e clareza de decisao.",
            },
          ],
          mediumImpact: [
            {
              title: "Estreitar canal de conflito",
              explanation: "Um tema por conversa e bloqueio de escalada com varios assuntos.",
              why: "Empilhar temas sobrecarrega capacidade de reparo.",
              change: "Melhora foco e regulacao de curto prazo.",
            },
            {
              title: "Usar follow-up escrito apos conversas dificeis",
              explanation: "Registrem acordos por escrito imediatamente apos a conversa.",
              why: "Deriva de memoria reabre disputas.",
              change: "Aumenta responsabilizacao e reduz reinterpretacao.",
            },
          ],
          lowImpact: [
            {
              title: "Remover primeiro estressores logisticos menores",
              explanation: "Eliminem pequenas friccoes recorrentes na rotina e agenda.",
              why: "So isso nao resolve problema estrutural.",
              change: "Libera energia para acoes de maior impacto.",
            },
          ],
        },
      },
      in: null,
    };

    const base = map.en;
    const content = map[locale] || base;
    return {
      heading: content.heading,
      highImpact: content.highImpact,
      mediumImpact: content.mediumImpact,
      lowImpact: content.lowImpact,
      whyLabel: content.whyLabel || base.whyLabel,
      changeLabel: content.changeLabel || base.changeLabel,
      high: content.high || base.high,
      mid: content.mid || base.mid,
      low: content.low || base.low,
    };
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
      localStorage.setItem(LANG_KEY, pageLocale);
    } catch (e) {
      // Ignore storage issues.
    }
  }

  function redirectToLocale(locale) {
    const targetPath = LOCALE_PATHS[locale] || LOCALE_PATHS.en;
    const currentPath = window.location.pathname || "/";
    if (currentPath === targetPath) return;
    window.location.replace(`${targetPath}${window.location.search}${window.location.hash}`);
  }

  function detectBrowserLocale() {
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (let i = 0; i < langs.length; i += 1) {
      const tag = String(langs[i] || "").toLowerCase();
      const base = tag.split("-")[0] || "";
      if (base === "pl") return "pl";
      if (base === "de") return "de";
      if (base === "es") return "es";
      if (base === "pt") return "pt";
      if (base === "en") return "en";
    }
    return "en";
  }

  function isMainEntryPath(pathname) {
    return pathname === "/" || pathname === "/index.html";
  }

  async function initLocaleByLocation() {
    const path = (window.location.pathname || "").toLowerCase();
    const urlLocale = getLocaleFromPath(path);
    if (urlLocale) {
      setLang(urlLocale);
      return;
    }

    if (isMainEntryPath(path)) {
      const storedOnMain = getStoredLang();
      if (storedOnMain && LOCALE_PATHS[storedOnMain]) {
        setLang(storedOnMain);
        redirectToLocale(storedOnMain);
        return;
      }
      const browserLocale = detectBrowserLocale();
      setLang(browserLocale);
      if (browserLocale !== "en") {
        redirectToLocale(browserLocale);
      }
      return;
    }

    const storedLocale = getStoredLang();
    if (storedLocale) {
      setLang(storedLocale);
      return;
    }
    setLang("en");
  }

  function appendLangToStripeLinks() {
    const locale = getFlowLocale();
    const links = document.querySelectorAll(`a[href^="${STRIPE_LINK}"]`);
    const successPath = `success.html?lang=${encodeURIComponent(locale)}`;
    const cancelPath = getFlowPageUrl("result", locale);
    const successUrl = new URL(successPath, window.location.origin).toString();
    const cancelUrl = new URL(cancelPath, window.location.origin).toString();
    links.forEach((a) => {
      try {
        const url = new URL(a.getAttribute("href"), window.location.origin);
        url.searchParams.set("lang", locale);
        url.searchParams.set("success_url", successUrl);
        url.searchParams.set("cancel_url", cancelUrl);
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
    const progressPercent = document.getElementById("test-progress-percent");
    const progressHint = document.getElementById("test-progress-hint");
    const btnNext = document.getElementById("btn-next");
    const btnPrev = document.getElementById("btn-prev");
    const disclaimerEl = document.getElementById("test-disclaimer");
    const headerBackLink = document.querySelector(".test-header-tools .btn");

    if (!root || !form || !progressBar || !stepLabel || !btnNext || !btnPrev) return;

    const locale = getTestLocale();
    const logoLink = document.querySelector(".site-header .logo");
    const allQuestions = buildQuestionList(locale);
    const sessionQuestions = getSessionQuestions(allQuestions, locale);
    const uiCopy = TEST_UI_COPY[locale] || TEST_UI_COPY.en;

    document.documentElement.lang = locale;
    document.title = uiCopy.title;
    if (disclaimerEl) disclaimerEl.textContent = uiCopy.disclaimer;
    if (headerBackLink) {
      headerBackLink.textContent = uiCopy.backHome;
      headerBackLink.setAttribute("href", LOCALE_PATHS[locale] || LOCALE_PATHS.en);
    }
    if (logoLink) {
      logoLink.setAttribute("href", LOCALE_PATHS[locale] || LOCALE_PATHS.en);
    }

    /** @type {number[]} odpowiedzi 1–5 na indeks pytania */
    const answers = new Array(sessionQuestions.length).fill(null);
    let index = 0;

    function getProgressHintText(step) {
      if (step <= 3) return uiCopy.progressHints.early;
      if (step <= 7) return uiCopy.progressHints.mid;
      return uiCopy.progressHints.late;
    }

    function animateQuestionSwap(nextIndex) {
      root.classList.add("question-card--leaving");
      window.setTimeout(() => {
        index = nextIndex;
        render();
      }, 120);
    }

    function render() {
      const q = sessionQuestions[index];
      const total = sessionQuestions.length;
      const step = index + 1;

      progressBar.style.width = `${(step / total) * 100}%`;
      stepLabel.textContent = uiCopy.stepLabel(step, total);
      if (progressPercent) progressPercent.textContent = `${Math.round((step / total) * 100)}%`;
      if (progressHint) progressHint.textContent = getProgressHintText(step);
      if (disclaimerEl) disclaimerEl.textContent = uiCopy.disclaimer;

      const selected = answers[index];
      root.innerHTML = `
        <p class="question-card__section">${escapeHtml(q.sectionTitle)}</p>
        <p class="question-card__text">${escapeHtml(q.text)}</p>
        <div class="scale-horizontal" role="radiogroup" aria-label="${escapeHtml(uiCopy.scaleAria)}">
          <div class="scale-row scale-row--buttons">
            ${[1, 2, 3, 4, 5]
              .map(
                (val) => `
              <div class="scale-cell">
                <div class="scale-option">
                  <input type="radio" name="scale" id="s${val}" value="${val}" ${selected === val ? "checked" : ""} />
                  <label for="s${val}">${val}</label>
                </div>
              </div>
            `
              )
              .join("")}
          </div>
          <div class="scale-row scale-row--labels" aria-hidden="true">
            ${[1, 2, 3, 4, 5]
              .map(
                (val) => `
              <div class="scale-cell">
                <span class="scale-label">${escapeHtml(uiCopy.scaleLabels[val])}</span>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
        <p class="scale-micro">${escapeHtml(uiCopy.micro)}</p>
      `;

      btnPrev.hidden = false;
      btnPrev.textContent = index === 0 ? uiCopy.backHome : uiCopy.back;
      btnNext.textContent = index === total - 1 ? uiCopy.seeResult : uiCopy.next;
      btnNext.disabled = selected == null;

      root.classList.remove("reveal", "is-visible", "question-card--leaving");
      void root.offsetWidth;
      root.classList.add("reveal", "is-visible");
      window.setTimeout(() => {
        root.classList.remove("question-card--selected-pulse");
      }, 220);

      root.querySelectorAll('input[name="scale"]').forEach((input) => {
        input.addEventListener("change", () => {
          answers[index] = parseInt(input.value, 10);
          btnNext.disabled = false;
          root.classList.remove("question-card--selected-pulse");
          void root.offsetWidth;
          root.classList.add("question-card--selected-pulse");
        });
      });
    }

    function goNext() {
      if (answers[index] == null) {
        flashInvalid();
        return;
      }
      if (index < sessionQuestions.length - 1) {
        animateQuestionSwap(index + 1);
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
      animateQuestionSwap(index - 1);
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
      clearPaidFlag();
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

  function getPaywallTeasers(locale, score, areaScores) {
    const weakestArea = getWeakestAreaKey(areaScores);
    const weakestScore = Math.round(
      weakestArea === "communication"
        ? areaScores.communication
        : weakestArea === "emotional"
          ? areaScores.emotional
          : weakestArea === "stability"
            ? areaScores.behavior
            : areaScores.trust
    );
    const clarityScore = Math.round(areaScores.trust);
    const map = {
      en: {
        area: {
          communication: "communication",
          emotional: "emotional safety",
          stability: "stability",
          clarity: "clarity",
        },
        line1: score >= 70 ? "Detected pattern: high score with hidden pressure point." : "Detected pattern: recurring uncertainty loop.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Clarity score below average. Hidden intent risk detected."
            : "Clarity score near average. One signal still stays unresolved.",
        line3: `Weakest area: ${weakestArea}. Current level: ${weakestScore}/100.`,
      },
      pl: {
        area: {
          communication: "komunikacja",
          emotional: "bezpieczenstwo emocjonalne",
          stability: "stabilnosc",
          clarity: "klarownosc",
        },
        line1: score >= 70 ? "Wykryty wzorzec: wysoki wynik z ukrytym punktem nacisku." : "Wykryty wzorzec: powtarzajaca sie petla niepewnosci.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Wynik klarownosci ponizej sredniej. Wysokie ryzyko blednej oceny."
            : "Wynik klarownosci blisko sredniej. Jeden sygnal nadal nie jest domkniety.",
        line3: `Najsłabszy obszar: ${weakestArea}. Biezacy poziom: ${weakestScore}/100.`,
      },
      de: {
        area: {
          communication: "Kommunikation",
          emotional: "emotionale Sicherheit",
          stability: "Stabilität",
          clarity: "Klarheit",
        },
        line1: score >= 70 ? "Erkanntes Muster: hoher Score mit verdecktem Druckpunkt." : "Erkanntes Muster: wiederkehrende Unsicherheitsschleife.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Klarheitswert unter Durchschnitt. Erhöhtes Fehlinterpretationsrisiko."
            : "Klarheitswert nahe Durchschnitt. Ein Signal bleibt offen.",
        line3: `Schwächster Bereich: ${weakestArea}. Aktuelles Niveau: ${weakestScore}/100.`,
      },
      es: {
        area: {
          communication: "comunicacion",
          emotional: "seguridad emocional",
          stability: "estabilidad",
          clarity: "claridad",
        },
        line1: score >= 70 ? "Patron detectado: puntaje alto con punto de presion oculto." : "Patron detectado: ciclo recurrente de incertidumbre.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Claridad por debajo del promedio. Riesgo alto de lectura incorrecta."
            : "Claridad cerca del promedio. Una señal sigue sin cierre.",
        line3: `Area mas debil: ${weakestArea}. Nivel actual: ${weakestScore}/100.`,
      },
      pt: {
        area: {
          communication: "comunicacao",
          emotional: "seguranca emocional",
          stability: "estabilidade",
          clarity: "clareza",
        },
        line1: score >= 70 ? "Padrao detectado: score alto com ponto de pressao oculto." : "Padrao detectado: ciclo recorrente de incerteza.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Clareza abaixo da media. Risco elevado de interpretacao incorreta."
            : "Clareza perto da media. Um sinal permanece sem fechamento.",
        line3: `Area mais fraca: ${weakestArea}. Nivel atual: ${weakestScore}/100.`,
      },
      in: null,
    };
    const lang = map[locale] || map.en;
    const weakestLabel = lang.area[weakestArea] || lang.area.communication;
    return [lang.line1, lang.line2, lang.line3.replace(weakestArea, weakestLabel)];
  }

  function localizeResultPageUi(locale) {
    const lang = RESULT_LAYOUT_UI[locale] ? locale : "en";
    const ui = RESULT_LAYOUT_UI[lang];
    const chrome = PAGE_CHROME_UI[lang] || PAGE_CHROME_UI.en;
    document.title = chrome.resultPageTitle;
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
    setText("paywall-emotional-hook", ui.paywallHook);
    setText("paywall-score-label", ui.scoreLabel);
    setText("locked-title-1", ui.lockedTitles[0]);
    setText("locked-title-2", ui.lockedTitles[1]);
    setText("locked-title-3", ui.lockedTitles[2]);
    setText("locked-label-1", ui.lockedLabel);
    setText("locked-label-2", ui.lockedLabel);
    setText("locked-label-3", ui.lockedLabel);
    setText("preview-bar-label-1", ui.previewLabels[0]);
    setText("preview-bar-label-2", ui.previewLabels[1]);
    setText("preview-bar-label-3", ui.previewLabels[2]);
    setText("preview-bar-label-4", ui.previewLabels[3]);
    setText("locked-preview-label", ui.previewOverlay);
    setText("premium-value-heading", ui.valueHeading);
    setText("premium-value-item-1", ui.valueItems[0]);
    setText("premium-value-item-2", ui.valueItems[1]);
    setText("premium-value-item-3", ui.valueItems[2]);
    setText("premium-value-item-4", ui.valueItems[3]);
    setText("premium-value-item-5", ui.valueItems[4]);
    setText("premium-price-line", ui.priceLine);
    setText("premium-cta", ui.ctaButton);
    setText("premium-note-1", ui.notes[0]);
    setText("premium-note-2", ui.notes[1]);
    setText("premium-note-3", ui.notes[2]);
    setText("result-signal-line", ui.disclaimer);
    setText("result-donut-label", chrome.donutLabel);
    setText("result-footer-home-link", chrome.homeLink);
    setText("result-footer-retake-link", chrome.retakeLink);
    setText("result-footer-note-primary", chrome.footerInfo);
    setText("result-footer-note-disclaimer", chrome.footerDisclaimer);
    const homeLink = document.getElementById("result-footer-home-link");
    const retakeLink = document.getElementById("result-footer-retake-link");
    if (homeLink) homeLink.setAttribute("href", LOCALE_PATHS[lang] || LOCALE_PATHS.en);
    if (retakeLink) retakeLink.setAttribute("href", getFlowPageUrl("test", lang));
  }

  function localizeReportPageUi(locale) {
    const uiMap = {
      en: {
        eyebrow: "Premium relationship report",
        title: "Full relationship analysis",
        indexLabel: "Trust Index:",
        subhead:
          "This report turns your answers into a structured diagnosis of pressure points, stability, and next decisions.",
        overview: "Core dimensions",
        charts: "Score overview and chart",
        chartNote:
          "The chart shows where pressure is concentrated and where your relationship still has structural support.",
        scale: ["Low uncertainty", "Medium uncertainty", "High uncertainty"],
        areas: ["Communication", "Stability", "Clarity", "Emotional closeness"],
        comm: "Communication",
        emotional: "Emotional closeness",
        stability: "Stability",
        clarity: "Clarity",
        pattern: "Recurring pattern",
        meaning: "Overall meaning",
        next: "Practical next steps",
        recheck: "Track change in 2-3 weeks",
        recheckCta: "Run scan again",
        back: "Back to result",
      },
      pl: {
        eyebrow: "Raport premium relacji",
        title: "Pelna analiza relacji",
        indexLabel: "Trust Index:",
        subhead:
          "Ten raport zamienia odpowiedzi w uporzadkowana diagnoze punktow nacisku, stabilnosci i kolejnych decyzji.",
        overview: "Kluczowe wymiary",
        charts: "Przeglad wyniku i wykres",
        chartNote:
          "Wykres pokazuje, gdzie kumuluje sie nacisk i gdzie relacja ma jeszcze stabilne fundamenty.",
        scale: ["Niska niepewnosc", "Srednia niepewnosc", "Wysoka niepewnosc"],
        areas: ["Komunikacja", "Stabilnosc", "Klarownosc", "Bliskosc emocjonalna"],
        comm: "Komunikacja",
        emotional: "Bliskosc emocjonalna",
        stability: "Stabilnosc",
        clarity: "Klarownosc",
        pattern: "Powtarzajacy sie wzorzec",
        meaning: "Znaczenie calego obrazu",
        next: "Praktyczne kolejne kroki",
        recheck: "Sprawdz zmiane za 2-3 tygodnie",
        recheckCta: "Powtorz skan",
        back: "Wroc do wyniku",
      },
      de: {
        eyebrow: "Premium-Beziehungsbericht",
        title: "Vollständige Beziehungsanalyse",
        indexLabel: "Trust Index:",
        subhead:
          "Dieser Bericht übersetzt deine Antworten in eine klare Struktur aus Druckpunkten, Stabilität und nächsten Entscheidungen.",
        overview: "Kern-Dimensionen",
        charts: "Score-Übersicht und Diagramm",
        chartNote:
          "Das Diagramm zeigt, wo Druck sitzt und wo die Beziehung noch tragende Stabilität hat.",
        scale: ["Niedrige Unsicherheit", "Mittlere Unsicherheit", "Hohe Unsicherheit"],
        areas: ["Kommunikation", "Stabilität", "Klarheit", "Emotionale Nähe"],
        comm: "Kommunikation",
        emotional: "Emotionale Nähe",
        stability: "Stabilität",
        clarity: "Klarheit",
        pattern: "Wiederkehrendes Muster",
        meaning: "Gesamtbedeutung",
        next: "Praktische nächste Schritte",
        recheck: "Veränderung in 2-3 Wochen messen",
        recheckCta: "Scan erneut starten",
        back: "Zurück zum Ergebnis",
      },
      es: {
        eyebrow: "Informe premium de relacion",
        title: "Analisis completo de la relacion",
        indexLabel: "Trust Index:",
        subhead:
          "Este informe convierte tus respuestas en un mapa claro de presion, estabilidad y decisiones practicas.",
        overview: "Dimensiones clave",
        charts: "Resumen de puntuacion y grafico",
        chartNote:
          "El grafico muestra donde se concentra la presion y donde aun existe soporte estable.",
        scale: ["Incertidumbre baja", "Incertidumbre media", "Incertidumbre alta"],
        areas: ["Comunicacion", "Estabilidad", "Claridad", "Cercania emocional"],
        comm: "Comunicacion",
        emotional: "Cercania emocional",
        stability: "Estabilidad",
        clarity: "Claridad",
        pattern: "Patron recurrente",
        meaning: "Significado global",
        next: "Siguientes pasos practicos",
        recheck: "Mide el cambio en 2-3 semanas",
        recheckCta: "Repetir scan",
        back: "Volver al resultado",
      },
      pt: {
        eyebrow: "Relatorio premium de relacionamento",
        title: "Analise completa do relacionamento",
        indexLabel: "Trust Index:",
        subhead:
          "Este relatorio transforma suas respostas em um quadro claro de pressao, estabilidade e proximas decisoes.",
        overview: "Dimensoes centrais",
        charts: "Visao de pontuacao e grafico",
        chartNote:
          "O grafico mostra onde a pressao se concentra e onde ainda existe base estavel.",
        scale: ["Baixa incerteza", "Media incerteza", "Alta incerteza"],
        areas: ["Comunicacao", "Estabilidade", "Clareza", "Proximidade emocional"],
        comm: "Comunicacao",
        emotional: "Proximidade emocional",
        stability: "Estabilidade",
        clarity: "Clareza",
        pattern: "Padrao recorrente",
        meaning: "Significado geral",
        next: "Proximos passos praticos",
        recheck: "Acompanhe mudanca em 2-3 semanas",
        recheckCta: "Refazer scan",
        back: "Voltar ao resultado",
      },
      in: null,
    };
    const ui = uiMap[locale] || uiMap.en;
    const chrome = PAGE_CHROME_UI[locale] || PAGE_CHROME_UI.en;
    document.title = chrome.reportPageTitle;
    setText("report-eyebrow", ui.eyebrow);
    setText("report-title", ui.title);
    setText("report-index-label", ui.indexLabel);
    setText("report-subhead", ui.subhead);
    setText("report-overview-title", ui.overview);
    setText("report-score-overview-title", ui.charts);
    setText("report-chart-note", ui.chartNote);
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
    setText("report-comm-heading", ui.comm);
    setText("report-emotion-heading", ui.emotional);
    setText("report-stability-heading", ui.stability);
    setText("report-clarity-heading", ui.clarity);
    setText("report-pattern-heading", ui.pattern);
    setText("report-meaning-heading", ui.meaning);
    setText("report-next-heading", ui.next);
    setText("report-recheck-heading", ui.recheck);
    setText("report-recheck-cta", ui.recheckCta);
    const benchmarkUi = getBenchmarkLabels(locale);
    const alertsUi = getRiskAlertLabels(locale);
    const trajectoryUi = getTrajectoryContent(locale);
    const timelineUi = getTimelineContent(locale);
    const outcomeUi = getOutcomeActionsContent(locale);
    setText("report-benchmark-heading", benchmarkUi.heading);
    setText("report-alerts-heading", alertsUi.heading);
    setText("report-trajectory-heading", trajectoryUi.heading);
    setText("report-timeline-heading", timelineUi.heading);
    setText("report-outcome-heading", outcomeUi.heading);
    setText("report-disclaimer-text", RESULT_SIGNAL_LINE_BY_LOCALE[locale] || RESULT_SIGNAL_LINE_BY_LOCALE.en);
    setText("report-back-link", ui.back);
    setText("report-donut-label", chrome.donutLabel);
    setText("report-footer-home-link", chrome.homeLink);
    setText("report-footer-note-disclaimer", chrome.footerDisclaimer);
    const reportBackLink = document.getElementById("report-back-link");
    const reportHomeLink = document.getElementById("report-footer-home-link");
    if (reportBackLink) reportBackLink.setAttribute("href", getFlowPageUrl("result", locale));
    if (reportHomeLink) reportHomeLink.setAttribute("href", LOCALE_PATHS[locale] || LOCALE_PATHS.en);
  }

  // --- Wynik: odczyt localStorage i wypełnienie DOM ---
  function initResult() {
    const locale = getFlowLocale();
    const logoLink = document.querySelector(".site-header .logo");
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
    const ctaBlock = document.getElementById("premium-block");
    const personalizedEl = document.getElementById("paywall-personalized-sentence");
    const paywallScoreValueEl = document.getElementById("paywall-score-value");
    if (!scoreEl || !headlineEl || !leadEl || !interpEl || !insightsEl || !tipsEl) return;

    document.documentElement.lang = locale;
    localizeResultPageUi(locale);
    if (logoLink) logoLink.setAttribute("href", LOCALE_PATHS[locale] || LOCALE_PATHS.en);

    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }
    if (raw === null || raw === "") {
      scoreEl.textContent = "—";
      const chrome = PAGE_CHROME_UI[locale] || PAGE_CHROME_UI.en;
      headlineEl.textContent = chrome.noResultTitle;
      leadEl.textContent = chrome.noResultBody;
      interpEl.innerHTML = "";
      insightsEl.innerHTML = "";
      tipsEl.innerHTML = "";
      return;
    }

    const score = Math.max(0, Math.min(100, parseInt(raw, 10)));
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
    const areaScores = {
      communication: Math.max(0, Math.min(100, Number(details.areas.communication || score))),
      emotional: Math.max(0, Math.min(100, Number(details.areas.emotional || details.areas.emotions || score))),
      behavior: Math.max(0, Math.min(100, Number(details.areas.behavior || score))),
      trust: Math.max(0, Math.min(100, Number(details.areas.trust || score))),
    };
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
    if (paywallScoreValueEl) paywallScoreValueEl.textContent = `${score}/100`;
    if (personalizedEl) {
      const insight = getPersonalizedInsightSentence(locale, score, areaScores);
      personalizedEl.textContent = insight.sentence;
    }

    const previewValues = {
      communication: Math.round(areaScores.communication),
      stability: Math.round(areaScores.behavior),
      transparency: Math.round(areaScores.trust),
      emotional: Math.round(areaScores.emotional),
    };
    setText("preview-bar-value-1", `${previewValues.communication}`);
    setText("preview-bar-value-2", `${previewValues.stability}`);
    const barFill1 = document.getElementById("preview-bar-fill-1");
    const barFill2 = document.getElementById("preview-bar-fill-2");
    const barFill3 = document.getElementById("preview-bar-fill-3");
    const barFill4 = document.getElementById("preview-bar-fill-4");
    if (barFill1) barFill1.style.width = `${previewValues.communication}%`;
    if (barFill2) barFill2.style.width = `${previewValues.stability}%`;
    if (barFill3) barFill3.style.width = `${previewValues.transparency}%`;
    if (barFill4) barFill4.style.width = `${previewValues.emotional}%`;

    const teaserLines = getPaywallTeasers(locale, score, areaScores);
    setText("locked-teaser-1", teaserLines[0]);
    setText("locked-teaser-2", teaserLines[1]);
    setText("locked-teaser-3", teaserLines[2]);

    const isPaid = readPaidFlag();

    if (isPaid) {
      window.location.href = getFlowPageUrl("report", locale);
      return;
    }

    if (ctaBlock) ctaBlock.hidden = false;
  }

  function initSuccess() {
    syncPaidFromStripeReturnUrl();
    const queryLang = getQueryLang();
    if (queryLang) setLang(queryLang);
    const locale = getFlowLocale();
    document.documentElement.lang = locale;

    const copyByLocale = {
      en: {
        title: "Payment confirmed",
        body: "Finalizing access to your full report...",
      },
      pl: {
        title: "Platnosc potwierdzona",
        body: "Finalizujemy dostep do pelnego raportu...",
      },
      de: {
        title: "Zahlung bestätigt",
        body: "Der Zugriff auf den Vollbericht wird vorbereitet...",
      },
      es: {
        title: "Pago confirmado",
        body: "Estamos finalizando tu acceso al informe completo...",
      },
      pt: {
        title: "Pagamento confirmado",
        body: "Finalizando seu acesso ao relatorio completo...",
      },
      in: {
        title: "Payment confirmed",
        body: "Finalizing access to your full report...",
      },
    };
    const ui = copyByLocale[locale] || copyByLocale.en;
    const chrome = PAGE_CHROME_UI[locale] || PAGE_CHROME_UI.en;
    document.title = chrome.successPageTitle;
    setText("success-title", ui.title);
    setText("success-body", ui.body);

    writePaidFlag();

    window.setTimeout(() => {
      window.location.href = getFlowPageUrl("report", locale);
    }, 700);
  }

  function getPremiumReportNarrative(locale) {
    const map = {
      en: {
        opening:
          "You are looking at the full structure behind your result. This is not a mood snapshot. It is a pressure map showing where the relationship absorbs tension and where it leaks stability. The goal is practical clarity before decisions.",
        benchmarkNote:
          "Above average means this area currently supports stability. Below average means this area is pulling your overall direction down.",
        dimensions: {
          communication: {
            body:
              "Communication in this profile is not defined by how often you talk, but by what happens after difficult moments. Stable communication closes loops. Unstable communication keeps loops open and pushes unresolved meaning into the next conversation. When closure is missing, every new topic starts with hidden backlog. That creates defensive tone, fragmented focus, and rising decision fatigue. The practical cost is high: both partners start reacting to assumptions rather than facts. In this report, communication should be read as operational reliability. If conversations produce concrete decisions, clear responsibilities, and visible follow-through, uncertainty falls quickly. If they produce temporary relief without structural closure, uncertainty compounds even when tone sounds calm.",
            checks: [
              "Check whether one difficult topic gets closed with one concrete decision.",
              "Check whether both sides can repeat the same agreement 24 hours later.",
              "Check whether conflict reopens old themes or stays within one scope.",
            ],
          },
          emotional: {
            body:
              "Emotional closeness here is not about intensity. It is about consistency of emotional availability under ordinary pressure. A relationship can look warm in isolated moments and still feel unsafe in repeated stress windows. When emotional availability drops unpredictably, interpretation load rises and small events feel threatening. That shift changes behavior: less directness, more withdrawal, and slower repair after friction. In practical terms, emotional closeness determines how expensive each conflict becomes. Higher closeness keeps conflict costs contained. Lower closeness turns even moderate tension into prolonged uncertainty. This section should be read as your regulation base: if emotional contact remains accessible during pressure, recovery cycles shorten. If access collapses during pressure, recovery becomes unstable and trust erosion accelerates.",
            checks: [
              "Check whether support is available during stress, not only after stress.",
              "Check whether disagreement leads to distance or to re-engagement.",
              "Check whether repair happens within hours or drifts across days.",
            ],
          },
          stability: {
            body:
              "Stability in this report tracks behavioral consistency across time. Words matter, but repeated behavior defines trust capacity. When behavior patterns remain predictable, the relationship can plan, coordinate, and absorb uncertainty from outside pressures. When behavior shifts without explanation, internal uncertainty rises even if intentions sound positive. The central issue is not perfection. The issue is reliability under repetition. One-off effort does not stabilize the system if weekly behavior keeps diverging from stated agreements. Stability also controls escalation speed: inconsistent routines increase surprise, and surprise increases reactivity. A stable pattern lowers surprise and protects decision quality. Read this area as execution quality: do commitments survive normal friction, calendar pressure, and emotional noise, or do they collapse when pressure appears.",
            checks: [
              "Check whether promised actions happen without repeated reminders.",
              "Check whether daily routines align with declared priorities.",
              "Check whether follow-through remains stable across two full weeks.",
            ],
          },
          clarity: {
            body:
              "Clarity measures how much of the relationship must be guessed versus directly verified. Low clarity forces interpretation. High clarity allows direct decisions. When intent, boundaries, and expectations stay ambiguous, both partners spend energy decoding signals instead of solving issues. That decoding cost accumulates into mistrust, because neutral events get read through uncertainty filters. Clarity does not require overexplaining every emotion. It requires explicit agreements in high-impact zones: commitment, boundaries, priorities, and repair rules. In this profile, clarity is a leverage dimension. Improving it often reduces pressure in multiple areas at once. Weak clarity amplifies every other weakness. Strong clarity limits error, reduces emotional overreaction, and improves coordination speed. This is where decision confidence is either built or undermined.",
            checks: [
              "Check whether boundaries are explicit and referenced in real decisions.",
              "Check whether intent is stated directly before sensitive conversations.",
              "Check whether both sides know what counts as real repair.",
            ],
          },
        },
        pattern:
          "The data shows a repeating cycle, not isolated noise. Pressure rises in one weak area, then spreads into communication and interpretation. Conversations create temporary relief, but unresolved structure returns in the next stress window. This produces a stop-start dynamic: short improvements followed by familiar friction. Confidence drops because outcomes feel inconsistent. Decision quality drops because attention shifts to immediate relief. The key pattern is imbalance between signal strength and execution quality. Strong moments exist, but weak areas still dictate overall direction. Without targeted correction, the same cycle repeats with higher emotional cost.",
        meaning:
          "The full picture is clear: this relationship is not defined by one dramatic event, but by repeated structure under pressure. Your strongest areas can still support recovery. Your weakest areas are currently setting the risk ceiling. If you improve only tone, the system remains unstable. If you improve structure, tone follows. The practical meaning is leverage. You do not need to fix everything at once. You need to fix the few mechanisms that keep rebuilding uncertainty.",
        recheck:
          "Run the scan again in 2-3 weeks after applying concrete changes. Compare movement in the weakest area first, then check if variance between dimensions narrows. Progress is real when score improves and structure becomes more even.",
      },
      pl: {
        opening:
          "Patrzysz na pelna strukture stojaca za wynikiem. To nie jest opis nastroju z jednego dnia. To mapa nacisku pokazujaca, gdzie relacja utrzymuje stabilnosc, a gdzie ja traci. Celem jest jasnosc przed decyzja.",
        benchmarkNote:
          "Powyzej sredniej oznacza, ze ten obszar wspiera stabilnosc. Ponizej sredniej oznacza, ze ten obszar obniza caly kierunek relacji.",
        dimensions: {
          communication: {
            body:
              "Komunikacja w tym profilu nie jest mierzona tym, jak czesto rozmawiacie, tylko tym, co dzieje sie po trudnej rozmowie. Stabilna komunikacja domyka petle. Niestabilna komunikacja zostawia petle otwarte i przenosi niedomkniete znaczenia do kolejnych tematow. Gdy domkniecia brakuje, kazda nowa rozmowa startuje z ukrytym zaleglym napieciem. To buduje defensywny ton, rozproszenie i zmeczenie decyzyjne. Koszt jest praktyczny: rosnie liczba domyslow, spada liczba faktow. W tym raporcie komunikacja to jakosc wykonania ustalen. Jezeli rozmowy prowadza do konkretnych decyzji, odpowiedzialnosci i widocznego follow-through, niepewnosc spada. Jezeli daja tylko chwilowe uspokojenie, niepewnosc wraca szybciej i mocniej.",
            checks: [
              "Sprawdz, czy trudny temat konczy sie jedna konkretna decyzja.",
              "Sprawdz, czy obie strony powtarzaja to samo ustalenie po 24 godzinach.",
              "Sprawdz, czy konflikt trzyma jeden temat, czy wraca do starych petli.",
            ],
          },
          emotional: {
            body:
              "Bliskosc emocjonalna nie oznacza stalej intensywnosci. Oznacza stabilna dostepnosc emocjonalna pod normalna presja. Relacja moze miec cieple momenty i jednoczesnie byc niestabilna przy powtarzalnym stresie. Gdy dostepnosc spada nierowno, rosnie koszt interpretacji i nawet male sygnaly zaczynaja byc czytane jako zagrozenie. To zmienia zachowanie: mniej bezposredniosci, wiecej wycofania i wolniejsza naprawa po tarciu. W praktyce bliskosc emocjonalna decyduje, jak drogi staje sie konflikt. Wyzsza bliskosc skraca czas naprawy. Nizsza bliskosc wydluza niepewnosc i obciaza zaufanie. Traktuj ten obszar jako baze regulacji: jesli kontakt jest dostepny pod presja, relacja szybciej wraca do rownowagi.",
            checks: [
              "Sprawdz, czy wsparcie jest dostepne w trakcie stresu, nie tylko po nim.",
              "Sprawdz, czy niezgoda prowadzi do dialogu, czy do dystansu.",
              "Sprawdz, czy naprawa dzieje sie w godzinach, czy w dniach.",
            ],
          },
          stability: {
            body:
              "Stabilnosc opisuje spojnosc zachowan w czasie. Slowa sa wazne, ale to powtarzalne zachowanie buduje zdolnosc do zaufania. Gdy wzorce zachowan sa przewidywalne, relacja moze planowac i utrzymywac spokoj mimo presji zewnętrznej. Gdy zachowanie zmienia sie bez jasnego wyjasnienia, rosnie wewnetrzna niepewnosc nawet przy dobrych deklaracjach. Kluczowy problem to nie idealnosc, tylko powtarzalna wiarygodnosc. Jednorazowy wysilek nie stabilizuje systemu, jesli cotygodniowe zachowanie pozostaje niespojne z ustaleniami. Stabilnosc kontroluje tez tempo eskalacji: niespodzianka podnosi reaktywnosc. Spojnosc obniza niespodzianke i chroni jakosc decyzji. Czytaj ten obszar jako jakosc wykonania: czy zobowiazania przechodza przez normalne tarcie.",
            checks: [
              "Sprawdz, czy obietnice sa realizowane bez wielokrotnego przypominania.",
              "Sprawdz, czy codzienne nawyki zgadzaja sie z deklarowanymi priorytetami.",
              "Sprawdz, czy follow-through utrzymuje sie przez dwa pelne tygodnie.",
            ],
          },
          clarity: {
            body:
              "Klarownosc mierzy, ile w relacji trzeba zgadywac, a ile mozna weryfikowac bezposrednio. Niska klarownosc wymusza domysly. Wysoka klarownosc pozwala podejmowac decyzje bez nadmiaru interpretacji. Gdy intencje, granice i oczekiwania sa niejasne, energia idzie w odszyfrowywanie sygnalow zamiast rozwiazywanie problemu. Ten koszt kumuluje sie i oslabia zaufanie, bo neutralne sytuacje zaczynaja wygladac jak zagrozenie. Klarownosc nie wymaga dlugich wyjasnien do kazdego tematu. Wymaga jawnych ustalen tam, gdzie koszt bledu jest najwyzszy: granice, priorytety i zasady naprawy. To obszar dzwigni. Poprawa klarownosci czesto obniza nacisk w kilku wymiarach naraz i porzadkuje decyzje.",
            checks: [
              "Sprawdz, czy granice sa zapisane i realnie uzywane w decyzjach.",
              "Sprawdz, czy intencja jest mowiona wprost przed trudnym tematem.",
              "Sprawdz, czy obie strony wiedza, co oznacza realna naprawa.",
            ],
          },
        },
        pattern:
          "Dane pokazuja powtarzalny cykl, a nie przypadkowe zdarzenia. Nacisk rośnie w jednym slabszym obszarze, potem przechodzi do komunikacji i interpretacji. Rozmowa daje chwilowe uspokojenie, ale brak domkniecia wraca przy kolejnym stresie. Powstaje uklad stop-start: poprawa, potem nawrot tego samego tarcia. Spada pewnosc, bo rezultat staje sie nierowny. Spada tez jakosc decyzji, bo priorytetem staje sie gaszenie napiecia. Glowny wzorzec to nierownowaga miedzy sila sygnalow a jakoscia wykonania. Bez celowanej korekty cykl bedzie sie powtarzal z wiekszym kosztem emocjonalnym.",
        meaning:
          "Caly obraz jest jednoznaczny: relacja nie rozstrzyga sie jednym wydarzeniem, tylko powtarzalna struktura pod presja. Najmocniejsze obszary nadal moga wspierac odbudowe. Najslabsze obszary wyznaczaja obecny limit bezpieczenstwa decyzji. Sama poprawa tonu nie wystarczy. Potrzebna jest poprawa mechaniki relacji. Gdy mechanika sie stabilizuje, ton poprawia sie naturalnie. To raport o dzwigniach, nie o etykietach.",
        recheck:
          "Powtorz skan za 2-3 tygodnie po wdrozeniu konkretnych zmian. Najpierw sprawdz ruch w najslabszym obszarze, potem porownaj, czy roznica miedzy wymiarami maleje. Postep jest realny, gdy rosnacy wynik idzie razem ze spadkiem rozrzutu.",
      },
      de: {
        opening:
          "Du siehst hier die vollständige Struktur hinter deinem Ergebnis. Das ist keine Momentaufnahme, sondern eine belastbare Analyse von Druck, Stabilität und Entscheidungsrisiko.",
        benchmarkNote:
          "Über Durchschnitt heißt: dieser Bereich stabilisiert. Unter Durchschnitt heißt: dieser Bereich zieht den Gesamtkurs nach unten.",
        dimensions: {
          communication: {
            body:
              "Kommunikation wird hier nicht über Gesprächsmenge bewertet, sondern über Abschlussqualität nach Spannung. Stabil ist Kommunikation dann, wenn schwierige Themen mit klaren Entscheidungen enden. Instabil ist sie, wenn offene Schleifen in das nächste Gespräch getragen werden. Dadurch steigt Interpretationslast und sinkt Entscheidungsklarheit. Das erzeugt defensiven Ton und verlängerte Konfliktzyklen. In diesem Profil ist Kommunikation eine Ausführungsfrage. Wenn Gespräche zu verbindlichem Follow-through führen, sinkt Unsicherheit schnell. Ohne Abschluss kehrt Druck zuverlässig zurück.",
            checks: [
              "Wird ein schwieriges Thema mit einer konkreten Entscheidung geschlossen?",
              "Können beide Seiten die gleiche Vereinbarung nach 24 Stunden benennen?",
              "Bleibt Konflikt auf einem Thema oder öffnet er alte Schleifen?",
            ],
          },
          emotional: {
            body:
              "Emotionale Nähe bedeutet in dieser Analyse verlässliche Erreichbarkeit unter Belastung. Nähe zeigt sich nicht in Spitzenmomenten, sondern in der Qualität von Reaktion und Reparatur bei Druck. Fällt Verfügbarkeit unregelmäßig aus, steigen Fehlinterpretationen und Konfliktkosten. Die Folge sind Rückzug, Reaktivität und langsamere Wiederannäherung. Höhere Nähe reduziert Konfliktkosten. Niedrigere Nähe verlängert Unsicherheitsphasen und beschleunigt Vertrauensverschleiß.",
            checks: [
              "Ist Unterstützung während Stress verfügbar, nicht nur danach?",
              "Führt Dissens zu Distanz oder zu erneuter Verbindung?",
              "Passiert Reparatur in Stunden oder in Tagen?",
            ],
          },
          stability: {
            body:
              "Stabilität misst Verhaltenskonsistenz über Zeit. Worte schaffen Orientierung, aber wiederholtes Verhalten schafft Vertrauen. Bei konsistenter Umsetzung bleibt das System planbar. Bei inkonsistenter Umsetzung steigt Überraschung, und Überraschung treibt Reaktivität. Einmalige Anstrengung reicht nicht, wenn Wochenmuster instabil bleiben. Dieser Bereich zeigt, ob Zusagen auch unter Alltagdruck tragen.",
            checks: [
              "Werden Zusagen ohne wiederholte Erinnerung umgesetzt?",
              "Passen Routinen zu erklärten Prioritäten?",
              "Bleibt Follow-through über zwei Wochen konstant?",
            ],
          },
          clarity: {
            body:
              "Klarheit zeigt, wie viel in der Beziehung verifiziert statt geraten wird. Niedrige Klarheit produziert Deutungskosten. Hohe Klarheit senkt Fehlentscheidungen. Wenn Grenzen, Intentionen und Erwartungen diffus bleiben, entsteht Druck in allen anderen Bereichen. Klarheit ist daher Hebel statt Nebenthema. Präzise Regeln in Hochrisikozonen verbessern Koordination und senken Eskalationsgeschwindigkeit.",
            checks: [
              "Sind Grenzen explizit und in Entscheidungen sichtbar?",
              "Werden Intentionen vor sensiblen Gesprächen direkt benannt?",
              "Ist klar definiert, was als echte Reparatur gilt?",
            ],
          },
        },
        pattern:
          "Das Muster ist wiederkehrend: Druck steigt im schwächsten Bereich und verteilt sich dann über Kommunikation und Deutung. Kurzfristige Entlastung ohne strukturellen Abschluss führt zur nächsten Schleife. Dadurch entsteht ein Stop-and-Start-Verlauf mit sinkender Vorhersehbarkeit. Ohne gezielte Korrektur bleibt der Zyklus aktiv.",
        meaning:
          "Die Gesamtlage ist strukturell, nicht zufällig. Starke Bereiche sind vorhanden, aber schwache Bereiche setzen aktuell den Risikorahmen. Priorität hat Mechanik vor Rhetorik: klare Regeln, messbares Follow-through, engere Schleifen.",
        recheck:
          "Wiederhole den Scan in 2-3 Wochen nach klaren Maßnahmen. Prüfe zuerst den schwächsten Bereich und dann die Streuung zwischen Dimensionen.",
      },
      es: {
        opening:
          "Este informe muestra la estructura real detras del resultado. No es un resumen ligero. Es un mapa de presion, estabilidad y riesgo de decision.",
        benchmarkNote:
          "Por encima del promedio: esta area sostiene estabilidad. Por debajo del promedio: esta area esta tirando del resultado total.",
        dimensions: {
          communication: {
            body:
              "La comunicacion se evalua por cierre, no por cantidad de conversaciones. Si los temas dificiles terminan con decisiones claras, baja la incertidumbre. Si quedan abiertos, el conflicto se recicla y sube el costo emocional. Este perfil muestra que la calidad de cierre define la calidad de confianza.",
            checks: [
              "Comprueba si cada tema dificil termina con una decision concreta.",
              "Comprueba si ambos repiten el mismo acuerdo al dia siguiente.",
              "Comprueba si el conflicto mantiene foco o mezcla temas antiguos.",
            ],
          },
          emotional: {
            body:
              "La cercania emocional aqui significa disponibilidad consistente bajo presion. No basta con momentos buenos aislados. Cuando la disponibilidad cae de forma irregular, crece la interpretacion defensiva y se alarga la reparacion. Eso reduce seguridad y aumenta fatiga relacional.",
            checks: [
              "Comprueba si el apoyo aparece durante el estres, no solo despues.",
              "Comprueba si el desacuerdo termina en distancia o reconexion.",
              "Comprueba si la reparacion ocurre en horas o en dias.",
            ],
          },
          stability: {
            body:
              "La estabilidad mide consistencia de conducta en el tiempo. Las palabras orientan, pero el comportamiento repetido construye confianza. Si la ejecucion es irregular, cada nueva promesa pierde valor. Este eje indica si la relacion mantiene fiabilidad bajo friccion cotidiana.",
            checks: [
              "Comprueba si las promesas se cumplen sin recordatorios constantes.",
              "Comprueba si la rutina real coincide con prioridades declaradas.",
              "Comprueba consistencia de seguimiento durante dos semanas.",
            ],
          },
          clarity: {
            body:
              "La claridad mide cuanto se verifica y cuanto se adivina. Baja claridad obliga a interpretar. Alta claridad permite decidir. Sin limites y expectativas explicitas, sube el ruido y baja la precision relacional. Este eje tiene efecto multiplicador sobre el resto.",
            checks: [
              "Comprueba si los limites estan claros y operativos.",
              "Comprueba si la intencion se declara antes de temas sensibles.",
              "Comprueba si ambos comparten la misma definicion de reparacion.",
            ],
          },
        },
        pattern:
          "El patron es repetitivo: presion en el area mas debil, alivio parcial, regreso del mismo conflicto. El sistema mejora por momentos pero no consolida. Sin correccion dirigida, la inercia sigue siendo inestable.",
        meaning:
          "La lectura global no depende de un evento aislado. Depende de estructura repetida bajo estres. La palanca principal esta en cerrar brechas operativas, no en mejorar solo el tono.",
        recheck:
          "Repite el scan en 2-3 semanas tras aplicar cambios concretos. Mira primero el area mas debil y luego la distancia entre dimensiones.",
      },
      pt: {
        opening:
          "Este relatorio mostra a estrutura real por tras do resultado. Nao e um resumo rapido. E um mapa de pressao, estabilidade e risco de decisao.",
        benchmarkNote:
          "Acima da media: esta area sustenta estabilidade. Abaixo da media: esta area puxa o resultado para baixo.",
        dimensions: {
          communication: {
            body:
              "Comunicacao aqui e medida por fechamento, nao por volume. Quando temas dificeis terminam com decisoes claras, a incerteza cai. Quando ficam abertos, o conflito se repete e o custo emocional sobe. Este perfil mostra que qualidade de fechamento define qualidade de confianca.",
            checks: [
              "Verifique se cada tema dificil termina com decisao concreta.",
              "Verifique se os dois repetem o mesmo acordo no dia seguinte.",
              "Verifique se o conflito mantem foco em um tema.",
            ],
          },
          emotional: {
            body:
              "Proximidade emocional significa disponibilidade consistente sob pressao. Nao basta ter bons momentos isolados. Quando a disponibilidade cai de forma irregular, cresce interpretacao defensiva e o reparo demora mais. Isso reduz seguranca e aumenta desgaste relacional.",
            checks: [
              "Verifique se apoio aparece durante o estresse, nao apenas depois.",
              "Verifique se discordancia leva a distancia ou reconexao.",
              "Verifique se reparo acontece em horas ou em dias.",
            ],
          },
          stability: {
            body:
              "Estabilidade mede consistencia de comportamento no tempo. Palavras orientam, mas repeticao de comportamento constroi confianca. Se execucao e irregular, cada promessa perde valor. Este eixo mostra se a relacao sustenta confiabilidade sob friccao diaria.",
            checks: [
              "Verifique se promessas sao cumpridas sem lembrete constante.",
              "Verifique se rotina real combina com prioridades declaradas.",
              "Verifique consistencia de follow-through por duas semanas.",
            ],
          },
          clarity: {
            body:
              "Clareza mede quanto e verificado e quanto e adivinhado. Baixa clareza aumenta ruido. Alta clareza melhora decisao. Sem limites e expectativas explicitas, o sistema perde precisao relacional e acelera reatividade. Este eixo tem efeito multiplicador.",
            checks: [
              "Verifique se limites estao claros e aplicados.",
              "Verifique se a intencao e dita antes de temas sensiveis.",
              "Verifique se os dois compartilham definicao de reparo.",
            ],
          },
        },
        pattern:
          "O padrao e recorrente: pressao na area mais fraca, alivio parcial e retorno do mesmo ciclo. Ha melhora pontual, mas sem consolidacao estrutural. Sem correcao dirigida, a inercia segue instavel.",
        meaning:
          "O quadro geral nao depende de um unico evento. Depende de repeticao estrutural sob estresse. A alavanca principal esta em fechar lacunas de execucao, nao apenas em melhorar o tom.",
        recheck:
          "Refaca o scan em 2-3 semanas apos aplicar mudancas concretas. Observe primeiro a area mais fraca e depois a distancia entre dimensoes.",
      },
      in: null,
    };
    return map[locale] || map.en;
  }

  // --- Raport: wynik z testu + podsumowanie i profil dopasowane do pasma ---
  function initReport() {
    syncPaidFromStripeReturnUrl();
    const locale = getFlowLocale();
    const logoLink = document.querySelector(".site-header .logo");
    const isPaid = readPaidFlag();
    if (!isPaid) {
      window.location.href = getFlowPageUrl("result", locale);
      return;
    }

    document.body.classList.remove("report-is-locked");
    const lockOverlay = document.getElementById("report-lock-overlay");
    if (lockOverlay) {
      lockOverlay.hidden = true;
      lockOverlay.setAttribute("hidden", "");
    }

    document.documentElement.lang = locale;
    localizeReportPageUi(locale);
    if (logoLink) logoLink.setAttribute("href", LOCALE_PATHS[locale] || LOCALE_PATHS.en);

    const required = {
      scoreStrong: document.getElementById("report-score"),
      communicationEl: document.getElementById("report-communication-body"),
      emotionalEl: document.getElementById("report-emotional-body"),
      stabilityEl: document.getElementById("report-stability-body"),
      clarityEl: document.getElementById("report-clarity-body"),
      patternEl: document.getElementById("report-pattern-body"),
      meaningEl: document.getElementById("report-meaning-body"),
      nextStepsEl: document.getElementById("report-next-steps-body"),
      recheckEl: document.getElementById("report-recheck-body"),
    };
    if (!required.scoreStrong || !required.communicationEl || !required.emotionalEl || !required.stabilityEl || !required.clarityEl) return;

    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      raw = null;
    }
    const score = raw != null && raw !== "" ? Math.max(0, Math.min(100, parseInt(raw, 10))) : null;
    if (score == null) {
      required.communicationEl.innerHTML = "";
      required.emotionalEl.innerHTML = "";
      required.stabilityEl.innerHTML = "";
      required.clarityEl.innerHTML = "";
      required.patternEl.innerHTML = "";
      required.meaningEl.innerHTML = "";
      required.nextStepsEl.innerHTML = "";
      required.recheckEl.innerHTML = "";
      return;
    }

    let details = null;
    try {
      const detailsRaw = localStorage.getItem(STORAGE_DETAILS_KEY);
      details = detailsRaw ? JSON.parse(detailsRaw) : null;
    } catch (e) {
      details = null;
    }
    if (!details || !details.areas) details = getFallbackReportDetails(score);

    const areaScores = {
      communication: Math.max(0, Math.min(100, Number(details.areas.communication || score))),
      emotional: Math.max(0, Math.min(100, Number(details.areas.emotional || details.areas.emotions || score))),
      behavior: Math.max(0, Math.min(100, Number(details.areas.behavior || score))),
      trust: Math.max(0, Math.min(100, Number(details.areas.trust || score))),
    };
    const benchmarkScores = {
      overall: score,
      communication: areaScores.communication,
      emotional: areaScores.emotional,
      stability: areaScores.behavior,
      clarity: areaScores.trust,
    };
    const trajectory = getRelationshipTrajectory(areaScores);
    const { alertsUi, alertItems } = collectRiskAlerts(locale, benchmarkScores);
    const alertCount = alertItems.length;
    const timelineUi = getTimelineContent(locale);
    const timeline = getRelationshipTimeline(trajectory.avgScore, alertCount);
    const outcomeUi = getOutcomeActionsContent(locale);
    const outcomeVariant = outcomeUi[timeline.variant] || outcomeUi.mid;
    const narrative = getPremiumReportNarrative(locale);

    required.scoreStrong.textContent = `${score}/100`;
    const donutEl = document.getElementById("report-donut");
    const donutValueEl = document.getElementById("report-donut-value");
    const scorePosition = document.getElementById("report-score-position");
    if (donutEl) donutEl.style.setProperty("--result-percent", `${score}%`);
    if (donutValueEl) donutValueEl.textContent = String(score);
    if (scorePosition) scorePosition.style.left = `${score}%`;

    const personalizedInsightEl = document.getElementById("report-personalized-insight");
    if (personalizedInsightEl) {
      const personalInsight = getPersonalizedInsightSentence(locale, score, areaScores);
      personalizedInsightEl.textContent = personalInsight.sentence;
    }

    const renderMap = [
      { domPrefix: "communication", areaKey: "communication", scoreId: "report-dim-communication-score", labelId: "report-dim-communication-label" },
      { domPrefix: "safety", areaKey: "emotional", scoreId: "report-dim-emotional-score", labelId: "report-dim-emotional-label" },
      { domPrefix: "stability", areaKey: "behavior", scoreId: "report-dim-stability-score", labelId: "report-dim-stability-label" },
      { domPrefix: "transparency", areaKey: "trust", scoreId: "report-dim-clarity-score", labelId: "report-dim-clarity-label" },
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
      setText(entry.scoreId, `${scoreValue}/100`);
      setText(entry.labelId, segmentLabel);
      const bar = document.getElementById(`report-bar-${entry.domPrefix}`);
      if (bar) bar.style.width = `${scoreValue}%`;
    });

    const benchmarkGridEl = document.getElementById("report-benchmark-grid");
    if (benchmarkGridEl) {
      const benchmarkUi = getBenchmarkLabels(locale);
      benchmarkGridEl.innerHTML = ["overall", "communication", "emotional", "stability", "clarity"]
        .map((key) => {
          const userScore = Math.round(benchmarkScores[key]);
          const averageScore = BENCHMARK_SCORES[key];
          const bandKey = getComparisonBand(userScore, averageScore);
          const comparisonLabel = benchmarkUi[bandKey] || benchmarkUi.around;
          return `<article class="report-benchmark-card"><div class="report-benchmark-card__head"><h3>${escapeHtml(
            benchmarkUi.dimensions[key]
          )}</h3><p class="report-benchmark-card__score">${userScore}/100</p></div><p class="report-benchmark-card__meta">${escapeHtml(
            benchmarkUi.average
          )}: ${averageScore}/100</p><p class="report-benchmark-card__result">${escapeHtml(comparisonLabel)}</p></article>`;
        })
        .join("");
    }
    const benchmarkNoteEl = document.getElementById("report-benchmark-note");
    if (benchmarkNoteEl) benchmarkNoteEl.textContent = narrative.benchmarkNote;

    const alertsEl = document.getElementById("report-alerts");
    if (alertsEl) {
      alertsEl.innerHTML = alertItems.length
        ? alertItems
            .map((item) => `<article class="report-alert-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p></article>`)
            .join("")
        : `<p class="report-alerts__empty">${escapeHtml(alertsUi.none)}</p>`;
    }

    const trajectoryEl = document.getElementById("report-trajectory");
    if (trajectoryEl) {
      const trajectoryContent = getTrajectoryContent(locale);
      const trajectoryText = trajectoryContent[trajectory.label] || trajectoryContent.unstable;
      trajectoryEl.innerHTML = `<div class="report-trajectory__header"><p class="report-trajectory__label">${escapeHtml(
        trajectoryText.label
      )}</p><p class="report-trajectory__meta">${escapeHtml(trajectoryContent.avgLabel)} ${trajectory.avgScore}/100 | ${escapeHtml(
        trajectoryContent.varianceLabel
      )} ${trajectory.variance}</p></div><p class="report-trajectory__body">${escapeHtml(trajectoryText.text)}</p>`;
    }

    const timelineEl = document.getElementById("report-timeline");
    if (timelineEl) {
      const variant = timelineUi[timeline.variant] || timelineUi.mid;
      const stateLabel = timelineUi[timeline.state] || timelineUi.unstable;
      timelineEl.innerHTML = `<div class="report-timeline__meta"><p class="report-timeline__state">${escapeHtml(
        stateLabel
      )}</p><p class="report-timeline__numbers">${escapeHtml(timelineUi.avgLabel)} ${trajectory.avgScore}/100 | ${escapeHtml(
        timelineUi.varianceLabel
      )} ${trajectory.variance} | ${escapeHtml(timelineUi.alertsLabel)} ${alertCount}</p></div><div class="report-timeline__grid"><article class="report-timeline__stage"><h3>${escapeHtml(
        timelineUi.shortTerm
      )}</h3><p>${escapeHtml(variant.short)}</p></article><article class="report-timeline__stage"><h3>${escapeHtml(
        timelineUi.midTerm
      )}</h3><p>${escapeHtml(variant.mid)}</p></article><article class="report-timeline__stage"><h3>${escapeHtml(
        timelineUi.longTerm
      )}</h3><p>${escapeHtml(variant.long)}</p></article></div>`;
    }

    const outcomeEl = document.getElementById("report-outcome");
    if (outcomeEl) {
      const renderActions = (items) =>
        items
          .map(
            (item) =>
              `<article class="report-outcome-action"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.explanation)}</p><p><strong>${escapeHtml(
                outcomeUi.whyLabel
              )}:</strong> ${escapeHtml(item.why)}</p><p><strong>${escapeHtml(outcomeUi.changeLabel)}:</strong> ${escapeHtml(item.change)}</p></article>`
          )
          .join("");
      outcomeEl.innerHTML = `<section class="report-outcome-group"><h3>${escapeHtml(
        outcomeUi.highImpact
      )}</h3><div class="report-outcome-actions">${renderActions(outcomeVariant.highImpact || [])}</div></section><section class="report-outcome-group"><h3>${escapeHtml(
        outcomeUi.mediumImpact
      )}</h3><div class="report-outcome-actions">${renderActions(outcomeVariant.mediumImpact || [])}</div></section>${
        outcomeVariant.lowImpact && outcomeVariant.lowImpact.length
          ? `<section class="report-outcome-group"><h3>${escapeHtml(outcomeUi.lowImpact)}</h3><div class="report-outcome-actions">${renderActions(
              outcomeVariant.lowImpact
            )}</div></section>`
          : ""
      }`;
    }

    required.communicationEl.innerHTML = `<p>${escapeHtml(narrative.dimensions.communication.body)}</p>`;
    required.emotionalEl.innerHTML = `<p>${escapeHtml(narrative.dimensions.emotional.body)}</p>`;
    required.stabilityEl.innerHTML = `<p>${escapeHtml(narrative.dimensions.stability.body)}</p>`;
    required.clarityEl.innerHTML = `<p>${escapeHtml(narrative.dimensions.clarity.body)}</p>`;
    const checksMap = [
      ["report-communication-checks", narrative.dimensions.communication.checks],
      ["report-emotional-checks", narrative.dimensions.emotional.checks],
      ["report-stability-checks", narrative.dimensions.stability.checks],
      ["report-clarity-checks", narrative.dimensions.clarity.checks],
    ];
    checksMap.forEach(([id, items]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    });

    required.patternEl.innerHTML = `<p>${escapeHtml(narrative.pattern)}</p>`;
    required.meaningEl.innerHTML = `<p>${escapeHtml(narrative.meaning)}</p>`;
    required.nextStepsEl.innerHTML = (outcomeVariant.highImpact || [])
      .slice(0, 4)
      .map((item) => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.change)}</li>`)
      .join("");
    required.recheckEl.innerHTML = `<p>${escapeHtml(narrative.recheck)}</p>`;

    const chartNoteEl = document.getElementById("report-chart-note");
    if (chartNoteEl && !chartNoteEl.textContent) {
      chartNoteEl.textContent = narrative.benchmarkNote;
    }
    const recheckCta = document.getElementById("report-recheck-cta");
    if (recheckCta) recheckCta.setAttribute("href", getFlowPageUrl("test", locale));
  }

  // --- Bootstrap wg adresu strony ---
  function boot() {
    document.documentElement.classList.add("js");
    initLocaleByLocation();
    persistPageLocale();
    const lang = getFlowLocale();
    console.log("LANG ACTIVE:", lang);
    appendLangToStripeLinks();
    setYear();
    initLegalFooter();
    initLangSwitcher();
    initMobileNav();
    initReveal();

    let path = (window.location.pathname || "").toLowerCase();
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    /** Obsługa zarówno plików *.html, jak i katalogów /test/ na hostingu statycznym */
    const isTestPage =
      path.endsWith("/test.html") || path.endsWith("/test") || path.endsWith("/test/index.html");
    const isResultPage =
      path.endsWith("/result.html") || path.endsWith("/result") || path.endsWith("/result/index.html");
    const isReportPage =
      path.endsWith("/report.html") || path.endsWith("/report") || path.endsWith("/report/index.html");
    const isSuccessPage =
      path.endsWith("/success.html") || path.endsWith("/success") || path.endsWith("/success/index.html");

    if (isTestPage) initTest();
    else if (isResultPage) initResult();
    else if (isReportPage) initReport();
    else if (isSuccessPage) initSuccess();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
