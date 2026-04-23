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
  const PREMIUM_GRANT_KEY = "premium_access_grant_v1";
  const PREMIUM_GRANT_EXP_KEY = "premium_access_grant_exp_v1";
  const TEST_SESSION_KEY = "relationshipscan_test_session_v1";
  const STRIPE_API_BASE_META = "stripe-verify-api-base";

  function getStripeVerifyApiBase() {
    try {
      const meta = document.querySelector(`meta[name="${STRIPE_API_BASE_META}"]`);
      const fromMeta = meta ? String(meta.getAttribute("content") || "").trim() : "";
      if (fromMeta) return fromMeta.replace(/\/$/, "");
    } catch (e) {
      // Ignore DOM issues.
    }
    return "";
  }

  function clearPaidFlag() {
    try {
      localStorage.removeItem(PAID_KEY);
      localStorage.removeItem("paidAt");
      localStorage.removeItem(PREMIUM_GRANT_KEY);
      localStorage.removeItem(PREMIUM_GRANT_EXP_KEY);
    } catch (e) {
      // Ignore storage issues.
    }
    try {
      sessionStorage.removeItem(PAID_KEY);
    } catch (e) {
      // Ignore storage issues.
    }
  }

  function writeAccessGrant(grantToken, expiresAt) {
    if (!grantToken) return;
    try {
      localStorage.setItem(PREMIUM_GRANT_KEY, String(grantToken));
      localStorage.setItem(PREMIUM_GRANT_EXP_KEY, String(expiresAt || ""));
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

  function readAccessGrant() {
    let token = "";
    let exp = "";
    try {
      token = String(localStorage.getItem(PREMIUM_GRANT_KEY) || "").trim();
      exp = String(localStorage.getItem(PREMIUM_GRANT_EXP_KEY) || "").trim();
    } catch (e) {
      token = "";
      exp = "";
    }
    if (!token) return { token: "", expiresAt: 0 };
    const expiresAt = parseInt(exp || "0", 10) || 0;
    if (expiresAt > 0 && Date.now() > expiresAt) {
      clearPaidFlag();
      return { token: "", expiresAt: 0 };
    }
    return { token, expiresAt };
  }

  function getStripeReturnEvidence() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = String(params.get("session_id") || "").trim();
    const paymentIntent = String(params.get("payment_intent") || "").trim();
    if (sessionId.includes("CHECKOUT_SESSION") || sessionId.includes("{")) {
      return { sessionId: "", paymentIntent: "" };
    }
    return { sessionId, paymentIntent };
  }

  function scrubStripeReturnParams() {
    try {
      const params = new URLSearchParams(window.location.search);
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

  async function validateAccessGrantWithBackend(grantToken) {
    const apiBase = getStripeVerifyApiBase();
    if (!apiBase || !grantToken) return false;
    try {
      const url = new URL("/api/stripe/grant-status", apiBase);
      url.searchParams.set("grant", grantToken);
      const res = await fetch(url.toString(), { method: "GET" });
      if (!res.ok) return false;
      const payload = await res.json();
      if (!payload.active) return false;
      if (payload.expiresAt) {
        try {
          localStorage.setItem(PREMIUM_GRANT_EXP_KEY, String(payload.expiresAt));
        } catch (e) {
          // Ignore storage issues.
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async function confirmStripeReturnWithBackend(sessionId, paymentIntent) {
    const apiBase = getStripeVerifyApiBase();
    if (!apiBase) {
      console.warn("[stripe-access] Missing stripe-verify-api-base meta. Refusing to unlock premium.");
      return { paid: false, reason: "missing_api_base" };
    }
    if (!sessionId && !paymentIntent) {
      return { paid: false, reason: "missing_return_evidence" };
    }
    try {
      const url = new URL("/api/stripe/confirm-return", apiBase);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId || null,
          payment_intent: paymentIntent || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.paid || !payload.grantToken) {
        console.warn("[stripe-access] Backend did not confirm payment", {
          status: res.status,
          payload,
        });
        return { paid: false, reason: "not_paid", payload };
      }
      writeAccessGrant(payload.grantToken, payload.expiresAt || 0);
      return { paid: true, payload };
    } catch (e) {
      console.error("[stripe-access] Backend verification error", e);
      return { paid: false, reason: "verify_error" };
    }
  }

  async function hasVerifiedPremiumAccess() {
    const { token } = readAccessGrant();
    if (!token) return false;
    const active = await validateAccessGrantWithBackend(token);
    if (!active) clearPaidFlag();
    return active;
  }
  const LOCALE_PATHS = {
    en: "/en/",
    de: "/de/",
    es: "/es/",
    pl: "/pl/",
    pt: "/pt/",
    in: "/in/",
  };
  function getRuntimeLocaleConfig() {
    try {
      const cfg = window.RELATIONSHIPSCAN_CONFIG;
      if (cfg && cfg.locales && typeof cfg.locales === "object") return cfg.locales;
    } catch (e) {
      // Ignore config access issues.
    }
    return null;
  }

  function getLocaleBasePath(locale) {
    const normalized = normalizeLocale(locale);
    const runtime = getRuntimeLocaleConfig();
    const configured = runtime && runtime[normalized] && runtime[normalized].basePath;
    if (configured) return String(configured);
    return LOCALE_PATHS[normalized] || LOCALE_PATHS.en;
  }

  function getLocaleSuccessPath(locale) {
    const normalized = normalizeLocale(locale);
    const runtime = getRuntimeLocaleConfig();
    const configured = runtime && runtime[normalized] && runtime[normalized].successUrl;
    if (configured) return String(configured);
    return `/success.html?lang=${encodeURIComponent(normalized)}`;
  }
  const LANG_KEY = "lang";
  const LEGAL_PATHS = {
    en: { terms: "/en/terms.html", privacy: "/en/privacy.html", contact: "/en/contact.html" },
    pl: { terms: "/pl/regulamin.html", privacy: "/pl/polityka-prywatnosci.html", contact: "/pl/contact.html" },
    de: { terms: "/de/agb.html", privacy: "/de/datenschutz.html", contact: "/de/contact.html" },
    es: { terms: "/es/terminos.html", privacy: "/es/privacidad.html", contact: "/es/contact.html" },
    pt: { terms: "/pt/termos.html", privacy: "/pt/privacidade.html", contact: "/pt/contact.html" },
    in: { terms: "/in/terms.html", privacy: "/in/privacy.html", contact: "/in/contact.html" },
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
      privacy: "Polityka prywatności",
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
      disclaimer: "Roughly two minutes. First answer that shows up — no polishing.",
      micro: "No trick questions.",
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
      disclaimer: "Około dwóch minut. Odpowiadaj spontanicznie, bez długiego zastanawiania się.",
      micro: "Bez podchwytliwych pytań.",
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
      disclaimer: "Etwa zwei Minuten. Erste Antwort, die kommt — nicht schönreden.",
      micro: "Keine Fangfragen.",
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
      disclaimer: "Unos dos minutos. La primera respuesta que salga — sin pulirla.",
      micro: "Sin preguntas trampa.",
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
      disclaimer: "Cerca de dois minutos. A primeira resposta que vier — sem polir.",
      micro: "Sem perguntas armadilha.",
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

  const PAYMENT_LINKS = {
    pl: "https://buy.stripe.com/eVqaEZ2S7beFc0iaar4ow03",
    en: "https://buy.stripe.com/fZubJ3dwL0A1ggybev4ow05",
    default: "https://buy.stripe.com/4gM8wR3Wb3MdaWeeqH4ow04",
  };

  function getPaymentLink() {
    const path = window.location.pathname.toLowerCase();
    const lang = path.split("/")[1];
    if (lang === "pl") return PAYMENT_LINKS.pl;
    if (lang === "en") return PAYMENT_LINKS.en;
    return PAYMENT_LINKS.default;
  }

  function getBillingCurrency(locale) {
    const L = normalizeLocale(locale);
    if (L === "pl") return "pln";
    if (L === "en") return "usd";
    return "eur";
  }

  function getStripeLinkForLocale(locale) {
    const normalized = normalizeLocale(locale);
    if (normalized === "pl") return PAYMENT_LINKS.pl;
    if (normalized === "en") return PAYMENT_LINKS.en;
    return PAYMENT_LINKS.default;
  }

  function getStripeCheckoutLocale(locale) {
    const L = normalizeLocale(locale);
    if (L === "pl") return "pl";
    if (L === "de") return "de";
    if (L === "es") return "es";
    if (L === "pt") return "pt";
    return "en";
  }

  function getPriceDisplayCompact(locale) {
    switch (getBillingCurrency(locale)) {
      case "pln":
        return "39 zł";
      case "usd":
        return "$7.99";
      default:
        return "€6.99";
    }
  }

  function formatPremiumPriceLine(locale) {
    const L = normalizeLocale(locale);
    const ui = RESULT_LAYOUT_UI[L] || RESULT_LAYOUT_UI.en;
    return `${getPriceDisplayCompact(L)} · ${ui.priceSuffix}`;
  }

  function getPriceCheckoutHint(locale) {
    const L = normalizeLocale(locale);
    const t = {
      en: "Final price and payment method are shown at checkout.",
      pl: "Ostateczna cena i metoda płatności są widoczne przy finalizacji zakupu.",
      de: "Der endgültige Preis und die Zahlungsmethode werden im Checkout angezeigt.",
      es: "El precio final y el método de pago se muestran en el checkout.",
      pt: "O preço final e o método de pagamento aparecem no checkout.",
      in: "Final price and payment method are shown at checkout.",
    };
    return t[L] || t.en;
  }

  const UPSELL_PRICE_NOTE = {
    en: "one-time access · full report",
    pl: "jednorazowy dostęp · pełny raport",
    de: "Einmaliger Zugriff · vollständiger Bericht",
    es: "Acceso único · informe completo",
    pt: "Acesso único · relatório completo",
    in: "one-time access · full report",
  };

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
    const langParam = String(new URLSearchParams(window.location.search || "").get("lang") || "").toLowerCase();
    if (langParam && LOCALE_PATHS[langParam]) return setLang(langParam);
    const stored = getStoredLang();
    if (stored) return stored;
    return setLang("en");
  }

  function getTestLocale() {
    return getFlowLocale();
  }

  function getFlowPageUrl(pageName, locale) {
    const normalizedLocale = normalizeLocale(locale);
    const runtime = getRuntimeLocaleConfig();
    const localizedPages = new Set(["index", "checkout", "success", "report", "result"]);
    if (runtime && runtime[normalizedLocale] && runtime[normalizedLocale].basePath && localizedPages.has(String(pageName || ""))) {
      return `${getLocaleBasePath(normalizedLocale)}${pageName}.html`;
    }
    return `/${pageName}.html?lang=${encodeURIComponent(normalizedLocale)}`;
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
      en: { low: "Low", mid: "Medium", high: "High" },
      pl: { low: "Niski", mid: "Średni", high: "Wysoki" },
      de: { low: "Niedrig", mid: "Mittel", high: "Hoch" },
      es: { low: "Bajo", mid: "Medio", high: "Alto" },
      pt: { low: "Baixo", mid: "Médio", high: "Alto" },
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

  const RESULT_COPY =   {
    "stabilna": {
      "headline": "The relationship is stable and well-balanced",
      "label": "HIGH SCORE",
      "lead": "Most areas are working: both sides take initiative, time and attention are shared, and everyday matters are handled without friction. After tension, the relationship returns to balance without long disruption.",
      "interpretation": [
        "What works",
        "Initiative – both sides engage",
        "Involvement – effort is balanced",
        "Closeness – present in everyday life",
        "Responsibility – commitments are handled",
        "Boundaries – differences don’t break the connection"
      ],
      "tips": [
        "Warning signs",
        "postponing small issues",
        "temporary drop in effort from one side",
        "routine replacing attention",
        "What it means",
        "The relationship works because it stays balanced."
      ]
    },
    "napiecia": {
      "headline": "The relationship is uneven",
      "label": "MEDIUM SCORE",
      "lead": "Some areas work well, others are strained. The effort is not evenly distributed.",
      "interpretation": [
        "What is off",
        "initiative often comes from one side",
        "involvement is unbalanced",
        "time together is inconsistent",
        "closeness fluctuates",
        "tension carries over"
      ],
      "tips": [
        "What it means",
        "The relationship depends on effort rather than stability."
      ]
    },
    "niepewnosc": {
      "headline": "The relationship is losing structure",
      "label": "LOW SCORE",
      "lead": "There is no stable rhythm. Contact is inconsistent and often one-sided.",
      "interpretation": [
        "What is not working",
        "low or one-sided initiative",
        "reduced involvement",
        "limited time together",
        "weak closeness",
        "unresolved tension"
      ],
      "tips": [
        "What it means",
        "Without change, the relationship will continue to weaken."
      ]
    }
  };

  const RESULT_COPY_PL =   {
    "stabilna": {
      "headline": "Relacja jest spójna i funkcjonalna",
      "label": "WYSOKI WYNIK (75–100)",
      "lead": "W większości obszarów działacie razem: jest inicjatywa z obu stron, kontakt nie zależy od jednego z Was, sprawy są ogarniane na bieżąco. Widać, że potraficie wrócić do równowagi po napięciu, a codzienne rzeczy nie zamieniają się w problem.",
      "interpretation": [
        "Co działa",
        "Inicjatywa – obie strony wychodzą z propozycjami (kontakt, spotkania, decyzje)",
        "Zaangażowanie – czas i uwaga są rozłożone dość równo",
        "Bliskość – obecna nie tylko „od święta”, ale w zwykłych sytuacjach",
        "Odpowiedzialność – sprawy są doprowadzane do końca (organizacja, zobowiązania)",
        "Granice – różnice nie rozwalają relacji, tylko są do ogarnięcia"
      ],
      "tips": [
        "Sygnały ostrzegawcze",
        "odkładanie drobnych tematów „na później”",
        "spadki inicjatywy u jednej ze stron w gorszych okresach",
        "rutyna, która zaczyna wypierać uważność",
        "Co z tego wynika",
        "Relacja działa, bo ma równowagę między bliskością a autonomią. Utrzymanie tego wymaga pilnowania drobnych rzeczy zanim się skumulują."
      ]
    },
    "napiecia": {
      "headline": "Relacja działa, ale traci równowagę",
      "label": "ŚREDNI WYNIK (45–74)",
      "lead": "Niektóre obszary działają dobrze, inne są przeciążone albo zaniedbane. Widać, że ciężar relacji nie rozkłada się równo — jedna strona częściej inicjuje, pilnuje kontaktu albo bierze odpowiedzialność za wspólne sprawy.",
      "interpretation": [
        "Co nie domaga",
        "Inicjatywa – częściej po jednej stronie",
        "Zaangażowanie – nierówne (ktoś „ciągnie” więcej)",
        "Czas razem – jest, ale bywa przypadkowy lub ograniczony",
        "Bliskość – pojawia się, ale nie jest stabilna",
        "Napięcie – nie znika, tylko przechodzi na kolejne sytuacje"
      ],
      "tips": [
        "Jak to wygląda w praktyce",
        "plany są robione, ale łatwo się rozjeżdżają",
        "drobne rzeczy zaczynają irytować bardziej niż powinny",
        "kontakt bywa intensywny, a potem wyraźnie słabnie",
        "ważne sprawy są odkładane, bo „teraz nie ma kiedy”",
        "Co z tego wynika",
        "Relacja nie rozpada się, ale zaczyna opierać się na wysiłku jednej strony. Jeśli to się utrzyma, pojawi się zmęczenie i dystans."
      ]
    },
    "niepewnosc": {
      "headline": "Relacja traci strukturę i kierunek",
      "label": "NISKI WYNIK (0–44)",
      "lead": "Brakuje wspólnego rytmu. Kontakt nie jest czymś oczywistym, tylko dzieje się nieregularnie. Inicjatywa, zaangażowanie i odpowiedzialność są ograniczone albo jednostronne.",
      "interpretation": [
        "Co nie działa",
        "Inicjatywa – słaba lub jednostronna",
        "Zaangażowanie – spada lub jest niestabilne",
        "Czas razem – rzadki albo powierzchowny",
        "Bliskość – wycofana lub sporadyczna",
        "Napięcie – zostaje i narasta"
      ],
      "tips": [
        "Jak to wygląda w praktyce",
        "kontakt jest przerywany albo ograniczony do minimum",
        "sprawy nie są załatwiane, tylko zostają",
        "jedna lub obie strony wycofują się z relacji",
        "nawet proste rzeczy zaczynają być trudne do ogarnięcia",
        "Co z tego wynika",
        "Relacja nie ma stabilnego oparcia. Jeśli ten stan się utrzyma, dystans będzie się pogłębiał, a kontakt stanie się coraz bardziej ograniczony."
      ]
    }
  };

  const RESULT_COPY_DE =   {
    "stabilna": {
      "headline": "Die Beziehung ist stabil und funktional",
      "label": "HOHER WERT (75–100)",
      "lead": "In den meisten Bereichen funktioniert ihr als Team: beide Seiten zeigen Initiative, der Kontakt hängt nicht nur von einer Person ab, und alltägliche Dinge werden laufend geklärt. Nach Spannungen findet ihr wieder ins Gleichgewicht zurück, und Alltagsthemen entwickeln sich nicht zu Problemen.",
      "interpretation": [
        "Was funktioniert",
        "Initiative – beide Seiten bringen Vorschläge ein (Kontakt, Pläne, Entscheidungen)",
        "Engagement – Zeit und Aufmerksamkeit sind relativ ausgeglichen",
        "Nähe – nicht nur in besonderen Momenten, sondern auch im Alltag präsent",
        "Verantwortung – Verpflichtungen werden umgesetzt (Organisation, Absprachen)",
        "Grenzen – Unterschiede führen nicht zum Bruch, sondern bleiben handhabbar"
      ],
      "tips": [
        "Warnsignale",
        "kleine Themen werden auf später verschoben",
        "vorübergehender Rückgang der Initiative auf einer Seite",
        "Routine ersetzt allmählich Aufmerksamkeit",
        "Was das bedeutet",
        "Die Beziehung funktioniert durch das Gleichgewicht zwischen Nähe und Eigenständigkeit. Dieses Niveau bleibt nur erhalten, wenn kleine Dinge rechtzeitig geklärt werden."
      ]
    },
    "napiecia": {
      "headline": "Die Beziehung funktioniert, verliert aber an Balance",
      "label": "MITTLERER WERT (45–74)",
      "lead": "Einige Bereiche funktionieren gut, andere sind belastet oder vernachlässigt. Die Verantwortung ist ungleich verteilt — eine Person übernimmt häufiger Initiative, Kontakt oder Organisation.",
      "interpretation": [
        "Was nicht funktioniert",
        "Initiative – häufiger auf einer Seite",
        "Engagement – ungleich verteilt",
        "Gemeinsame Zeit – vorhanden, aber unregelmäßig",
        "Nähe – vorhanden, aber nicht stabil",
        "Spannung – bleibt bestehen und überträgt sich"
      ],
      "tips": [
        "Wie es sich zeigt",
        "Pläne werden gemacht, halten aber nicht",
        "kleine Dinge werden schnell belastend",
        "Kontakt schwankt zwischen intensiv und schwach",
        "wichtige Themen werden verschoben",
        "Was das bedeutet",
        "Die Beziehung besteht, basiert aber zunehmend auf einseitigem Aufwand. Das führt zu Ermüdung und Distanz."
      ]
    },
    "niepewnosc": {
      "headline": "Die Beziehung verliert Struktur und Richtung",
      "label": "NIEDRIGER WERT (0–44)",
      "lead": "Es fehlt ein gemeinsamer Rhythmus. Kontakt entsteht unregelmäßig. Initiative, Engagement und Verantwortung sind schwach oder einseitig.",
      "interpretation": [
        "Was nicht funktioniert",
        "Initiative – gering oder einseitig",
        "Engagement – sinkt oder schwankt",
        "Gemeinsame Zeit – selten oder oberflächlich",
        "Nähe – zurückgezogen oder sporadisch",
        "Spannung – bleibt bestehen und wächst"
      ],
      "tips": [
        "Wie es sich zeigt",
        "Kontakt ist unterbrochen oder minimal",
        "Themen werden nicht geklärt",
        "Rückzug aus der Beziehung",
        "selbst einfache Dinge werden schwierig",
        "Was das bedeutet",
        "Die Beziehung hat kein stabiles Fundament. Ohne Veränderung nimmt die Distanz weiter zu."
      ]
    }
  };

  const RESULT_COPY_ES =   {
    "stabilna": {
      "headline": "La relación es coherente y funcional",
      "label": "RESULTADO ALTO (75–100)",
      "lead": "En la mayoría de los aspectos funcionan como un equipo: hay iniciativa por parte de ambos, el contacto no depende de una sola persona y las situaciones cotidianas se gestionan de forma continua. Se nota que, después de momentos de tensión, sois capaces de recuperar el equilibrio y que los asuntos diarios no se convierten en problemas prolongados.",
      "interpretation": [
        "Qué funciona",
        "Iniciativa – ambas personas proponen contacto, planes y decisiones",
        "Compromiso – el tiempo y la atención están relativamente equilibrados",
        "Cercanía – presente no solo en momentos especiales, sino también en lo cotidiano",
        "Responsabilidad – los compromisos se cumplen (organización, acuerdos)",
        "Límites – las diferencias no rompen la relación, se pueden gestionar"
      ],
      "tips": [
        "Señales de alerta",
        "aplazar temas pequeños “para más adelante”",
        "descensos puntuales de iniciativa por parte de uno",
        "la rutina empieza a sustituir la atención",
        "Qué significa",
        "La relación funciona porque mantiene un equilibrio entre cercanía y autonomía. Para sostener este nivel, es importante atender a los detalles antes de que se acumulen."
      ]
    },
    "napiecia": {
      "headline": "La relación funciona, pero pierde equilibrio",
      "label": "RESULTADO MEDIO (45–74)",
      "lead": "Algunas áreas funcionan bien, mientras que otras están sobrecargadas o descuidadas. Se observa que el peso de la relación no se reparte de forma equitativa: una persona inicia más, mantiene el contacto o asume más responsabilidad en lo compartido.",
      "interpretation": [
        "Qué no funciona",
        "Iniciativa – más frecuente en una sola persona",
        "Compromiso – desigual (alguien sostiene más)",
        "Tiempo juntos – existe, pero es irregular o limitado",
        "Cercanía – aparece, pero no es constante",
        "Tensión – no desaparece, se traslada a otras situaciones"
      ],
      "tips": [
        "Cómo se ve en la práctica",
        "se hacen planes, pero se desorganizan con facilidad",
        "pequeñas situaciones generan más irritación de lo habitual",
        "el contacto pasa de ser intenso a debilitarse claramente",
        "temas importantes se posponen porque “no es el momento”",
        "Qué significa",
        "La relación no se rompe, pero empieza a depender del esfuerzo de una sola parte. Si esto continúa, aparecerán cansancio y distancia."
      ]
    },
    "niepewnosc": {
      "headline": "La relación pierde estructura y dirección",
      "label": "RESULTADO BAJO (0–44)",
      "lead": "Falta un ritmo compartido. El contacto no es algo natural, sino irregular. La iniciativa, el compromiso y la responsabilidad son limitados o unilaterales.",
      "interpretation": [
        "Qué no funciona",
        "Iniciativa – débil o concentrada en una sola persona",
        "Compromiso – bajo o inestable",
        "Tiempo juntos – escaso o superficial",
        "Cercanía – limitada o esporádica",
        "Tensión – permanece y se acumula"
      ],
      "tips": [
        "Cómo se ve en la práctica",
        "el contacto se interrumpe o se reduce al mínimo",
        "los asuntos no se resuelven y quedan pendientes",
        "una o ambas personas se retiran de la relación",
        "incluso las cosas simples resultan difíciles de manejar",
        "Qué significa",
        "La relación no tiene una base estable. Si la situación se mantiene, la distancia aumentará y el contacto será cada vez más limitado."
      ]
    }
  };

  const RESULT_COPY_PT =   {
    "stabilna": {
      "headline": "A relação é coerente e funcional",
      "label": "RESULTADO ALTO (75–100)",
      "lead": "Na maioria dos aspetos, vocês funcionam como uma equipa: há iniciativa dos dois lados, o contacto não depende de uma única pessoa e as situações do dia a dia são resolvidas de forma contínua. É visível a capacidade de recuperar o equilíbrio após momentos de tensão, sem que as questões quotidianas se transformem em problemas duradouros.",
      "interpretation": [
        "O que funciona",
        "Iniciativa – ambos tomam iniciativa em contacto, planos e decisões",
        "Envolvimento – tempo e atenção distribuídos de forma equilibrada",
        "Proximidade – presente não só em momentos especiais, mas também no dia a dia",
        "Responsabilidade – compromissos são cumpridos (organização, acordos)",
        "Limites – diferenças não destabilizam a relação, são geridas"
      ],
      "tips": [
        "Sinais de alerta",
        "adiar pequenos assuntos “para depois”",
        "redução temporária de iniciativa de uma das partes",
        "rotina a substituir a atenção",
        "O que significa",
        "A relação funciona porque mantém equilíbrio entre proximidade e autonomia. Para preservar isso, é importante não deixar acumular pequenas questões."
      ]
    },
    "napiecia": {
      "headline": "A relação funciona, mas perde equilíbrio",
      "label": "RESULTADO MÉDIO (45–74)",
      "lead": "Algumas áreas funcionam bem, enquanto outras estão sobrecarregadas ou negligenciadas. O peso da relação não está distribuído de forma equilibrada — uma pessoa assume mais iniciativa, mantém o contacto ou gere mais responsabilidades.",
      "interpretation": [
        "O que não funciona",
        "Iniciativa – mais presente de um lado",
        "Envolvimento – desigual (alguém sustenta mais)",
        "Tempo juntos – existe, mas é irregular ou limitado",
        "Proximidade – aparece, mas não é consistente",
        "Tensão – não desaparece, acumula-se"
      ],
      "tips": [
        "Como se manifesta na prática",
        "planos são feitos, mas facilmente se desorganizam",
        "pequenas situações geram irritação desproporcional",
        "o contacto alterna entre intensidade e afastamento",
        "assuntos importantes são adiados",
        "O que significa",
        "A relação não está a terminar, mas começa a depender do esforço de uma só pessoa. Se continuar assim, surgem desgaste e distanciamento."
      ]
    },
    "niepewnosc": {
      "headline": "A relação perde estrutura e direção",
      "label": "RESULTADO BAIXO (0–44)",
      "lead": "Falta um ritmo comum. O contacto não é natural, mas irregular. Iniciativa, envolvimento e responsabilidade são limitados ou unilaterais.",
      "interpretation": [
        "O que não funciona",
        "Iniciativa – fraca ou concentrada numa só pessoa",
        "Envolvimento – baixo ou instável",
        "Tempo juntos – raro ou superficial",
        "Proximidade – reduzida ou esporádica",
        "Tensão – permanece e acumula"
      ],
      "tips": [
        "Como se manifesta na prática",
        "o contacto é interrompido ou mínimo",
        "assuntos ficam por resolver",
        "há afastamento de uma ou ambas as partes",
        "até situações simples se tornam difíceis",
        "O que significa",
        "A relação não tem base estável. Se nada mudar, o distanciamento vai aumentar e o contacto será cada vez mais limitado."
      ]
    }
  };

  const RESULT_SIGNAL_LINE_BY_LOCALE =   {
    "en": "This is an interpretation of your situation, not psychological, medical, or legal advice.",
    "pl": "To jest interpretacja Twojej sytuacji, nie porada psychologiczna, medyczna ani prawna.",
    "de": "Das ist eine Einschätzung deiner Situation, keine psychologische, medizinische oder rechtliche Beratung.",
    "es": "Esto es una interpretación de tu situación, no asesoramiento psicológico, médico ni legal.",
    "pt": "Isto é uma interpretação da tua situação, não aconselhamento psicológico, médico ou jurídico.",
    "in": "This is an interpretation of your situation, not psychological, medical, or legal advice."
  };

  const RESULT_PAGE_UI = {
    en: {
      eyebrow: "Free readout",
      title: "Your Trust Index",
      interpretationTitle: "What it says",
      tipsTitle: "What to do with it",
      premiumEyebrow: "Paid layer",
      premiumTitle: "The free screen stops halfway",
      premiumSubhead: "You get a number and a straight read. The rest is behind the paywall on purpose.",
      premiumIntroA:
        "Your answers point somewhere. Without the paid write-up you keep filling in the blanks yourself.",
      premiumIntroB: "The paid report lays out:",
      premiumBullets: [
        "what in your answers actually moved the score",
        "where it still holds together",
        "where it goes if nobody changes course",
      ],
      premiumIncludesTitle: "Inside the paid report:",
      premiumIncludes: [
        "Trust Index split by area",
        "plain read on talk, distance, behaviour, trust",
        "what keeps coming back between you two",
        "a straight call on where this heads if nothing shifts",
        "three moves that fit your case",
      ],
      premiumValueLabels: [
        "What is moving fastest?",
        "Where a wrong call hurts most?",
        "What do you do first?",
      ],
      cta: "Open the paid report",
      note1: "One-time payment. Stripe checkout. Access right after you pay.",
      note2: "Most people in this mess open the paid report.",
    },
    pl: {
      eyebrow: "Darmowy odczyt",
      title: "Twój Trust Index",
      interpretationTitle: "Co z tego wynika",
      tipsTitle: "Co z tym zrobić",
      premiumEyebrow: "Wersja płatna",
      premiumTitle: "Darmowy ekran urywa się w połowie",
      premiumSubhead: "Dostajesz liczbę i krótki odczyt. Reszta jest za paywallem celowo.",
      premiumIntroA:
        "Twoje odpowiedzi coś znaczą. Bez płatnej części dalej domykasz to w głowie samodzielnie.",
      premiumIntroB: "Płatny raport rozpisuje:",
      premiumBullets: [
        "co w odpowiedziach realnie ruszyło wynik",
        "gdzie jeszcze się trzymacie",
        "dokąd to idzie, jeśli nic się nie zmieni",
      ],
      premiumIncludesTitle: "W płatnym raporcie:",
      premiumIncludes: [
        "Trust Index rozbity na obszary",
        "prosty opis: rozmowa, dystans, zachowanie, zaufanie",
        "co między Wami wraca jak bumerang",
        "wprost: w co to wpada, jeśli nic nie ruszycie",
        "trzy ruchy pod Twoją sytuację, nie ogólne rady",
      ],
      premiumValueLabels: [
        "Co się zmienia najszybciej?",
        "Gdzie błąd boli najbardziej?",
        "Co robisz pierwsze?",
      ],
      cta: "Wejdź w płatny raport",
      note1: "Jednorazowa płatność. Checkout Stripe. Dostęp od razu po zaksięgowaniu.",
      note2: "Większość osób w tym miejscu i tak otwiera płatny raport.",
    },
    de: {
      eyebrow: "Kostenloser Abriss",
      title: "Dein Trust Index",
      interpretationTitle: "Was das heißt",
      tipsTitle: "Was du damit machst",
      premiumEyebrow: "Bezahlteil",
      premiumTitle: "Der kostenlose Teil endet mittendrin",
      premiumSubhead: "Du siehst eine Zahl und einen klaren Abriss. Der Rest ist hinter der Bezahlschranke — absichtlich.",
      premiumIntroA:
        "Deine Antworten zeigen eine Richtung. Ohne den bezahlten Teil füllst du die Lücken selbst weiter.",
      premiumIntroB: "Der bezahlte Bericht legt offen:",
      premiumBullets: [
        "was in deinen Antworten den Wert wirklich bewegt hat",
        "wo es bei euch noch hält",
        "wohin das läuft, wenn niemand umschwenkt",
      ],
      premiumIncludesTitle: "Im bezahlten Bericht:",
      premiumIncludes: [
        "Trust Index nach Bereichen",
        "klare Sprache zu Gespräch, Distanz, Verhalten, Vertrauen",
        "was zwischen euch immer wieder auftaucht",
        "ehrlich: wohin das driftet, wenn sich nichts ändert",
        "drei Schritte, die zu eurer Lage passen",
      ],
      premiumValueLabels: [
        "Was bewegt sich am schnellsten?",
        "Wo tut ein Fehlentscheid am meisten weh?",
        "Was zuerst?",
      ],
      cta: "Bezahlten Bericht öffnen",
      note1: "Einmalzahlung. Stripe-Checkout. Zugriff direkt nach Zahlung.",
      note2: "Die meisten in dieser Lage öffnen den bezahlten Bericht.",
    },
    es: {
      eyebrow: "Lectura gratis",
      title: "Tu Trust Index",
      interpretationTitle: "Qué dice",
      tipsTitle: "Qué hacer con eso",
      premiumEyebrow: "Parte de pago",
      premiumTitle: "La pantalla gratis se corta a medias",
      premiumSubhead: "Ves un número y una lectura clara. El resto está detrás del pago a propósito.",
      premiumIntroA:
        "Tus respuestas apuntan a algo. Sin la parte de pago sigues rellenando tú solo.",
      premiumIntroB: "El informe de pago detalla:",
      premiumBullets: [
        "qué en tus respuestas movió de verdad el resultado",
        "dónde aún aguanta la relación",
        "hacia dónde va esto si nadie cambia de rumbo",
      ],
      premiumIncludesTitle: "Dentro del informe de pago:",
      premiumIncludes: [
        "Trust Index por áreas",
        "texto claro: conversación, distancia, comportamiento, confianza",
        "lo que vuelve una y otra vez entre vosotros",
        "sin rodeos: en qué se convierte esto si nada se mueve",
        "tres pasos ajustados a tu caso",
      ],
      premiumValueLabels: [
        "Qué se mueve más rápido?",
        "Dónde duele más equivocarse?",
        "Qué haces primero?",
      ],
      cta: "Abrir informe de pago",
      note1: "Pago único. Checkout Stripe. Acceso en cuanto paga.",
      note2: "La mayoría en este punto abre el informe de pago.",
    },
    pt: {
      eyebrow: "Leitura grátis",
      title: "O teu Trust Index",
      interpretationTitle: "O que isto diz",
      tipsTitle: "O que fazer com isto",
      premiumEyebrow: "Parte paga",
      premiumTitle: "O ecrã grátis corta a meio",
      premiumSubhead: "Vês um número e uma leitura direta. O resto está atrás do pagamento de propósito.",
      premiumIntroA:
        "As tuas respostas apontam para algum lado. Sem a parte paga continuas a preencher sozinho.",
      premiumIntroB: "O relatório pago descreve:",
      premiumBullets: [
        "o que nas respostas mexeu mesmo o resultado",
        "onde ainda se aguentam",
        "para onde isto vai se ninguém mudar de rumo",
      ],
      premiumIncludesTitle: "Dentro do relatório pago:",
      premiumIncludes: [
        "Trust Index por áreas",
        "texto direto: conversa, distância, comportamento, confiança",
        "o que volta sempre entre vocês",
        "sem rodeios: no que isto cai se nada se mexer",
        "três passos ajustados ao teu caso",
      ],
      premiumValueLabels: [
        "O que se move mais rápido?",
        "Onde um erro dói mais?",
        "O que fazes primeiro?",
      ],
      cta: "Abrir relatório pago",
      note1: "Pagamento único. Checkout Stripe. Acesso logo após pagar.",
      note2: "A maioria neste ponto abre o relatório pago.",
    },
    in: {
      eyebrow: "Free readout",
      title: "Your Trust Index",
      interpretationTitle: "What it says",
      tipsTitle: "What to do with it",
      premiumEyebrow: "Paid layer",
      premiumTitle: "The free screen stops halfway",
      premiumSubhead: "You get a number and a straight read. The rest is behind the paywall on purpose.",
      premiumIntroA:
        "Your answers point somewhere. Without the paid write-up you keep filling in the blanks yourself.",
      premiumIntroB: "The paid report lays out:",
      premiumBullets: [
        "what in your answers actually moved the score",
        "where it still holds together",
        "where it goes if nobody changes course",
      ],
      premiumIncludesTitle: "Inside the paid report:",
      premiumIncludes: [
        "Trust Index split by area",
        "plain read on talk, distance, behaviour, trust",
        "what keeps coming back between you two",
        "a straight call on where this heads if nothing shifts",
        "three moves that fit your case",
      ],
      premiumValueLabels: [
        "What is moving fastest?",
        "Where a wrong call hurts most?",
        "What do you do first?",
      ],
      cta: "Open the paid report",
      note1: "One-time payment. Stripe checkout. Access right after you pay.",
      note2: "Most people in this mess open the paid report.",
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
      scaleLow: "Low",
      scaleMid: "Medium",
      scaleHigh: "High",
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

  const AREA_BODY_LABELS = {
    en: { happening: "What's happening", practice: "What it does in practice", watch: "What to watch" },
    pl: { happening: "Co się dzieje", practice: "Co to robi w praktyce", watch: "Na co zwrócić uwagę" },
    de: { happening: "Was passiert", practice: "Praktische Folge", watch: "Worauf achten" },
    es: { happening: "Que pasa", practice: "Efecto en el dia a dia", watch: "Que vigilar" },
    pt: { happening: "O que esta acontecendo", practice: "Efeito no dia a dia", watch: "O que observar" },
    in: { happening: "What's happening", practice: "What it does in practice", watch: "What to watch" },
  };

  const AREA_CONTENT = {
    en: {
      communication: {
        low: {
          title: "Hard topics get avoided, softened, or dropped",
          happening:
            "You still talk, but the conversations that actually cost you energy get postponed, rushed, or closed with vague comfort instead of a decision.",
          practice:
            "Small misunderstandings stack. You rehash the same point, or one person goes quiet while the other keeps pushing—so nothing actually moves.",
          watch: "Track whether 'we'll talk later' includes a time and one concrete next step. If not, it is avoidance wearing a polite face.",
        },
        mid: {
          title: "You talk, but the same fights come back unchanged",
          happening:
            "You have talks that calm things for a moment, but they rarely end with a clear who-does-what-by-when. The topic is not missing—closure is.",
          practice:
            "You both feel like you 'talked it through', yet nothing feels settled. That is why the same argument returns under new excuses.",
          watch: "After the next hard talk, write one sentence: what exactly was decided. If you cannot write it, that is the leak.",
        },
        high: {
          title: "Hard topics get addressed without losing the thread",
          happening:
            "When tension shows up, you tend to stay in the room mentally—you name the issue and keep it to one topic instead of dumping the whole backlog.",
          practice: "Repair is faster because facts beat guesses; you spend less energy defending against motives nobody actually stated.",
          watch: "Pressure-test follow-through, not tone—quietly slipping agreements is the main risk when communication is already strong.",
        },
      },
      emotional: {
        low: {
          title: "Support drops off right when stress hits",
          happening:
            "When pressure rises, one or both of you pulls back—less warmth, less patience, less 'we're on the same team' energy at the exact moment it is needed.",
          practice: "Hard days feel lonelier than neutral days. You start bracing instead of leaning in, so repair starts late or not at all.",
          watch: "Notice the first three hours after a disappointment: is contact easier or harder than usual? That window is your real baseline.",
        },
        mid: {
          title: "Closeness comes in waves—hard to rely on",
          happening:
            "Warmth shows up, then it suddenly thins out without a clear reason you can point to. The swing is the problem, not the average mood.",
          practice:
            "You cannot bank closeness for the next fight. When it is uneven, even reasonable requests sound like pressure and defensiveness spikes.",
          watch: "Pick one recurring stress day (work deadline, family event) and watch what happens to tone and availability—patterns hide there.",
        },
        high: {
          title: "Emotional backup is usually there when it counts",
          happening:
            "Under normal pressure, you still get responses that feel human—curiosity, repair bids, patience—not just silence or cold efficiency.",
          practice: "Conflict still costs energy, but it is less likely to turn into days of distance because someone re-opens contact.",
          watch: "Do not confuse strength with unlimited capacity—burnout still shows up as irritability first, not a big speech.",
        },
      },
      behavior: {
        low: {
          title: "Words and actions often point in different directions",
          happening:
            "Promises, plans, or apologies happen in conversation, but the week that follows does not match—cancellations, forgetfulness, or a totally different tone.",
          practice: "You stop trusting the calendar and the chat log. You double-check, nag, or withdraw because reliability feels shaky.",
          watch: "Pick one promise from the last 10 days and score it: done as agreed, partly, or not. Repeat weekly—numbers beat vibes.",
        },
        mid: {
          title: "Follow-through is real sometimes—and missing other times",
          happening:
            "You get stretches where things work, then the same issue resurfaces because a habit slipped—lateness, phone habits, chores, intimacy, money talk.",
          practice: "The relationship feels unpredictable: you never know which version of your partner shows up, so you pre-argue in your head.",
          watch: "Track two weeks, not one good weekend. Consistency is the whole game when behavior sits in the middle band.",
        },
        high: {
          title: "Behavior mostly matches what you agree out loud",
          happening:
            "When you decide something together, everyday life reflects it often enough that you are not living in constant verification mode.",
          practice: "Fights shorten because the baseline is not 'I cannot trust anything you say.'",
          watch: "Watch for slow drift: small broken commitments are how reliability erodes without drama.",
        },
      },
      trust: {
        low: {
          title: "You are reading everything through a doubt filter",
          happening:
            "Neutral actions get interpreted fast—late text, tired tone, a change of plans—and the story you tell yourself is often worst-case.",
          practice: "You spend hours decoding instead of asking one direct question. Decisions stall because evidence never feels 'clean enough.'",
          watch: "Write down three recent fears and the fact each one rested on. If facts are thin, you are running on guesses.",
        },
        mid: {
          title: "You half-know where you stand—and that is exhausting",
          happening:
            "You are not fully sure what you are building together, what is off-limits, or what 'commitment' means in weekly life—not just on holidays.",
          practice: "You negotiate daily life through hints and tests instead of clear rules, so small issues carry extra weight.",
          watch: "Name one decision you have delayed purely because the answer would force clarity you do not want yet.",
        },
        high: {
          title: "Intent and boundaries are mostly readable",
          happening:
            "You can say what you need without inventing a courtroom case. Disagreements still happen, but they are less fogged by mind-reading.",
          practice: "Lower guesswork means faster repair—you spend less time proving you are not the villain.",
          watch: "Clarity is not immunity—watch for new life stressors that make old agreements outdated without anyone naming it.",
        },
      },
    },
    pl: {
      communication: {
        low: {
          title: "Trudne tematy są odkładane, złagodzone albo ucinane",
          happening:
            "Nadal piszecie i rozmawiacie, ale rozmowy, które realnie kosztują Was energię, lądują „potem”, są skrócone albo kończą się ogólnym „już dobrze” zamiast decyzji.",
          practice:
            "Narastają drobne nieporozumienia. Wracacie do tego samego w kółko albo jedna osoba milknie, a druga naciska — i w praktyce nic nie idzie do przodu.",
          watch: "Sprawdź, czy „porozmawiamy później” ma godzinę i jeden konkretny następny krok. Jeśli nie, to ucieczka w grzecznej formie.",
        },
        mid: {
          title: "Rozmowy są, ale te same konflikty wracają bez zmiany",
          happening:
            "Macie rozmowy, które chwilowo uspokajają sytuację, ale nie kończą się konkretnymi ustaleniami. Problem nie jest w tym, że nie rozmawiacie, tylko że rozmowy niczego nie zamykają.",
          practice:
            "Oboje macie poczucie, że „wszystko wyjaśniliście”, a potem wraca ten sam spór, tylko pod innym pretekstem. To jest mechanizm, nie pech.",
          watch: "Po następnej ciężkiej rozmowie zapiszcie jedno zdanie: co dokładnie zostało ustalone. Jeśli nie da się tego zapisać, macie wyciek.",
        },
        high: {
          title: "Ciężkie tematy da się poruszyć bez rozwalania wątku",
          happening:
            "Gdy rośnie napięcie, zwykle zostajecie przy temacie: nazywacie problem i trzymacie jeden wątek zamiast wysypywać całą historię naraz.",
          practice: "Naprawa jest szybsza, bo liczą się fakty, a nie domysły — mniej energii idzie na obronę przed intencjami, których nikt nie powiedział.",
          watch: "Testujcie follow-through, nie ton — przy mocnej komunikacji największe ryzyko to ciche rozjeżdżanie się ustaleń.",
        },
      },
      emotional: {
        low: {
          title: "Wsparcie spada dokładnie wtedy, gdy jest najbardziej potrzebne",
          happening:
            "Gdy rośnie presja, jedna albo obie osoby się cofają: mniej ciepła, mniej cierpliwości, mniej poczucia „jesteśmy w tym razem” w momencie, kiedy to ma znaczenie.",
          practice: "Trudne dni są bardziej samotne niż zwykłe dni. Zaczynasz się nastawiać zamiast się oprzeć, więc naprawa startuje późno albo wcale.",
          watch: "Zobacz pierwsze trzy godziny po rozczarowaniu: kontakt jest łatwiejszy czy trudniejszy niż zwykle? To okno pokazuje realny standard.",
        },
        mid: {
          title: "Bliskość pojawia się falami — trudno się na niej oprzeć",
          happening:
            "Bywa ciepło, a potem nagle robi się chłodniej bez sensu, który da się wskazać palcem. Problemem jest huśtawka, nie „średni nastrój”.",
          practice:
            "Nie da się „zapisać” bliskości na następną kłótnię. Jak jest nierówno, nawet rozsądne prośby brzmią jak nacisk i rośnie defensywa.",
          watch: "Wybierz jeden powtarzający się stres (deadline, rodzina) i zobacz, co dzieje się z tonem i dostępnością — tam widać schemat.",
        },
        high: {
          title: "Emocjonalne wsparcie zwykle jest, kiedy trzeba",
          happening:
            "Przy zwykłej presji nadal dostajesz odpowiedzi „ludzkie”: ciekawość, próby naprawy, cierpliwość — nie tylko ciszę albo chłód.",
          practice: "Konflikt nadal kosztuje, ale mniej często zamienia się w kilka dni dystansu, bo ktoś wraca do kontaktu.",
          watch: "Mocny obszar to nie niewyczerpany zapas — wypalenie najpierw wygląda jak drażliwość, nie jak wielka rozmowa.",
        },
      },
      behavior: {
        low: {
          title: "Słowa i działania często mówią co innego",
          happening:
            "Obietnice, plany albo przeprosiny padają w rozmowie, ale kolejny tydzień tego nie potwierdza: odwołania, zapomnienie albo zupełnie inny ton.",
          practice: "Przestajesz ufać kalendarzowi i czatowi. Wracasz, przypominasz albo się wycofujesz, bo wiarygodność jest chwiejna.",
          watch: "Weź jedną obietnicę z ostatnich 10 dni i oceń: zrobione zgodnie z ustaleniem, częściowo, czy nie. Powtarzaj co tydzień — liczby biją „klimat”.",
        },
        mid: {
          title: "Bywa dobrze z realizacją — i bywa, że znika bez ostrzeżenia",
          happening:
            "Są okresy, kiedy jest OK, a potem wraca ten sam problem, bo nawyk się obsunął: spóźnienia, telefon, dom, bliskość, pieniądze.",
          practice: "Relacja jest trudna do przewidzenia: nie wiesz, która „wersja” partnera wróci, więc często wyprzedzasz kłótnię w głowie.",
          watch: "Patrz na dwa tygodnie, nie na jeden dobry weekend. Przy średnim wyniku liczy się powtarzalność, nie jednorazowy skok.",
        },
        high: {
          title: "Zachowanie na co dzień zwykle trzyma ustalenia",
          happening:
            "Jak coś ustalicie, życie codzienne dość często to odzwierciedla — nie żyjesz w trybie ciągłej weryfikacji.",
          practice: "Kłótnie są krótsze, bo baza to nie „nie wierzę niczemu, co mówisz”.",
          watch: "Uważaj na powolne ześlizgiwanie: małe niedotrzymania tak niszczą wiarygodność, że bez dramatu.",
        },
      },
      trust: {
        low: {
          title: "Interpretujesz wszystko przez filtr wątpliwości",
          happening:
            "Neutralne zachowania szybko dostają najgorszą interpretację: spóźniony SMS, zmęczony ton, zmiana planu — i od razu buduje się czarna narracja.",
          practice: "Tracisz godziny na dekodowanie zamiast zadać jedno proste pytanie. Decyzje stoją, bo „dowody” nigdy nie są wystarczająco czyste.",
          watch: "Zapisz trzy ostatnie lęki i fakt pod każdym. Jeśli faktów mało, jedziesz na domysłach.",
        },
        mid: {
          title: "Nie do końca wiecie, na czym stoicie — i to męczy",
          happening:
            "Nie jesteście pewni, co budujecie, co jest nie do zaakceptowania i co znaczy zaangażowanie w codziennym życiu — nie tylko „w święta”.",
          practice: "Codzienność idzie przez aluzje i testy zamiast jasnych zasad, więc drobne sprawy niosą za dużą wagę.",
          watch: "Wskaż jedną decyzję, którą odkładasz, bo odpowiedź wymusiłaby klarowność, której jeszcze nie chcesz.",
        },
        high: {
          title: "Intencje i granice da się zwykle odczytać",
          happening:
            "Da się powiedzieć, czego potrzebujesz, bez budowania aktu oskarżenia. Spory są, ale mniej zamglone mind-readingiem.",
          practice: "Mniej zgadywania to szybsza naprawa — mniej czasu na udowadnianie, że nie jesteś złym.",
          watch: "Klarowność nie chroni przed życiem: nowy stres potrafi zdezaktualizować stare ustalenia bez słowa.",
        },
      },
    },
  };

  function formatAreaDimensionBody(locale, content) {
    const labels = AREA_BODY_LABELS[locale] || AREA_BODY_LABELS.en;
    if (content && content.happening && content.practice && content.watch) {
      return `${labels.happening}: ${content.happening}\n\n${labels.practice}: ${content.practice}\n\n${labels.watch}: ${content.watch}`;
    }
    return (content && content.body) || "";
  }

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
        happening: {
          low: "In diesem Bereich ist die Unsicherheit hoch und sie steuert euren Alltag direkt.",
          mid: "Hier fehlen oft klare Abschlusse: es wird viel gesprochen, aber wenig zuverlassig entschieden.",
          high: "Dieser Bereich wirkt stabil und stutzt die Beziehung im Alltag spürbar.",
        },
        practice: {
          low: "Konflikte dauern langer, weil ihr Energie in Deutung statt in eine konkrete Vereinbarung steckt.",
          mid: "Alte Reibung kommt zuruck, weil die gleichen Themen ohne messbaren Abschluss bleiben.",
          high: "Weniger Raten, weniger Nachfassen: Zusagen und Verhalten passen haufiger zusammen.",
        },
        watch: {
          low: "Testet 7 Tage lang ein Thema mit einem schriftlichen nachsten Schritt und einem Datum.",
          mid: "Nach einem schweren Gesprach einen Satz schreiben: was ist entschieden? Wenn leer, war es kein Abschluss.",
          high: "Achtet auf kleines nachlassendes Follow-through, nicht auf den Gesamteindruck.",
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
        happening: {
          low: "En esta area la incertidumbre es alta y ya condiciona decisiones importantes.",
          mid: "Hay conversacion, pero faltan cierres claros: el mismo tema vuelve con otro disfraz.",
          high: "Esta area se ve mas estable y sostiene el resto del sistema.",
        },
        practice: {
          low: "Pagas mas costo emocional en cada friccion porque no hay reglas claras que reduzcan interpretacion.",
          mid: "Mezclas alivio momentaneo con el mismo conflicto sin raiz resuelta.",
          high: "Menos adivinanzas: lo acordado se nota en la semana, no solo en la charla.",
        },
        watch: {
          low: "Elegid un tema recurrente y cerradlo con responsable, accion y fecha.",
          mid: "Tras la proxima charla dificil, escribid una linea: que quedo decidido.",
          high: "Vigilad acuerdos pequenos que se deslizan sin drama.",
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
        happening: {
          low: "Nesta area a incerteza esta alta e ja puxa decisoes do dia a dia.",
          mid: "Ha dialogo, mas falta fechamento: o mesmo assunto volta com outro pretexto.",
          high: "Esta area esta mais estavel e sustenta o restante da relacao.",
        },
        practice: {
          low: "Cada atrito custa mais porque falta padrao claro que corte interpretacao infinita.",
          mid: "Alivio rapido nao substitui acordo concreto, entao o ciclo reabre.",
          high: "Menos adivinhacao: combinado vira rotina visivel na semana.",
        },
        watch: {
          low: "Escolham um tema recorrente e fechem com dono, acao e data.",
          mid: "Apos a proxima conversa dificil, escrevam uma linha: o que ficou decidido.",
          high: "Observem combinados pequenos que vao escorregando.",
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
        happening: {
          low: "Uncertainty here is high and it is already steering day-to-day decisions.",
          mid: "You talk, but the same issue returns because nothing concrete gets closed.",
          high: "This area looks more stable and supports the wider relationship structure.",
        },
        practice: {
          low: "Friction costs more because you spend energy decoding instead of agreeing a next step.",
          mid: "Short relief replaces a real fix, so the same fight comes back under a new headline.",
          high: "Less guesswork: what you agree shows up in behavior across the week.",
        },
        watch: {
          low: "Pick one recurring topic and close it with owner, action, and a date.",
          mid: "After the next hard talk, write one line: what was actually decided.",
          high: "Watch small agreements quietly slipping—that is how trust erodes.",
        },
      },
    };

    const localized = fallbackByLocale[locale] || fallbackByLocale.in;
    return {
      title: `${localized.names[areaKey]}: ${localized.titles[segment]}`,
      happening: localized.happening[segment],
      practice: localized.practice[segment],
      watch: localized.watch[segment],
    };
  }

  const RESULT_LAYOUT_UI =   {
    "en": {
      "eyebrow": "Your result",
      "title": "Your Trust Index",
      "visualTitle": "Your score, quickly",
      "scaleLow": "Low",
      "scaleMid": "Medium",
      "scaleHigh": "High",
      "visualSub": "From your answers",
      "freeHeading": "What is happening",
      "tipsHeading": "What to do now",
      "premiumEyebrow": "Full report",
      "premiumTitle": "The score only shows the surface",
      "premiumSubhead": "Below is the concrete part: where conversation, behavior, and trust are failing.",
      "premiumIntro": "If you stop on this screen, you are left with guesses.",
      "lockedTitles": [
        "Where conversations break",
        "Where distance is growing",
        "What changed in behavior",
        "Where trust is being damaged",
        "What this is likely to become",
        "What to do before it gets worse"
      ],
      "lockedTeaser": "This is not one bad day. The same problem returns step by step.",
      "lockedLabel": "Locked",
      "previewLabels": [
        "Communication",
        "Stability",
        "Trust",
        "Closeness"
      ],
      "previewOverlay": "Preview",
      "paywallHook": "Without the full report, it is hard to tell a stress moment from an ongoing problem.",
      "scoreLabel": "Your current score",
      "valueHeading": "Inside",
      "valueItems": [
        "Which answers pushed your score down the most",
        "What still works and where it already fails",
        "What happens if everything stays as it is",
        "How contact may look in 3-6 weeks",
        "What to base your decision on without guessing"
      ],
      "priceSuffix": "one-time payment",
      "ctaButton": "Unlock full report",
      "ctaSecondary": "See what drives this score",
      "unlockedTitle": "Full report unlocked",
      "unlockedBody": "You now have full access. Read the whole report.",
      "unlockedButton": "Go to report",
      "notes": [
        "Secure Stripe payment",
        "Instant access after payment",
        "Most people in this situation open the full report"
      ],
      "disclaimer": "This is an interpretation of your situation, not psychological, medical, or legal advice.",
      "freeTips": [
        "Watch what repeats, not one intense moment",
        "Separate facts from assumptions",
        "Do not decide in peak emotion"
      ]
    },
    "pl": {
      "eyebrow": "Twój wynik",
      "title": "Twój Trust Index",
      "visualTitle": "Twój wynik w skrócie",
      "scaleLow": "Niski",
      "scaleMid": "Średni",
      "scaleHigh": "Wysoki",
      "visualSub": "Na podstawie odpowiedzi",
      "freeHeading": "Co się dzieje",
      "tipsHeading": "Co zrobić teraz",
      "premiumEyebrow": "Pełny raport",
      "premiumTitle": "Wynik pokazuje tylko wierzch",
      "premiumSubhead": "Niżej jest konkret: co się psuje w rozmowach, zachowaniu i zaufaniu.",
      "premiumIntro": "Jeśli skończysz na tym ekranie, zostajesz z domysłami.",
      "lockedTitles": [
        "W którym momencie rozmowa się urywa",
        "Po czym dokładnie widać oddalenie",
        "Które zachowania zmieniły się najbardziej",
        "Co najmocniej podcina zaufanie",
        "Jak to będzie wyglądać za kilka tygodni",
        "Co jeszcze można zatrzymać"
      ],
      "lockedTeaser": "To nie jest jeden gorszy dzień. Ten sam problem wraca krok po kroku.",
      "lockedLabel": "Zablokowane",
      "previewLabels": [
        "Komunikacja",
        "Stabilność",
        "Zaufanie",
        "Bliskość"
      ],
      "previewOverlay": "Podgląd",
      "paywallHook": "Bez pełnego raportu trudno odróżnić chwilę stresu od stałego problemu.",
      "scoreLabel": "Twój aktualny wynik",
      "valueHeading": "W środku",
      "valueItems": [
        "Które odpowiedzi najmocniej obniżyły wynik",
        "Co jeszcze działa i gdzie to się kończy",
        "Co się stanie, jeśli wszystko zostanie jak teraz",
        "Jak może wyglądać kontakt za 3–6 tygodni",
        "Na czym oprzeć decyzję bez zgadywania"
      ],
      "priceSuffix": "jednorazowa płatność",
      "ctaButton": "Odblokuj pełny raport",
      "ctaSecondary": "Zobacz, co napędza wynik",
      "unlockedTitle": "Pełny raport odblokowany",
      "unlockedBody": "Masz pełny dostęp. Przeczytaj cały raport.",
      "unlockedButton": "Przejdź do raportu",
      "notes": [
        "Bezpieczna płatność Stripe",
        "Dostęp od razu po płatności",
        "Większość osób w tej sytuacji otwiera pełny raport"
      ],
      "disclaimer": "To jest interpretacja Twojej sytuacji, nie porada psychologiczna, medyczna ani prawna.",
      "freeTips": [
        "Patrz na to, co się powtarza, nie na jeden mocny moment",
        "Oddziel fakty od założeń",
        "Nie podejmuj decyzji w szczycie emocji"
      ]
    },
    "de": {
      "eyebrow": "Dein Ergebnis",
      "title": "Dein Trust Index",
      "visualTitle": "Dein Wert auf einen Blick",
      "scaleLow": "Niedrig",
      "scaleMid": "Mittel",
      "scaleHigh": "Hoch",
      "visualSub": "Aus deinen Antworten",
      "freeHeading": "Was passiert",
      "tipsHeading": "Was jetzt zu tun ist",
      "premiumEyebrow": "Vollständiger Bericht",
      "premiumTitle": "Der Wert zeigt nur die Oberfläche",
      "premiumSubhead": "Unten kommt der konkrete Teil: wo Gespräch, Verhalten und Vertrauen kippen.",
      "premiumIntro": "Wenn du hier stoppst, bleibst du bei Vermutungen.",
      "lockedTitles": [
        "Wo Gespräche abbrechen",
        "Wo Abstand wächst",
        "Was sich im Verhalten geändert hat",
        "Wo Vertrauen Schaden nimmt",
        "Wozu sich das entwickeln kann",
        "Was du tun solltest, bevor es kippt"
      ],
      "lockedTeaser": "Das ist nicht nur ein schlechter Tag. Dasselbe Problem kommt Schritt für Schritt zurück.",
      "lockedLabel": "Gesperrt",
      "previewLabels": [
        "Kommunikation",
        "Stabilität",
        "Vertrauen",
        "Nähe"
      ],
      "previewOverlay": "Vorschau",
      "paywallHook": "Ohne den vollen Bericht ist schwer zu sehen, was nur Stress ist und was schon dauerhaft kippt.",
      "scoreLabel": "Dein aktueller Wert",
      "valueHeading": "Im Bericht",
      "valueItems": [
        "Welche Antworten den Wert am stärksten gedrückt haben",
        "Was noch trägt und wo es schon endet",
        "Was passiert, wenn alles so bleibt",
        "Wie Kontakt in 3-6 Wochen aussehen kann",
        "Worauf du eine Entscheidung ohne Raten stützt"
      ],
      "priceSuffix": "einmalige Zahlung",
      "ctaButton": "Vollständigen Bericht freischalten",
      "ctaSecondary": "Sieh, was den Wert treibt",
      "unlockedTitle": "Vollständiger Bericht freigeschaltet",
      "unlockedBody": "Du hast jetzt vollen Zugriff. Lies den ganzen Bericht.",
      "unlockedButton": "Zum Bericht",
      "notes": [
        "Sichere Stripe-Zahlung",
        "Sofortiger Zugriff nach Zahlung",
        "Die meisten in dieser Lage öffnen den vollständigen Bericht"
      ],
      "disclaimer": "Das ist eine Einschätzung deiner Situation, keine psychologische, medizinische oder rechtliche Beratung.",
      "freeTips": [
        "Achte auf Wiederholung, nicht auf einen einzelnen Moment",
        "Trenne Fakten von Annahmen",
        "Triff keine große Entscheidung im Emotionshoch"
      ]
    },
    "es": {
      "eyebrow": "Tu resultado",
      "title": "Tu Trust Index",
      "visualTitle": "Tu resultado en breve",
      "scaleLow": "Bajo",
      "scaleMid": "Medio",
      "scaleHigh": "Alto",
      "visualSub": "Según tus respuestas",
      "freeHeading": "Qué está pasando",
      "tipsHeading": "Qué hacer ahora",
      "premiumEyebrow": "Informe completo",
      "premiumTitle": "El número solo enseña la superficie",
      "premiumSubhead": "Abajo está lo concreto: dónde fallan conversación, conducta y confianza.",
      "premiumIntro": "Si te quedas aquí, te quedas con suposiciones.",
      "lockedTitles": [
        "Dónde se cortan vuestras conversaciones",
        "Dónde crece la distancia",
        "Qué cambió en el comportamiento",
        "Dónde se está rompiendo la confianza",
        "En qué puede terminar esto",
        "Qué hacer antes de que empeore"
      ],
      "lockedTeaser": "No es un mal día aislado. El mismo problema vuelve paso a paso.",
      "lockedLabel": "Bloqueado",
      "previewLabels": [
        "Comunicación",
        "Estabilidad",
        "Confianza",
        "Cercanía"
      ],
      "previewOverlay": "Vista previa",
      "paywallHook": "Sin el informe completo cuesta separar un momento de estrés de un problema que ya se repite.",
      "scoreLabel": "Tu resultado actual",
      "valueHeading": "Dentro",
      "valueItems": [
        "Qué respuestas bajaron más tu resultado",
        "Qué todavía funciona y dónde ya se rompe",
        "Qué pasará si todo sigue igual",
        "Cómo puede verse el contacto en 3-6 semanas",
        "En qué basar una decisión sin adivinar"
      ],
      "priceSuffix": "pago único",
      "ctaButton": "Desbloquear informe completo",
      "ctaSecondary": "Ver qué mueve el resultado",
      "unlockedTitle": "Informe completo desbloqueado",
      "unlockedBody": "Ya tienes acceso total. Lee todo el informe.",
      "unlockedButton": "Ir al informe",
      "notes": [
        "Pago seguro con Stripe",
        "Acceso inmediato tras el pago",
        "La mayoría en esta situación abre el informe completo"
      ],
      "disclaimer": "Esto es una interpretación de tu situación, no asesoramiento psicológico, médico ni legal.",
      "freeTips": [
        "Mira lo que se repite, no un momento aislado",
        "Separa hechos de suposiciones",
        "No decidas en pico emocional"
      ]
    },
    "pt": {
      "eyebrow": "O teu resultado",
      "title": "O teu Trust Index",
      "visualTitle": "O teu resultado em resumo",
      "scaleLow": "Baixo",
      "scaleMid": "Médio",
      "scaleHigh": "Alto",
      "visualSub": "Com base nas tuas respostas",
      "freeHeading": "O que está a acontecer",
      "tipsHeading": "O que fazer agora",
      "premiumEyebrow": "Relatório completo",
      "premiumTitle": "O número mostra só a superfície",
      "premiumSubhead": "Em baixo está a parte concreta: onde conversa, comportamento e confiança falham.",
      "premiumIntro": "Se parares aqui, ficas com suposições.",
      "lockedTitles": [
        "Onde as conversas quebram",
        "Onde a distância cresce",
        "O que mudou no comportamento",
        "Onde a confiança está a falhar",
        "No que isto pode acabar",
        "O que fazer antes de piorar"
      ],
      "lockedTeaser": "Isto não é só um dia mau. O mesmo problema volta passo a passo.",
      "lockedLabel": "Bloqueado",
      "previewLabels": [
        "Comunicação",
        "Estabilidade",
        "Confiança",
        "Proximidade"
      ],
      "previewOverlay": "Prévia",
      "paywallHook": "Sem o relatório completo, é difícil separar um momento de stress de um problema que já se repete.",
      "scoreLabel": "O teu resultado atual",
      "valueHeading": "Lá dentro",
      "valueItems": [
        "Que respostas baixaram mais o teu resultado",
        "O que ainda funciona e onde já falha",
        "O que acontece se tudo continuar igual",
        "Como pode estar o contacto em 3-6 semanas",
        "Em que basear uma decisão sem adivinhar"
      ],
      "priceSuffix": "pagamento único",
      "ctaButton": "Desbloquear relatório completo",
      "ctaSecondary": "Ver o que move o resultado",
      "unlockedTitle": "Relatório completo desbloqueado",
      "unlockedBody": "Agora tens acesso total. Lê o relatório inteiro.",
      "unlockedButton": "Ir para o relatório",
      "notes": [
        "Pagamento seguro com Stripe",
        "Acesso imediato após pagamento",
        "A maioria nesta situação abre o relatório completo"
      ],
      "disclaimer": "Isto é uma interpretação da tua situação, não aconselhamento psicológico, médico ou jurídico.",
      "freeTips": [
        "Olha para o que se repete, não para um momento isolado",
        "Separa factos de suposições",
        "Não decidas no pico emocional"
      ]
    }
  };

  const CHECKOUT_UI = {
    en: {
      htmlLang: "en",
      pageTitle: "Pay — RelationshipScan | Full report",
      metaDescription: "One-time payment. Full RelationshipScan report. Instant access after checkout.",
      eyebrow: "Pay",
      productTitle: "RelationshipScan — full report",
      productDesc: "You pay once. Stripe handles the card. You get the full report right after.",
      priceLabel: "Price",
      paymentNoteShort: "One-time • Instant access",
      stripeCta: "Pay with Stripe",
      backToHome: "← Back to home",
      stripeFooterNote: "Stripe processes the payment.",
    },
    pl: {
      htmlLang: "pl",
      pageTitle: "Płatność — RelationshipScan | Pełny raport",
      metaDescription: "Jednorazowa płatność. Pełny raport RelationshipScan. Dostęp od razu po checkout.",
      eyebrow: "Płatność",
      productTitle: "RelationshipScan — pełny raport",
      productDesc: "Płacisz raz. Kartą zajmuje się Stripe. Raport od razu po zaksięgowaniu.",
      priceLabel: "Cena",
      paymentNoteShort: "Jednorazowo • Dostęp od razu",
      stripeCta: "Zapłać przez Stripe",
      backToHome: "← Wróć na stronę główną",
      stripeFooterNote: "Płatność obsługuje Stripe.",
    },
    de: {
      htmlLang: "de",
      pageTitle: "Zahlung — RelationshipScan | Vollständiger Bericht",
      metaDescription: "Einmalzahlung. Vollständiger RelationshipScan-Bericht. Sofortiger Zugriff nach Checkout.",
      eyebrow: "Zahlung",
      productTitle: "RelationshipScan — vollständiger Bericht",
      productDesc: "Du zahlst einmal. Stripe übernimmt die Karte. Danach sofort Zugriff.",
      priceLabel: "Preis",
      paymentNoteShort: "Einmalig • Sofortiger Zugriff",
      stripeCta: "Mit Stripe zahlen",
      backToHome: "← Zurück zur Startseite",
      stripeFooterNote: "Zahlung über Stripe.",
    },
    es: {
      htmlLang: "es",
      pageTitle: "Pago — RelationshipScan | Informe completo",
      metaDescription: "Pago único. Informe completo RelationshipScan. Acceso inmediato tras el checkout.",
      eyebrow: "Pago",
      productTitle: "RelationshipScan — informe completo",
      productDesc: "Pagas una vez. Stripe cobra la tarjeta. Acceso al informe al instante.",
      priceLabel: "Precio",
      paymentNoteShort: "Pago único • Acceso inmediato",
      stripeCta: "Pagar con Stripe",
      backToHome: "← Volver al inicio",
      stripeFooterNote: "El pago lo procesa Stripe.",
    },
    pt: {
      htmlLang: "pt",
      pageTitle: "Pagamento — RelationshipScan | Relatório completo",
      metaDescription: "Pagamento único. Relatório completo RelationshipScan. Acesso imediato após checkout.",
      eyebrow: "Pagamento",
      productTitle: "RelationshipScan — relatório completo",
      productDesc: "Pagas uma vez. O Stripe trata do cartão. Acesso ao relatório na hora.",
      priceLabel: "Preço",
      paymentNoteShort: "Pagamento único • Acesso imediato",
      stripeCta: "Pagar com Stripe",
      backToHome: "← Voltar ao início",
      stripeFooterNote: "O pagamento é processado pela Stripe.",
    },
    in: {
      htmlLang: "en-IN",
      pageTitle: "Pay — RelationshipScan | Full report",
      metaDescription: "One-time payment. Full RelationshipScan report. Instant access after checkout.",
      eyebrow: "Pay",
      productTitle: "RelationshipScan — full report",
      productDesc: "You pay once. Stripe handles the card. You get the full report right after.",
      priceLabel: "Price",
      paymentNoteShort: "One-time • Instant access",
      stripeCta: "Pay with Stripe",
      backToHome: "← Back to home",
      stripeFooterNote: "Stripe processes the payment.",
    },
  };


  const paywallModalText = {
    pl: {
      title: "Pełny raport",
      subtitle: "Dopiero po płatności Stripe widać całość.",
      button: "Idę do Stripe",
    },
    en: {
      title: "Full report",
      subtitle: "You only get the full write-up after Stripe payment.",
      button: "Continue to Stripe",
    },
    de: {
      title: "Vollständiger Bericht",
      subtitle: "Den vollen Text siehst du erst nach der Stripe-Zahlung.",
      button: "Weiter zu Stripe",
    },
    es: {
      title: "Informe completo",
      subtitle: "El texto completo solo aparece tras pagar con Stripe.",
      button: "Ir a Stripe",
    },
    pt: {
      title: "Relatório completo",
      subtitle: "O texto completo só aparece depois do pagamento Stripe.",
      button: "Ir para o Stripe",
    },
    in: {
      title: "Full report",
      subtitle: "You only get the full write-up after Stripe payment.",
      button: "Continue to Stripe",
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
      reportPageTitle: "Pełny raport — RelationshipScan",
      successPageTitle: "Płatność potwierdzona — RelationshipScan",
      donutLabel: "Trust Index",
      homeLink: "Start",
      retakeLink: "Powtórz skan",
      noResultTitle: "Brak wyniku",
      noResultBody: "Wróć do testu, żeby zobaczyć swój wynik.",
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
    const resolved = normalizeLocale(lang || getModalLang());
    const text = paywallModalText[resolved] || paywallModalText.en;
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

  const PREPAYWALL_SECTION_CONTENT = {
    pl: {
      stabilna: {
        title: "WYSOKI WYNIK (75-100)",
        subtitle: "Relacja jest spójna i funkcjonalna",
        sections: [
          { heading: "Obraz całości", paragraph: "W większości obszarów działacie razem: jest inicjatywa z obu stron, kontakt nie zależy od jednego z Was, sprawy są ogarniane na bieżąco. Widać, że potraficie wrócić do równowagi po napięciu, a codzienne rzeczy nie zamieniają się w problem." },
          { heading: "Co działa", list: [
            "Inicjatywa - obie strony wychodzą z propozycjami (kontakt, spotkania, decyzje)",
            "Zaangażowanie - czas i uwaga są rozłożone dość równo",
            "Bliskość - obecna nie tylko „od święta”, ale w zwykłych sytuacjach",
            "Odpowiedzialność - sprawy są doprowadzane do końca (organizacja, zobowiązania)",
            "Granice - różnice nie rozwalają relacji, tylko są do ogarnięcia",
          ] },
          { heading: "Sygnały ostrzegawcze", list: [
            "odkładanie drobnych tematów „na później”",
            "spadki inicjatywy u jednej ze stron w gorszych okresach",
            "rutyna, która zaczyna wypierać uważność",
          ] },
          { heading: "Co z tego wynika", paragraph: "Relacja działa, bo ma równowagę między bliskością a autonomią. Utrzymanie tego wymaga pilnowania drobnych rzeczy zanim się skumulują." },
        ],
      },
      napiecia: {
        title: "ŚREDNI WYNIK (45-74)",
        subtitle: "Relacja działa, ale traci równowagę",
        sections: [
          { heading: "Obraz całości", paragraph: "Niektóre obszary działają dobrze, inne są przeciążone albo zaniedbane. Widać, że ciężar relacji nie rozkłada się równo - jedna strona częściej inicjuje, pilnuje kontaktu albo bierze odpowiedzialność za wspólne sprawy." },
          { heading: "Co nie domaga", list: [
            "Inicjatywa - częściej po jednej stronie",
            "Zaangażowanie - nierówne (ktoś „ciągnie” więcej)",
            "Czas razem - jest, ale bywa przypadkowy lub ograniczony",
            "Bliskość - pojawia się, ale nie jest stabilna",
            "Napięcie - nie znika, tylko przechodzi na kolejne sytuacje",
          ] },
          { heading: "Jak to wygląda w praktyce", list: [
            "plany są robione, ale łatwo się rozjeżdżają",
            "drobne rzeczy zaczynają irytować bardziej niż powinny",
            "kontakt bywa intensywny, a potem wyraźnie słabnie",
            "ważne sprawy są odkładane, bo „teraz nie ma kiedy”",
          ] },
          { heading: "Co z tego wynika", paragraph: "Relacja nie rozpada się, ale zaczyna opierać się na wysiłku jednej strony. Jeśli to się utrzyma, pojawi się zmęczenie i dystans." },
        ],
      },
      niepewnosc: {
        title: "NISKI WYNIK (0-44)",
        subtitle: "Relacja traci strukturę i kierunek",
        sections: [
          { heading: "Obraz całości", paragraph: "Brakuje wspólnego rytmu. Kontakt nie jest czymś oczywistym, tylko dzieje się nieregularnie. Inicjatywa, zaangażowanie i odpowiedzialność są ograniczone albo jednostronne." },
          { heading: "Co nie działa", list: [
            "Inicjatywa - słaba lub jednostronna",
            "Zaangażowanie - spada lub jest niestabilne",
            "Czas razem - rzadki albo powierzchowny",
            "Bliskość - wycofana lub sporadyczna",
            "Napięcie - zostaje i narasta",
          ] },
          { heading: "Jak to wygląda w praktyce", list: [
            "kontakt jest przerywany albo ograniczony do minimum",
            "sprawy nie są załatwiane, tylko zostają",
            "jedna lub obie strony wycofują się z relacji",
            "nawet proste rzeczy zaczynają być trudne do ogarnięcia",
          ] },
          { heading: "Co z tego wynika", paragraph: "Relacja nie ma stabilnego oparcia. Jeśli ten stan się utrzyma, dystans będzie się pogłębiał, a kontakt stanie się coraz bardziej ograniczony." },
        ],
      },
    },
    en: {
      stabilna: {
        title: "HIGH SCORE (75-100)",
        subtitle: "The relationship is stable and well-balanced",
        sections: [
          { heading: "Overall picture", paragraph: "Most areas are working: both sides take initiative, time and attention are shared, and everyday matters are handled without friction. After tension, the relationship returns to balance without long disruption." },
          { heading: "What works", list: [
            "Initiative - both sides engage",
            "Involvement - effort is balanced",
            "Closeness - present in everyday life",
            "Responsibility - commitments are handled",
            "Boundaries - differences don’t break the connection",
          ] },
          { heading: "Warning signs", list: [
            "postponing small issues",
            "temporary drop in effort from one side",
            "routine replacing attention",
          ] },
          { heading: "What it means", paragraph: "The relationship works because it stays balanced." },
        ],
      },
      napiecia: {
        title: "MEDIUM SCORE (45-74)",
        subtitle: "The relationship is uneven",
        sections: [
          { heading: "Overall picture", paragraph: "Some areas work well, others are strained. The effort is not evenly distributed." },
          { heading: "What is off", list: [
            "Initiative - often comes from one side",
            "Involvement - unbalanced",
            "Time together - inconsistent",
            "Closeness - fluctuates",
            "Tension - carries over",
          ] },
          { heading: "What it means", paragraph: "The relationship depends on effort rather than stability." },
        ],
      },
      niepewnosc: {
        title: "LOW SCORE (0-44)",
        subtitle: "The relationship is losing structure",
        sections: [
          { heading: "Overall picture", paragraph: "There is no stable rhythm. Contact is inconsistent and often one-sided." },
          { heading: "What is not working", list: [
            "Initiative - low or one-sided",
            "Involvement - reduced",
            "Time together - limited",
            "Closeness - weak",
            "Tension - unresolved",
          ] },
          { heading: "What it means", paragraph: "Without change, the relationship will continue to weaken." },
        ],
      },
    },
    de: {
      stabilna: {
        title: "HOHER WERT (75-100)",
        subtitle: "Die Beziehung ist stabil und funktional",
        sections: [
          { heading: "Gesamtbild", paragraph: "In den meisten Bereichen funktioniert ihr als Team: beide Seiten zeigen Initiative, der Kontakt hängt nicht nur von einer Person ab, und alltägliche Dinge werden laufend geklärt. Nach Spannungen findet ihr wieder ins Gleichgewicht zurück, und Alltagsthemen entwickeln sich nicht zu Problemen." },
          { heading: "Was funktioniert", list: [
            "Initiative - beide Seiten bringen Vorschläge ein (Kontakt, Pläne, Entscheidungen)",
            "Engagement - Zeit und Aufmerksamkeit sind relativ ausgeglichen",
            "Nähe - nicht nur in besonderen Momenten, sondern auch im Alltag präsent",
            "Verantwortung - Verpflichtungen werden umgesetzt (Organisation, Absprachen)",
            "Grenzen - Unterschiede führen nicht zum Bruch, sondern bleiben handhabbar",
          ] },
          { heading: "Warnsignale", list: [
            "kleine Themen werden auf später verschoben",
            "vorübergehender Rückgang der Initiative auf einer Seite",
            "Routine ersetzt allmählich Aufmerksamkeit",
          ] },
          { heading: "Was das bedeutet", paragraph: "Die Beziehung funktioniert durch das Gleichgewicht zwischen Nähe und Eigenständigkeit. Dieses Niveau bleibt nur erhalten, wenn kleine Dinge rechtzeitig geklärt werden." },
        ],
      },
      napiecia: {
        title: "MITTLERER WERT (45-74)",
        subtitle: "Die Beziehung funktioniert, verliert aber an Balance",
        sections: [
          { heading: "Gesamtbild", paragraph: "Einige Bereiche funktionieren gut, andere sind belastet oder vernachlässigt. Die Verantwortung ist ungleich verteilt - eine Person übernimmt häufiger Initiative, Kontakt oder Organisation." },
          { heading: "Was nicht funktioniert", list: [
            "Initiative - häufiger auf einer Seite",
            "Engagement - ungleich verteilt",
            "Gemeinsame Zeit - vorhanden, aber unregelmäßig",
            "Nähe - vorhanden, aber nicht stabil",
            "Spannung - bleibt bestehen und überträgt sich",
          ] },
          { heading: "Wie es sich zeigt", list: [
            "Pläne werden gemacht, halten aber nicht",
            "kleine Dinge werden schnell belastend",
            "Kontakt schwankt zwischen intensiv und schwach",
            "wichtige Themen werden verschoben",
          ] },
          { heading: "Was das bedeutet", paragraph: "Die Beziehung besteht, basiert aber zunehmend auf einseitigem Aufwand. Das führt zu Ermüdung und Distanz." },
        ],
      },
      niepewnosc: {
        title: "NIEDRIGER WERT (0-44)",
        subtitle: "Die Beziehung verliert Struktur und Richtung",
        sections: [
          { heading: "Gesamtbild", paragraph: "Es fehlt ein gemeinsamer Rhythmus. Kontakt entsteht unregelmäßig. Initiative, Engagement und Verantwortung sind schwach oder einseitig." },
          { heading: "Was nicht funktioniert", list: [
            "Initiative - gering oder einseitig",
            "Engagement - sinkt oder schwankt",
            "Gemeinsame Zeit - selten oder oberflächlich",
            "Nähe - zurückgezogen oder sporadisch",
            "Spannung - bleibt bestehen und wächst",
          ] },
          { heading: "Wie es sich zeigt", list: [
            "Kontakt ist unterbrochen oder minimal",
            "Themen werden nicht geklärt",
            "Rückzug aus der Beziehung",
            "selbst einfache Dinge werden schwierig",
          ] },
          { heading: "Was das bedeutet", paragraph: "Die Beziehung hat kein stabiles Fundament. Ohne Veränderung nimmt die Distanz weiter zu." },
        ],
      },
    },
    es: {
      stabilna: {
        title: "RESULTADO ALTO (75-100)",
        subtitle: "La relación es coherente y funcional",
        sections: [
          { heading: "Visión general", paragraph: "En la mayoría de los aspectos funcionan como un equipo: hay iniciativa por parte de ambos, el contacto no depende de una sola persona y las situaciones cotidianas se gestionan de forma continua. Se nota que, después de momentos de tensión, sois capaces de recuperar el equilibrio y que los asuntos diarios no se convierten en problemas prolongados." },
          { heading: "Qué funciona", list: [
            "Iniciativa - ambas personas proponen contacto, planes y decisiones",
            "Compromiso - el tiempo y la atención están relativamente equilibrados",
            "Cercanía - presente no solo en momentos especiales, sino también en lo cotidiano",
            "Responsabilidad - los compromisos se cumplen (organización, acuerdos)",
            "Límites - las diferencias no rompen la relación, se pueden gestionar",
          ] },
          { heading: "Señales de alerta", list: [
            "aplazar temas pequeños “para más adelante”",
            "descensos puntuales de iniciativa por parte de uno",
            "la rutina empieza a sustituir la atención",
          ] },
          { heading: "Qué significa", paragraph: "La relación funciona porque mantiene un equilibrio entre cercanía y autonomía. Para sostener este nivel, es importante atender a los detalles antes de que se acumulen." },
        ],
      },
      napiecia: {
        title: "RESULTADO MEDIO (45-74)",
        subtitle: "La relación funciona, pero pierde equilibrio",
        sections: [
          { heading: "Visión general", paragraph: "Algunas áreas funcionan bien, mientras que otras están sobrecargadas o descuidadas. Se observa que el peso de la relación no se reparte de forma equitativa: una persona inicia más, mantiene el contacto o asume más responsabilidad en lo compartido." },
          { heading: "Qué no funciona", list: [
            "Iniciativa - más frecuente en una sola persona",
            "Compromiso - desigual (alguien sostiene más)",
            "Tiempo juntos - existe, pero es irregular o limitado",
            "Cercanía - aparece, pero no es constante",
            "Tensión - no desaparece, se traslada a otras situaciones",
          ] },
          { heading: "Cómo se ve en la práctica", list: [
            "se hacen planes, pero se desorganizan con facilidad",
            "pequeñas situaciones generan más irritación de lo habitual",
            "el contacto pasa de ser intenso a debilitarse claramente",
            "temas importantes se posponen porque “no es el momento”",
          ] },
          { heading: "Qué significa", paragraph: "La relación no se rompe, pero empieza a depender del esfuerzo de una sola parte. Si esto continúa, aparecerán cansancio y distancia." },
        ],
      },
      niepewnosc: {
        title: "RESULTADO BAJO (0-44)",
        subtitle: "La relación pierde estructura y dirección",
        sections: [
          { heading: "Visión general", paragraph: "Falta un ritmo compartido. El contacto no es algo natural, sino irregular. La iniciativa, el compromiso y la responsabilidad son limitados o unilaterales." },
          { heading: "Qué no funciona", list: [
            "Iniciativa - débil o concentrada en una sola persona",
            "Compromiso - bajo o inestable",
            "Tiempo juntos - escaso o superficial",
            "Cercanía - limitada o esporádica",
            "Tensión - permanece y se acumula",
          ] },
          { heading: "Cómo se ve en la práctica", list: [
            "el contacto se interrumpe o se reduce al mínimo",
            "los asuntos no se resuelven y quedan pendientes",
            "una o ambas personas se retiran de la relación",
            "incluso las cosas simples resultan difíciles de manejar",
          ] },
          { heading: "Qué significa", paragraph: "La relación no tiene una base estable. Si la situación se mantiene, la distancia aumentará y el contacto será cada vez más limitado." },
        ],
      },
    },
    pt: {
      stabilna: {
        title: "RESULTADO ALTO (75-100)",
        subtitle: "A relação é coerente e funcional",
        sections: [
          { heading: "Visão geral", paragraph: "Na maioria dos aspetos, vocês funcionam como uma equipa: há iniciativa dos dois lados, o contacto não depende de uma única pessoa e as situações do dia a dia são resolvidas de forma contínua. É visível a capacidade de recuperar o equilíbrio após momentos de tensão, sem que as questões quotidianas se transformem em problemas duradouros." },
          { heading: "O que funciona", list: [
            "Iniciativa - ambos tomam iniciativa em contacto, planos e decisões",
            "Envolvimento - tempo e atenção distribuídos de forma equilibrada",
            "Proximidade - presente não só em momentos especiais, mas também no dia a dia",
            "Responsabilidade - compromissos são cumpridos (organização, acordos)",
            "Limites - diferenças não destabilizam a relação, são geridas",
          ] },
          { heading: "Sinais de alerta", list: [
            "adiar pequenos assuntos “para depois”",
            "redução temporária de iniciativa de uma das partes",
            "rotina a substituir a atenção",
          ] },
          { heading: "O que significa", paragraph: "A relação funciona porque mantém equilíbrio entre proximidade e autonomia. Para preservar isso, é importante não deixar acumular pequenas questões." },
        ],
      },
      napiecia: {
        title: "RESULTADO MÉDIO (45-74)",
        subtitle: "A relação funciona, mas perde equilíbrio",
        sections: [
          { heading: "Visão geral", paragraph: "Algumas áreas funcionam bem, enquanto outras estão sobrecarregadas ou negligenciadas. O peso da relação não está distribuído de forma equilibrada - uma pessoa assume mais iniciativa, mantém o contacto ou gere mais responsabilidades." },
          { heading: "O que não funciona", list: [
            "Iniciativa - mais presente de um lado",
            "Envolvimento - desigual (alguém sustenta mais)",
            "Tempo juntos - existe, mas é irregular ou limitado",
            "Proximidade - aparece, mas não é consistente",
            "Tensão - não desaparece, acumula-se",
          ] },
          { heading: "Como se manifesta na prática", list: [
            "planos são feitos, mas facilmente se desorganizam",
            "pequenas situações geram irritação desproporcional",
            "o contacto alterna entre intensidade e afastamento",
            "assuntos importantes são adiados",
          ] },
          { heading: "O que significa", paragraph: "A relação não está a terminar, mas começa a depender do esforço de uma só pessoa. Se continuar assim, surgem desgaste e distanciamento." },
        ],
      },
      niepewnosc: {
        title: "RESULTADO BAIXO (0-44)",
        subtitle: "A relação perde estrutura e direção",
        sections: [
          { heading: "Visão geral", paragraph: "Falta um ritmo comum. O contacto não é natural, mas irregular. Iniciativa, envolvimento e responsabilidade são limitados ou unilaterais." },
          { heading: "O que não funciona", list: [
            "Iniciativa - fraca ou concentrada numa só pessoa",
            "Envolvimento - baixo ou instável",
            "Tempo juntos - raro ou superficial",
            "Proximidade - reduzida ou esporádica",
            "Tensão - permanece e acumula",
          ] },
          { heading: "Como se manifesta na prática", list: [
            "o contacto é interrompido ou mínimo",
            "assuntos ficam por resolver",
            "há afastamento de uma ou ambas as partes",
            "até situações simples se tornam difíceis",
          ] },
          { heading: "O que significa", paragraph: "A relação não tem base estável. Se nada mudar, o distanciamento vai aumentar e o contacto será cada vez mais limitado." },
        ],
      },
    },
  };

  function renderPrePaywallDescription(locale, band) {
    const lang = ["pl", "en", "de", "es", "pt"].includes(locale) ? locale : "en";
    const content = (PREPAYWALL_SECTION_CONTENT[lang] && PREPAYWALL_SECTION_CONTENT[lang][band]) || PREPAYWALL_SECTION_CONTENT.en.napiecia;
    let html = `<h3>${escapeHtml(content.title)}</h3><p>${escapeHtml(content.subtitle)}</p>`;
    content.sections.forEach((section) => {
      html += `<h4>${escapeHtml(section.heading)}</h4>`;
      if (section.paragraph) html += `<p>${escapeHtml(section.paragraph)}</p>`;
      if (section.list && section.list.length) {
        html += `<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
      }
    });
    return html;
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
      pl: { Low: "Niski", Medium: "Średni", High: "Wysoki" },
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
        heading: "Overall picture",
        average: "Reference",
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
        heading: "Porównanie",
        average: "Punkt odniesienia",
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
        heading: "Overall picture",
        average: "Reference",
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
          title: "Clarity alert: you do not fully know what the other person wants",
          body:
            "Your clarity score is below the threshold. That shows up as guessing, testing, and late-night scrolling through old messages. Neutral events feel loaded because the story you tell fills gaps the relationship never closed with plain words.",
        },
        emotional: {
          title: "Emotional alert: backup disappears when stress lands",
          body:
            "Your emotional score is below the threshold. Warm moments can exist, but support thins right when one of you is already down. Repair starts late, so small hurts stack into big distance.",
        },
        inconsistency: {
          title: "Spread alert: one strong area is hiding another weak one",
          body:
            "The gap between your highest and lowest dimension is over 15 points. One lane looks fine while another keeps leaking stress into fights and guesses. Until the weak lane is fixed with dated agreements, good weeks will keep feeling fragile.",
        },
      },
      pl: {
        heading: "Alerty ryzyka",
        none: "Brak krytycznych alertow przy aktualnych progach.",
        clarity: {
          title: "Klarownosc: nie wiecie do konca, czego druga osoba chce — i to generuje domysly",
          body:
            "Wynik klarownosci jest ponizej progu. W praktyce widzisz testowanie, milczenie zamiast pytania wprost i czytanie tonu jak dowodu w sprawie. Neutralne zdarzenia robia sie ciezkie, bo brakuje jawnych ustalen, ktore by zamknely interpretacje.",
        },
        emotional: {
          title: "Bliskosc: wsparcie znika dokladnie wtedy, gdy jest potrzebne",
          body:
            "Wynik bliskosci jest ponizej progu. Cieple momenty moga byc, ale przy stresie robi sie chlodniej szybciej niz myslisz. Naprawa startuje pozno, wiec male obrazenia ukladaja sie w dystans.",
        },
        inconsistency: {
          title: "Rozrzut: jeden obszar maskuje drugi, slabszy",
          body:
            "Roznica miedzy najwyzszym a najnizszym wynikiem przekracza 15 punktow. Jeden wymiar wyglada OK, a drugi ciagle dosyla napiecie do klotni i domyslow. Dopoki slabszy wymiar nie dostanie datowanych ustalen, dobre tygodnie beda sie czuly kruche.",
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
            "What repeats: you get closeness or calm, then the same unfinished topic returns after stress. What does not close: decisions that never get an owner, date, or follow-through check. What gets worse: you brace for swings, so small problems trigger big reactions. Fix the pattern by shrinking variance—write one agreement after the next hard talk and score follow-through weekly.",
        },
        declining: {
          label: "Declining",
          text:
            "Your relationship trajectory is declining based on the current signal pattern. The overall average is below the stability threshold, which means uncertainty is now structurally dominant. In this state, even small ruptures can escalate because the baseline is already weak. Waiting passively usually deepens drift and increases emotional cost. The key risk is normalization of low-quality interaction: less clarity, less safety, and lower trust recovery. Immediate action is required: define non-negotiable boundaries, test for concrete follow-through, and reassess trajectory after a short, specific intervention window.",
        },
      },
      pl: {
        heading: "Kierunek relacji",
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
            "Co się powtarza: jest dobrze albo blisko, a potem wraca ten sam niedomknięty temat po kolejnym stresie. Co się nie domyka: ustalenia bez właściciela, daty i sprawdzenia czy zrobione. Co się pogarsza: zaczynasz się nastawiać na huśtawkę, więc małe sprawy odpalają dużą reakcję. Priorytet: zmniejszyć rozrzut — po następnej twardej rozmowie jedno pisemne „kto-co-do kiedy” i cotygodniowa ocena realizacji.",
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
            "Was sich wiederholt: Nähe oder Ruhe, dann kehrt dasselbe offene Thema nach Stress zurück. Was nicht schließt: Vereinbarungen ohne Owner, Datum und Check. Was schlechter wird: Du bist dauernd in Alarmbereitschaft, deshalb wirken kleine Reize groß. Hebel: Streuung senken—nach dem nächsten harten Gespräch eine schriftliche Wer-Was-Bis-Wann-Zeile und wöchentlich Follow-through bewerten.",
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
            "What repeats: you get closeness or calm, then the same unfinished topic returns after stress. What does not close: decisions that never get an owner, date, or follow-through check. What gets worse: you brace for swings, so small problems trigger big reactions. Fix the pattern by shrinking variance—write one agreement after the next hard talk and score follow-through weekly.",
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
            "There will be good days, but the same conflicts will return because nothing at the root got fixed. Calm without a dated agreement only moves the next blow-up.",
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
            "W najblizszych tygodniach beda dobre dni, ale te same konflikty beda wracac, bo nie sa rozwiazane u zrodla. Czesciowe uspokojenie bez konkretnego domkniecia tylko przesuwa wybuch w czasie.",
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

  const EXEC_SUMMARY_LINES = {
    en: {
      low: {
        communication: [
          "The lowest signal is communication: hard talks either stop early or spin without a repair plan you can execute.",
          "You get longer cold spells, more guarded texts, and the same topic re-enters through side doors instead of being finished.",
          "This week: one 25-minute talk, one agenda item, end with one sentence you both sign off on—who does what by when.",
        ],
        emotional: [
          "The lowest signal is emotional closeness: support thins right when one of you is already down.",
          "That shows up as short answers, changing the subject to logistics, or 'I need space' with no return time.",
          "Next friction: first sentence names you are still a team, second names the hurt fact, third proposes one small repair today.",
        ],
        stability: [
          "The lowest signal is follow-through: calm-hour promises do not survive the messy week.",
          "You double-check silently, send poke messages, or stop asking because repeated disappointment hurts.",
          "Pull two promises from the last 14 days. Either redo them with a date and owner, or retire them openly so they stop poisoning trust.",
        ],
        clarity: [
          "The lowest signal is clarity: you still cannot name what you are building together and what is off-limits in plain language.",
          "You run tests and read tea leaves instead of asking direct questions, so small events carry huge weight.",
          "Swap written lists: three hard boundaries and three needs each—no debate night one, decision on night four.",
        ],
      },
      mid: {
        communication: [
          "The sharpest drag on your score is communication: you talk, but recurring topics rarely end with a clear decision.",
          "Same fights return after a calm stretch because nothing at the root changed—only the tone did.",
          "Pick one recurring issue, write one agreement with a date, and do not open a second fight until that line is closed.",
        ],
        emotional: [
          "The sharpest drag is emotional closeness: warmth comes in waves, so you cannot lean on it when stress lands.",
          "Reasonable requests start sounding like pressure because the baseline feels unreliable day to day.",
          "Pick your heaviest recurring stress day and watch tone plus availability for two weeks—fix the pattern there first.",
        ],
        stability: [
          "The sharpest drag is behavior consistency: good stretches snap back when habits slip—lateness, phones, money talk, chores.",
          "You pre-argue in your head because you never know which version of the relationship will show up.",
          "Run a 14-day scoreboard on two concrete habits tied to trust—not vibes—and review numbers together Sunday.",
        ],
        clarity: [
          "The sharpest drag is clarity: you half-know what the other person wants, so you fill gaps with guesses.",
          "Decisions stall because every plan feels provisional; reassurance does not replace explicit rules where it hurts.",
          "Name one decision you are avoiding because it forces clarity you do not want yet—and schedule that conversation.",
        ],
      },
      high: {
        communication: [
          "Headline score is strong, but communication is still your leak: busy weeks turn into hinted complaints instead of clean closes.",
          "Backlog conversations quietly raise defensiveness even when the relationship still looks 'fine' on the surface.",
          "After each important talk, paste the agreed next step into one shared note while you are still in the room.",
        ],
        emotional: [
          "Headline score is strong, but emotional bandwidth is the leak: irritability shows up before anyone says 'I am burnt out'.",
          "Small misses get read harshly because the reserve tank is low even if love is real.",
          "Block two protected check-ins monthly that cannot be bumped by work—quality over quantity.",
        ],
        stability: [
          "Headline score is strong, but micro-commitments are the leak: small slips train you to expect slippage.",
          "Trust is high until one dropped ball reopens old doubt faster than it should.",
          "Pick three tiny weekly commitments and track done/not done—protect the baseline.",
        ],
        clarity: [
          "Headline score is strong, but clarity still needs maintenance: new stress changes old agreements without anyone naming it.",
          "Silent renegotiation creates surprise fights that feel 'out of nowhere'.",
          "Quarterly reset: one page—priorities, boundaries, money rules—updated together, not assumed.",
        ],
      },
    },
    pl: {
      low: {
        communication: [
          "Najniższy sygnał to komunikacja: ciężkie rozmowy albo się urywają, albo kręcą w kółko bez planu naprawy, który da się wykonać.",
          "W praktyce są dłuższe zimne fazy, krótsze odpowiedzi i ten sam temat wraca „drzwiami bocznymi”, zamiast być domknięty.",
          "Ten tydzień: 25 minut, jeden temat, koniec z jednym zdaniem podpisanym przez Was oboje — kto, co, do kiedy.",
        ],
        emotional: [
          "Najniższy sygnał to bliskość: wsparcie cienieje dokładnie wtedy, kiedy druga osoba i tak jest na dnie.",
          "W praktyce: ucieczka w logistykę, „potrzebuję przestrzeni” bez godziny powrotu albo ton, który zamyka kontakt.",
          "Przy następnej stłuczce: pierwsze zdanie — nadal jesteśmy w jednym zespole; drugie — fakt bólu; trzecie — jedna mała naprawa dziś.",
        ],
        stability: [
          "Najniższy sygnał to realizacja ustaleń: w spokojnej godzinie jest obietnica, a w chaotycznym tygodniu znika.",
          "Wraca sprawdzanie w głowie, przypominajki albo milczenie, bo kolejne rozczarowanie boli.",
          "Weźcie dwie obietnice z ostatnich 14 dni: albo odtwórzcie je z datą i właścicielem, albo wycofajcie je wprost, żeby nie truły zaufania.",
        ],
        clarity: [
          "Najniższy sygnał to klarowność: nadal nie da się wprost powiedzieć, co budujecie i co jest nie do przekroczenia.",
          "Zamiast pytań są testy i domysły, więc małe zdarzenia rosną do rozmiaru sprawy zasadniczej.",
          "Wymieńcie się listami: po trzy twarde granice i trzy potrzeby — pierwsza noc bez walki, decyzja czwartego dnia.",
        ],
      },
      mid: {
        communication: [
          "Największy problem w tym profilu to komunikacja: macie rozmowy, które chwilowo uspokajają sytuację, ale nie kończą się konkretnymi ustaleniami.",
          "W praktyce ten sam spór wraca po spokojniejszym okresie, bo u źródła nic się nie zmieniło — tylko ton.",
          "Jedna rzecz na start: jeden powracający temat, jedno pisemne ustalenie z datą — bez otwierania drugiej wojny, dopóki ta linia nie jest zamknięta.",
        ],
        emotional: [
          "Największy problem to bliskość emocjonalna: pojawia się falami, więc trudno się na niej oprzeć w ciężkim momencie.",
          "W praktyce rozsądne prośby brzmią jak nacisk, bo dzień do dnia czujesz niestabilny grunt.",
          "Wybierz jeden powtarzający się stres (np. deadline) i przez dwa tygodnie obserwuj ton i dostępność — tam najpierw napraw wzorzec.",
        ],
        stability: [
          "Największy problem to spójność zachowań: są dobre serie, a potem wraca ten sam temat, bo nawyk się obsunął.",
          "W praktyce wyprzedzasz kłótnię w głowie, bo nie wiesz, która „wersja” relacji wróci.",
          "Przez 14 dni liczcie dwie konkretne nawyki związane zaufaniem — nie „klimat” — i w niedzielę porównajcie liczby.",
        ],
        clarity: [
          "Największy problem to klarowność: nie wiecie do końca, czego druga osoba chce — i to generuje domysły.",
          "W praktyce decyzje stoją, bo każdy plan jest na pół gwizdka; uspokojenie nie zastępuje jawnych zasad tam, gdzie boli.",
          "Wskaż jedną decyzję, którą odkładasz, bo wymusiłaby jasność, której jeszcze nie chcesz — i umów termin tej rozmowy.",
        ],
      },
      high: {
        communication: [
          "Wynik z góry jest mocny, ale przeciek nadal jest w komunikacji: w natłoku tygodnia wraca aluzja zamiast czystego domknięcia.",
          "Zaległe tematy podnoszą defensywę, nawet gdy relacja z zewnątrz wygląda „OK”.",
          "Po ważnej rozmowie wklejcie ustalony następny krok do jednej wspólnej notatki, zanim roziejecie się po pokoju.",
        ],
        emotional: [
          "Wynik z góry jest mocny, ale przeciek to zapas emocjonalny: drażliwość przychodzi wcześniej niż słowo „jestem na wyczerpaniu”.",
          "Małe potknięcia czytacie ostrzej, bo zbiornik jest niski, mimo że uczucie jest prawdziwe.",
          "Zablokujcie dwa krótkie check-iny w miesiącu, których nie skasuje praca — jakość, nie ilość.",
        ],
        stability: [
          "Wynik z góry jest mocny, ale przeciek to mikro-obietnice: małe poślizgi uczą Was spodziewać się poślizgu.",
          "Zaufanie jest wysokie, aż jedno urwane zdanie za szybko otwiera stary lęk.",
          "Wybierzcie trzy małe cotygodniowe zobowiązania i róbcie tylko „zrobione / nie” — chrońcie bazę.",
        ],
        clarity: [
          "Wynik z góry jest mocny, ale klarowność wymaga serwisu: nowy stres zmienia stare ustalenia bez słowa.",
          "Cicha renegocjacja robi „niespodziewane” kłótnie.",
          "Co kwartał jedna strona A4: priorytety, granice, zasady pieniędzy — update razem, nie z założenia.",
        ],
      },
    },
  };

  function getReportExecutiveSummary(locale, score, areaScores, alertCount) {
    const range = getScoreRange(score);
    const lang = ["pl", "de", "es", "pt"].includes(locale) ? locale : "en";
    const content = {
      pl: {
        high:
          "Relacja jest spójna i funkcjonalna\n\nObraz całości\nW większości obszarów działacie razem: jest inicjatywa z obu stron, kontakt nie zależy od jednego z Was, sprawy są ogarniane na bieżąco. Widać, że potraficie wrócić do równowagi po napięciu, a codzienne rzeczy nie zamieniają się w problem.\n\nCo działa\n- Inicjatywa: obie strony wychodzą z propozycjami (kontakt, spotkania, decyzje)\n- Zaangażowanie: czas i uwaga są rozłożone dość równo\n- Bliskość: obecna nie tylko od święta, ale też w zwykłych sytuacjach\n- Odpowiedzialność: sprawy są doprowadzane do końca (organizacja, zobowiązania)\n- Granice: różnice nie rozwalają relacji, tylko są do ogarnięcia\n\nSygnały ostrzegawcze\n- odkładanie drobnych tematów na później\n- spadki inicjatywy u jednej ze stron w gorszych okresach\n- rutyna, która zaczyna wypierać uważność\n\nCo z tego wynika\nRelacja działa, bo ma równowagę między bliskością a autonomią. Utrzymanie tego wymaga pilnowania drobnych rzeczy zanim się skumulują.",
        mid:
          "Relacja działa, ale traci równowagę\n\nObraz całości\nNiektóre obszary działają dobrze, inne są przeciążone albo zaniedbane. Widać, że ciężar relacji nie rozkłada się równo - jedna strona częściej inicjuje, pilnuje kontaktu albo bierze odpowiedzialność za wspólne sprawy.\n\nCo nie domaga\n- Inicjatywa: częściej po jednej stronie\n- Zaangażowanie: nierówne (ktoś ciągnie więcej)\n- Czas razem: jest, ale bywa przypadkowy lub ograniczony\n- Bliskość: pojawia się, ale nie jest stabilna\n- Napięcie: nie znika, tylko przechodzi na kolejne sytuacje\n\nJak to wygląda w praktyce\n- plany są robione, ale łatwo się rozjeżdżają\n- drobne rzeczy zaczynają irytować bardziej niż powinny\n- kontakt bywa intensywny, a potem wyraźnie słabnie\n- ważne sprawy są odkładane, bo teraz nie ma kiedy\n\nCo z tego wynika\nRelacja nie rozpada się, ale zaczyna opierać się na wysiłku jednej strony. Jeśli to się utrzyma, pojawi się zmęczenie i dystans.",
        low:
          "Relacja traci strukturę i kierunek\n\nObraz całości\nBrakuje wspólnego rytmu. Kontakt nie jest czymś oczywistym, tylko dzieje się nieregularnie. Inicjatywa, zaangażowanie i odpowiedzialność są ograniczone albo jednostronne.\n\nCo nie działa\n- Inicjatywa: słaba lub jednostronna\n- Zaangażowanie: spada lub jest niestabilne\n- Czas razem: rzadki albo powierzchowny\n- Bliskość: wycofana lub sporadyczna\n- Napięcie: zostaje i narasta\n\nJak to wygląda w praktyce\n- kontakt jest przerywany albo ograniczony do minimum\n- sprawy nie są załatwiane, tylko zostają\n- jedna lub obie strony wycofują się z relacji\n- nawet proste rzeczy zaczynają być trudne do ogarnięcia\n\nCo z tego wynika\nRelacja nie ma stabilnego oparcia. Jeśli ten stan się utrzyma, dystans będzie się pogłębiał, a kontakt stanie się coraz bardziej ograniczony.",
      },
      en: {
        high:
          "The relationship is coherent and functional\n\nOverall picture\nIn most areas, you function as a team: both sides take initiative, contact does not depend on one person, and everyday matters are handled on an ongoing basis. When tension appears, you are able to return to balance, and daily issues do not turn into ongoing problems.\n\nWhat works\n- Initiative: both sides actively propose contact, plans and decisions\n- Involvement: time and attention are relatively balanced\n- Closeness: present not only in special moments, but in everyday situations\n- Responsibility: commitments are followed through (organization, agreements)\n- Boundaries: differences do not break the relationship, they are manageable\n\nWarning signals\n- postponing small issues for later\n- temporary drops in initiative from one side during more difficult periods\n- routine starting to replace attention\n\nWhat it means\nThe relationship works because it maintains balance between closeness and autonomy. Keeping this level requires attention to small things before they accumulate.",
        mid:
          "The relationship works, but is losing balance\n\nOverall picture\nSome areas work well, others are strained or neglected. The weight of the relationship is not evenly distributed - one person more often initiates, maintains contact, or takes responsibility for shared matters.\n\nWhat is not working\n- Initiative: more often on one side\n- Involvement: uneven (one person carries more)\n- Time together: present, but inconsistent or limited\n- Closeness: appears, but is not stable\n- Tension: does not disappear, carries over into other situations\n\nHow it looks in practice\n- plans are made, but easily fall apart\n- small things become more irritating than they should\n- contact can be intense, then clearly weakens\n- important matters are postponed because now is not the right time\n\nWhat it means\nThe relationship is not breaking, but starts to rely on one-sided effort. If this continues, it will lead to fatigue and distance.",
        low:
          "The relationship is losing structure and direction\n\nOverall picture\nThere is no shared rhythm. Contact is not something natural, but happens irregularly. Initiative, involvement and responsibility are limited or one-sided.\n\nWhat is not working\n- Initiative: weak or one-sided\n- Involvement: declining or unstable\n- Time together: rare or superficial\n- Closeness: withdrawn or occasional\n- Tension: remains and builds up\n\nHow it looks in practice\n- contact is interrupted or reduced to a minimum\n- matters are not resolved, they remain open\n- one or both sides withdraw from the relationship\n- even simple things become difficult to handle\n\nWhat it means\nThe relationship has no stable foundation. If this continues, distance will increase and contact will become more and more limited.",
      },
      de: {
        high:
          "Die Beziehung ist stabil und funktional\n\nGesamtbild\nIn den meisten Bereichen funktioniert ihr als Team: beide Seiten zeigen Initiative, der Kontakt hängt nicht nur von einer Person ab, und alltägliche Dinge werden laufend geklärt. Nach Spannungen findet ihr wieder ins Gleichgewicht zurück, und Alltagsthemen entwickeln sich nicht zu Problemen.\n\nWas funktioniert\n- Initiative: beide Seiten bringen Vorschläge ein (Kontakt, Pläne, Entscheidungen)\n- Engagement: Zeit und Aufmerksamkeit sind relativ ausgeglichen\n- Nähe: nicht nur in besonderen Momenten, sondern auch im Alltag präsent\n- Verantwortung: Verpflichtungen werden umgesetzt (Organisation, Absprachen)\n- Grenzen: Unterschiede führen nicht zum Bruch, sondern bleiben handhabbar\n\nWarnsignale\n- kleine Themen werden auf später verschoben\n- vorübergehender Rückgang der Initiative auf einer Seite\n- Routine ersetzt allmählich Aufmerksamkeit\n\nWas das bedeutet\nDie Beziehung funktioniert durch das Gleichgewicht zwischen Nähe und Eigenständigkeit. Dieses Niveau bleibt nur erhalten, wenn kleine Dinge rechtzeitig geklärt werden.",
        mid:
          "Die Beziehung funktioniert, verliert aber an Balance\n\nGesamtbild\nEinige Bereiche funktionieren gut, andere sind belastet oder vernachlässigt. Die Verantwortung ist ungleich verteilt - eine Person übernimmt häufiger Initiative, Kontakt oder Organisation.\n\nWas nicht funktioniert\n- Initiative: häufiger auf einer Seite\n- Engagement: ungleich verteilt\n- Gemeinsame Zeit: vorhanden, aber unregelmäßig\n- Nähe: vorhanden, aber nicht stabil\n- Spannung: bleibt bestehen und überträgt sich\n\nWie es sich zeigt\n- Pläne werden gemacht, halten aber nicht\n- kleine Dinge werden schnell belastend\n- Kontakt schwankt zwischen intensiv und schwach\n- wichtige Themen werden verschoben\n\nWas das bedeutet\nDie Beziehung besteht, basiert aber zunehmend auf einseitigem Aufwand. Das führt zu Ermüdung und Distanz.",
        low:
          "Die Beziehung verliert Struktur und Richtung\n\nGesamtbild\nEs fehlt ein gemeinsamer Rhythmus. Kontakt entsteht unregelmäßig. Initiative, Engagement und Verantwortung sind schwach oder einseitig.\n\nWas nicht funktioniert\n- Initiative: gering oder einseitig\n- Engagement: sinkt oder schwankt\n- Gemeinsame Zeit: selten oder oberflächlich\n- Nähe: zurückgezogen oder sporadisch\n- Spannung: bleibt bestehen und wächst\n\nWie es sich zeigt\n- Kontakt ist unterbrochen oder minimal\n- Themen werden nicht geklärt\n- Rückzug aus der Beziehung\n- selbst einfache Dinge werden schwierig\n\nWas das bedeutet\nDie Beziehung hat kein stabiles Fundament. Ohne Veränderung nimmt die Distanz weiter zu.",
      },
      es: {
        high:
          "La relación es coherente y funcional\n\nVisión general\nEn la mayoría de los aspectos funcionan como un equipo: hay iniciativa por parte de ambos, el contacto no depende de una sola persona y las situaciones cotidianas se gestionan de forma continua. Se nota que, después de momentos de tensión, sois capaces de recuperar el equilibrio y que los asuntos diarios no se convierten en problemas prolongados.\n\nQué funciona\n- Iniciativa: ambas personas proponen contacto, planes y decisiones\n- Compromiso: el tiempo y la atención están relativamente equilibrados\n- Cercanía: presente no solo en momentos especiales, sino también en lo cotidiano\n- Responsabilidad: los compromisos se cumplen (organización, acuerdos)\n- Límites: las diferencias no rompen la relación, se pueden gestionar\n\nSeñales de alerta\n- aplazar temas pequeños para más adelante\n- descensos puntuales de iniciativa por parte de uno\n- la rutina empieza a sustituir la atención\n\nQué significa\nLa relación funciona porque mantiene un equilibrio entre cercanía y autonomía. Para sostener este nivel, es importante atender a los detalles antes de que se acumulen.",
        mid:
          "La relación funciona, pero pierde equilibrio\n\nVisión general\nAlgunas áreas funcionan bien, mientras que otras están sobrecargadas o descuidadas. Se observa que el peso de la relación no se reparte de forma equitativa: una persona inicia más, mantiene el contacto o asume más responsabilidad en lo compartido.\n\nQué no funciona\n- Iniciativa: más frecuente en una sola persona\n- Compromiso: desigual (alguien sostiene más)\n- Tiempo juntos: existe, pero es irregular o limitado\n- Cercanía: aparece, pero no es constante\n- Tensión: no desaparece, se traslada a otras situaciones\n\nCómo se ve en la práctica\n- se hacen planes, pero se desorganizan con facilidad\n- pequeñas situaciones generan más irritación de lo habitual\n- el contacto pasa de ser intenso a debilitarse claramente\n- temas importantes se posponen porque no es el momento\n\nQué significa\nLa relación no se rompe, pero empieza a depender del esfuerzo de una sola parte. Si esto continúa, aparecerán cansancio y distancia.",
        low:
          "La relación pierde estructura y dirección\n\nVisión general\nFalta un ritmo compartido. El contacto no es algo natural, sino irregular. La iniciativa, el compromiso y la responsabilidad son limitados o unilaterales.\n\nQué no funciona\n- Iniciativa: débil o concentrada en una sola persona\n- Compromiso: bajo o inestable\n- Tiempo juntos: escaso o superficial\n- Cercanía: limitada o esporádica\n- Tensión: permanece y se acumula\n\nCómo se ve en la práctica\n- el contacto se interrumpe o se reduce al mínimo\n- los asuntos no se resuelven y quedan pendientes\n- una o ambas personas se retiran de la relación\n- incluso las cosas simples resultan difíciles de manejar\n\nQué significa\nLa relación no tiene una base estable. Si la situación se mantiene, la distancia aumentará y el contacto será cada vez más limitado.",
      },
      pt: {
        high:
          "A relação é coerente e funcional\n\nVisão geral\nNa maioria dos aspetos, vocês funcionam como uma equipa: há iniciativa dos dois lados, o contacto não depende de uma única pessoa e as situações do dia a dia são resolvidas de forma contínua. É visível a capacidade de recuperar o equilíbrio após momentos de tensão, sem que as questões quotidianas se transformem em problemas duradouros.\n\nO que funciona\n- Iniciativa: ambos tomam iniciativa em contacto, planos e decisões\n- Envolvimento: tempo e atenção distribuídos de forma equilibrada\n- Proximidade: presente não só em momentos especiais, mas também no dia a dia\n- Responsabilidade: compromissos são cumpridos (organização, acordos)\n- Limites: diferenças não destabilizam a relação, são geridas\n\nSinais de alerta\n- adiar pequenos assuntos para depois\n- redução temporária de iniciativa de uma das partes\n- rotina a substituir a atenção\n\nO que significa\nA relação funciona porque mantém equilíbrio entre proximidade e autonomia. Para preservar isso, é importante não deixar acumular pequenas questões.",
        mid:
          "A relação funciona, mas perde equilíbrio\n\nVisão geral\nAlgumas áreas funcionam bem, enquanto outras estão sobrecarregadas ou negligenciadas. O peso da relação não está distribuído de forma equilibrada - uma pessoa assume mais iniciativa, mantém o contacto ou gere mais responsabilidades.\n\nO que não funciona\n- Iniciativa: mais presente de um lado\n- Envolvimento: desigual (alguém sustenta mais)\n- Tempo juntos: existe, mas é irregular ou limitado\n- Proximidade: aparece, mas não é consistente\n- Tensão: não desaparece, acumula-se\n\nComo se manifesta na prática\n- planos são feitos, mas facilmente se desorganizam\n- pequenas situações geram irritação desproporcional\n- o contacto alterna entre intensidade e afastamento\n- assuntos importantes são adiados\n\nO que significa\nA relação não está a terminar, mas começa a depender do esforço de uma só pessoa. Se continuar assim, surgem desgaste e distanciamento.",
        low:
          "A relação perde estrutura e direção\n\nVisão geral\nFalta um ritmo comum. O contacto não é natural, mas irregular. Iniciativa, envolvimento e responsabilidade são limitados ou unilaterais.\n\nO que não funciona\n- Iniciativa: fraca ou concentrada numa só pessoa\n- Envolvimento: baixo ou instável\n- Tempo juntos: raro ou superficial\n- Proximidade: reduzida ou esporádica\n- Tensão: permanece e acumula\n\nComo se manifesta na prática\n- o contacto é interrompido ou mínimo\n- assuntos ficam por resolver\n- há afastamento de uma ou ambas as partes\n- até situações simples se tornam difíceis\n\nO que significa\nA relação não tem base estável. Se nada mudar, o distanciamento vai aumentar e o contacto será cada vez mais limitado.",
      },
    };
    return (content[lang] && content[lang][range]) || content.en.mid;
  }

  function getPersonalizedInsightSentence(locale, score, areaScores, alertCount = 0) {
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
      reportSummary: getReportExecutiveSummary(locale, score, areaScores, alertCount),
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
              title: "Name two unacceptable behaviors—and what happens if they repeat",
              explanation:
                "Examples: ignoring messages for a full day, cancelling meetups last minute. Write the consequence for the second repeat, not a vague 'we should be better.'",
              why: "Fuzzy limits mean every fight starts from zero because nobody knows what actually crossed the line.",
              change: "You stop re-negotiating basics weekly; reactions become predictable instead of explosive surprises.",
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
        heading: "Co może to zmienić",
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
              title: "Ustalcie 2 konkretne rzeczy, ktore sa nie do zaakceptowania — i co sie dzieje, jesli to sie powtorzy",
              explanation:
                "Np. ignorowanie wiadomosci przez caly dzien, odwolywanie spotkan w ostatniej chwili. Zapiszcie konsekwencje przy drugim powtorzeniu, a nie ogolne 'mamy sie poprawic'.",
              why: "Mgliste granice sprawiaja, ze kazda klotnia zaczyna sie od zera, bo nikt nie wie, co realnie przekroczylo linie.",
              change: "Koniec tygodniowego re-negocjowania podstaw — reakcje staja sie przewidywalne zamiast niespodziewanych wybuchow.",
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
    if (path.endsWith("/checkout.html") || path.endsWith("/checkout") || path.endsWith("/checkout/index.html")) {
      return;
    }
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
    const langParam = String(new URLSearchParams(window.location.search || "").get("lang") || "").toLowerCase();
    if (langParam && LOCALE_PATHS[langParam]) {
      setLang(langParam);
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
    const base = getStripeLinkForLocale(locale);
    const origin = window.location.origin;
    const successPath = getLocaleSuccessPath(locale);
    const successObj = new URL(successPath, origin);
    successObj.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
    const successUrl = successObj.toString();
    const cancelPath = getFlowPageUrl("result", locale);
    const cancelUrl = new URL(cancelPath, window.location.origin).toString();
    document.querySelectorAll('a[href*="buy.stripe.com"]').forEach((a) => {
      try {
        const url = new URL(base);
        url.searchParams.set("lang", locale);
        url.searchParams.set("locale", getStripeCheckoutLocale(locale));
        url.searchParams.set("success_url", successUrl);
        url.searchParams.set("cancel_url", cancelUrl);
        a.setAttribute("href", url.toString());
      } catch (e) {
        // Ignore malformed URLs.
      }
    });
  }

  function bindBuyButton() {
    const btn = document.querySelector("#buy-button");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = getPaymentLink();
    });
  }

  function initMarketPages() {
    let path = (window.location.pathname || "").toLowerCase();
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    const locale = getFlowLocale();
    const compact = getPriceDisplayCompact(locale);
    const isUpsell = path.endsWith("/upsell.html") || path.endsWith("/upsell") || path.endsWith("/upsell/index.html");
    if (isUpsell) {
      const amt = document.querySelector(".price-tag__amount");
      const note = document.querySelector(".price-tag__note");
      if (amt) amt.textContent = compact;
      if (note) note.textContent = UPSELL_PRICE_NOTE[locale] || UPSELL_PRICE_NOTE.en;
    }
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

  function localizeContactPageUi(locale) {
    const uiMap = {
      en: {
        pageTitle: "Contact — RelationshipScan",
        eyebrow: "Contact",
        title: "Contact & company details",
        intro: "For support, billing, or legal requests, use the details below.",
        companyLabel: "Legal company name:",
        addressLabel: "Registered address:",
        vatLabel: "VAT ID:",
        emailLabel: "Contact email:",
        phoneLabel: "Phone:",
        responseTarget: "Response time target: within 3 business days.",
        disclaimer:
          "RelationshipScan is an informational and educational tool. It is not psychological, legal, or medical advice and does not provide a diagnosis.",
      },
      pl: {
        pageTitle: "Kontakt — RelationshipScan",
        eyebrow: "Kontakt",
        title: "Kontakt i dane firmy",
        intro: "W sprawach wsparcia, rozliczeń lub kwestii prawnych skorzystaj z danych poniżej.",
        companyLabel: "Nazwa firmy:",
        addressLabel: "Adres rejestrowy:",
        vatLabel: "NIP:",
        emailLabel: "E-mail kontaktowy:",
        phoneLabel: "Telefon:",
        responseTarget: "Docelowy czas odpowiedzi: do 3 dni roboczych.",
        disclaimer:
          "RelationshipScan to narzędzie informacyjne i edukacyjne. Nie stanowi porady psychologicznej, prawnej ani medycznej oraz nie stawia diagnozy.",
      },
      de: {
        pageTitle: "Kontakt — RelationshipScan",
        eyebrow: "Kontakt",
        title: "Kontakt- und Firmendaten",
        intro: "Für Support, Abrechnung oder rechtliche Anfragen nutze bitte die folgenden Daten.",
        companyLabel: "Rechtlicher Firmenname:",
        addressLabel: "Eingetragene Adresse:",
        vatLabel: "USt-IdNr.:",
        emailLabel: "Kontakt-E-Mail:",
        phoneLabel: "Telefon:",
        responseTarget: "Ziel für die Antwortzeit: innerhalb von 3 Werktagen.",
        disclaimer:
          "RelationshipScan ist ein Informations- und Bildungswerkzeug. Es ist keine psychologische, rechtliche oder medizinische Beratung und stellt keine Diagnose.",
      },
      es: {
        pageTitle: "Contacto — RelationshipScan",
        eyebrow: "Contacto",
        title: "Contacto y datos de la empresa",
        intro: "Para soporte, facturación o solicitudes legales, utiliza los datos a continuación.",
        companyLabel: "Nombre legal de la empresa:",
        addressLabel: "Dirección registrada:",
        vatLabel: "NIF-IVA:",
        emailLabel: "Correo de contacto:",
        phoneLabel: "Teléfono:",
        responseTarget: "Tiempo objetivo de respuesta: dentro de 3 días hábiles.",
        disclaimer:
          "RelationshipScan es una herramienta informativa y educativa. No es asesoramiento psicológico, legal ni médico y no proporciona un diagnóstico.",
      },
      pt: {
        pageTitle: "Contato — RelationshipScan",
        eyebrow: "Contato",
        title: "Contato e dados da empresa",
        intro: "Para suporte, cobrança ou questões jurídicas, use os dados abaixo.",
        companyLabel: "Razão social:",
        addressLabel: "Endereço registrado:",
        vatLabel: "Número de identificação fiscal (VAT):",
        emailLabel: "E-mail de contato:",
        phoneLabel: "Telefone:",
        responseTarget: "Meta de tempo de resposta: até 3 dias úteis.",
        disclaimer:
          "O RelationshipScan é uma ferramenta informativa e educacional. Não constitui aconselhamento psicológico, jurídico ou médico e não fornece diagnóstico.",
      },
      in: {
        pageTitle: "Contact — RelationshipScan",
        eyebrow: "Contact",
        title: "Contact & company details",
        intro: "For support, billing, or legal requests, use the details below.",
        companyLabel: "Legal company name:",
        addressLabel: "Registered address:",
        vatLabel: "VAT ID:",
        emailLabel: "Contact email:",
        phoneLabel: "Phone:",
        responseTarget: "Response time target: within 3 business days.",
        disclaimer:
          "RelationshipScan is an informational and educational tool. It is not psychological, legal, or medical advice and does not provide a diagnosis.",
      },
    };
    const ui = uiMap[locale] || uiMap.en;
    document.title = ui.pageTitle;
    setText("contact-eyebrow", ui.eyebrow);
    setText("contact-title", ui.title);
    setText("contact-intro", ui.intro);
    setText("contact-company-label", ui.companyLabel);
    setText("contact-address-label", ui.addressLabel);
    setText("contact-vat-label", ui.vatLabel);
    setText("contact-email-label", ui.emailLabel);
    setText("contact-phone-label", ui.phoneLabel);
    setText("contact-response-target", ui.responseTarget);
    setText("contact-disclaimer", ui.disclaimer);
  }

  function renderPremiumDimensionSection(narrative, key) {
    const dim = narrative.dimensions[key];
    if (!dim) return "";
    const labels = narrative.dimensionSectionLabels;
    if (labels && dim.happening && dim.practice && dim.watch) {
      return `<p><strong>${escapeHtml(labels.happening)}</strong> ${escapeHtml(dim.happening)}</p><p><strong>${escapeHtml(
        labels.practice
      )}</strong> ${escapeHtml(dim.practice)}</p><p><strong>${escapeHtml(labels.watch)}</strong> ${escapeHtml(dim.watch)}</p>`;
    }
    if (dim.body) return `<p>${escapeHtml(dim.body)}</p>`;
    return "";
  }

  function getOperationalLocalePack(locale) {
    const map = {
      pl: {
        names: {
          communication: "komunikacja",
          emotional: "bliskość emocjonalna",
          stability: "stabilność zachowań",
          clarity: "klarowność",
        },
        sectionNoChange: "Co się stanie, jeśli nic nie zmienicie (3–6 tygodni)",
        evidenceLead: "Dowód z Twoich danych",
        testLabel: "Test na 7 dni",
      },
      en: {
        names: {
          communication: "communication",
          emotional: "emotional closeness",
          stability: "behavior consistency",
          clarity: "clarity",
        },
        sectionNoChange: "What happens if nothing changes (3–6 weeks)",
        evidenceLead: "Evidence from your data",
        testLabel: "7-day test",
      },
      de: {
        names: {
          communication: "Kommunikation",
          emotional: "emotionale Nähe",
          stability: "Verhaltensstabilität",
          clarity: "Klarheit",
        },
        sectionNoChange: "Was passiert, wenn ihr nichts ändert (3–6 Wochen)",
        evidenceLead: "Hinweis aus deinen Daten",
        testLabel: "7-Tage-Test",
      },
      es: {
        names: {
          communication: "comunicación",
          emotional: "cercanía emocional",
          stability: "estabilidad conductual",
          clarity: "claridad",
        },
        sectionNoChange: "Qué pasará si no cambiáis nada (3–6 semanas)",
        evidenceLead: "Evidencia en tus datos",
        testLabel: "Prueba de 7 días",
      },
      pt: {
        names: {
          communication: "comunicação",
          emotional: "proximidade emocional",
          stability: "estabilidade comportamental",
          clarity: "clareza",
        },
        sectionNoChange: "O que acontece se nada mudar (3–6 semanas)",
        evidenceLead: "Evidência dos seus dados",
        testLabel: "Teste de 7 dias",
      },
      in: null,
    };
    return map[locale] || map.en;
  }

  function getAreaValueByKey(areaScores, key) {
    if (key === "communication") return Math.round(areaScores.communication || 0);
    if (key === "emotional") return Math.round(areaScores.emotional || 0);
    if (key === "stability") return Math.round(areaScores.behavior || 0);
    return Math.round(areaScores.trust || 0);
  }

  function getSecondWeakestAreaKey(areaScores) {
    const list = [
      ["communication", getAreaValueByKey(areaScores, "communication")],
      ["emotional", getAreaValueByKey(areaScores, "emotional")],
      ["stability", getAreaValueByKey(areaScores, "stability")],
      ["clarity", getAreaValueByKey(areaScores, "clarity")],
    ].sort((a, b) => a[1] - b[1]);
    return list[1] ? list[1][0] : list[0][0];
  }

  function buildOverviewCardText(locale, areaKey, scoreValue, areaScores, trajectory) {
    const pack = getOperationalLocalePack(locale);
    const weakest = getWeakestAreaKey(areaScores);
    const secondWeakest = getSecondWeakestAreaKey(areaScores);
    const linked = areaKey === weakest ? secondWeakest : weakest;
    const linkedScore = getAreaValueByKey(areaScores, linked);
    const score = Math.round(scoreValue);
    const spread = Math.round(trajectory.variance || 0);

    if (locale === "pl") {
      if (areaKey === "communication") {
        return `${pack.evidenceLead}: komunikacja ma ${score}/100, a ${pack.names[linked]} ${linkedScore}/100. W odpowiedziach widać, że rozmowy nie kończą się decyzją „kto, co, do kiedy”, więc temat wraca i podnosi napięcie. Działanie: przez 14 dni zamykajcie każdą trudną rozmowę jednym zapisem z terminem. ${pack.testLabel}: sprawdźcie po tygodniu, ile ustaleń zostało zrobionych bez przypominania.`;
      }
      if (areaKey === "emotional") {
        return `${pack.evidenceLead}: bliskość ma ${score}/100 przy rozrzucie ${spread} pkt między wymiarami. To zwykle oznacza, że wsparcie działa niestabilnie pod presją i po konflikcie szybciej pojawia się dystans niż naprawa. Działanie: ustalcie stały schemat powrotu do kontaktu (np. 20 minut przerwy, potem 10 minut rozmowy tylko o faktach). ${pack.testLabel}: liczcie przez 7 dni, ile konfliktów kończy się kontaktem tego samego dnia.`;
      }
      if (areaKey === "behavior") {
        return `${pack.evidenceLead}: stabilność zachowań to ${score}/100, a komunikacja ${Math.round(areaScores.communication)}/100. Widać rozjazd „mówimy o zmianie” vs „brak realizacji”, co podcina zaufanie szybciej niż sam konflikt. Działanie: wybierzcie 2 mikro-zobowiązania na tydzień i oznaczajcie codziennie wykonane/niewykonane. ${pack.testLabel}: po 7 dniach decyzja — kontynuujecie tylko jeśli wykonanie przekracza 80%.`;
      }
      return `${pack.evidenceLead}: klarowność ma ${score}/100, a słabszy obszar obok to ${pack.names[linked]} (${linkedScore}/100). To oznacza nadmiar domysłów: jedna osoba zakłada intencję, druga broni się przed zarzutem, którego nie usłyszała wprost. Działanie: spiszcie trzy zasady nie do negocjacji i jedną konsekwencję za ich złamanie. ${pack.testLabel}: po tygodniu sprawdźcie, czy była choć jedna sytuacja „zgadywania”, której dało się uniknąć tymi zasadami.`;
    }

    if (areaKey === "communication") {
      return `${pack.evidenceLead}: ${pack.names.communication} is ${score}/100 and ${pack.names[linked]} is ${linkedScore}/100. Your answers suggest hard talks calm things short-term but do not end with a dated owner/action, so the same issue reappears. Action: for 14 days, close each difficult talk with one line: who does what by when. ${pack.testLabel}: after 7 days, count how many agreements were completed without reminders.`;
    }
    if (areaKey === "emotional") {
      return `${pack.evidenceLead}: ${pack.names.emotional} is ${score}/100 with a ${spread}-point gap between dimensions. That pattern usually means support drops exactly during stress, so distance lasts longer than the original issue. Action: set a fixed re-entry protocol after conflict (for example: 20-minute pause, then 10 minutes on facts only). ${pack.testLabel}: for 7 days, track how many conflicts return to contact on the same day.`;
    }
    if (areaKey === "behavior") {
      return `${pack.evidenceLead}: ${pack.names.stability} is ${score}/100 while communication is ${Math.round(areaScores.communication)}/100. This points to a declaration-vs-execution gap: promises are verbal, follow-through is inconsistent. Action: set two weekly micro-commitments and score done/not done daily. ${pack.testLabel}: at day 7 make a decision—continue only if execution stays above 80%.`;
    }
    return `${pack.evidenceLead}: ${pack.names.clarity} is ${score}/100, and ${pack.names[linked]} is ${linkedScore}/100. This combination creates guessing loops: one side infers intent, the other defends against assumptions. Action: write three non-negotiable rules and one consequence for each repeated break. ${pack.testLabel}: after 7 days, count how many conflicts came from assumptions instead of explicit agreements.`;
  }

  function buildOperationalDimension(locale, key, areaScores, trajectory) {
    const score = getAreaValueByKey(areaScores, key);
    const weakest = getWeakestAreaKey(areaScores);
    const weakScore = getAreaValueByKey(areaScores, weakest);
    const spread = Math.round(trajectory.variance || 0);
    const pack = getOperationalLocalePack(locale);

    if (locale === "pl") {
      const byKey = {
        communication: {
          body: `Twarda obserwacja: komunikacja ma ${score}/100, a najsłabszy wymiar ${weakScore}/100. Mechanizm: rozmowa obniża napięcie, ale bez domknięcia wraca ten sam temat (widać to w wyniku komunikacji i stabilności). Konsekwencja: decyzje się przesuwają, a koszt konfliktu rośnie tydzień po tygodniu. Działanie: przez 2 tygodnie kończcie trudny temat jednym zadaniem i terminem 72h.`,
          check: "Test: po 7 dniach policz, ile tematów wróciło mimo ustalenia. Jeśli więcej niż 1 — zmieńcie format rozmowy.",
        },
        emotional: {
          body: `Twarda obserwacja: bliskość ma ${score}/100 przy rozrzucie ${spread} pkt. Mechanizm: gdy rośnie presja, kontakt spada szybciej niż gotowość do naprawy. Konsekwencja: po konflikcie pojawia się chłód i sprawa ciągnie się dłużej niż sama przyczyna. Działanie: umówcie stały „powrót do kontaktu” tego samego dnia.`,
          check: "Decyzja: jeśli przez 7 dni nie uda się wracać do rozmowy w tym samym dniu, wprowadzacie zewnętrzną strukturę (np. mediację).",
        },
        stability: {
          body: `Twarda obserwacja: stabilność zachowań to ${score}/100, niżej niż deklaracje z innych obszarów. Mechanizm: intencja jest, ale wykonanie nie przechodzi przez codzienny chaos. Konsekwencja: spada wiarygodność i każda kolejna obietnica ma mniejszą wartość. Działanie: ustawcie 2 mierzalne standardy na 14 dni i codzienny status wykonania.`,
          check: "Test: po tygodniu sprawdź wykonanie procentowo. Poniżej 80% = korekta planu albo decyzja o ograniczeniu oczekiwań.",
        },
        clarity: {
          body: `Twarda obserwacja: klarowność ma ${score}/100, a najsłabszy wymiar to ${pack.names[weakest]} (${weakScore}/100). Mechanizm: tam, gdzie brak jasnych reguł, pojawiają się domysły i obrona. Konsekwencja: konflikty startują od intencji, nie od faktów. Działanie: spiszcie 3 zasady graniczne i konsekwencje ich złamania.`,
          check: "Decyzja: jeśli w 7 dni pojawi się kolejne naruszenie bez konsekwencji, uznajecie, że obecny model relacji nie działa.",
        },
      };
      return byKey[key];
    }

    const byKey = {
      communication: {
        body: `Hard observation: ${pack.names.communication} is ${score}/100 while the weakest dimension is ${weakScore}/100. Mechanism: conversation lowers tension but without closure the same issue returns (visible across communication and stability). Consequence: decisions get delayed and conflict cost increases week by week. Action: for 14 days, end each difficult topic with one dated owner/action line.`,
        check: "Test: after 7 days count how many topics returned despite an agreement. If more than 1, change your conversation format.",
      },
      emotional: {
        body: `Hard observation: ${pack.names.emotional} is ${score}/100 with a ${spread}-point spread across dimensions. Mechanism: when pressure rises, contact drops faster than repair readiness. Consequence: conflicts turn into distance and drag longer than the trigger itself. Action: set a fixed same-day re-entry protocol after conflict.`,
        check: "Decision: if same-day re-entry fails for 7 days, introduce external structure (for example mediation).",
      },
      stability: {
        body: `Hard observation: ${pack.names.stability} is ${score}/100, lower than your declared intent in other lanes. Mechanism: intent exists, execution breaks in daily pressure. Consequence: reliability drops and each next promise carries less weight. Action: set 2 measurable standards for 14 days and track daily completion.`,
        check: "Test: review completion after 7 days. Below 80% means either plan correction or reduced expectations.",
      },
      clarity: {
        body: `Hard observation: ${pack.names.clarity} is ${score}/100, with ${pack.names[weakest]} at ${weakScore}/100. Mechanism: unclear rules create guessing and defensive reactions. Consequence: conflict starts from assumed intent, not observable facts. Action: write 3 boundary rules and explicit consequences for repeat breaks.`,
        check: "Decision: if another boundary break happens in 7 days without consequence, your current model is not working.",
      },
    };
    return byKey[key];
  }

  function buildNoChangeScenario(locale, areaScores, trajectory, alertCount) {
    const weak = getWeakestAreaKey(areaScores);
    const weakScore = getAreaValueByKey(areaScores, weak);
    const spread = Math.round(trajectory.variance || 0);
    const pack = getOperationalLocalePack(locale);
    if (locale === "pl") {
      return `Jeśli nic nie zmienicie, w ciągu 3–6 tygodni wróci ten sam konflikt z najsłabszego obszaru (${pack.names[weak]}: ${weakScore}/100). Przy rozrzucie ${spread} pkt poprawa z dobrych dni nie utrzyma się pod presją i zaczniecie odkładać decyzje „na później”. Najbardziej prawdopodobny scenariusz: więcej domysłów, mniej realizacji ustaleń, oraz 1–2 powtarzalne spięcia tygodniowo. Decyzja na dziś: wybieracie jeden obszar i robicie 14-dniowy test wykonania albo uznajecie, że bez zmiany zasad relacja będzie dalej tracić jakość.`;
    }
    return `If nothing changes, in 3–6 weeks the same conflict will reappear from your weakest lane (${pack.names[weak]}: ${weakScore}/100). With a ${spread}-point spread, good days will not hold under pressure and key decisions will keep getting delayed. Most likely path: more assumptions, less follow-through, and 1–2 recurring clashes per week. Decision now: run a 14-day execution test on one lane, or accept that quality will continue to decline under the current rules.`;
  }

  function buildPatternAndMeaning(locale, areaScores, trajectory, alertCount) {
    const pack = getOperationalLocalePack(locale);
    const weak = getWeakestAreaKey(areaScores);
    const weakScore = getAreaValueByKey(areaScores, weak);
    const spread = Math.round(trajectory.variance || 0);
    const avg = Math.round(trajectory.avgScore || 0);
    if (locale === "pl") {
      return {
        pattern: `Wzorzec z danych: średnia ${avg}/100 i rozrzut ${spread} pkt oznaczają, że jeden słabszy obszar (${pack.names[weak]}: ${weakScore}/100) co tydzień niweluje postęp z mocniejszych obszarów. W praktyce temat wraca po chwilowym uspokojeniu, bo mechanizm wykonania nie został zmieniony.`,
        meaning: `To nie jest „ogólny kryzys”, tylko konkretny problem operacyjny: decyzje bez terminu i odpowiedzialności. Największe ryzyko na teraz: odkładanie decyzji i powtarzalne spięcia ${alertCount >= 2 ? "2 razy w tygodniu" : "1 raz w tygodniu"}. Decyzja: przez 14 dni testujecie jeden obszar wykonawczo albo akceptujecie dalszy spadek jakości.`,
      };
    }
    return {
      pattern: `Data pattern: average ${avg}/100 with a ${spread}-point spread means one weak lane (${pack.names[weak]}: ${weakScore}/100) keeps canceling gains from stronger lanes. In practice, the same issue returns after short-term calm because execution mechanics did not change.`,
      meaning: `This is not a generic crisis; it is an operational gap: decisions without owner and deadline. Main risk now: delayed decisions and recurring clashes ${alertCount >= 2 ? "twice per week" : "weekly"}. Decision: run a 14-day execution test on one lane or accept continued quality decline.`,
    };
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
        line1: score >= 70 ? "From outside it looks calm, but one topic keeps coming back." : "After each tense moment, the same topic returns under a new label.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Clear answers are missing, so it is easy to misread the other person’s intent."
            : "You have partial clarity, but one issue still stays open.",
        line3: `Weakest area: ${weakestArea}. Current level: ${weakestScore}/100.`,
      },
      pl: {
        area: {
          communication: "komunikacja",
          emotional: "bezpieczenstwo emocjonalne",
          stability: "stabilnosc",
          clarity: "klarownosc",
        },
        line1: score >= 70 ? "Na zewnątrz wygląda spokojnie, ale jeden temat regularnie wraca." : "Po każdym spięciu temat wraca, tylko pod inną nazwą.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Jest mało jasnych odpowiedzi, dlatego łatwo źle odczytać intencję drugiej osoby."
            : "Macie częściową jasność, ale jedna sprawa dalej jest niedomknięta.",
        line3: `Najsłabszy obszar: ${weakestArea}. Obecny poziom: ${weakestScore}/100.`,
      },
      de: {
        area: {
          communication: "Kommunikation",
          emotional: "emotionale Sicherheit",
          stability: "Stabilität",
          clarity: "Klarheit",
        },
        line1: score >= 70 ? "Nach außen wirkt es ruhig, aber ein Thema kehrt regelmäßig zurück." : "Nach jeder Spannung kommt dasselbe Thema unter neuem Namen wieder.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Es fehlen klare Antworten, deshalb wird die Absicht der anderen Person leicht falsch gelesen."
            : "Teilweise Klarheit ist da, aber ein Thema bleibt offen.",
        line3: `Schwächster Bereich: ${weakestArea}. Aktuelles Niveau: ${weakestScore}/100.`,
      },
      es: {
        area: {
          communication: "comunicacion",
          emotional: "seguridad emocional",
          stability: "estabilidad",
          clarity: "claridad",
        },
        line1: score >= 70 ? "Por fuera parece estable, pero un tema vuelve de forma regular." : "Después de cada tensión vuelve el mismo tema con otro nombre.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Faltan respuestas claras y por eso es fácil leer mal la intención de la otra persona."
            : "Hay claridad parcial, pero un tema sigue abierto.",
        line3: `Area mas debil: ${weakestArea}. Nivel actual: ${weakestScore}/100.`,
      },
      pt: {
        area: {
          communication: "comunicacao",
          emotional: "seguranca emocional",
          stability: "estabilidade",
          clarity: "clareza",
        },
        line1: score >= 70 ? "Por fora parece estável, mas um tema volta com frequência." : "Depois de cada tensão, o mesmo tema regressa com outro nome.",
        line2:
          clarityScore < BENCHMARK_SCORES.clarity
            ? "Faltam respostas claras, por isso é fácil ler mal a intenção da outra pessoa."
            : "Há clareza parcial, mas um tema continua aberto.",
        line3: `Area mais fraca: ${weakestArea}. Nivel atual: ${weakestScore}/100.`,
      },
      in: null,
    };
    const lang = map[locale] || map.en;
    const weakestLabel = lang.area[weakestArea] || lang.area.communication;
    return [lang.line1, lang.line2, lang.line3.replace(weakestArea, weakestLabel)];
  }

  /** Static / no-result copy aligned with getPaywallTeasers (score below 70, clarity near benchmark, weakest = communication). */
  function getPaywallTeaserPlaceholderLines(locale) {
    const L = normalizeLocale(locale);
    const m = {
      en: [
        "After tension, the same topic returns and ends without closure again.",
        "Clear answers are missing, so guesses are easy to mistake for facts.",
        "Weakest area: communication. Current level: 52/100.",
      ],
      pl: [
        "Po napięciu wraca ten sam temat i znów kończy się bez domknięcia.",
        "Brakuje jasnej odpowiedzi, więc łatwo pomylić domysł z faktem.",
        "Najsłabszy obszar: komunikacja. Obecny poziom: 52/100.",
      ],
      de: [
        "Nach Spannung kehrt dasselbe Thema zurück und endet wieder ohne Abschluss.",
        "Klare Antworten fehlen, dadurch werden Vermutungen schnell mit Fakten verwechselt.",
        "Schwächster Bereich: Kommunikation. Aktuelles Niveau: 52/100.",
      ],
      es: [
        "Tras la tensión vuelve el mismo tema y se queda otra vez sin cierre.",
        "Faltan respuestas claras y es fácil confundir suposición con hecho.",
        "Area mas debil: comunicacion. Nivel actual: 52/100.",
      ],
      pt: [
        "Depois da tensão, o mesmo tema volta e fica outra vez sem fecho.",
        "Faltam respostas claras e fica fácil confundir suposição com facto.",
        "Area mais fraca: comunicacao. Nivel atual: 52/100.",
      ],
      in: [
        "After tension, the same topic returns and ends without closure again.",
        "Clear answers are missing, so guesses are easy to mistake for facts.",
        "Weakest area: communication. Current level: 52/100.",
      ],
    };
    return m[L] || m.en;
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
    setText("premium-price-line", formatPremiumPriceLine(lang));
    setText("premium-price-hint", getPriceCheckoutHint(lang));
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
        scale: ["Low", "Medium", "High"],
        areas: ["Communication", "Stability", "Clarity", "Emotional closeness"],
        comm: "Communication",
        emotional: "Emotional closeness",
        stability: "Stability",
        clarity: "Clarity",
        pattern: "Recurring pattern",
        meaning: "Overall meaning",
        next: "Practical next steps",
        noChange: "What happens if nothing changes (3–6 weeks)",
        recheck: "Track change in 2-3 weeks",
        recheckCta: "Run scan again",
        back: "Back to result",
      },
      pl: {
        eyebrow: "Raport premium relacji",
        title: "Pełna analiza relacji",
        indexLabel: "Trust Index:",
        subhead: "Ten raport pokazuje konkrety: co się dzieje, co to kosztuje i jaką decyzję podjąć teraz.",
        overview: "Kluczowe wymiary",
        charts: "Przegląd wyniku i wykres",
        chartNote: "Wykres pokazuje, który obszar realnie psuje wykonanie ustaleń.",
        scale: ["Niska niepewność", "Średnia niepewność", "Wysoka niepewność"],
        areas: ["Komunikacja", "Stabilność", "Klarowność", "Bliskość emocjonalna"],
        comm: "Komunikacja",
        emotional: "Bliskość emocjonalna",
        stability: "Stabilność",
        clarity: "Klarowność",
        pattern: "Powtarzający się schemat",
        meaning: "Wniosek końcowy",
        next: "Co możesz zrobić teraz",
        noChange: "Co się stanie, jeśli nic nie zmienicie (3–6 tygodni)",
        recheck: "Sprawdź zmianę",
        recheckCta: "Powtórz skan",
        back: "Wróć do wyniku",
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
        noChange: "Was passiert, wenn ihr nichts ändert (3–6 Wochen)",
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
        noChange: "Qué pasa si no cambiáis nada (3–6 semanas)",
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
        noChange: "O que acontece se nada mudar (3–6 semanas)",
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
    setText("report-nochange-heading", ui.noChange || (uiMap.en && uiMap.en.noChange));
    setText("report-recheck-heading", ui.recheck);
    setText("report-recheck-cta", ui.recheckCta);
    const benchmarkUi = getBenchmarkLabels(locale);
    const alertsUi = getRiskAlertLabels(locale);
    const trajectoryUi = getTrajectoryContent(locale);
    const timelineUi = getTimelineContent(locale);
    const outcomeUi = getOutcomeActionsContent(locale);
    const tensionRaw = Number(details.areas.tension ?? details.tension);
    const tensionScore = Number.isFinite(tensionRaw)
      ? Math.max(0, Math.min(100, Math.round(tensionRaw)))
      : Math.max(0, Math.min(100, Math.round(100 - (areaScores.communication + areaScores.emotional + areaScores.behavior + areaScores.trust) / 4)));
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
    if (document.getElementById("report-lock-title")) {
      renderPaywallModalText(locale);
    }
  }

  // --- Wynik: odczyt localStorage i wypełnienie DOM ---
  async function initResult() {
    const locale = getFlowLocale();
    if (await hasVerifiedPremiumAccess()) {
      window.location.replace(getFlowPageUrl("report", locale));
      return;
    }
    const returnEvidence = getStripeReturnEvidence();
    if (returnEvidence.sessionId || returnEvidence.paymentIntent) {
      const verify = await confirmStripeReturnWithBackend(returnEvidence.sessionId, returnEvidence.paymentIntent);
      scrubStripeReturnParams();
      if (verify.paid) {
        window.location.replace(getFlowPageUrl("report", locale));
        return;
      }
    }

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
      const teaserPh = getPaywallTeaserPlaceholderLines(locale);
      setText("locked-teaser-1", teaserPh[0]);
      setText("locked-teaser-2", teaserPh[1]);
      setText("locked-teaser-3", teaserPh[2]);
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
    interpEl.innerHTML = renderPrePaywallDescription(locale, band);
    insightsEl.innerHTML = "";
    tipsEl.innerHTML = "";

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
    setText("preview-bar-value-3", `${previewValues.transparency}`);
    setText("preview-bar-value-4", `${previewValues.emotional}`);
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

    if (ctaBlock) ctaBlock.hidden = false;
  }

  async function initSuccess() {
    const queryLang = getQueryLang();
    if (queryLang) setLang(queryLang);
    const locale = getFlowLocale();
    document.documentElement.lang = locale;

    const copyByLocale = {
      en: {
        title: "Payment confirmed",
        body: "Verifying payment with Stripe...",
        failed: "We did not receive a confirmed paid status yet. Complete payment in your bank app, then return here.",
      },
      pl: {
        title: "Płatność potwierdzona",
        body: "Weryfikujemy płatność po stronie Stripe...",
        failed:
          "Nie mamy jeszcze potwierdzonej, opłaconej transakcji. Dokończ autoryzację w aplikacji banku i wróć na ten ekran.",
      },
      de: {
        title: "Zahlung bestätigt",
        body: "Die Zahlung wird serverseitig bei Stripe verifiziert...",
        failed:
          "Es liegt noch keine bestätigte bezahlte Transaktion vor. Bitte Zahlung in der Banking-App abschließen und dann zurückkehren.",
      },
      es: {
        title: "Pago confirmado",
        body: "Estamos verificando el pago en Stripe...",
        failed:
          "Aun no hay confirmacion de pago completado. Termina la autorizacion en tu app bancaria y vuelve a esta pagina.",
      },
      pt: {
        title: "Pagamento confirmado",
        body: "Estamos verificando o pagamento no Stripe...",
        failed: "Ainda nao temos confirmacao de pagamento concluido. Finalize no app do banco e volte para esta pagina.",
      },
      in: {
        title: "Payment confirmed",
        body: "Verifying payment with Stripe...",
        failed: "We did not receive a confirmed paid status yet. Complete payment in your bank app, then return here.",
      },
    };
    const ui = copyByLocale[locale] || copyByLocale.en;
    const chrome = PAGE_CHROME_UI[locale] || PAGE_CHROME_UI.en;
    document.title = chrome.successPageTitle;
    setText("success-title", ui.title);
    setText("success-body", ui.body);

    const evidence = getStripeReturnEvidence();
    const verify = await confirmStripeReturnWithBackend(evidence.sessionId, evidence.paymentIntent);
    scrubStripeReturnParams();
    if (!verify.paid) {
      clearPaidFlag();
      setText("success-body", ui.failed || copyByLocale.en.failed);
      return;
    }

    window.setTimeout(() => {
      window.location.href = getFlowPageUrl("report", locale);
    }, 500);
  }

  function getPremiumReportNarrative(locale) {
    const map = {
      en: {
        opening:
          "This report maps where your relationship actually leaks energy—not a one-day mood read. Use it to name one repeating loop, then change mechanics (decisions, dates, follow-through), not vibes.",
        benchmarkNote:
          "Above average means this area currently supports stability. Below average means this area is pulling your overall direction down.",
        dimensionSectionLabels: {
          happening: "What's happening",
          practice: "What it does in practice",
          watch: "What to watch",
        },
        dimensions: {
          communication: {
            happening:
              "You still exchange messages and talk, but the expensive part is what happens after tension: either the topic ends with a clear next step, or it dissolves into 'we are okay now' with no decision.",
            practice:
              "When closure is missing, the next argument inherits old fuel. You spend hours on tone and guesses instead of one fact-based fix, so the same fight returns with a new headline.",
            watch:
              "After the next hard conversation, write one line: what was decided, who owns it, and the date. If you cannot write that line, you bought calm—not change.",
            checks: [
              "Does one difficult topic end with one concrete decision?",
              "Can both of you repeat the same agreement 24 hours later?",
              "Does conflict stay on one issue, or does it pull in older unfinished topics?",
            ],
          },
          emotional: {
            happening:
              "This measures whether you stay reachable under normal pressure—not how intense a good weekend felt.",
            practice:
              "If warmth drops sharply when stress lands, small problems read huge. People protect first, repair second, so distance lasts longer than the original issue.",
            watch:
              "Look at the first six hours after a disappointment: faster, softer re-entry to contact beats a perfect apology delivered two days late.",
            checks: [
              "Is support reachable during stress—not only after it passes?",
              "Does disagreement lead to distance, or to a clear repair bid?",
              "Does repair start within hours, or does it drift for days?",
            ],
          },
          stability: {
            happening:
              "This tracks whether everyday behavior matches what you promise in calmer moments—time, money, chores, showing up, phone habits.",
            practice:
              "When follow-through swings, people stop risking direct asks. Plans get tentative, reminders pile up, and resentment stacks in the background.",
            watch:
              "Score two commitments from last week: done / partly / not. Repeat for two weeks—numbers show drift before drama does.",
            checks: [
              "Do promised actions happen without endless reminders?",
              "Do daily routines match the priorities you state out loud?",
              "Does follow-through hold steady across two full weeks?",
            ],
          },
          clarity: {
            happening:
              "Low clarity means you run the relationship partly on interpretation—reading texts, testing loyalty—instead of stated rules and priorities.",
            practice:
              "Neutral events become trials because the story you tell yourself fills gaps the conversation never closed. Decisions stall because 'proof' never feels enough.",
            watch:
              "Pick one thing you keep guessing—money rules, contact expectations, exclusivity, time together—and put it in one plain paragraph you both sign off on.",
            checks: [
              "Are boundaries written or spoken clearly—and used in real decisions?",
              "Do you state intent directly before sensitive topics?",
              "Do you both share the same definition of what counts as repair?",
            ],
          },
        },
        pattern:
          "The same sequence repeats: a weak spot loads stress, you talk it down, nothing structural changes, and the same friction returns with a new wrapper. Good days do not erase an open loop—what does not close comes back.",
        meaning:
          "Your weakest dimension still sets the ceiling until you change mechanics, not mood. Strong areas help, but they do not cancel a leak that keeps reopening under pressure. Close one dated loop, then re-check whether the gap between your highest and lowest scores tightens.",
        recheck:
          "Re-run in 2–3 weeks after one concrete structural change. Look first at the weakest dimension, then whether the spread between dimensions shrinks—not just the headline score.",
      },
      pl: {
        opening:
          "Ten raport pokazuje, gdzie relacja realnie traci energię — nie chodzi o nastrój z jednego dnia. Masz wskazać jeden powtarzający się mechanizm i zmienić ustalenia oraz realizację, a nie tylko „klimat”.",
        benchmarkNote:
          "Powyzej sredniej oznacza, ze ten obszar wspiera stabilnosc. Ponizej sredniej oznacza, ze ten obszar obniza caly kierunek relacji.",
        dimensionSectionLabels: {
          happening: "Co się dzieje",
          practice: "Co to robi w praktyce",
          watch: "Na co zwrócić uwagę",
        },
        dimensions: {
          communication: {
            happening:
              "Nadal piszecie i rozmawiacie, ale liczy się koniec trudnej rozmowy: albo wychodzicie z jednym ustaleniem (kto, co, do kiedy), albo temat gaśnie w „już jest OK” bez decyzji.",
            practice:
              "Bez domknięcia kolejna kłótnia dostaje stare paliwo. Tracicie czas na ton i domysły zamiast jednej poprawki opartej na faktach — i ten sam spór wraca pod innym pretekstem.",
            watch:
              "Po następnej ciężkiej rozmowie zapiszcie jedno zdanie: co zostało ustalone, kto za to odpowiada i jaki jest termin. Jeśli nie da się tego zapisać, kupiliście spokój, a nie zmianę.",
            checks: [
              "Czy trudny temat kończy się jedną konkretną decyzją?",
              "Czy oboje po 24 godzinach powtarzacie to samo ustalenie?",
              "Czy konflikt trzyma jeden wątek, czy wraca do starych, niedomkniętych spraw?",
            ],
          },
          emotional: {
            happening:
              "Chodzi o to, czy przy zwykłej presji nadal da się do Was dotrzeć — nie o to, jak romantyczny był weekend.",
            practice:
              "Jak ciepło gwałtownie spada przy stresie, małe problemy rosną. Najpierw jest obrona, potem naprawa — więc dystans trwa dłużej niż pierwotna sprawa.",
            watch:
              "Zobacz pierwsze sześć godzin po rozczarowaniu: szybszy, łagodniejszy powrót do kontaktu bije przeprosiny wysłane po dwóch dniach.",
            checks: [
              "Czy wsparcie jest dostępne w trakcie stresu, nie tylko po nim?",
              "Czy niezgoda prowadzi do dystansu, czy do jasnej próby naprawy?",
              "Czy naprawa startuje w godzinach, czy rozlewa się na dni?",
            ],
          },
          stability: {
            happening:
              "To jest zgodność codziennych działań z tym, co obiecujecie w spokojniejszej chwili — czas, pieniądze, dom, obecność, telefon.",
            practice:
              "Gdy realizacja skacze, ludzie przestają ryzykować proste prośby. Plany są ostrożne, przypomnienia się kumulują, a pretensje rosną w tle.",
            watch:
              "Oceń dwie obietnice z ostatniego tygodnia: zrobione / częściowo / nie. Powtórz przez dwa tygodnie — liczby pokazują ześlizg zanim wybuchnie drama.",
            checks: [
              "Czy obietnice są realizowane bez końca przypominania?",
              "Czy codzienne nawyki zgadzają się z wypowiedzianymi priorytetami?",
              "Czy follow-through trzyma się przez dwa pełne tygodnie?",
            ],
          },
          clarity: {
            happening:
              "Niska klarowność to częściowe prowadzenie relacji na domysłach — czytanie tonu, testy lojalności — zamiast jasnych zasad i priorytetów.",
            practice:
              "Neutralne zdarzenia robią się „egzaminem”, bo rozmowa nie domknęła luk. Decyzje stoją, bo dowód nigdy nie jest „wystarczająco czysty”.",
            watch:
              "Wybierz jedną rzecz, którą ciągle zgadujesz — granice finansowe, kontakt, czas razem — i zapisz ją w jednym prostym akapicie, na który oboje mówicie „tak”.",
            checks: [
              "Czy granice są jasno powiedziane i realnie używane w decyzjach?",
              "Czy przed trudnym tematem mówicie wprost, o co chodzi?",
              "Czy oboje macie tę samą definicję naprawy?",
            ],
          },
        },
        pattern:
          "Powtarza się ten sam schemat: słabszy punkt ładuje stres, rozmowa gasi napięcie, a u źródła nic się nie zmienia — więc tarcie wraca w nowej opakowce. Dobre dni nie zamykają otwartej pętli: co nie jest domknięte, wraca.",
        meaning:
          "Najsłabszy wymiar wciąż ustawia sufit, dopóki nie zmienicie mechaniki, a nie tylko tonu. Mocne obszary pomagają, ale nie kasują przecieku, który przy kolejnym stresie znów się otwiera. Domknij jedną pętlę z datą, potem sprawdź, czy rozrzut między najwyższym a najniższym wynikiem maleje.",
        recheck:
          "Powtórz skan za 2–3 tygodnie po jednej konkretnej zmianie strukturalnej. Najpierw najsłabszy wymiar, potem czy rozrzut między wymiarami się kurczy — nie tylko wynik „z góry”.",
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
  async function initReport() {
    const locale = getFlowLocale();
    const logoLink = document.querySelector(".site-header .logo");
    let isPaid = await hasVerifiedPremiumAccess();
    if (!isPaid) {
      const returnEvidence = getStripeReturnEvidence();
      if (returnEvidence.sessionId || returnEvidence.paymentIntent) {
        const verify = await confirmStripeReturnWithBackend(returnEvidence.sessionId, returnEvidence.paymentIntent);
        scrubStripeReturnParams();
        isPaid = !!verify.paid;
      }
    }
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
      noChangeEl: document.getElementById("report-nochange-body"),
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
      required.noChangeEl.innerHTML = "";
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
      const personalInsight = getPersonalizedInsightSentence(locale, score, areaScores, alertCount);
      personalizedInsightEl.textContent = personalInsight.reportSummary || personalInsight.sentence;
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
      setText(`report-area-${entry.domPrefix}-text`, buildOverviewCardText(locale, entry.areaKey, scoreValue, areaScores, trajectory));
      setText(`report-bar-label-${entry.domPrefix}`, segmentLabel);
      setText(entry.scoreId, `${scoreValue}/100`);
      setText(entry.labelId, segmentLabel);
      const bar = document.getElementById(`report-bar-${entry.domPrefix}`);
      if (bar) bar.style.width = `${scoreValue}%`;
    });

    const benchmarkGridEl = document.getElementById("report-benchmark-grid");
    if (benchmarkGridEl) {
      const overallLead = getOverviewNarrative(locale, score, areaScores, tensionScore);
      benchmarkGridEl.innerHTML = `<article class="report-benchmark-card"><div class="report-benchmark-card__head"><h3>${escapeHtml(
        overallLead.heading
      )}</h3><p class="report-benchmark-card__score">${score}/100</p></div><p class="report-benchmark-card__meta">${escapeHtml(
        overallLead.body
      )}</p></article>`;
    }
    const benchmarkNoteEl = document.getElementById("report-benchmark-note");
    if (benchmarkNoteEl) benchmarkNoteEl.textContent = getOverviewCaption(locale);

    const alertsEl = document.getElementById("report-alerts");
    if (alertsEl) {
      const primary = getPrimaryIssueBlock(locale, areaScores, tensionScore);
      alertsEl.innerHTML = `<article class="report-alert-card"><h3>${escapeHtml(primary.title)}</h3><p>${escapeHtml(primary.body)}</p></article>`;
    }

    const trajectoryEl = document.getElementById("report-trajectory");
    if (trajectoryEl) {
      const trajectoryContent = getTrajectoryContent(locale);
      const trajectoryText = trajectoryContent[trajectory.label] || trajectoryContent.unstable;
      trajectoryEl.innerHTML = `<div class="report-trajectory__header"><p class="report-trajectory__label">${escapeHtml(
        trajectoryText.label
      )}</p><p class="report-trajectory__meta">${escapeHtml(getTrajectoryMetaLabel(locale))} ${trajectory.avgScore}/100 · ${escapeHtml(
        getSpreadMetaLabel(locale)
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
              `<article class="report-outcome-action"><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.explanation)}</p><p>${escapeHtml(
                item.change
              )} — ${escapeHtml(item.why)}</p></article>`
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

    const operationalCommunication = buildOperationalDimension(locale, "communication", areaScores, trajectory);
    const operationalEmotional = buildOperationalDimension(locale, "emotional", areaScores, trajectory);
    const operationalStability = buildOperationalDimension(locale, "stability", areaScores, trajectory);
    const operationalClarity = buildOperationalDimension(locale, "clarity", areaScores, trajectory);
    required.communicationEl.innerHTML = `<p>${escapeHtml(operationalCommunication.body)}</p><p><strong>${escapeHtml(getInterpretationLead(locale))}</strong> ${escapeHtml(
      getAreaInterpretation(locale, "initiative")
    )}</p>`;
    required.emotionalEl.innerHTML = `<p>${escapeHtml(operationalEmotional.body)}</p><p><strong>${escapeHtml(getInterpretationLead(locale))}</strong> ${escapeHtml(
      getAreaInterpretation(locale, "engagement")
    )}</p>`;
    required.stabilityEl.innerHTML = `<p>${escapeHtml(operationalStability.body)}</p><p><strong>${escapeHtml(getInterpretationLead(locale))}</strong> ${escapeHtml(
      getAreaInterpretation(locale, "closeness")
    )}</p>`;
    required.clarityEl.innerHTML = `<p>${escapeHtml(operationalClarity.body)}</p><p><strong>${escapeHtml(getInterpretationLead(locale))}</strong> ${escapeHtml(
      getAreaInterpretation(locale, "stability")
    )}</p>`;
    const checksMap = [
      ["report-communication-checks", [operationalCommunication.check]],
      ["report-emotional-checks", [operationalEmotional.check]],
      ["report-stability-checks", [operationalStability.check]],
      ["report-clarity-checks", [operationalClarity.check]],
    ];
    checksMap.forEach(([id, items]) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    });

    const tensionScoreEl = document.getElementById("report-dim-tension-score");
    const tensionLabelEl = document.getElementById("report-dim-tension-label");
    const tensionBodyEl = document.getElementById("report-tension-body");
    const tensionChecksEl = document.getElementById("report-tension-checks");
    const tensionSegment = getAreaSegment(tensionScore);
    if (tensionScoreEl) tensionScoreEl.textContent = `${tensionScore}/100`;
    if (tensionLabelEl) tensionLabelEl.textContent = getAreaSegmentLabel(locale, tensionSegment);
    if (tensionBodyEl) {
      tensionBodyEl.innerHTML = `<p>${escapeHtml(getTensionNarrative(locale, tensionScore, trajectory.label))}</p><p><strong>${escapeHtml(
        getInterpretationLead(locale)
      )}</strong> ${escapeHtml(getAreaInterpretation(locale, "tension"))}</p>`;
    }
    if (tensionChecksEl) tensionChecksEl.innerHTML = `<li>${escapeHtml(getTensionCheck(locale))}</li>`;

    const patternMeaning = buildPatternAndMeaning(locale, areaScores, trajectory, alertCount);
    required.patternEl.innerHTML = `<p>${escapeHtml(patternMeaning.pattern)}</p>`;
    required.meaningEl.innerHTML = `<p>${escapeHtml(patternMeaning.meaning)}</p>`;
    required.nextStepsEl.innerHTML = (outcomeVariant.highImpact || [])
      .slice(0, 4)
      .map((item) => `<li><strong>${escapeHtml(item.title)}:</strong> ${escapeHtml(item.change)}</li>`)
      .join("");
    if (required.noChangeEl) {
      required.noChangeEl.innerHTML = `<p>${escapeHtml(buildNoChangeScenario(locale, areaScores, trajectory, alertCount))}</p>`;
    }
    required.recheckEl.innerHTML = `<p>${escapeHtml(narrative.recheck)}</p>`;

    const chartNoteEl = document.getElementById("report-chart-note");
    if (chartNoteEl && !chartNoteEl.textContent) {
      chartNoteEl.textContent = narrative.benchmarkNote;
    }
    const recheckCta = document.getElementById("report-recheck-cta");
    if (recheckCta) recheckCta.setAttribute("href", getFlowPageUrl("test", locale));
  }

  function isContactPagePath() {
    const p = String(window.location.pathname || "").toLowerCase();
    return p.endsWith("/contact.html") || p.endsWith("/contact") || p.endsWith("/contact/index.html");
  }

  function isCheckoutPagePath() {
    const p = String(window.location.pathname || "").toLowerCase();
    return p.endsWith("/checkout.html") || p.endsWith("/checkout") || p.endsWith("/checkout/index.html");
  }

  function localizeCheckoutPageUi(locale) {
    const L = CHECKOUT_UI[locale] ? locale : "en";
    const ui = CHECKOUT_UI[L];
    const legalUi = LEGAL_FOOTER_COPY[L] || LEGAL_FOOTER_COPY.en;
    const links = LEGAL_PATHS[L] || LEGAL_PATHS.en;
    document.documentElement.lang = ui.htmlLang;
    document.title = ui.pageTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", ui.metaDescription);
    setText("checkout-eyebrow", ui.eyebrow);
    setText("checkout-title", ui.productTitle);
    setText("checkout-desc", ui.productDesc);
    setText("checkout-price-label", ui.priceLabel);
    setText("checkout-inline-note", ui.paymentNoteShort);
    const priceEl = document.querySelector(".checkout-card__price");
    if (priceEl) priceEl.textContent = getPriceDisplayCompact(L);
    setText("checkout-price-hint", getPriceCheckoutHint(L));
    const cta = document.getElementById("checkout-stripe-cta");
    if (cta) cta.textContent = ui.stripeCta;
    setText("checkout-back", ui.backToHome);
    const note = document.getElementById("checkout-footer-note");
    if (note) note.textContent = ui.stripeFooterNote;
    const linksEl = document.getElementById("checkout-footer-links");
    if (linksEl) {
      linksEl.innerHTML = `<a href="${links.terms}">${escapeHtml(legalUi.terms)}</a> · <a href="${links.privacy}">${escapeHtml(
        legalUi.privacy
      )}</a> · <a href="${links.contact}">${escapeHtml(legalUi.contactLink)}</a>`;
    }
  }

  function getPremiumRewriteLocale(locale) {
    return ["pl", "de", "es", "pt"].includes(locale) ? locale : "en";
  }

  function fillScore(text, score) {
    return String(text || "").replace("{score}", String(Math.round(score || 0)));
  }

  function getPremiumRewritePack(locale) {
    const packs = {
      en: {
        ui: {
          eyebrow: "Full report",
          title: "What is happening between you",
          indexLabel: "Trust Index:",
          subhead: "This is a direct read from your answers and repeated behavior.",
          overview: "Main areas",
          charts: "Score and area split",
          chartNote: "Treat this as a weekly picture, not a one-day mood.",
          scale: ["Lower strain", "Mixed", "Higher strain"],
          areas: ["Communication", "Behavior", "Trust", "Emotional distance"],
          comm: "Communication",
          emotional: "Emotional distance",
          stability: "Behavior",
          clarity: "Trust",
          pattern: "What keeps happening",
          meaning: "What it means right now",
          next: "What this is turning into",
          noChange: "If nothing changes in the next 3-6 weeks",
          recheck: "Check again in 2-3 weeks",
          recheckCta: "Run scan again",
          back: "Back to result",
        },
        sections: {
          communication: {
            body:
              "Conversations start, then stop when the important part comes up. One person says \"later\" and the topic never closes. In day-to-day behavior this shows as delayed replies, topic changes, and no final decision after hard talks. That creates uncertainty because both of you leave the conversation with different versions of what was agreed. If this repeats, old arguments keep coming back under new topics. Current score: {score}/100.",
            check: "Repeated marker: after conflict, there is no one clear sentence with who does what by when.",
          },
          emotional: {
            body:
              "Closeness appears in short bursts, then drops fast. One evening feels warm, next day feels cold without explanation. In behavior this looks like less contact after stress, less softness in tone, and longer silent windows after disagreement. Uncertainty grows because good moments stop feeling reliable; you do not know which version of the relationship you will get tomorrow. If this repeats, both people protect themselves first and reconnect less. Current score: {score}/100.",
            check: "Repeated marker: after disappointment, contact stays distant into the next day.",
          },
          stability: {
            body:
              "What is promised and what happens do not stay aligned. Plans are made in calm moments and then canceled, postponed, or diluted later. In behavior this shows as uneven follow-through, missed small commitments, and frequent last-minute changes. Uncertainty rises because words lose value when execution keeps shifting. If this repeats, daily life becomes monitoring instead of trust. Current score: {score}/100.",
            check: "Repeated marker: the same small commitment is missed more than once in the same week.",
          },
          clarity: {
            body:
              "Trust is no longer automatic and gets checked constantly. Neutral events get read through doubt first. In behavior this shows as re-reading chats, measuring reply time, and testing instead of asking directly. Uncertainty rises because gaps are filled with worst-case stories before facts are confirmed. If this repeats, both people speak less openly and assume more. Current score: {score}/100.",
            check: "Repeated marker: simple questions are replaced by hints, tests, or silence.",
          },
        },
        pattern:
          "The same sequence keeps showing up: tension, partial calm, no full closure, then the same issue returns.",
        meaning:
          "This is not one bad day. It is a repeated weekly cycle that is already shaping decisions between you.",
        noChange:
          "If nothing changes, contact will become more practical and less personal. You can still look like a couple from outside, but inside there will be less repair, more silence, and slower return after conflict. The weakest area is where the next rupture is most likely.",
        recheck:
          "Run this again after 2-3 weeks and compare whether the same weak area still drags everything else.",
        benchmarkNote:
          "Area scores matter more than one headline number. The weakest area usually decides the next conflict.",
        outcome: {
          heading: "Where this goes next",
          highImpact: "Most visible now",
          mediumImpact: "Building in the background",
          lowImpact: "Still lighter, but present",
          whyLabel: "Why it matters",
          changeLabel: "What shows up",
          high: {
            highImpact: [
              {
                title: "Unfinished conversations",
                explanation: "Important talks stop at the hardest point, then restart later without closure.",
                why: "Unclosed topics return with extra frustration.",
                change: "Same argument comes back faster each time.",
              },
              {
                title: "Uneven emotional availability",
                explanation: "Support is present on easy days and disappears on pressure days.",
                why: "Pressure days are where trust is tested most.",
                change: "Distance lasts longer after conflict.",
              },
            ],
            mediumImpact: [
              {
                title: "Promise fatigue",
                explanation: "New promises are heard as temporary because old ones were not completed.",
                why: "Reliability drops quietly before major breaks.",
                change: "People stop asking directly for what they need.",
              },
            ],
            lowImpact: [
              {
                title: "Background irritation",
                explanation: "Small remarks, short tone, and low patience increase.",
                why: "Tiny cuts accumulate into bigger distance.",
                change: "Ordinary days feel tense more often.",
              },
            ],
          },
          mid: {
            highImpact: [
              {
                title: "Stop-start contact",
                explanation: "There is closeness, then sudden withdrawal, then partial return.",
                why: "Unpredictable contact weakens emotional safety.",
                change: "Both sides prepare for disappointment.",
              },
              {
                title: "Agreement drift",
                explanation: "What was agreed in talk is not visible in the week after.",
                why: "Execution is what keeps trust alive.",
                change: "Trust gets replaced by checking behavior.",
              },
            ],
            mediumImpact: [
              {
                title: "Delayed repair",
                explanation: "Conflict settles slowly, often over days not hours.",
                why: "Long recovery windows increase emotional cost.",
                change: "More time spent in emotional distance.",
              },
            ],
            lowImpact: [
              {
                title: "External noise",
                explanation: "Outside opinions start filling gaps left by unclear talks.",
                why: "Unclear internal contact invites outside interpretation.",
                change: "Decisions feel less grounded in what actually happened.",
              },
            ],
          },
          low: {
            highImpact: [
              {
                title: "Chronic uncertainty",
                explanation: "Core questions about commitment and direction stay unanswered.",
                why: "No stable baseline means every week restarts from doubt.",
                change: "Emotional energy goes into decoding, not connecting.",
              },
              {
                title: "Fast trust erosion",
                explanation: "Contradictions between words and actions are frequent.",
                why: "Repeated mismatch quickly breaks confidence.",
                change: "Neutral events are read as threat.",
              },
            ],
            mediumImpact: [
              {
                title: "Conflict stacking",
                explanation: "New disagreements pull old unfinished topics immediately.",
                why: "No closure means unresolved backlog stays active.",
                change: "Arguments get longer and less clear.",
              },
            ],
            lowImpact: [
              {
                title: "Logistic strain",
                explanation: "Daily planning becomes harder because basic coordination is weak.",
                why: "Practical friction adds to emotional overload.",
                change: "Even small plans feel heavy.",
              },
            ],
          },
        },
      },
      pl: {
        ui: {
          eyebrow: "Pelny raport",
          title: "Co sie dzieje miedzy Wami",
          indexLabel: "Trust Index:",
          subhead: "To prosty odczyt z odpowiedzi i z tego, co wraca w zachowaniu.",
          overview: "Glowne obszary",
          charts: "Wynik i rozbicie obszarow",
          chartNote: "Traktuj to jak obraz tygodnia, nie jednego dnia.",
          scale: ["Mniejsze napiecie", "Mieszanie", "Wieksze napiecie"],
          areas: ["Komunikacja", "Zachowanie", "Zaufanie", "Dystans emocjonalny"],
          comm: "Komunikacja",
          emotional: "Dystans emocjonalny",
          stability: "Zachowanie",
          clarity: "Zaufanie",
          pattern: "Co tu wraca",
          meaning: "Co to znaczy teraz",
          next: "W co to idzie",
          noChange: "Jesli nic sie nie zmieni przez 3-6 tygodni",
          recheck: "Sprawdz ponownie za 2-3 tygodnie",
          recheckCta: "Powtorz skan",
          back: "Wroc do wyniku",
        },
        sections: {
          communication: {
            body:
              "Rozmowy sie zaczynaja, ale urywaja tam, gdzie trzeba powiedziec cos konkretnego. Jedna osoba mowi \"pozniej\" i temat nie wraca do domkniecia. W zachowaniu widac to jako opoznione odpowiedzi, zmiane tematu i brak jednego jasnego ustalenia po trudnej rozmowie. To daje niepewnosc, bo kazde z Was wychodzi z inna wersja tego, co zostalo ustalone. Gdy to sie powtarza, stary konflikt wraca pod nowym pretekstem. Aktualny wynik: {score}/100.",
            check: "Powtarzalny marker: po klotni nie ma jednego zdania \"kto, co, do kiedy\".",
          },
          emotional: {
            body:
              "Bliskosc pojawia sie na chwile i szybko znika. Wieczorem bywa cieplo, a nastepnego dnia robi sie zimno bez wyjasnienia. W zachowaniu to mniej kontaktu po stresie, mniej miekkiego tonu i dluzsze okresy ciszy po sporze. Niepewnosc rosnie, bo dobre chwile przestaja byc wiarygodne i nie wiadomo, jaka wersja relacji bedzie jutro. Gdy to sie powtarza, obie strony bardziej sie chronia niz zblizaja. Aktualny wynik: {score}/100.",
            check: "Powtarzalny marker: po rozczarowaniu dystans trzyma sie do nastepnego dnia.",
          },
          stability: {
            body:
              "To, co jest obiecane, nie zgadza sie stabilnie z tym, co sie dzieje. Ustalenia padaja w spokojnym momencie, a potem sa przesuwane albo rozmywane. W zachowaniu widac to jako nierowne domykanie, gubienie drobnych zobowiazan i odwolania na ostatnia chwile. Niepewnosc rosnie, bo slowa traca wartosc, kiedy wykonanie stale sie rozjezdza. Gdy to sie powtarza, codziennosc zamienia sie w kontrolowanie, a nie w bycie razem. Aktualny wynik: {score}/100.",
            check: "Powtarzalny marker: to samo male ustalenie pada wiecej niz raz w jednym tygodniu.",
          },
          clarity: {
            body:
              "Zaufanie nie dziala juz automatycznie, tylko wymaga ciaglego sprawdzania. Neutralne sytuacje sa czytane przez filtr watpliwosci. W zachowaniu to wracanie do starych wiadomosci, liczenie czasu odpowiedzi i testowanie zamiast prostego pytania. Niepewnosc rosnie, bo luki sa wypelniane najgorszym scenariuszem, zanim padna fakty. Gdy to sie powtarza, obie strony mowia mniej wprost i bardziej sie domyslaja. Aktualny wynik: {score}/100.",
            check: "Powtarzalny marker: proste pytanie jest zastapione aluzja albo cisza.",
          },
        },
        pattern:
          "Wraca ten sam ciag: napiecie, chwilowe uspokojenie, brak domkniecia, i znowu ten sam temat.",
        meaning:
          "To nie jest jeden zly dzien. To tygodniowy cykl, ktory juz ustawia decyzje miedzy Wami.",
        noChange:
          "Jesli nic sie nie zmieni, kontakt bedzie coraz bardziej techniczny i coraz mniej bliski. Z zewnatrz nadal mozecie wygladac jak para, ale w srodku bedzie mniej naprawy, wiecej ciszy i wolniejszy powrot po konflikcie. Najslabszy obszar najpewniej odpali kolejne pekniecie.",
        recheck:
          "Powtorz to za 2-3 tygodnie i zobacz, czy ten sam slaby obszar dalej sciaga reszte w dol.",
        benchmarkNote:
          "Wazniejsze od liczby glownej jest to, ktory obszar jest najslabszy. To on zwykle uruchamia kolejna klotnie.",
        outcome: {
          heading: "Co bedzie widac dalej",
          highImpact: "Najbardziej widoczne teraz",
          mediumImpact: "Buduje sie w tle",
          lowImpact: "Lzejsze, ale juz obecne",
          whyLabel: "Dlaczego to wazne",
          changeLabel: "Co bedzie widac",
          high: {
            highImpact: [
              {
                title: "Niedomkniete rozmowy",
                explanation: "Wazne tematy zatrzymuja sie przy najtrudniejszym miejscu i nie maja finalu.",
                why: "Niedomkniety temat wraca z wieksza frustracja.",
                change: "Ten sam spor wraca coraz szybciej.",
              },
              {
                title: "Nierowna dostepnosc emocjonalna",
                explanation: "Wsparcie jest w latwych dniach, a znika, gdy rosnnie presja.",
                why: "To dni stresowe testuja relacje najmocniej.",
                change: "Dystans po konflikcie trzyma dluzej.",
              },
            ],
            mediumImpact: [
              {
                title: "Zmeczenie obietnicami",
                explanation: "Nowe deklaracje sa odbierane jako chwilowe, bo stare nie byly dowiezione.",
                why: "Wiarygodnosc spada po cichu zanim padna duze slowa.",
                change: "Mniej prostych prosb, wiecej ostroznego tonu.",
              },
            ],
            lowImpact: [
              {
                title: "Ciche podraznienie",
                explanation: "Wzrastaja krotkie odpowiedzi, ciecia tonem i brak cierpliwosci.",
                why: "Male rzeczy kumuluja dystans.",
                change: "Zwykle dni czesciej sa napiete.",
              },
            ],
          },
          mid: {
            highImpact: [
              {
                title: "Kontakt typu start-stop",
                explanation: "Jest blisko, potem nagly odstep, potem czesciowy powrot.",
                why: "Nieprzewidywalnosc oslabia poczucie bezpieczenstwa.",
                change: "Obie strony szykuja sie na rozczarowanie.",
              },
              {
                title: "Rozjazd ustalen",
                explanation: "To, co bylo ustalone, nie jest widoczne w kolejnym tygodniu.",
                why: "Zaufanie trzyma sie na wykonaniu, nie na deklaracji.",
                change: "Zamiast zaufania pojawia sie sprawdzanie.",
              },
            ],
            mediumImpact: [
              {
                title: "Opozniona naprawa",
                explanation: "Spor stygnie wolno, czesto przez dni, nie godziny.",
                why: "Dlugie gaszenie zwieksza koszt emocjonalny.",
                change: "Wiecej czasu mija w dystansie.",
              },
            ],
            lowImpact: [
              {
                title: "Szum z zewnatrz",
                explanation: "Opinie innych wypelniaja luki po niedomknietych rozmowach.",
                why: "Brak jasnosci w srodku otwiera miejsce na cudze narracje.",
                change: "Decyzje sa mniej osadzone w faktach z relacji.",
              },
            ],
          },
          low: {
            highImpact: [
              {
                title: "Przewlekla niepewnosc",
                explanation: "Podstawowe pytania o kierunek i zaangazowanie zostaja bez odpowiedzi.",
                why: "Bez bazy kazdy tydzien zaczyna sie od nowa.",
                change: "Energia idzie w rozszyfrowywanie zamiast bycie blisko.",
              },
              {
                title: "Szybka erozja zaufania",
                explanation: "Rozbieznosc miedzy slowem a dzialaniem pojawia sie regularnie.",
                why: "Powtarzalny rozjazd szybko podcina wiarygodnosc.",
                change: "Neutralne rzeczy sa czytane jak zagrozenie.",
              },
            ],
            mediumImpact: [
              {
                title: "Nawarstwianie konfliktow",
                explanation: "Nowy spor od razu odpala stare niedomkniete sprawy.",
                why: "Brak finalu trzyma backlog aktywny.",
                change: "Klotnie sa dluzsze i mniej konkretne.",
              },
            ],
            lowImpact: [
              {
                title: "Przeciazenie codziennosci",
                explanation: "Nawet proste ustalenia dnia robia sie trudne.",
                why: "Tarcie organizacyjne doklada sie do emocjonalnego.",
                change: "Male rzeczy zaczynaja wazyc za duzo.",
              },
            ],
          },
        },
      },
      de: {
        ui: {
          eyebrow: "Voller Bericht",
          title: "Was zwischen euch passiert",
          indexLabel: "Trust Index:",
          subhead: "Direkter Abgleich aus Antworten und wiederholtem Verhalten.",
          overview: "Hauptbereiche",
          charts: "Score und Bereiche",
          chartNote: "Das ist ein Wochenbild, nicht nur ein Tagesgefuhl.",
          scale: ["Weniger Druck", "Gemischt", "Mehr Druck"],
          areas: ["Kommunikation", "Verhalten", "Vertrauen", "Emotionale Distanz"],
          comm: "Kommunikation",
          emotional: "Emotionale Distanz",
          stability: "Verhalten",
          clarity: "Vertrauen",
          pattern: "Was sich wiederholt",
          meaning: "Was das jetzt bedeutet",
          next: "Wohin es kippt",
          noChange: "Wenn in den nachsten 3-6 Wochen nichts anders wird",
          recheck: "In 2-3 Wochen erneut prufen",
          recheckCta: "Scan erneut starten",
          back: "Zuruck zum Ergebnis",
        },
        sections: {
          communication: {
            body:
              "Gesprache starten normal und stoppen genau am wichtigsten Punkt. Eine Person sagt \"spater\" und das Thema bleibt offen. Im Alltag zeigt sich das durch spate Antworten auf heikle Themen, Themenwechsel und fehlende klare Absprachen nach Streit. Das erzeugt Unsicherheit, weil beide mit anderer Erwartung aus dem Gesprach gehen. Wenn das bleibt, kommt derselbe Streit mit neuem Anlass zuruck. Aktueller Wert: {score}/100.",
            check: "Wiederkehrender Marker: nach Konflikt gibt es keinen klaren Satz mit wer macht was bis wann.",
          },
          emotional: {
            body:
              "Nahe kommt kurz, dann fallt sie schnell weg. Abends ist Verbindung da, am nachsten Tag wirkt alles kuhl ohne Erklarung. Im Verhalten sind das weniger Kontakt nach Stress, harterer Ton und langere Funkstille nach Uneinigkeit. Unsicherheit steigt, weil gute Momente nicht mehr verlasslich wirken. Wenn das sich wiederholt, schutzen sich beide mehr als sie sich annahern. Aktueller Wert: {score}/100.",
            check: "Wiederkehrender Marker: nach Enttauschung bleibt der Abstand bis zum nachsten Tag.",
          },
          stability: {
            body:
              "Worte und Handeln laufen nicht mehr stabil zusammen. Zusagen werden gemacht und spater verschoben oder abgeschwacht. Im Verhalten sieht man kurzfristige Absagen, vergessene kleine Absprachen und ungleiches Dranbleiben. Unsicherheit wachst, weil Zusagen an Gewicht verlieren. Wenn das bleibt, wird Alltag zu Kontrolle statt Vertrauen. Aktueller Wert: {score}/100.",
            check: "Wiederkehrender Marker: dieselbe kleine Zusage kippt mehr als einmal pro Woche.",
          },
          clarity: {
            body:
              "Vertrauen ist nicht mehr automatisch, sondern wird laufend gepruft. Neutrale Situationen werden zuerst mit Zweifel gelesen. Im Verhalten zeigt sich das durch Chat-Nachlesen, Antwortzeit-Vergleiche und indirekte Tests statt direkter Fragen. Unsicherheit wachst, weil Lucken mit schlechten Deutungen gefullt werden, bevor Fakten kommen. Wenn das bleibt, wird weniger offen gesprochen und mehr angenommen. Aktueller Wert: {score}/100.",
            check: "Wiederkehrender Marker: klare Fragen werden durch Andeutungen oder Schweigen ersetzt.",
          },
        },
        pattern:
          "Es lauft immer gleich: Druck, kurze Beruhigung, kein Abschluss, dann Ruckkehr desselben Themas.",
        meaning:
          "Das ist kein einzelner Ausrutscher, sondern ein Wochenablauf, der schon eure Entscheidungen steuert.",
        noChange:
          "Wenn nichts passiert, wird der Kontakt funktional und verliert Nahe. Nach aussen kann es weiter wie Beziehung aussehen, innen gibt es weniger Reparatur, mehr stille Tage und spatere Ruckkehr nach Konflikten. Der schwachste Bereich wird sehr wahrscheinlich den nachsten Bruch auslosen.",
        recheck:
          "In 2-3 Wochen erneut prufen, ob derselbe schwache Bereich weiter alles runterzieht.",
        benchmarkNote:
          "Wichtiger als der Gesamtwert ist der schwachste Bereich. Dort startet meist der nachste Konflikt.",
        outcome: {
          heading: "Was als Nachstes sichtbar wird",
          highImpact: "Jetzt am deutlichsten",
          mediumImpact: "Baut sich im Hintergrund auf",
          lowImpact: "Noch leichter, aber da",
          whyLabel: "Warum es zahlt",
          changeLabel: "Was sichtbar wird",
          high: {
            highImpact: [
              {
                title: "Offene Gesprache ohne Abschluss",
                explanation: "Wichtige Themen stoppen am schwierigsten Punkt und bleiben offen.",
                why: "Offene Punkte kommen mit mehr Frust zuruck.",
                change: "Der gleiche Streit kehrt schneller zuruck.",
              },
              {
                title: "Unregelmassige emotionale Erreichbarkeit",
                explanation: "An leichten Tagen ist Nahe da, an Drucktagen bricht sie weg.",
                why: "Drucktage entscheiden, ob Vertrauen halt.",
                change: "Abstand nach Konflikt dauert langer.",
              },
            ],
            mediumImpact: [
              {
                title: "Mudigkeit bei Zusagen",
                explanation: "Neue Zusagen wirken schwach, weil alte nicht getragen haben.",
                why: "Verlasslichkeit fallt leise, bevor es offen knallt.",
                change: "Direkte Wunsche werden seltener ausgesprochen.",
              },
            ],
            lowImpact: [
              {
                title: "Stille Gereiztheit",
                explanation: "Kurzer Ton, kleine Stiche, weniger Geduld nehmen zu.",
                why: "Kleine Reibung sammelt Distanz an.",
                change: "Normale Tage fuhlen sich ofter angespannt an.",
              },
            ],
          },
          mid: {
            highImpact: [
              {
                title: "Start-Stopp-Kontakt",
                explanation: "Nahe, dann Ruckzug, dann halbherzige Ruckkehr.",
                why: "Unvorhersehbarkeit schwacht Sicherheit.",
                change: "Beide rechnen fruher mit Enttauschung.",
              },
              {
                title: "Absprachen rutschen weg",
                explanation: "Was besprochen wurde, taucht in der Woche nicht als Verhalten auf.",
                why: "Vertrauen halt an Umsetzung, nicht an Worten.",
                change: "Kontrolle ersetzt Vertrauen.",
              },
            ],
            mediumImpact: [
              {
                title: "Spate Reparatur",
                explanation: "Streit beruhigt sich uber Tage statt uber Stunden.",
                why: "Lange Erholung erhoht den Preis jedes Konflikts.",
                change: "Mehr Zeit im Abstand statt in Verbindung.",
              },
            ],
            lowImpact: [
              {
                title: "Aussenlarm",
                explanation: "Externe Meinungen fullen Lucken aus unklaren Gesprachen.",
                why: "Unklarheit innen offnet die Tur nach aussen.",
                change: "Entscheidungen werden weniger aus eigenen Fakten getroffen.",
              },
            ],
          },
          low: {
            highImpact: [
              {
                title: "Dauerunsicherheit",
                explanation: "Grundfragen zu Richtung und Bindung bleiben offen.",
                why: "Ohne Basis startet jede Woche mit Zweifel.",
                change: "Energie geht in Deuten statt in Nahe.",
              },
              {
                title: "Schneller Vertrauensabbau",
                explanation: "Widerspruch zwischen Worten und Verhalten taucht haufig auf.",
                why: "Wiederholter Widerspruch zerstort Verlasslichkeit schnell.",
                change: "Neutrale Ereignisse wirken bedrohlich.",
              },
            ],
            mediumImpact: [
              {
                title: "Konfliktstapel",
                explanation: "Neue Themen ziehen sofort alte offene Themen rein.",
                why: "Offene Altlasten bleiben aktiv.",
                change: "Streit wird langer und unklarer.",
              },
            ],
            lowImpact: [
              {
                title: "Alltagsuberlastung",
                explanation: "Selbst kleine Planungen werden schwer.",
                why: "Praktische Reibung verstarkt den inneren Druck.",
                change: "Kleine Dinge wirken zu gross.",
              },
            ],
          },
        },
      },
      es: {
        ui: {
          eyebrow: "Informe completo",
          title: "Lo que esta pasando entre vosotros",
          indexLabel: "Trust Index:",
          subhead: "Lectura directa desde respuestas y conductas que se repiten.",
          overview: "Areas clave",
          charts: "Resultado y reparto por areas",
          chartNote: "Es una foto de semanas, no de un dia suelto.",
          scale: ["Menos tension", "Mezclado", "Mas tension"],
          areas: ["Comunicacion", "Conducta", "Confianza", "Distancia emocional"],
          comm: "Comunicacion",
          emotional: "Distancia emocional",
          stability: "Conducta",
          clarity: "Confianza",
          pattern: "Lo que vuelve",
          meaning: "Lo que significa ahora",
          next: "Hacia donde va",
          noChange: "Si nada cambia en 3-6 semanas",
          recheck: "Revisar otra vez en 2-3 semanas",
          recheckCta: "Repetir scan",
          back: "Volver al resultado",
        },
        sections: {
          communication: {
            body:
              "Las conversaciones empiezan, pero se cortan justo donde hay que concretar. Una persona dice \"luego\" y el tema queda abierto. En conducta se ve con respuestas tardias en temas importantes, cambios de tema y cero cierre claro despues del conflicto. Eso crea incertidumbre porque cada uno sale con una idea distinta de lo acordado. Si se repite, el mismo conflicto vuelve con otra forma. Resultado actual: {score}/100.",
            check: "Marcador repetido: tras discutir no queda una frase clara de quien hace que y cuando.",
          },
          emotional: {
            body:
              "La cercania aparece por ratos y luego cae de golpe. Una noche estais cerca y al dia siguiente hay frialdad sin explicacion. En conducta se nota en menos contacto bajo estres, tono mas seco y silencio mas largo tras desacuerdo. La incertidumbre sube porque los momentos buenos dejan de sentirse estables. Si se repite, ambos se protegen mas de lo que se acercan. Resultado actual: {score}/100.",
            check: "Marcador repetido: tras una decepcion la distancia sigue hasta el dia siguiente.",
          },
          stability: {
            body:
              "Lo prometido y lo que ocurre ya no van juntos de forma estable. Se acuerda algo en calma y luego se aplaza o se diluye. En conducta se ve en cancelaciones de ultima hora, pequenos acuerdos olvidados y seguimiento irregular. La incertidumbre crece porque las palabras pierden peso cuando la ejecucion cambia cada semana. Si se repite, el dia a dia se vuelve control y no descanso. Resultado actual: {score}/100.",
            check: "Marcador repetido: el mismo compromiso pequeno falla mas de una vez por semana.",
          },
          clarity: {
            body:
              "La confianza ya no es automatica y se revisa todo el tiempo. Situaciones neutras se leen primero con duda. En conducta aparece como releer chats, medir tiempos de respuesta y probar en vez de preguntar directo. La incertidumbre sube porque los huecos se llenan con la peor lectura antes de confirmar hechos. Si se repite, se habla menos claro y se supone mas. Resultado actual: {score}/100.",
            check: "Marcador repetido: preguntas simples se cambian por indirectas o silencio.",
          },
        },
        pattern:
          "Se repite la misma secuencia: tension, calma parcial, falta de cierre, regreso del mismo tema.",
        meaning:
          "No es un mal dia suelto. Es un ciclo semanal que ya esta marcando decisiones.",
        noChange:
          "Si nada cambia, el contacto sera mas funcional y menos cercano. Por fuera podeis seguir pareciendo pareja, pero por dentro habra menos reparacion, mas silencio y vuelta mas lenta despues de discutir. El area mas debil es donde es mas probable el siguiente quiebre.",
        recheck:
          "Repite en 2-3 semanas y mira si el mismo punto debil sigue arrastrando todo.",
        benchmarkNote:
          "Importa mas el area mas baja que el numero global. Ahi suele empezar la siguiente pelea.",
        outcome: {
          heading: "Lo que se vera despues",
          highImpact: "Lo mas visible ahora",
          mediumImpact: "Lo que crece por debajo",
          lowImpact: "Mas suave, pero ya presente",
          whyLabel: "Por que importa",
          changeLabel: "Lo que se ve",
          high: {
            highImpact: [
              {
                title: "Conversaciones sin cierre",
                explanation: "Los temas clave paran justo en la parte dificil y quedan abiertos.",
                why: "Lo abierto vuelve con mas carga.",
                change: "La misma pelea vuelve antes.",
              },
              {
                title: "Disponibilidad emocional irregular",
                explanation: "Hay apoyo en dias faciles y retirada en dias de presion.",
                why: "Los dias duros prueban de verdad la relacion.",
                change: "La distancia tras conflicto dura mas.",
              },
            ],
            mediumImpact: [
              {
                title: "Cansancio de promesas",
                explanation: "Las nuevas promesas se oyen debiles por incumplimientos previos.",
                why: "La fiabilidad cae antes del conflicto grande.",
                change: "Se piden menos cosas de forma directa.",
              },
            ],
            lowImpact: [
              {
                title: "Irritacion de fondo",
                explanation: "Suben respuestas cortas, tono seco y poca paciencia.",
                why: "Lo pequeno se acumula y pesa.",
                change: "Dias normales se sienten tensos mas seguido.",
              },
            ],
          },
          mid: {
            highImpact: [
              {
                title: "Contacto de encender-apagar",
                explanation: "Hay cercania, luego retirada, luego regreso parcial.",
                why: "La imprevisibilidad rompe seguridad.",
                change: "Ambos esperan decepcion antes.",
              },
              {
                title: "Deriva de acuerdos",
                explanation: "Lo hablado no aparece en la semana siguiente.",
                why: "La confianza depende de hechos, no de intencion.",
                change: "Se cambia confianza por vigilancia.",
              },
            ],
            mediumImpact: [
              {
                title: "Reparacion lenta",
                explanation: "Los choques tardan dias en bajar en vez de horas.",
                why: "Recuperar lento sube el coste emocional.",
                change: "Mas tiempo en distancia.",
              },
            ],
            lowImpact: [
              {
                title: "Ruido externo",
                explanation: "Opiniones externas llenan huecos de conversaciones poco claras.",
                why: "La falta de claridad interna abre esa puerta.",
                change: "Decisiones menos basadas en lo vivido entre vosotros.",
              },
            ],
          },
          low: {
            highImpact: [
              {
                title: "Incertidumbre constante",
                explanation: "Preguntas base de rumbo y compromiso siguen sin respuesta.",
                why: "Sin base, cada semana empieza en duda.",
                change: "La energia se va en descifrar, no en acercarse.",
              },
              {
                title: "Desgaste rapido de confianza",
                explanation: "Chocan seguido palabras y hechos.",
                why: "Ese choque repetido rompe fiabilidad.",
                change: "Lo neutro se vive como amenaza.",
              },
            ],
            mediumImpact: [
              {
                title: "Acumulacion de conflictos",
                explanation: "Cada tema nuevo arrastra viejos temas abiertos.",
                why: "Lo no cerrado sigue activo.",
                change: "Discusiones mas largas y menos claras.",
              },
            ],
            lowImpact: [
              {
                title: "Carga diaria",
                explanation: "Hasta planes simples se vuelven pesados.",
                why: "La friccion practica suma mas tension.",
                change: "Lo pequeno pesa demasiado.",
              },
            ],
          },
        },
      },
      pt: {
        ui: {
          eyebrow: "Relatorio completo",
          title: "O que esta a acontecer entre voces",
          indexLabel: "Trust Index:",
          subhead: "Leitura direta das respostas e do comportamento que se repete.",
          overview: "Areas principais",
          charts: "Pontuacao e divisao por areas",
          chartNote: "Isto mostra semanas, nao apenas um dia.",
          scale: ["Menos tensao", "Misto", "Mais tensao"],
          areas: ["Comunicacao", "Comportamento", "Confianca", "Distancia emocional"],
          comm: "Comunicacao",
          emotional: "Distancia emocional",
          stability: "Comportamento",
          clarity: "Confianca",
          pattern: "O que volta a acontecer",
          meaning: "O que isto significa agora",
          next: "Para onde isto caminha",
          noChange: "Se nada mudar nas proximas 3-6 semanas",
          recheck: "Ver novamente em 2-3 semanas",
          recheckCta: "Refazer scan",
          back: "Voltar ao resultado",
        },
        sections: {
          communication: {
            body:
              "As conversas comecam normais, mas param no ponto mais importante. Uma pessoa diz \"depois\" e o tema fica aberto. No comportamento isso aparece como resposta tardia em temas sensiveis, mudanca de assunto e falta de fecho claro apos conflito. Isso cria incerteza porque cada um sai com uma versao diferente do que ficou combinado. Se se repetir, o mesmo conflito volta com outra forma. Pontuacao atual: {score}/100.",
            check: "Marcador repetido: depois da discussao nao fica uma frase clara de quem faz o que e quando.",
          },
          emotional: {
            body:
              "A proximidade aparece por momentos e cai rapido. Numa noite ha ligacao, no dia seguinte ha frieza sem explicacao. No comportamento nota-se menos contacto quando ha stress, tom mais duro e silencio mais longo apos desacordo. A incerteza sobe porque os momentos bons deixam de parecer seguros. Se isto se repetir, ambos protegem-se mais do que se aproximam. Pontuacao atual: {score}/100.",
            check: "Marcador repetido: depois de dececao, o afastamento segue ate ao dia seguinte.",
          },
          stability: {
            body:
              "O que e prometido e o que acontece deixam de andar juntos. O acordo e feito em calma e depois e adiado ou enfraquecido. No comportamento isso aparece em cancelamentos de ultima hora, pequenos combinados esquecidos e seguimento irregular. A incerteza cresce porque a palavra perde valor quando a execucao oscila. Se se repetir, o dia a dia vira verificacao em vez de confianca. Pontuacao atual: {score}/100.",
            check: "Marcador repetido: o mesmo combinado pequeno falha mais de uma vez na mesma semana.",
          },
          clarity: {
            body:
              "A confianca deixa de ser automatica e passa a ser verificada o tempo todo. Situacoes neutras sao lidas primeiro com duvida. No comportamento isso aparece em reler conversas, medir tempo de resposta e testar em vez de perguntar diretamente. A incerteza cresce porque os vazios sao preenchidos com a pior leitura antes dos factos. Se se repetir, fala-se menos claro e assume-se mais. Pontuacao atual: {score}/100.",
            check: "Marcador repetido: perguntas simples viram indiretas ou silencio.",
          },
        },
        pattern:
          "Repete-se a mesma sequencia: tensao, alivio parcial, falta de fecho, regresso do mesmo tema.",
        meaning:
          "Nao e um dia mau isolado. E um ciclo semanal que ja esta a guiar as vossas decisoes.",
        noChange:
          "Se nada mudar, o contacto fica mais funcional e menos proximo. Por fora pode parecer que continua tudo, mas por dentro havera menos reparacao, mais silencio e regresso mais lento depois de conflito. A area mais fraca e onde o proximo corte e mais provavel.",
        recheck:
          "Refaz em 2-3 semanas e ve se o mesmo ponto fraco continua a puxar o resto para baixo.",
        benchmarkNote:
          "Mais importante que o numero geral e a area mais baixa. E ali que o proximo conflito costuma comecar.",
        outcome: {
          heading: "O que vai aparecer a seguir",
          highImpact: "Mais visivel agora",
          mediumImpact: "A crescer no fundo",
          lowImpact: "Mais leve, mas ja presente",
          whyLabel: "Porque importa",
          changeLabel: "O que aparece",
          high: {
            highImpact: [
              {
                title: "Conversas sem fecho",
                explanation: "Temas centrais param no ponto mais dificil e ficam abertos.",
                why: "Tema aberto volta com mais friccao.",
                change: "A mesma discussao volta mais cedo.",
              },
              {
                title: "Disponibilidade emocional irregular",
                explanation: "Ha apoio em dias leves e afastamento em dias de pressao.",
                why: "E no stress que a relacao e testada.",
                change: "A distancia apos conflito dura mais.",
              },
            ],
            mediumImpact: [
              {
                title: "Cansaco de promessas",
                explanation: "Novas promessas soam fracas por causa das antigas nao cumpridas.",
                why: "A confiabilidade cai antes do conflito grande.",
                change: "Menos pedidos diretos, mais cautela.",
              },
            ],
            lowImpact: [
              {
                title: "Irritacao de fundo",
                explanation: "Resposta curta, tom seco e pouca paciencia aparecem mais.",
                why: "Pequenas coisas acumulam desgaste.",
                change: "Dias normais ficam tensos com mais frequencia.",
              },
            ],
          },
          mid: {
            highImpact: [
              {
                title: "Contacto liga-desliga",
                explanation: "Ha proximidade, depois afastamento, depois retorno parcial.",
                why: "Imprevisibilidade baixa a seguranca.",
                change: "Os dois antecipam dececao.",
              },
              {
                title: "Deriva dos acordos",
                explanation: "O que foi combinado nao aparece no comportamento da semana seguinte.",
                why: "Confianca depende de execucao, nao de intencao.",
                change: "Vigilancia substitui confianca.",
              },
            ],
            mediumImpact: [
              {
                title: "Reparo lento",
                explanation: "Conflito baixa em dias, nao em horas.",
                why: "Recuperacao lenta aumenta o custo emocional.",
                change: "Mais tempo em distancia.",
              },
            ],
            lowImpact: [
              {
                title: "Ruido externo",
                explanation: "Opinioes de fora ocupam espaco deixado por conversas pouco claras.",
                why: "Falta de clareza interna abre essa porta.",
                change: "Decisao menos baseada no que voces vivem.",
              },
            ],
          },
          low: {
            highImpact: [
              {
                title: "Incerteza cronica",
                explanation: "Perguntas base sobre rumo e compromisso ficam sem resposta.",
                why: "Sem base, cada semana recomeca na duvida.",
                change: "Energia vai para decifrar, nao para aproximar.",
              },
              {
                title: "Desgaste rapido da confianca",
                explanation: "Conflito entre palavra e acao aparece com frequencia.",
                why: "Esse choque repetido quebra confiabilidade.",
                change: "O neutro parece ameaca.",
              },
            ],
            mediumImpact: [
              {
                title: "Empilhamento de conflitos",
                explanation: "Tema novo puxa temas antigos que ficaram abertos.",
                why: "Sem fecho, backlog continua ativo.",
                change: "Discussao mais longa e menos clara.",
              },
            ],
            lowImpact: [
              {
                title: "Peso na rotina",
                explanation: "Ate combinados simples do dia ficam pesados.",
                why: "Friccao pratica soma com desgaste emocional.",
                change: "Coisas pequenas pesam demasiado.",
              },
            ],
          },
        },
      },
    };
    return packs[getPremiumRewriteLocale(locale)];
  }

  function localizeReportPageUi(locale) {
    const L = getPremiumRewriteLocale(locale);
    const chrome = PAGE_CHROME_UI[L] || PAGE_CHROME_UI.en;
    const map = {
      pl: {
        eyebrow: "Raport premium RelationshipScan",
        title: "Pełna analiza relacji na podstawie Twoich odpowiedzi",
        indexLabel: "Trust Index:",
        subhead: "Krótka interpretacja",
        overview: "Rozkład kluczowych obszarów",
        charts: "Trust Index i wykres",
        chartNote: "Wysoki wynik w jednym obszarze nie równoważy automatycznie niskiego wyniku w innym. Relacja działa stabilnie wtedy, gdy te elementy są względnie spójne.",
        scale: ["Niski", "Średni", "Wysoki"],
        areas: ["Inicjatywa", "Zaangażowanie", "Bliskość", "Stabilność"],
        comm: "Inicjatywa",
        emotional: "Zaangażowanie",
        stability: "Bliskość",
        clarity: "Stabilność",
        tension: "Napięcie",
        benchmark: "Obraz całości",
        alerts: "Główny problem",
        pattern: "Powtarzający się schemat",
        meaning: "Wniosek końcowy",
        trajectory: "Kierunek relacji w najbliższych tygodniach",
        outcome: "Co może zmienić wynik",
        next: "Co możesz zrobić teraz",
        summary: "Podsumowanie raportu",
        noChange: "Jeśli nic się nie zmieni",
        recheck: "Plan 3 kroków",
        recheckCta: "Powtórz skan",
        back: "Wróć do wyniku",
      },
      en: {
        eyebrow: "RelationshipScan Premium Report",
        title: "Full relationship analysis based on your answers",
        indexLabel: "Trust Index:",
        subhead: "Short interpretation",
        overview: "Breakdown of key areas",
        charts: "Trust Index and chart",
        chartNote: "A high score in one area does not automatically compensate for a low score in another. A relationship is stable when these elements remain relatively consistent.",
        scale: ["Low", "Medium", "High"],
        areas: ["Initiative", "Involvement", "Closeness", "Stability"],
        comm: "Initiative",
        emotional: "Involvement",
        stability: "Closeness",
        clarity: "Stability",
        tension: "Tension",
        benchmark: "Overall picture",
        alerts: "Main issue",
        pattern: "Recurring pattern",
        meaning: "Final conclusion",
        trajectory: "Relationship direction in the coming weeks",
        outcome: "What can change the result",
        next: "What you can do now",
        summary: "Report summary",
        noChange: "If nothing changes",
        recheck: "3-step plan",
        recheckCta: "Run scan again",
        back: "Back to result",
      },
      de: {
        eyebrow: "RelationshipScan Premium-Bericht",
        title: "Vollständige Beziehungsanalyse auf Grundlage deiner Antworten",
        indexLabel: "Trust Index:",
        subhead: "Kurzinterpretation",
        overview: "Verteilung der zentralen Bereiche",
        charts: "Trust Index und Diagramm",
        chartNote: "Ein hoher Wert in einem Bereich gleicht einen niedrigen Wert in einem anderen nicht automatisch aus. Eine Beziehung ist stabil, wenn diese Elemente relativ stimmig zueinander bleiben.",
        scale: ["Niedrig", "Mittel", "Hoch"],
        areas: ["Initiative", "Engagement", "Nähe", "Stabilität"],
        comm: "Initiative",
        emotional: "Engagement",
        stability: "Nähe",
        clarity: "Stabilität",
        tension: "Spannung",
        benchmark: "Gesamtbild",
        alerts: "Hauptproblem",
        pattern: "Wiederkehrendes Muster",
        meaning: "Abschließende Einschätzung",
        trajectory: "Richtung der Beziehung in den kommenden Wochen",
        outcome: "Was das Ergebnis verändern kann",
        next: "Was du jetzt tun kannst",
        summary: "Zusammenfassung",
        noChange: "Wenn sich nichts ändert",
        recheck: "3-Schritte-Plan",
        recheckCta: "Scan erneut starten",
        back: "Zurück zum Ergebnis",
      },
      es: {
        eyebrow: "Informe premium de RelationshipScan",
        title: "Análisis completo de la relación basado en tus respuestas",
        indexLabel: "Trust Index:",
        subhead: "Interpretación breve",
        overview: "Distribución de las áreas clave",
        charts: "Trust Index y gráfico",
        chartNote: "Un resultado alto en un área no compensa automáticamente un resultado bajo en otra. La relación se mantiene estable cuando estos elementos son relativamente coherentes entre sí.",
        scale: ["Bajo", "Medio", "Alto"],
        areas: ["Iniciativa", "Compromiso", "Cercanía", "Estabilidad"],
        comm: "Iniciativa",
        emotional: "Compromiso",
        stability: "Cercanía",
        clarity: "Estabilidad",
        tension: "Tensión",
        benchmark: "Visión general",
        alerts: "Problema principal",
        pattern: "Patrón repetitivo",
        meaning: "Conclusión final",
        trajectory: "Dirección de la relación en las próximas semanas",
        outcome: "Qué puede cambiar el resultado",
        next: "Qué puedes hacer ahora",
        summary: "Resumen",
        noChange: "Si nada cambia",
        recheck: "Plan de 3 pasos",
        recheckCta: "Repetir scan",
        back: "Volver al resultado",
      },
      pt: {
        eyebrow: "Relatório premium RelationshipScan",
        title: "Análise completa da relação com base nas tuas respostas",
        indexLabel: "Trust Index:",
        subhead: "Interpretação breve",
        overview: "Distribuição das áreas principais",
        charts: "Trust Index e gráfico",
        chartNote: "Um resultado alto numa área não compensa automaticamente um resultado baixo noutra. A relação mantém-se estável quando estes elementos são relativamente coerentes entre si.",
        scale: ["Baixo", "Médio", "Alto"],
        areas: ["Iniciativa", "Envolvimento", "Proximidade", "Estabilidade"],
        comm: "Iniciativa",
        emotional: "Envolvimento",
        stability: "Proximidade",
        clarity: "Estabilidade",
        tension: "Tensão",
        benchmark: "Visão geral",
        alerts: "Problema principal",
        pattern: "Padrão recorrente",
        meaning: "Conclusão final",
        trajectory: "Direção da relação nas próximas semanas",
        outcome: "O que pode mudar o resultado",
        next: "O que podes fazer agora",
        summary: "Resumo",
        noChange: "Se nada mudar",
        recheck: "Plano de 3 passos",
        recheckCta: "Repetir scan",
        back: "Voltar ao resultado",
      },
    };
    const ui = map[L] || map.en;
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
    setText("report-tension-heading", ui.tension);
    setText("report-pattern-heading", ui.pattern);
    setText("report-meaning-heading", ui.meaning);
    setText("report-next-heading", ui.next);
    setText("report-nochange-heading", ui.noChange);
    setText("report-recheck-heading", ui.recheck);
    setText("report-recheck-cta", ui.recheckCta);
    const outcomeUi = getOutcomeActionsContent(L);
    setText("report-benchmark-heading", ui.benchmark);
    setText("report-alerts-heading", ui.alerts);
    setText("report-trajectory-heading", ui.trajectory);
    setText("report-outcome-heading", ui.outcome || outcomeUi.heading);
    setText("report-timeline-heading", ui.summary);
    setText("report-disclaimer-text", RESULT_SIGNAL_LINE_BY_LOCALE[L] || RESULT_SIGNAL_LINE_BY_LOCALE.en);
    setText("report-back-link", ui.back);
    setText("report-donut-label", "Trust Index");
    setText("report-footer-home-link", chrome.homeLink);
    setText("report-footer-note-disclaimer", chrome.footerDisclaimer);
    const reportBackLink = document.getElementById("report-back-link");
    const reportHomeLink = document.getElementById("report-footer-home-link");
    if (reportBackLink) reportBackLink.setAttribute("href", getFlowPageUrl("result", L));
    if (reportHomeLink) reportHomeLink.setAttribute("href", LOCALE_PATHS[L] || LOCALE_PATHS.en);
    if (document.getElementById("report-lock-title")) renderPaywallModalText(L);
  }

  function getInterpretationLead(locale) {
    const map = { pl: "Interpretacja:", en: "Interpretation:", de: "Interpretation:", es: "Interpretación:", pt: "Interpretação:" };
    return map[getPremiumRewriteLocale(locale)] || map.en;
  }

  function getAreaInterpretation(locale, key) {
    const L = getPremiumRewriteLocale(locale);
    const map = {
      pl: {
        initiative: "Inicjatywa pokazuje, czy relacja ma naturalny ruch po obu stronach, czy wymaga stałego podtrzymywania przez jedną osobę.",
        engagement: "Zaangażowanie nie oznacza tylko czasu. Chodzi też o uwagę, gotowość i realny udział w codziennym utrzymywaniu relacji.",
        closeness: "Bliskość nie opiera się na pojedynczych dobrych momentach, tylko na powtarzalności. Brak ciągłości powoduje poczucie niestabilności.",
        stability: "Stabilność pokazuje, czy relacja ma rytm, do którego można wracać. Bez rytmu nawet dobre momenty nie budują trwałego poczucia bezpieczeństwa.",
        tension: "Napięcie samo w sobie nie przekreśla relacji. Problem zaczyna się wtedy, gdy nie zostaje domknięte i przechodzi na kolejne sytuacje.",
      },
      en: {
        initiative: "Initiative shows whether the relationship has movement from both sides, or whether it needs to be constantly maintained by one person.",
        engagement: "Involvement is not only about time. It is also about attention, readiness and real participation in maintaining the relationship day to day.",
        closeness: "Closeness is not based on single good moments, but on repetition. A lack of continuity creates a sense of instability.",
        stability: "Stability shows whether the relationship has a rhythm to return to. Without rhythm, even good moments do not build lasting safety.",
        tension: "Tension itself does not cancel a relationship. The problem begins when it is not resolved and carries into the next situations.",
      },
      de: {
        initiative: "Initiative zeigt, ob die Beziehung Bewegung von beiden Seiten hat oder ob sie dauerhaft von einer Person aufrechterhalten werden muss.",
        engagement: "Engagement bedeutet nicht nur Zeit. Es geht auch um Aufmerksamkeit, Bereitschaft und echte Beteiligung am täglichen Erhalt der Beziehung.",
        closeness: "Nähe entsteht nicht durch einzelne gute Momente, sondern durch Wiederholung. Fehlende Kontinuität erzeugt ein Gefühl von Instabilität.",
        stability: "Stabilität zeigt, ob die Beziehung einen Rhythmus hat, zu dem man zurückkehren kann. Ohne Rhythmus bauen selbst gute Momente kein dauerhaftes Sicherheitsgefühl auf.",
        tension: "Spannung allein beendet keine Beziehung. Problematisch wird es, wenn sie nicht geklärt wird und in die nächsten Situationen übergeht.",
      },
      es: {
        initiative: "La iniciativa muestra si la relación tiene movimiento por ambas partes o si necesita ser sostenida constantemente por una sola persona.",
        engagement: "El compromiso no es solo tiempo. También incluye atención, disposición y participación real en el mantenimiento cotidiano de la relación.",
        closeness: "La cercanía no se basa en momentos buenos aislados, sino en su repetición. La falta de continuidad genera sensación de inestabilidad.",
        stability: "La estabilidad muestra si la relación tiene un ritmo al que se puede volver. Sin ritmo, incluso los buenos momentos no construyen una seguridad duradera.",
        tension: "La tensión por sí sola no invalida una relación. El problema empieza cuando no se resuelve y pasa a las siguientes situaciones.",
      },
      pt: {
        initiative: "A iniciativa mostra se a relação tem movimento dos dois lados ou se precisa de ser sustentada constantemente por uma só pessoa.",
        engagement: "O envolvimento não é apenas tempo. Também inclui atenção, disponibilidade e participação real na manutenção diária da relação.",
        closeness: "A proximidade não se baseia em bons momentos isolados, mas na sua repetição. A falta de continuidade cria uma sensação de instabilidade.",
        stability: "A estabilidade mostra se a relação tem um ritmo ao qual se pode voltar. Sem ritmo, até os bons momentos deixam de construir uma segurança duradoura.",
        tension: "A tensão por si só não invalida uma relação. O problema começa quando ela não é resolvida e passa para as situações seguintes.",
      },
    };
    return (map[L] && map[L][key]) || (map.en && map.en[key]) || "";
  }

  function getOverviewCaption(locale) {
    const map = {
      pl: "Ten wynik nie opisuje całej relacji raz na zawsze. Pokazuje jej aktualny układ: jak rozkładają się inicjatywa, zaangażowanie, bliskość, stabilność i napięcie w tym momencie.",
      en: "This score does not describe the whole relationship once and for all. It shows its current structure: how initiative, involvement, closeness, stability and tension are distributed at this moment.",
      de: "Dieses Ergebnis beschreibt nicht die ganze Beziehung für immer. Es zeigt ihre aktuelle Struktur: wie sich Initiative, Engagement, Nähe, Stabilität und Spannung in diesem Moment verteilen.",
      es: "Este resultado no describe toda la relación para siempre. Muestra su configuración actual: cómo se distribuyen la iniciativa, el compromiso, la cercanía, la estabilidad y la tensión en este momento.",
      pt: "Este resultado não descreve a relação inteira para sempre. Mostra a sua estrutura atual: como se distribuem a iniciativa, o envolvimento, a proximidade, a estabilidade e a tensão neste momento.",
    };
    return map[getPremiumRewriteLocale(locale)] || map.en;
  }

  function getOverviewNarrative(locale, score, areaScores, tensionScore) {
    const L = getPremiumRewriteLocale(locale);
    const heading = {
      pl: "Trust Index i obraz relacji",
      en: "Trust Index and overall picture",
      de: "Trust Index und Gesamtbild",
      es: "Trust Index y visión general",
      pt: "Trust Index e visão geral",
    };
    const body = {
      pl: `Trust Index: ${score}/100. Inicjatywa ${Math.round(areaScores.communication)}/100, zaangażowanie ${Math.round(areaScores.emotional)}/100, bliskość ${Math.round(areaScores.behavior)}/100, stabilność ${Math.round(areaScores.trust)}/100, napięcie ${tensionScore}/100.`,
      en: `Trust Index: ${score}/100. Initiative ${Math.round(areaScores.communication)}/100, involvement ${Math.round(areaScores.emotional)}/100, closeness ${Math.round(areaScores.behavior)}/100, stability ${Math.round(areaScores.trust)}/100, tension ${tensionScore}/100.`,
      de: `Trust Index: ${score}/100. Initiative ${Math.round(areaScores.communication)}/100, Engagement ${Math.round(areaScores.emotional)}/100, Nähe ${Math.round(areaScores.behavior)}/100, Stabilität ${Math.round(areaScores.trust)}/100, Spannung ${tensionScore}/100.`,
      es: `Trust Index: ${score}/100. Iniciativa ${Math.round(areaScores.communication)}/100, compromiso ${Math.round(areaScores.emotional)}/100, cercanía ${Math.round(areaScores.behavior)}/100, estabilidad ${Math.round(areaScores.trust)}/100, tensión ${tensionScore}/100.`,
      pt: `Trust Index: ${score}/100. Iniciativa ${Math.round(areaScores.communication)}/100, envolvimento ${Math.round(areaScores.emotional)}/100, proximidade ${Math.round(areaScores.behavior)}/100, estabilidade ${Math.round(areaScores.trust)}/100, tensão ${tensionScore}/100.`,
    };
    return { heading: heading[L] || heading.en, body: body[L] || body.en };
  }

  function getPrimaryIssueBlock(locale, areaScores, tensionScore) {
    const L = getPremiumRewriteLocale(locale);
    const values = [
      ["initiative", Math.round(areaScores.communication)],
      ["engagement", Math.round(areaScores.emotional)],
      ["closeness", Math.round(areaScores.behavior)],
      ["stability", Math.round(areaScores.trust)],
      ["tension", Math.round(100 - tensionScore)],
    ].sort((a, b) => a[1] - b[1]);
    const weakest = values[0][0];
    const names = {
      pl: { initiative: "inicjatywa", engagement: "zaangażowanie", closeness: "bliskość", stability: "stabilność", tension: "napięcie" },
      en: { initiative: "initiative", engagement: "involvement", closeness: "closeness", stability: "stability", tension: "tension" },
      de: { initiative: "Initiative", engagement: "Engagement", closeness: "Nähe", stability: "Stabilität", tension: "Spannung" },
      es: { initiative: "iniciativa", engagement: "compromiso", closeness: "cercanía", stability: "estabilidad", tension: "tensión" },
      pt: { initiative: "iniciativa", engagement: "envolvimento", closeness: "proximidade", stability: "estabilidade", tension: "tensão" },
    };
    const nm = (names[L] && names[L][weakest]) || names.en[weakest];
    const titleMap = { pl: `Główny problem: ${nm}`, en: `Main issue: ${nm}`, de: `Hauptproblem: ${nm}`, es: `Problema principal: ${nm}`, pt: `Problema principal: ${nm}` };
    const bodyMap = {
      pl: "Najczęściej nie chodzi o jedną sytuację, tylko o układ, który wraca. Bez zmiany mechanizmu ten sam schemat będzie się powtarzał.",
      en: "Most often this is not one situation, but a recurring setup. Without a concrete change, the same loop will return.",
      de: "Meist geht es nicht um eine einzelne Situation, sondern um ein wiederkehrendes Muster. Ohne konkrete Änderung kehrt dieselbe Schleife zurück.",
      es: "La mayoría de las veces no se trata de una sola situación, sino de un patrón que vuelve. Sin un cambio concreto, el mismo ciclo regresará.",
      pt: "Na maioria das vezes não se trata de uma única situação, mas de um padrão recorrente. Sem uma mudança concreta, o mesmo ciclo voltará.",
    };
    return { title: titleMap[L] || titleMap.en, body: bodyMap[L] || bodyMap.en };
  }

  function getTrajectoryMetaLabel(locale) {
    const map = { pl: "Wynik", en: "Score", de: "Wert", es: "Resultado", pt: "Resultado" };
    return map[getPremiumRewriteLocale(locale)] || map.en;
  }

  function getSpreadMetaLabel(locale) {
    const map = { pl: "Rozkład", en: "Spread", de: "Streuung", es: "Dispersión", pt: "Dispersão" };
    return map[getPremiumRewriteLocale(locale)] || map.en;
  }

  function getTensionNarrative(locale, tensionScore, trajectoryLabel) {
    const L = getPremiumRewriteLocale(locale);
    if (L === "pl") return `Wynik napięcia: ${tensionScore}/100. Gdy napięcie nie jest domykane, przechodzi na kolejne rozmowy i osłabia stabilność.`;
    if (L === "de") return `Spannungswert: ${tensionScore}/100. Wenn Spannung nicht geklärt wird, trägt sie sich in die nächsten Gespräche und schwächt die Stabilität.`;
    if (L === "es") return `Resultado de tensión: ${tensionScore}/100. Cuando la tensión no se cierra, pasa a las siguientes conversaciones y debilita la estabilidad.`;
    if (L === "pt") return `Resultado de tensão: ${tensionScore}/100. Quando a tensão não é resolvida, passa para as conversas seguintes e enfraquece a estabilidade.`;
    return `Tension score: ${tensionScore}/100. When tension is not resolved, it carries into the next conversations and weakens stability.`;
  }

  function getTensionCheck(locale) {
    const map = {
      pl: "Sprawdź, czy po konflikcie wracacie do tematu i domykacie go tego samego dnia.",
      en: "Check whether you return to the topic after conflict and close it on the same day.",
      de: "Prüfe, ob ihr nach Konflikten zum Thema zurückkehrt und es am selben Tag abschließt.",
      es: "Comprueba si después del conflicto volvéis al tema y lo cerráis el mismo día.",
      pt: "Verifica se após o conflito vocês voltam ao tema e fecham no mesmo dia.",
    };
    return map[getPremiumRewriteLocale(locale)] || map.en;
  }

  function buildOperationalDimension(locale, key, areaScores, trajectory) {
    const L = getPremiumRewriteLocale(locale);
    const sectionMap = { communication: "initiative", emotional: "engagement", stability: "closeness", clarity: "stability" };
    const areaKey = sectionMap[key] || "initiative";
    const score = areaKey === "initiative" ? areaScores.communication : areaKey === "engagement" ? areaScores.emotional : areaKey === "closeness" ? areaScores.behavior : areaScores.trust;
    const range = getScoreRange(score);
    const byLocale = {
      pl: {
        initiative: {
          high: "Inicjatywa jest po obu stronach. Kontakt i decyzje nie wisza na jednej osobie. To utrzymuje rowny rytm relacji.",
          mid: "Inicjatywa czesciej jest po jednej stronie. Jedna osoba czesciej zaczyna rozmowy i domyka sprawy. Taki uklad z czasem meczy.",
          low: "Inicjatywa jest slaba albo jednostronna. Kontakt urywa sie i wraca nieregularnie. Relacja traci kierunek.",
          i: "Interpretacja: ten obszar pokazuje, czy relacja niesie sie sama, czy wymaga stalego podtrzymywania przez jedna osobe.",
        },
        engagement: {
          high: "Zaangazowanie jest wzglednie rowne. Czas i uwaga sa dzielone po obu stronach. Obecnosc jest stabilna, nie przypadkowa.",
          mid: "Zaangazowanie jest nierowne. Ktos niesie wiekszy ciezar codziennych spraw i kontaktu. To podnosi napiecie w tle.",
          low: "Zaangazowanie spada albo jest niestabilne. Wspolne sprawy czesciej sa odkladane niz domykane. Narasta dystans.",
          i: "Interpretacja: tu chodzi nie tylko o czas, ale o jakosc obecnosci i gotowosc do brania odpowiedzialnosci.",
        },
        closeness: {
          high: "Bliskosc jest obecna rowniez w zwyklych dniach. Nie znika po pierwszym napieciu. To buduje poczucie oparcia.",
          mid: "Bliskosc pojawia sie, ale nie jest stabilna. Kontakt bywa intensywny, a potem wyraznie slabnie. Brakuje ciaglosci.",
          low: "Bliskosc jest ograniczona albo sporadyczna. Po trudnych sytuacjach szybciej pojawia sie wycofanie niz naprawa. Rosnie niepewnosc.",
          i: "Interpretacja: bliskosc działa wtedy, gdy wraca regularnie, a nie tylko w pojedynczych momentach.",
        },
        stability: {
          high: "Relacja ma rytm i przewidywalnosc. Ustalenia sa czesciej realizowane niz odkładane. Napiecie da sie domykac.",
          mid: "Stabilnosc jest chwiejna. Plany sa robione, ale latwo sie rozjezdzaja. Te same sprawy wracaja bez finalu.",
          low: "Stabilnosc jest niska. Sprawy zostaja otwarte, kontakt bywa minimalny, a napiecie przechodzi na kolejne sytuacje.",
          i: "Interpretacja: napiecie samo w sobie nie jest problemem; kluczowe jest, czy zostaje rozwiazane, czy narasta.",
        },
      },
      en: {
        initiative: { high: "Initiative is present on both sides. Contact and decisions do not depend on one person. This keeps the relationship moving in a shared rhythm.", mid: "Initiative is more often on one side. One person starts contact and closes open topics more often. Over time this creates imbalance.", low: "Initiative is weak or one-sided. Contact starts and stops irregularly. The relationship begins to lose direction.", i: "Interpretation: this area shows whether the relationship moves forward naturally or needs constant push from one side." },
        engagement: { high: "Involvement is relatively balanced. Time and attention are shared by both people. Presence stays consistent, not random.", mid: "Involvement is uneven. One side carries more of the shared load. This adds background tension.", low: "Involvement is declining or unstable. Shared matters are postponed more often than resolved. Distance grows.", i: "Interpretation: this is not only about time, but about quality of presence and practical follow-through." },
        closeness: { high: "Closeness is present in ordinary days, not only in special moments. It does not disappear after the first difficult talk.", mid: "Closeness appears, but it is inconsistent. Contact can be intense and then clearly weakens. Continuity is missing.", low: "Closeness is reduced or occasional. After hard moments, withdrawal is more common than repair. Uncertainty rises.", i: "Interpretation: closeness is built by repetition and continuity, not by isolated highs." },
        stability: { high: "The relationship has rhythm and predictability. Agreements are followed through more often than delayed. Tension gets closed.", mid: "Stability is mixed. Plans are made but often drift. The same issues return without closure.", low: "Stability is low. Matters stay unresolved, contact is minimal, and tension carries into new situations.", i: "Interpretation: tension itself is not the issue; the issue is whether it gets resolved or keeps accumulating." },
      },
      de: {
        initiative: { high: "Initiative ist auf beiden Seiten sichtbar. Kontakt und Entscheidungen hängen nicht nur an einer Person.", mid: "Initiative liegt häufiger auf einer Seite. Eine Person trägt mehr Start- und Klärungsarbeit.", low: "Initiative ist schwach oder einseitig. Kontakt entsteht unregelmäßig und verliert Richtung.", i: "Interpretation: Dieser Bereich zeigt, ob die Beziehung sich selbst trägt oder ständig angeschoben werden muss." },
        engagement: { high: "Engagement ist relativ ausgeglichen. Zeit und Aufmerksamkeit werden von beiden getragen.", mid: "Engagement ist ungleich verteilt. Eine Seite trägt deutlich mehr alltägliche Verantwortung.", low: "Engagement sinkt oder schwankt stark. Themen bleiben offen und Distanz wächst.", i: "Interpretation: Es geht nicht nur um Zeit, sondern um verlässliche Präsenz und Umsetzung." },
        closeness: { high: "Nähe ist auch im Alltag vorhanden, nicht nur in guten Momenten.", mid: "Nähe ist da, aber nicht stabil. Der Kontakt wechselt zwischen intensiv und deutlich schwächer.", low: "Nähe ist reduziert oder sporadisch. Nach Spannung folgt häufiger Rückzug als Reparatur.", i: "Interpretation: Nähe entsteht durch Wiederholung, nicht durch einzelne starke Momente." },
        stability: { high: "Die Beziehung hat Rhythmus. Vereinbarungen werden häufiger umgesetzt als verschoben.", mid: "Stabilität ist gemischt. Pläne werden gemacht, halten aber nicht konsequent.", low: "Stabilität ist niedrig. Offene Themen bleiben offen und Spannung trägt sich weiter.", i: "Interpretation: Spannung ist nicht das Hauptproblem - entscheidend ist, ob sie abgeschlossen wird." },
      },
      es: {
        initiative: { high: "La iniciativa aparece en ambos lados. El contacto y las decisiones no dependen solo de una persona.", mid: "La iniciativa recae más en una sola parte. Una persona impulsa y cierra más temas.", low: "La iniciativa es débil o unilateral. El contacto es irregular y pierde dirección.", i: "Interpretación: este bloque muestra si la relación avanza sola o si una sola persona la sostiene." },
        engagement: { high: "El compromiso está relativamente equilibrado. Tiempo y atención se reparten de forma estable.", mid: "El compromiso es desigual. Una parte carga más responsabilidades compartidas.", low: "El compromiso baja o se vuelve inestable. Quedan temas pendientes y crece la distancia.", i: "Interpretación: no es solo tiempo, también calidad de presencia y cumplimiento." },
        closeness: { high: "La cercanía está presente también en días normales, no solo en momentos especiales.", mid: "La cercanía aparece, pero no se mantiene. El contacto sube y luego baja con claridad.", low: "La cercanía es limitada o esporádica. Tras tensión, hay más retirada que reparación.", i: "Interpretación: la cercanía se construye por repetición y continuidad." },
        stability: { high: "La relación mantiene ritmo y previsibilidad. Los acuerdos se cumplen con más frecuencia.", mid: "La estabilidad es irregular. Se hacen planes, pero se desordenan con facilidad.", low: "La estabilidad es baja. Los temas se quedan abiertos y la tensión se acumula.", i: "Interpretación: la tensión no es el problema por sí sola; lo clave es si se resuelve o se arrastra." },
      },
      pt: {
        initiative: { high: "A iniciativa aparece dos dois lados. O contacto e as decisões não dependem de uma só pessoa.", mid: "A iniciativa cai mais para um lado. Uma pessoa inicia e fecha mais assuntos.", low: "A iniciativa é fraca ou unilateral. O contacto torna-se irregular e sem direção.", i: "Interpretação: esta área mostra se a relação se sustenta sozinha ou exige esforço constante de uma parte." },
        engagement: { high: "O envolvimento está relativamente equilibrado. Tempo e atenção são partilhados.", mid: "O envolvimento é desigual. Uma parte assume mais peso nas responsabilidades comuns.", low: "O envolvimento desce ou oscila. Assuntos ficam por resolver e cresce o distanciamento.", i: "Interpretação: não se trata só de tempo, mas da qualidade da presença e da execução." },
        closeness: { high: "A proximidade está presente também no dia a dia, não apenas em momentos bons.", mid: "A proximidade aparece, mas não se mantém. O contacto alterna entre intensidade e afastamento.", low: "A proximidade é reduzida ou esporádica. Depois da tensão, há mais retração do que reparação.", i: "Interpretação: a proximidade depende de continuidade, não de picos isolados." },
        stability: { high: "A relação tem ritmo e previsibilidade. Os acordos são cumpridos com maior consistência.", mid: "A estabilidade é irregular. Planos são feitos, mas desalinham-se com facilidade.", low: "A estabilidade é baixa. Temas ficam abertos e a tensão passa para as situações seguintes.", i: "Interpretação: a tensão em si não é o problema; o ponto é se ela é resolvida ou acumulada." },
      },
    };
    const d = (byLocale[L] || byLocale.en)[areaKey];
    return { body: `${d[range]}\n\nAktualny wynik obszaru: ${Math.round(score)}/100.`, check: d.i };
  }

  function buildNoChangeScenario(locale, areaScores, trajectory, alertCount) {
    const L = getPremiumRewriteLocale(locale);
    if (L === "pl") {
      return "Jesli nic sie nie zmieni, jakosc relacji bedzie spadac stopniowo. Najpierw pojawi sie wiecej odkladanych tematow i mniej domkniec, potem zmeczenie i dystans. Najczesciej nie ma jednego momentu kryzysu - sa powtarzajace sie rzeczy, na ktore nikt nie reaguje.";
    }
    if (L === "de") {
      return "Wenn sich nichts aendert, sinkt die Beziehungsqualitaet schrittweise. Erst bleiben mehr Themen offen, dann steigen Erschoepfung und Distanz. Meist gibt es keinen einzelnen Krisenmoment, sondern wiederkehrende Dinge ohne Reaktion.";
    }
    if (L === "es") {
      return "Si nada cambia, la calidad de la relacion bajara de forma gradual. Primero habra mas temas abiertos y menos cierres, luego cansancio y distancia. Normalmente no hay un unico momento de crisis, sino repeticion sin reaccion.";
    }
    if (L === "pt") {
      return "Se nada mudar, a qualidade da relacao vai cair de forma gradual. Primeiro aumentam os temas por fechar, depois surgem desgaste e distanciamento. Na maioria dos casos nao existe um unico momento de crise, mas repeticao sem resposta.";
    }
    return "If nothing changes, relationship quality will decline gradually. First, more topics stay unresolved and fewer things get closed. Then fatigue and distance increase. Most often there is no single crisis moment - there is repeated pattern with no response.";
  }

  function buildPatternAndMeaning(locale, areaScores, trajectory, alertCount) {
    const L = getPremiumRewriteLocale(locale);
    if (L === "pl") {
      return {
        pattern: "Najczesciej nie chodzi o jedna sytuacje, tylko o schemat: te same sprawy wracaja w innej formie, kontakt zmienia sie skokowo, a napiecie nie ma punktu zamkniecia.",
        meaning: "Relacja nie pogarsza sie nagle. Zmienia sie wtedy, gdy jeden obszar jest stale przeciazony - najczesciej inicjatywa albo zaangazowanie. To uruchamia reakcje w innych obszarach: mniej bliskosci, wiecej napiecia i slabsza stabilnosc.",
      };
    }
    if (L === "de") {
      return {
        pattern: "Meist geht es nicht um einen einzelnen Vorfall, sondern um ein Muster: dieselben Themen kommen in neuer Form zurueck, der Kontakt schwankt stark, und Spannung erreicht keinen echten Abschluss.",
        meaning: "Eine Beziehung verschlechtert sich selten ploetzlich. Sie kippt, wenn ein Bereich dauerhaft ueberlastet ist - meist Initiative oder Engagement. Dann reagieren die anderen Bereiche mit weniger Naehe, mehr Spannung und geringerer Stabilitaet.",
      };
    }
    if (L === "es") {
      return {
        pattern: "Casi nunca es una sola situacion, sino un patron: los mismos temas vuelven con otra forma, el contacto cambia de golpe y la tension no llega a cerrarse.",
        meaning: "La relacion no empeora de un dia para otro. Cambia cuando un area queda sobrecargada de forma constante, normalmente iniciativa o compromiso. Eso afecta al resto: menos cercania, mas tension y menos estabilidad.",
      };
    }
    if (L === "pt") {
      return {
        pattern: "Na maioria dos casos nao e uma situacao isolada, mas um padrao: os mesmos temas voltam noutra forma, o contacto oscila de forma brusca e a tensao nao chega a fecho.",
        meaning: "A relacao nao se deteriora de repente. Ela muda quando uma area fica sobrecarregada por muito tempo, normalmente iniciativa ou envolvimento. Isso afeta as outras areas: menos proximidade, mais tensao e menos estabilidade.",
      };
    }
    return {
      pattern: "Most often this is not one situation but a recurring pattern: the same issues return in new form, contact shifts abruptly, and tension never reaches true closure.",
      meaning: "A relationship does not deteriorate all at once. It changes when one area stays under constant strain - usually initiative or involvement. Then other areas react: less closeness, higher tension, and lower stability.",
    };
  }

  function getPremiumReportNarrative(locale) {
    const L = getPremiumRewriteLocale(locale);
    const opening = {
      pl: "Interpretacja skrocona: to wynik aktualnego ukladu relacji, a nie ocena calej historii.",
      en: "Short interpretation: this score describes the current structure, not the full history of the relationship.",
      de: "Kurzinterpretation: dieser Wert zeigt die aktuelle Struktur, nicht die gesamte Beziehungsgeschichte.",
      es: "Interpretacion breve: este resultado describe la estructura actual, no toda la historia de la relacion.",
      pt: "Interpretacao breve: este resultado mostra a estrutura atual, nao toda a historia da relacao.",
    };
    return {
      opening: opening[L] || opening.en,
      benchmarkNote: "",
      dimensions: {},
      pattern: "",
      meaning: "",
      recheck: "",
    };
  }

  function getOutcomeActionsContent(locale) {
    const L = getPremiumRewriteLocale(locale);
    const map = {
      pl: {
        heading: "Dzialania szczegolowe",
        highImpact: "Najwazniejsze teraz",
        mediumImpact: "Dodatkowe kroki",
        lowImpact: "Plan 3 krokow",
        whyLabel: "Dlaczego",
        changeLabel: "Co zrobic",
        high: {
          highImpact: [
            { title: "Najwazniejszy obszar do zmiany", explanation: "Skup sie na najslabszym obszarze i nie rozpraszaj dzialan.", why: "Rozproszenie utrzymuje chaos.", change: "Jedna zmiana, jeden obszar." },
            { title: "Inicjatywa", explanation: "Jesli inicjatywa jest niska, przestan ciagnac wszystko samodzielnie i sprawdz reakcje drugiej strony.", why: "Jednostronny wysilek szybko meczy.", change: "Daj przestrzen i obserwuj, czy druga strona przejmuje czesc inicjatywy." },
          ],
          mediumImpact: [
            { title: "Zaangazowanie i bliskosc", explanation: "Sprawdz, gdzie znika czas i uwaga. Bez tego nie da sie wyrownac zaangazowania.", why: "Brak obecnosci oslabia kontakt.", change: "Ustal jeden staly punkt kontaktu tygodniowo." },
          ],
          lowImpact: [
            { title: "3 kroki", explanation: "Wybierz jeden obszar. Wprowadz jedna zmiane. Obserwuj kilka dni, czy cos realnie sie zmienia.", why: "Mniej znaczy skuteczniej.", change: "Trzymaj sie jednego planu przez tydzien." },
          ],
        },
        mid: {
          highImpact: [
            { title: "Ustalenie priorytetu", explanation: "Wybierz glowny problem i zapisz konkretny cel na 7 dni.", why: "Bez celu wracacie do starego schematu.", change: "Jedno mierzalne ustalenie." },
            { title: "Napiecie", explanation: "Skup sie na jednej sprawie i doprowadz ja do konca, bez dodawania nowych tematow.", why: "Dokladanie tematow zwieksza chaos.", change: "Domkniecie jednego watku przed kolejnym." },
          ],
          mediumImpact: [
            { title: "Stabilnosc", explanation: "Wprowadz jeden powtarzalny element: czas, kontakt albo rytm rozmowy.", why: "Relacja potrzebuje rytmu.", change: "Powtarzalny punkt tygodniowy." },
          ],
          lowImpact: [
            { title: "3 kroki", explanation: "Wybierz obszar, jedna zmiana, obserwacja efektu przez kilka dni.", why: "Prosty plan jest latwiejszy do utrzymania.", change: "Nie zmieniaj kilku rzeczy naraz." },
          ],
        },
        low: {
          highImpact: [
            { title: "Tryb naprawczy", explanation: "Najpierw zatrzymaj dalsze rozjezdzanie: minimum kontaktu, minimum domkniec, minimum odpowiedzialnosci.", why: "Bez podstaw relacja traci strukture.", change: "Ustal minimum, ktore musi byc utrzymane codziennie." },
            { title: "Wyrazne granice", explanation: "Ustal, co jest nie do przyjecia i jaka jest konsekwencja powtorzenia.", why: "Brak granic podtrzymuje przeciazenie.", change: "Jedna jasna granica i jej egzekwowanie." },
          ],
          mediumImpact: [
            { title: "Kontakt", explanation: "Nie czekaj na idealny moment. Krotkie, regularne domkniecia sa wazniejsze niz dlugie rozmowy raz na jakis czas.", why: "Nieregularnosc pogarsza dystans.", change: "Krotki, staly rytm kontaktu." },
          ],
          lowImpact: [
            { title: "3 kroki", explanation: "Wybierz najslabszy obszar, wdroz jedna zmiane, sprawdz efekt po tygodniu.", why: "Bez obserwacji trudno ocenic, czy cos dziala.", change: "Kontrola po 7 dniach." },
          ],
        },
      },
      en: {
        heading: "Detailed actions",
        highImpact: "Top priority now",
        mediumImpact: "Additional actions",
        lowImpact: "Simple 3-step plan",
        whyLabel: "Why",
        changeLabel: "Action",
        high: {
          highImpact: [
            { title: "Most important area to change", explanation: "Focus on the weakest area and avoid spreading effort.", why: "Scattered effort keeps the same loop alive.", change: "One area, one concrete change." },
            { title: "Initiative", explanation: "If initiative is low, stop over-carrying everything and observe whether the other side takes initiative without prompting.", why: "One-sided effort creates fatigue.", change: "Create space and measure real response." },
          ],
          mediumImpact: [{ title: "Involvement and closeness", explanation: "Identify where time and attention are really disappearing.", why: "Without this, balance will not improve.", change: "Set one fixed weekly connection point." }],
          lowImpact: [{ title: "3 steps", explanation: "Choose one area. Introduce one change. Observe for a few days.", why: "Simple plans are easier to sustain.", change: "Keep one plan for one week." }],
        },
        mid: {
          highImpact: [
            { title: "Set a clear priority", explanation: "Choose the main issue and write one measurable target for 7 days.", why: "Without priority, old patterns return.", change: "One measurable commitment." },
            { title: "Tension", explanation: "Finish one specific issue before opening another one.", why: "Topic stacking increases chaos.", change: "Close one thread at a time." },
          ],
          mediumImpact: [{ title: "Stability", explanation: "Introduce one repeatable element: time, contact, or conversation rhythm.", why: "Relationships need rhythm.", change: "Use one recurring weekly anchor." }],
          lowImpact: [{ title: "3 steps", explanation: "One area, one change, few-day observation.", why: "This keeps execution realistic.", change: "Do not change many things at once." }],
        },
        low: {
          highImpact: [
            { title: "Stabilization mode", explanation: "Set minimum standards for contact, closure, and responsibility.", why: "Without baseline, structure keeps collapsing.", change: "Define daily minimum rules and check them." },
            { title: "Clear boundaries", explanation: "Define what is unacceptable and what happens if repeated.", why: "No boundaries means repeated overload.", change: "One clear boundary with consequence." },
          ],
          mediumImpact: [{ title: "Contact rhythm", explanation: "Use short and regular closure points instead of rare long talks.", why: "Irregular contact deepens distance.", change: "Set a short fixed check-in rhythm." }],
          lowImpact: [{ title: "3 steps", explanation: "Pick weakest area, implement one change, review after 7 days.", why: "No review means no real correction.", change: "Run one weekly review checkpoint." }],
        },
      },
      de: {
        heading: "Konkrete Maßnahmen",
        highImpact: "Wichtigster Hebel jetzt",
        mediumImpact: "Weitere Schritte",
        lowImpact: "Einfacher 3-Schritte-Plan",
        whyLabel: "Warum",
        changeLabel: "Maßnahme",
        high: {
          highImpact: [
            { title: "Wichtigster Bereich", explanation: "Auf den schwächsten Bereich fokussieren, nicht alles gleichzeitig ändern.", why: "Verteilte Energie hält das Muster stabil.", change: "Ein Bereich, eine klare Änderung." },
            { title: "Initiative", explanation: "Bei niedriger Initiative nicht allein weitertragen, sondern Raum geben und Reaktion prüfen.", why: "Einseitiger Aufwand erschöpft.", change: "Raum schaffen und Verhalten beobachten." },
          ],
          mediumImpact: [{ title: "Engagement und Nähe", explanation: "Klar benennen, wo Zeit und Aufmerksamkeit verloren gehen.", why: "Ohne Diagnose keine Korrektur.", change: "Einen festen Wochenpunkt setzen." }],
          lowImpact: [{ title: "3 Schritte", explanation: "Einen Bereich wählen, eine Änderung umsetzen, einige Tage beobachten.", why: "Einfacher Plan ist umsetzbar.", change: "Eine Woche konsequent halten." }],
        },
        mid: {
          highImpact: [
            { title: "Priorität setzen", explanation: "Hauptproblem wählen und 7-Tage-Ziel schriftlich festhalten.", why: "Ohne Priorität kehrt der alte Loop zurück.", change: "Ein messbares Wochenziel." },
            { title: "Spannung schließen", explanation: "Ein Thema vollständig schließen, bevor ein neues geöffnet wird.", why: "Themenstapel erhöhen Reibung.", change: "Ein Thema nach dem anderen." },
          ],
          mediumImpact: [{ title: "Stabilität", explanation: "Ein wiederkehrendes Element einführen: Zeit, Kontakt oder Gesprächsritual.", why: "Rhythmus stabilisiert.", change: "Einen festen Wochenrhythmus sichern." }],
          lowImpact: [{ title: "3 Schritte", explanation: "Ein Bereich, eine Änderung, kurze Beobachtung.", why: "So bleibt es realistisch.", change: "Keine Mehrfach-Experimente parallel." }],
        },
        low: {
          highImpact: [
            { title: "Stabilisierungsmodus", explanation: "Mindeststandard für Kontakt, Abschluss und Verbindlichkeit festlegen.", why: "Ohne Basis nimmt der Abbau zu.", change: "Tägliche Mindestregeln definieren." },
            { title: "Klare Grenzen", explanation: "Nicht verhandelbare Grenze plus Konsequenz bei Wiederholung.", why: "Ohne Grenze bleibt Überlastung bestehen.", change: "Eine klare Grenze konsequent umsetzen." },
          ],
          mediumImpact: [{ title: "Kontaktstruktur", explanation: "Kurze regelmäßige Klärungen statt seltener langer Gespräche.", why: "Unregelmäßigkeit verstärkt Distanz.", change: "Kurzen festen Check-in-Rhythmus setzen." }],
          lowImpact: [{ title: "3 Schritte", explanation: "Schwächsten Bereich wählen, eine Änderung umsetzen, nach 7 Tagen prüfen.", why: "Ohne Prüfung keine Korrektur.", change: "Wöchentlichen Review-Punkt fixieren." }],
        },
      },
      es: {
        heading: "Acciones detalladas",
        highImpact: "Prioridad principal",
        mediumImpact: "Acciones adicionales",
        lowImpact: "Plan simple de 3 pasos",
        whyLabel: "Por qué",
        changeLabel: "Acción",
        high: {
          highImpact: [
            { title: "Área más importante", explanation: "Enfócate en el área más débil y no repartas energía en todo a la vez.", why: "La dispersión mantiene el mismo patrón.", change: "Un área, un cambio concreto." },
            { title: "Iniciativa", explanation: "Si la iniciativa es baja, deja de sostener todo por tu cuenta y observa la respuesta real.", why: "El esfuerzo unilateral desgasta.", change: "Crear espacio y medir reacción." },
          ],
          mediumImpact: [{ title: "Compromiso y cercanía", explanation: "Detecta dónde se pierde tiempo y atención de forma real.", why: "Sin eso no hay equilibrio.", change: "Fija un punto semanal estable." }],
          lowImpact: [{ title: "3 pasos", explanation: "Elige un área, aplica un cambio, observa unos días.", why: "Lo simple se sostiene mejor.", change: "Mantén un solo plan por una semana." }],
        },
        mid: {
          highImpact: [
            { title: "Prioridad clara", explanation: "Elige el problema principal y define una meta medible para 7 días.", why: "Sin prioridad vuelve el patrón antiguo.", change: "Un compromiso medible." },
            { title: "Tensión", explanation: "Cierra un tema concreto antes de abrir otro.", why: "Acumular temas aumenta el caos.", change: "Un cierre completo cada vez." },
          ],
          mediumImpact: [{ title: "Estabilidad", explanation: "Introduce un elemento repetible: tiempo, contacto o ritmo de conversación.", why: "La relación necesita ritmo.", change: "Un ancla semanal fija." }],
          lowImpact: [{ title: "3 pasos", explanation: "Un área, un cambio, observación corta.", why: "Así se mantiene ejecutable.", change: "No cambiar varias cosas al mismo tiempo." }],
        },
        low: {
          highImpact: [
            { title: "Modo de estabilización", explanation: "Define mínimos de contacto, cierre y responsabilidad.", why: "Sin base, la estructura sigue cayendo.", change: "Reglas mínimas diarias con revisión." },
            { title: "Límites claros", explanation: "Define qué es inaceptable y la consecuencia si se repite.", why: "Sin límites se mantiene la sobrecarga.", change: "Una frontera clara con consecuencia." },
          ],
          mediumImpact: [{ title: "Ritmo de contacto", explanation: "Mejor cierres cortos y regulares que conversaciones largas esporádicas.", why: "La irregularidad amplía la distancia.", change: "Ritmo fijo de check-in breve." }],
          lowImpact: [{ title: "3 pasos", explanation: "Elige área débil, aplica un cambio, revisa en 7 días.", why: "Sin revisión no hay corrección.", change: "Un punto semanal de evaluación." }],
        },
      },
      pt: {
        heading: "Ações detalhadas",
        highImpact: "Prioridade principal",
        mediumImpact: "Ações adicionais",
        lowImpact: "Plano simples de 3 passos",
        whyLabel: "Porquê",
        changeLabel: "Ação",
        high: {
          highImpact: [
            { title: "Área mais importante", explanation: "Foca na área mais fraca e evita espalhar esforço por tudo ao mesmo tempo.", why: "Esforço disperso mantém o mesmo padrão.", change: "Uma área, uma mudança concreta." },
            { title: "Iniciativa", explanation: "Se a iniciativa estiver baixa, deixa de suportar tudo sozinho e observa a resposta real.", why: "Esforço unilateral gera desgaste.", change: "Criar espaço e medir reação." },
          ],
          mediumImpact: [{ title: "Envolvimento e proximidade", explanation: "Identifica onde tempo e atenção desaparecem de forma real.", why: "Sem isso, não há equilíbrio.", change: "Define um ponto semanal estável." }],
          lowImpact: [{ title: "3 passos", explanation: "Escolhe uma área, aplica uma mudança, observa por alguns dias.", why: "Plano simples é mais sustentável.", change: "Mantém um plano único por uma semana." }],
        },
        mid: {
          highImpact: [
            { title: "Prioridade clara", explanation: "Escolhe o problema principal e define meta mensurável para 7 dias.", why: "Sem prioridade, o padrão antigo volta.", change: "Um compromisso mensurável." },
            { title: "Tensão", explanation: "Fecha um tema concreto antes de abrir outro.", why: "Empilhar temas aumenta o caos.", change: "Um fecho completo de cada vez." },
          ],
          mediumImpact: [{ title: "Estabilidade", explanation: "Introduz um elemento repetível: tempo, contacto ou ritmo de conversa.", why: "A relação precisa de ritmo.", change: "Uma âncora semanal fixa." }],
          lowImpact: [{ title: "3 passos", explanation: "Uma área, uma mudança, observação curta.", why: "Mantém execução realista.", change: "Não mudar muitas coisas em paralelo." }],
        },
        low: {
          highImpact: [
            { title: "Modo de estabilização", explanation: "Define mínimos de contacto, fecho e responsabilidade.", why: "Sem base, a estrutura continua a cair.", change: "Regras mínimas diárias com revisão." },
            { title: "Limites claros", explanation: "Define o que é inaceitável e qual a consequência se repetir.", why: "Sem limites, a sobrecarga mantém-se.", change: "Uma fronteira clara com consequência." },
          ],
          mediumImpact: [{ title: "Ritmo de contacto", explanation: "Melhor fechos curtos e regulares do que conversas longas esporádicas.", why: "Irregularidade aumenta distanciamento.", change: "Ritmo fixo de check-in curto." }],
          lowImpact: [{ title: "3 passos", explanation: "Escolhe área fraca, aplica uma mudança, revê em 7 dias.", why: "Sem revisão, não há correção.", change: "Um checkpoint semanal." }],
        },
      },
    };
    const base = map.en;
    const c = map[L] || base;
    return {
      heading: c.heading,
      highImpact: c.highImpact,
      mediumImpact: c.mediumImpact,
      lowImpact: c.lowImpact,
      whyLabel: c.whyLabel,
      changeLabel: c.changeLabel,
      high: c.high,
      mid: c.mid,
      low: c.low,
    };
  }

  // --- Bootstrap wg adresu strony ---
  function boot() {
    document.documentElement.classList.add("js");
    initLocaleByLocation();
    persistPageLocale();
    const lang = getFlowLocale();
    if (isContactPagePath()) localizeContactPageUi(lang);
    appendLangToStripeLinks();
    bindBuyButton();
    initMarketPages();
    setYear();
    initLegalFooter();
    if (isCheckoutPagePath()) localizeCheckoutPageUi(lang);
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
