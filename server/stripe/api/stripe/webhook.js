import { getWebhookSecret, log, readRawBody, sendTikTokEvent, setCors, stripe } from "../_shared.js";

async function getSessionObject(maybeSession) {
  if (!maybeSession) return null;
  const id = maybeSession.id || null;
  if (!id) return null;
  if (maybeSession.payment_status && (maybeSession.payment_intent || typeof maybeSession.payment_intent === "string")) {
    return maybeSession;
  }
  return stripe().checkout.sessions.retrieve(id, { expand: ["payment_intent"] });
}

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const signature = req.headers["stripe-signature"];
  if (!signature) return res.status(400).send("Missing signature");

  let event;
  try {
    const raw = await readRawBody(req);
    event = stripe().webhooks.constructEvent(raw, signature, getWebhookSecret());
  } catch (err) {
    log("webhook.signature_invalid", { message: String(err.message || err) });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = await getSessionObject(event.data.object);
        const paymentIntentId =
          session && (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null);
        log("webhook.checkout_session", {
          type: event.type,
          sessionId: session?.id || null,
          paymentStatus: session?.payment_status || null,
          paymentIntentId,
        });
        if (session?.payment_status === "paid") {
          const eventId = `stripe_checkout_${session.id || paymentIntentId || "unknown"}`;
          await sendTikTokEvent(req, {
            event: "CompletePayment",
            eventId,
            pageUrl: `${process.env.FRONTEND_URL || "https://relationshipscan.app"}/pl/success.html`,
            value: typeof session?.amount_total === "number" ? session.amount_total / 100 : undefined,
            currency: session?.currency || "PLN",
            externalId: paymentIntentId || session?.id || null,
          });
        }
        break;
      }
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed": {
        const obj = event.data.object || {};
        log(`webhook.${event.type.replace(/\./g, "_")}`, {
          paymentIntentId: obj.id || null,
          status: obj.status || null,
        });
        break;
      }
      default:
        log("webhook.unhandled", { type: event.type });
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    log("webhook.handler_error", { message: String(err.message || err), type: event.type });
    return res.status(500).json({ error: "webhook_handler_error" });
  }
}
