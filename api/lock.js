// Locks any FINAL World Cup group (all teams played 3) into the official pool record.
// Idempotent: safe to call repeatedly. Run by Vercel Cron + on demand.
import Redis from 'ioredis';

const KEY = 'gagc_results_v1';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
const ALIAS = { BIH: 'BOS', CIV: 'IVC', MAR: 'MOR', CUW: 'CUR', COD: 'DRC', DZA: 'ALG' };
let redis = null;
function client() { if (!redis) redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 5 }); return redis; }
const codeFor = (ab) => { ab = (ab || '').toUpperCase(); return ALIAS[ab] || ab; };
const num = (e, n) => { const s = (e.stats || []).find((x) => x.name === n); return s ? (s.value != null ? s.value : s.displayValue) : null; };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!process.env.REDIS_URL) return res.status(500).json({ error: 'no storage' });
  try {
    const d = await (await fetch(STANDINGS, { headers: { 'User-Agent': 'Mozilla/5.0' } })).json();
    const official = {};
    (d.children || []).forEach((g) => {
      const G = (g.name || '').replace(/^Group\s+/i, '').trim();
      const teams = (g.standings && g.standings.entries || []).map((e) => ({
        code: codeFor(e.team && e.team.abbreviation),
        rank: parseInt(num(e, 'rank'), 10) || 99,
        gp: (parseInt(num(e, 'wins'), 10) || 0) + (parseInt(num(e, 'ties'), 10) || 0) + (parseInt(num(e, 'losses'), 10) || 0),
      }));
      if (teams.length === 4 && teams.every((t) => t.gp >= 3 && t.code)) {
        teams.sort((a, b) => a.rank - b.rank);
        official[G] = teams.map((t) => t.code);
      }
    });

    const r = client();
    const raw = await r.get(KEY);
    const cur = raw ? JSON.parse(raw) : {};
    const results = {
      groups: Object.assign({}, cur.groups || {}, official),
      ko: cur.ko || { r32: [], r16: [], qf: [], sf: [], f: [] },
      paid: cur.paid || {},
      tb: cur.tb || {},
    };
    await r.set(KEY, JSON.stringify(results));
    res.status(200).json({ ok: true, lockedGroups: Object.keys(official).sort(), totalLocked: Object.keys(results.groups).length });
  } catch (e) {
    res.status(500).json({ error: 'lock failed' });
  }
}
