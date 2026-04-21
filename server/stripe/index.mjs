import crypto from "node:crypto";
import express from "express";
import Stripe from "stripe";

const port = parseInt(process.env.PORT || "3001", 10);
const frontendUrl = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
const ttlHours = Math.max(1, parseInt(process.env.ACCESS_GRANT_TTL_HOURS || "24", 10));

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("Missing STRIPE_WEBHOOK_SECRET");
}
if (!frontendUrl) {
  throw new Error("Missing FRONTEND_URL");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" });
const app = express();

/** @type {Map<string, { paid: boolean, paymentIntentId: string|null, source: string, updatedAt: number }>} */
const paidSessions = new Map();
/** @type {Map<string, { paid: boolean, source: string, updatedAt: number }>} */
const paidIntents = new Map();
/** @type {Map<string, { sessionId: string|null, paymentIntentId: string|null, createdAt: number, expiresAt: number }>} */
const grants = new Map();

function now() {
  return Date.now();
}

function log(event, payload = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...payload }));
}

function pruneExpiredGrants() {
  const ts = now();
  for (const [key, value] of grants.entries()) {
    if (value.expiresAt <= ts) grants.delete(key);
  }
}

function createGrant(sessionId, paymentIntentId) {
  pruneExpiredGrants();
  const token = crypto.randomUUID();
  const createdAt = now();
  const expiresAt = createdAt + ttlHours * 60 * 60 * 1000;
  grants.set(token, {
    sessionId: sessionId || null,
    paymentIntentId: paymentIntentId || null,
    createdAt,
    expiresAt,
  });
  return { token, expiresAt };
}

function markSessionPaid(sessionId, paymentIntentId, source) {
  if (!sessionId) return;
  paidSessions.set(sessionId, {
    paid: true,
    paymentIntentId: paymentIntentId || null,
    source,
    updatedAt: now(),
  });
}

function markIntentPaid(paymentIntentId, source) {
  if (!paymentIntentId) return;
  paidIntents.set(paymentIntentId, { paid: true, source, updatedAt: now() });
}

function allowedOrigin(reqOrigin) {
  if (!reqOrigin) return frontendUrl;
  return reqOrigin === frontendUrl ? reqOrigin : frontendUrl;
}

app.use((req, res, next) => {
  const origin = allowedOrigin(req.headers.origin);
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    log("webhook.missing_signature");
    return res.status(400).send("Missing signature");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    log("webhook.signature_invalid", { message: String(err.message || err) });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        const isPaid = session.payment_status === "paid";
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
        if (isPaid && session.id) {
          markSessionPaid(session.id, paymentIntentId, `webhook:${event.type}`);
          if (paymentIntentId) markIntentPaid(paymentIntentId, `webhook:${event.type}`);
        }
        log("webhook.checkout_session", {
          type: event.type,
          sessionId: session.id || null,
          paymentStatus: session.payment_status || null,
          paymentIntentId,
          paid: isPaid,
        });
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        if (pi.id) markIntentPaid(pi.id, "webhook:payment_intent.succeeded");
        log("webhook.payment_intent_succeeded", { paymentIntentId: pi.id || null });
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        log("webhook.payment_intent_failed", { paymentIntentId: pi.id || null });
        break;
      }
      default:
        log("webhook.unhandled", { type: event.type });
    }
    return res.json({ received: true });
  } catch (err) {
    log("webhook.handler_error", { message: String(err.message || err) });
    return res.status(500).json({ error: "webhook_handler_error" });
  }
});

app.use(express.json({ limit: "32kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "stripe-gateway" });
});

app.get("/api/stripe/grant-status", (req, res) => {
  pruneExpiredGrants();
  const token = String(req.query.grant || "").trim();
  if (!token) return res.status(400).json({ active: false, error: "missing_grant" });
  const row = grants.get(token);
  if (!row) return res.json({ active: false });
  return res.json({
    active: true,
    expiresAt: row.expiresAt,
    sessionId: row.sessionId,
    paymentIntentId: row.paymentIntentId,
  });
});

app.post("/api/stripe/confirm-return", async (req, res) => {
  const sessionId = String(req.body?.session_id || "").trim();
  const paymentIntentIdRaw = String(req.body?.payment_intent || "").trim();
  log("confirm_return.request", {
    sessionId: sessionId || null,
    paymentIntentId: paymentIntentIdRaw || null,
  });

  if (!sessionId && !paymentIntentIdRaw) {
    return res.status(400).json({ paid: false, error: "missing_session_or_payment_intent" });
  }

  try {
    let paid = false;
    let paymentIntentId = paymentIntentIdRaw || null;
    let paymentIntentStatus = null;
    let paymentStatus = null;

    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });
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
        markSessionPaid(session.id, paymentIntentId, "confirm_return");
      }
    }

    if (!paid && paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      paymentIntentStatus = pi.status || null;
      if (pi.status === "succeeded") {
        paid = true;
        markIntentPaid(pi.id, "confirm_return");
      }
    }

    if (paid && paymentIntentId) {
      markIntentPaid(paymentIntentId, "confirm_return");
    }

    if (!paid) {
      log("confirm_return.not_paid", {
        sessionId: sessionId || null,
        paymentIntentId: paymentIntentId || null,
        paymentStatus,
        paymentIntentStatus,
      });
      return res.status(402).json({
        paid: false,
        paymentStatus,
        paymentIntentStatus,
      });
    }

    const grant = createGrant(sessionId || null, paymentIntentId || null);
    log("confirm_return.paid", {
      sessionId: sessionId || null,
      paymentIntentId: paymentIntentId || null,
      grantExpiresAt: grant.expiresAt,
    });
    return res.json({
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
    return res.status(500).json({
      paid: false,
      error: "stripe_verify_failed",
      message: String(err.message || err),
    });
  }
});

app.listen(port, () => {
  log("server.started", {
    port,
    frontendUrl,
    ttlHours,
  });
});
