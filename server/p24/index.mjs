/**
 * Bramka Przelewy24 (klasyczne API: trnRegister / trnVerify).
 * Uruchom poza hostingiem statycznym (Railway, Render, VPS) — wymagany publiczny HTTPS dla urlStatus.
 */

import crypto from "node:crypto";
import express from "express";

const P24_API_VERSION = "3.2";

function md5hex(s) {
  return crypto.createHash("md5").update(String(s), "utf8").digest("hex");
}

function baseUrl() {
  return process.env.P24_SANDBOX === "true" || process.env.P24_SANDBOX === "1"
    ? "https://sandbox.przelewy24.pl"
    : "https://secure.przelewy24.pl";
}

function merchantId() {
  return parseInt(process.env.P24_MERCHANT_ID || "0", 10);
}

function posId() {
  return parseInt(process.env.P24_POS_ID || process.env.P24_MERCHANT_ID || "0", 10);
}

function crc() {
  return process.env.P24_CRC_KEY || "";
}

function amountGrosze() {
  return parseInt(process.env.P24_AMOUNT_GROSZE || "2900", 10);
}

function publicBase() {
  return String(process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
}

function frontendUrl() {
  return String(process.env.FRONTEND_URL || "https://relationshipscan.app").replace(/\/$/, "");
}

/** sessionId -> { amount, currency } */
const sessions = new Map();
/** sessionId -> paid po udanym trnVerify */
const paid = new Set();

function registerSign(sessionId, amount, currency) {
  return md5hex(`${sessionId}|${merchantId()}|${amount}|${currency}|${crc()}`);
}

function notifySign(sessionId, orderId, amount, currency) {
  return md5hex(`${sessionId}|${orderId}|${amount}|${currency}|${crc()}`);
}

async function postForm(path, body) {
  const url = `${baseUrl()}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body,
  });
  const text = await res.text();
  const params = new URLSearchParams(text);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

const app = express();
app.set("trust proxy", 1);

app.use(express.json({ limit: "24kb" }));

app.use((req, res, next) => {
  const o = process.env.FRONTEND_URL || "*";
  res.setHeader("Access-Control-Allow-Origin", o);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "p24-gateway" });
});

/** Status dla frontu (polling po powrocie z P24) */
app.get("/api/p24/status", (req, res) => {
  const sessionId = String(req.query.sessionId || "").trim();
  if (!sessionId) return res.status(400).json({ paid: false, error: "sessionId" });
  res.json({ paid: paid.has(sessionId) });
});

/**
 * Start płatności: body JSON { email } opcjonalnie
 */
app.post("/api/p24/init", async (req, res) => {
  try {
    if (!merchantId() || !crc()) {
      return res.status(500).json({ error: "Brak P24_MERCHANT_ID / P24_CRC_KEY w środowisku" });
    }
    const pub = publicBase();
    if (!pub) {
      return res.status(500).json({ error: "Ustaw PUBLIC_BASE_URL (URL tego serwera)" });
    }

    const email = String(req.body?.email || req.query?.email || "kontakt@example.com").trim() || "kontakt@example.com";
    const sessionId = crypto.randomUUID();
    const amount = amountGrosze();
    const currency = "PLN";

    sessions.set(sessionId, { amount, currency });

    const returnUserUrl = `${pub}/api/p24/return`;
    const statusUrl = `${pub}/api/p24/notify`;

    const body = new URLSearchParams();
    body.set("p24_merchant_id", String(merchantId()));
    body.set("p24_pos_id", String(posId()));
    body.set("p24_session_id", sessionId);
    body.set("p24_amount", String(amount));
    body.set("p24_currency", currency);
    body.set("p24_description", "RelationshipScan — dostęp do testu");
    body.set("p24_email", email);
    body.set("p24_country", "PL");
    body.set("p24_url_return", returnUserUrl);
    body.set("p24_url_status", statusUrl);
    body.set("p24_api_version", P24_API_VERSION);
    body.set("p24_sign", registerSign(sessionId, amount, currency));

    body.set("p24_name_0", "RelationshipScan");
    body.set("p24_description_0", "Dostęp do testu online");
    body.set("p24_quantity_0", "1");
    body.set("p24_price_0", String(amount));

    const out = await postForm("/trnRegister", body);
    const token = out.token;
    const err = out.error;

    if (!token || err) {
      console.error("trnRegister error", out);
      return res.status(502).json({
        error: "trnRegister failed",
        details: out.errorMessage || out,
      });
    }

    const redirectUrl = `${baseUrl()}/trnRequest/${token}`;
    return res.json({ redirectUrl, sessionId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
});

/**
 * Powiadomienie serwerowe z P24 (urlStatus)
 */
app.post("/api/p24/notify", async (req, res) => {
  try {
    const q = req.body;
    const sessionId = String(q.p24_session_id || "").trim();
    const orderId = String(q.p24_order_id || "").trim();
    const remoteSign = String(q.p24_sign || "").trim();
    const amount = parseInt(q.p24_amount || "0", 10);
    const currency = String(q.p24_currency || "PLN");

    const meta = sessions.get(sessionId);
    if (!meta) {
      console.warn("notify: unknown session", sessionId);
      return res.status(400).send("ERR");
    }
    if (amount !== meta.amount || currency !== meta.currency) {
      console.warn("notify: amount mismatch", amount, meta.amount);
      return res.status(400).send("ERR");
    }

    const expected = notifySign(sessionId, orderId, amount, currency);
    if (expected !== remoteSign) {
      console.warn("notify: bad sign");
      return res.status(400).send("ERR");
    }

    const verifyBody = new URLSearchParams();
    verifyBody.set("p24_merchant_id", String(merchantId()));
    verifyBody.set("p24_pos_id", String(posId()));
    verifyBody.set("p24_session_id", sessionId);
    verifyBody.set("p24_amount", String(amount));
    verifyBody.set("p24_currency", currency);
    verifyBody.set("p24_order_id", orderId);
    verifyBody.set("p24_sign", expected);

    const v = await postForm("/trnVerify", verifyBody);
    if (v.error !== "0") {
      console.error("trnVerify failed", v);
      return res.status(502).send("ERR");
    }

    paid.add(sessionId);
    console.log("P24 OK session", sessionId);
    return res.send("OK");
  } catch (e) {
    console.error(e);
    return res.status(500).send("ERR");
  }
});

/**
 * Przekierowanie użytkownika po płatności (p24_url_return)
 */
app.get("/api/p24/return", (req, res) => {
  const sessionId = String(req.query.p24_session_id || req.query.sessionId || "").trim();
  const fe = frontendUrl();
  if (sessionId) {
    return res.redirect(302, `${fe}/test.html?sid=${encodeURIComponent(sessionId)}`);
  }
  return res.redirect(302, `${fe}/checkout.html`);
});

const port = parseInt(process.env.PORT || "3000", 10);
app.listen(port, () => {
  console.log(`P24 gateway listening on :${port} (${process.env.P24_SANDBOX === "true" ? "SANDBOX" : "PROD"})`);
});
