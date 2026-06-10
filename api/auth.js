// Passcode check for the "Enter Results" editor. POST /api/auth {passcode}.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'bad json' }); }
  }
  if (!body || body.passcode !== process.env.PASSCODE) {
    return res.status(401).json({ error: 'bad passcode' });
  }
  return res.status(200).json({ ok: true });
}
