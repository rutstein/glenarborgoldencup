// Backend for Glen Arbor Golden Cup — stores shared results/payments.
// Endpoints: GET /api/results (read), POST /api/results (write, passcode-guarded).
// Storage: Vercel KV (Upstash Redis) via REST — no npm dependencies needed.

const KEY = 'gagc_results_v1';
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const EMPTY = { groups: {}, ko: { r32: [], r16: [], qf: [], sf: [], f: [] }, paid: {}, tb: {} };

async function kvGet() {
  const r = await fetch(`${KV_URL}/get/${KEY}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    cache: 'no-store',
  });
  const j = await r.json();
  return j.result ? JSON.parse(j.result) : null;
}

async function kvSet(value) {
  const r = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
    body: JSON.stringify(value),
  });
  return r.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: 'Storage not configured' });
  }

  try {
    if (req.method === 'GET') {
      const data = await kvGet();
      return res.status(200).json(data || EMPTY);
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'bad json' }); }
      }
      if (!body || body.passcode !== process.env.PASSCODE) {
        return res.status(401).json({ error: 'bad passcode' });
      }
      const ok = await kvSet(body.results || EMPTY);
      return ok ? res.status(200).json({ ok: true }) : res.status(500).json({ error: 'save failed' });
    }

    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
}
