// Locks FINAL groups + COMPLETED knockout rounds into the official pool record.
// Idempotent: safe to call repeatedly. Run by Vercel Cron + on demand.
import Redis from 'ioredis';

const KEY = 'gagc_results_v1';
const STANDINGS = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
const KOFEED = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260626-20260722';
const ROUND = { 'round-of-32': 'r32', 'round-of-16': 'r16', 'quarterfinals': 'qf', 'semifinals': 'sf', 'final': 'f' };
const KOREQ = { r32: 16, r16: 8, qf: 4, sf: 2, f: 1 };
const ALIAS = { BIH: 'BOS', CIV: 'IVC', MAR: 'MOR', CUW: 'CUR', COD: 'DRC', DZA: 'ALG' };
let redis = null;
function client() { if (!redis) redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 5 }); return redis; }
const codeFor = (ab) => { ab = (ab || '').toUpperCase(); return ALIAS[ab] || ab; };
const num = (e, n) => { const s = (e.stats || []).find((x) => x.name === n); return s ? (s.value != null ? s.value : s.displayValue) : null; };
const J = (u) => fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.json());

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (!process.env.REDIS_URL) return res.status(500).json({ error: 'no storage' });
  try {
    // --- final groups ---
    const sd = await J(STANDINGS);
    const groupsOfficial = {};
    (sd.children || []).forEach((g) => {
      const G = (g.name || '').replace(/^Group\s+/i, '').trim();
      const teams = (g.standings && g.standings.entries || []).map((e) => ({
        code: codeFor(e.team && e.team.abbreviation),
        rank: parseInt(num(e, 'rank'), 10) || 99,
        gp: (parseInt(num(e, 'wins'), 10) || 0) + (parseInt(num(e, 'ties'), 10) || 0) + (parseInt(num(e, 'losses'), 10) || 0),
      }));
      if (teams.length === 4 && teams.every((t) => t.gp >= 3 && t.code)) {
        teams.sort((a, b) => a.rank - b.rank);
        groupsOfficial[G] = teams.map((t) => t.code);
      }
    });

    // --- completed knockout rounds ---
    const ko = { r32: [], r16: [], qf: [], sf: [], f: [] };
    const kd = await J(KOFEED);
    (kd.events || []).forEach((e) => {
      const rk = ROUND[(e.season || {}).slug || ''];
      if (!rk) return;
      const c = (e.competitions && e.competitions[0]) || {};
      if (((e.status || {}).type || {}).state !== 'post') return;
      const w = (c.competitors || []).find((x) => x.winner === true);
      if (w && w.team) { const code = codeFor(w.team.abbreviation); if (code && !ko[rk].includes(code)) ko[rk].push(code); }
    });
    const koOfficial = {};
    Object.keys(KOREQ).forEach((r) => { if (ko[r].length >= KOREQ[r]) koOfficial[r] = ko[r]; });

    // --- merge + save ---
    const r = client();
    const raw = await r.get(KEY);
    const cur = raw ? JSON.parse(raw) : {};
    const results = {
      groups: Object.assign({}, cur.groups || {}, groupsOfficial),
      ko: Object.assign({ r32: [], r16: [], qf: [], sf: [], f: [] }, cur.ko || {}, koOfficial),
      paid: cur.paid || {},
      tb: cur.tb || {},
    };
    await r.set(KEY, JSON.stringify(results));
    res.status(200).json({
      ok: true,
      lockedGroups: Object.keys(groupsOfficial).sort(),
      lockedKoRounds: Object.keys(koOfficial),
      totalGroups: Object.keys(results.groups).length,
    });
  } catch (e) {
    res.status(500).json({ error: 'lock failed' });
  }
}
