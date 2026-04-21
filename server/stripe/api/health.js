import { setCors } from "./_shared.js";

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method_not_allowed" });
  return res.status(200).json({ ok: true, service: "stripe-gateway-vercel" });
}
