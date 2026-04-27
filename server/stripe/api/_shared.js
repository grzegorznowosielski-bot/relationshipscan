import crypto from "node:crypto";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const FRONTEND_URL = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
const TTL_HOURS = Math.max(1, parseInt(process.env.ACCESS_GRANT_TTL_HOURS || "24", 10));
const TIKTOK_PIXEL_ID = process.env.TIKTOK_PIXEL_ID || "D7NR5V3C77UCPV3KTR80";
const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN || "";

if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
if (!FRONTEND_URL) throw new Error("Missing FRONTEND_URL");

let stripeClient = null;
export function stripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
  }
  return stripeClient;
}

export function getWebhookSecret() {
  if (!STRIPE_WEBHOOK_SECRET) throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  return STRIPE_WEBHOOK_SECRET;
}

export function setCors(res, reqOrigin) {
  const origin = !reqOrigin || reqOrigin === FRONTEND_URL ? FRONTEND_URL : FRONTEND_URL;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Stripe-Signature");
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export async function readJsonBody(req) {
  const raw = await readRawBody(req);
  if (!raw.length) return {};
  return JSON.parse(raw.toString("utf8"));
}

function hmac(payloadBase64) {
  return crypto.createHmac("sha256", STRIPE_SECRET_KEY).update(payloadBase64, "utf8").digest("base64url");
}

export function createGrant({ sessionId = null, paymentIntentId = null }) {
  const iat = Date.now();
  const exp = iat + TTL_HOURS * 60 * 60 * 1000;
  const payload = {
    sid: sessionId || null,
    pi: paymentIntentId || null,
    iat,
    exp,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = hmac(encoded);
  return {
    token: `${encoded}.${signature}`,
    expiresAt: exp,
  };
}

export function verifyGrant(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return { ok: false, reason: "malformed" };
  const expected = hmac(encoded);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  if (expectedBuffer.length !== signatureBuffer.length) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch (e) {
    return { ok: false, reason: "bad_payload" };
  }
  if (!payload?.exp || Date.now() > Number(payload.exp)) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}

export function log(event, payload = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value).trim().toLowerCase(), "utf8").digest("hex");
}

function getIpFromRequest(req) {
  const header = req?.headers?.["x-forwarded-for"];
  if (typeof header === "string" && header.trim()) return header.split(",")[0].trim();
  if (Array.isArray(header) && header.length) return String(header[0]).trim();
  return req?.socket?.remoteAddress || "";
}

export async function sendTikTokEvent(req, { event, eventId, eventTime, pageUrl, value, currency, email, phone, externalId }) {
  if (!TIKTOK_ACCESS_TOKEN || !TIKTOK_PIXEL_ID) {
    log("tiktok.skipped_missing_config", {
      hasToken: Boolean(TIKTOK_ACCESS_TOKEN),
      hasPixel: Boolean(TIKTOK_PIXEL_ID),
      event,
      eventId,
    });
    return { ok: false, skipped: true, reason: "missing_config" };
  }

  const user = {
    external_id: externalId ? String(externalId) : undefined,
    email: email ? sha256(email) : undefined,
    phone_number: phone ? sha256(phone) : undefined,
    ip: getIpFromRequest(req) || undefined,
    user_agent: req?.headers?.["user-agent"] ? String(req.headers["user-agent"]) : undefined,
  };

  const payload = {
    event_source: "web",
    event_source_id: TIKTOK_PIXEL_ID,
    data: [
      {
        event,
        event_id: eventId,
        event_time: Number(eventTime || Math.floor(Date.now() / 1000)),
        page: {
          url: pageUrl || FRONTEND_URL || "https://relationshipscan.app",
        },
        user,
        properties: {
          value: typeof value === "number" ? value : undefined,
          currency: currency ? String(currency).toUpperCase() : undefined,
        },
      },
    ],
  };

  try {
    const response = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": TIKTOK_ACCESS_TOKEN,
      },
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    if (!response.ok) {
      log("tiktok.error", { status: response.status, event, eventId, body: raw.slice(0, 500) });
      return { ok: false, status: response.status };
    }
    log("tiktok.sent", { event, eventId });
    return { ok: true };
  } catch (err) {
    log("tiktok.exception", { event, eventId, message: String(err.message || err) });
    return { ok: false, error: "request_failed" };
  }
}
