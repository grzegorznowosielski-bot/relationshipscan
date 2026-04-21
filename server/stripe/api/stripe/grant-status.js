import { setCors, verifyGrant } from "../_shared.js";

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ active: false, error: "method_not_allowed" });

  const token = String(req.query?.grant || "").trim();
  if (!token) return res.status(400).json({ active: false, error: "missing_grant" });

  const verified = verifyGrant(token);
  if (!verified.ok) return res.status(200).json({ active: false, reason: verified.reason });

  return res.status(200).json({
    active: true,
    expiresAt: Number(verified.payload.exp),
    sessionId: verified.payload.sid || null,
    paymentIntentId: verified.payload.pi || null,
  });
}
