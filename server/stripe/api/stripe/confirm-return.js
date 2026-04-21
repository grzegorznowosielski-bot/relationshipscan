import { createGrant, log, readJsonBody, setCors, stripe } from "../_shared.js";

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ paid: false, error: "method_not_allowed" });

  let payload = {};
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    return res.status(400).json({ paid: false, error: "invalid_json" });
  }

  const sessionId = String(payload?.session_id || "").trim();
  const paymentIntentInput = String(payload?.payment_intent || "").trim();

  if (!sessionId && !paymentIntentInput) {
    return res.status(400).json({ paid: false, error: "missing_session_or_payment_intent" });
  }

  try {
    let paid = false;
    let paymentIntentId = paymentIntentInput || null;
    let paymentStatus = null;
    let paymentIntentStatus = null;

    if (sessionId) {
      const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
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
      const pi = await stripe().paymentIntents.retrieve(paymentIntentId);
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

    const grant = createGrant({ sessionId, paymentIntentId });
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
      paymentIntentId: paymentIntentInput || null,
      message: String(err.message || err),
    });
    return res.status(500).json({ paid: false, error: "stripe_verify_failed", message: String(err.message || err) });
  }
}
