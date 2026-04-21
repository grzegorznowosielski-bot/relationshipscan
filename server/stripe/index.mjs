import crypto from "node:crypto";
import express from "express";
import Stripe from "stripe";

const port = parseInt(process.env.PORT || "3001", 10);
const frontendUrl = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
const ttlHours = Math.max(1, parseInt(process.env.ACCESS_GRANT_TTL_HOURS || "24", 10));
const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

if (!stripeSecret) throw new Error("Missing STRIPE_SECRET_KEY");
if (!frontendUrl) throw new Error("Missing FRONTEND_URL");
if (!webhookSecret) throw new Error("Missing STRIPE_WEBHOOK_SECRET");

const stripe = new Stripe(stripeSecret, { apiVersion: "2025-03-31.basil" });
const app = express();

function log(event, payload = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

function allowedOrigin(reqOrigin) {
  if (!reqOrigin) return frontendUrl;
  return reqOrigin === frontendUrl ? reqOrigin : frontendUrl;
}

function hmac(encodedPayload) {
  return crypto.createHmac("sha256", stripeSecret).update(encodedPayload, "utf8").digest("base64url");
}

function createGrant(sessionId, paymentIntentId) {
  const iat = Date.now();
  const exp = iat + ttlHours * 60 * 60 * 1000;
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

function verifyGrant(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) return { ok: false, reason: "malformed" };
  const expected = hmac(encoded);
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload = null;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch (e) {
    return { ok: false, reason: "bad_payload" };
  }
  if (!payload?.exp || Date.now() > Number(payload.exp)) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}

async function hydrateSession(eventObject) {
  if (!eventObject?.id) return null;
  if (eventObject.payment_status && eventObject.payment_intent) return eventObject;
  return stripe.checkout.sessions.retrieve(eventObject.id, { expand: ["payment_intent"] });
}

app.use((req, res, next) => {
  const origin = allowedOrigin(req.headers.origin);
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Stripe-Signature");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) return res.status(400).send("Missing signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    log("webhook.signature_invalid", { message: String(err.message || err) });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = await hydrateSession(event.data.object);
      const paymentIntentId =
        session && (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null);
      log("webhook.checkout_session", {
        type: event.type,
        sessionId: session?.id || null,
        paymentStatus: session?.payment_status || null,
        paymentIntentId,
      });
    } else if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
      const pi = event.data.object || {};
      log(`webhook.${event.type.replace(/\./g, "_")}`, {
        paymentIntentId: pi.id || null,
        status: pi.status || null,
      });
    } else {
      log("webhook.unhandled", { type: event.type });
    }
    return res.json({ received: true });
  } catch (err) {
    log("webhook.handler_error", { message: String(err.message || err), type: event.type });
    return res.status(500).json({ error: "webhook_handler_error" });
  }
});

app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "stripe-gateway" });
});

app.get("/api/stripe/grant-status", (req, res) => {
  const token = String(req.query.grant || "").trim();
  if (!token) return res.status(400).json({ active: false, error: "missing_grant" });
  const verified = verifyGrant(token);
  if (!verified.ok) return res.status(200).json({ active: false, reason: verified.reason });
  return res.status(200).json({
    active: true,
    expiresAt: Number(verified.payload.exp),
    sessionId: verified.payload.sid || null,
    paymentIntentId: verified.payload.pi || null,
  });
});

app.post("/api/stripe/confirm-return", async (req, res) => {
  const sessionId = String(req.body?.session_id || "").trim();
  const paymentIntentIdRaw = String(req.body?.payment_intent || "").trim();
  if (!sessionId && !paymentIntentIdRaw) {
    return res.status(400).json({ paid: false, error: "missing_session_or_payment_intent" });
  }

  try {
    let paid = false;
    let paymentIntentId = paymentIntentIdRaw || null;
    let paymentStatus = null;
    let paymentIntentStatus = null;

    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
      paymentStatus = session.payment_status || null;
      if (!paymentIntentId) {
        paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
      }
      if (session.payment_intent && typeof session.payment_intent !== "string") {
        paymentIntentStatus = session.payment_intent.status || null;
      }
      if (session.payment_status === "paid" && (!paymentIntentStatus || paymentIntentStatus === "succeeded")) {
        paid = true;
      }
    }

    if (!paid && paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      paymentIntentStatus = pi.status || null;
      if (pi.status === "succeeded") paid = true;
    }

    if (!paid) {
      log("confirm_return.not_paid", {
        sessionId: sessionId || null,
        paymentIntentId: paymentIntentId || null,
        paymentStatus,
        paymentIntentStatus,
      });
      return res.status(402).json({ paid: false, paymentStatus, paymentIntentStatus });
    }

    const grant = createGrant(sessionId || null, paymentIntentId || null);
    log("confirm_return.paid", {
      sessionId: sessionId || null,
      paymentIntentId: paymentIntentId || null,
      expiresAt: grant.expiresAt,
    });
    return res.status(200).json({
      paid: true,
      grantToken: grant.token,
      expiresAt: grant.expiresAt,
      sessionId: sessionId || null,
      paymentIntentId: paymentIntentId || null,
    });
  } catch (err) {
    log("confirm_return.error", {
      sessionId: sessionId || null,
      paymentIntentId: paymentIntentIdRaw || null,
      message: String(err.message || err),
    });
    return res.status(500).json({ paid: false, error: "stripe_verify_failed", message: String(err.message || err) });
  }
});

app.listen(port, () => {
  log("server.started", { port, frontendUrl, ttlHours, mode: "stateless" });
});
