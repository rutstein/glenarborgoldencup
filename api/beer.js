// Shared Beer Olympics scores in Redis. GET reads, POST writes (passcode-guarded).
import Redis from 'ioredis';

const KEY = 'gabo_scores_v1';
let redis = null;
function client() {
  if (!redis) redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 5 });
  return redis;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.REDIS_URL) return res.status(500).json({ error: 'Storage not configured' });

  try {
    const r = client();
    if (req.method === 'GET') {
      const v = await r.get(KEY);
      return res.status(200).json(v ? JSON.parse(v) : {});
    }
    if (req.method === 'POST') {
      let b = req.body;
      if (typeof b === 'string') { try { b = JSON.parse(b); } catch { return res.status(400).json({ error: 'bad json' }); } }
      if (!b || b.passcode !== process.env.PASSCODE) return res.status(401).json({ error: 'bad passcode' });
      await r.set(KEY, JSON.stringify(b.scores || {}));
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: 'server error' });
  }
}
