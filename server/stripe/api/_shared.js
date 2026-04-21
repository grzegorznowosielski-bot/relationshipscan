import crypto from "node:crypto";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const FRONTEND_URL = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
const TTL_HOURS = Math.max(1, parseInt(process.env.ACCESS_GRANT_TTL_HOURS || "24", 10));

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
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
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
