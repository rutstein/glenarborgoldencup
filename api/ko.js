// Live World Cup knockout results from ESPN. Edge-cached ~60s.
// ko[round] = teams that WON that round (advanced). out = teams eliminated (lost a KO match).
const FEED = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260626-20260722';
const ROUND = { 'round-of-32': 'r32', 'round-of-16': 'r16', 'quarterfinals': 'qf', 'semifinals': 'sf', 'final': 'f' };
const T = (x) => ({ abbr: (x.team && x.team.abbreviation) || '', name: (x.team && (x.team.shortDisplayName || x.team.displayName)) || '', full: (x.team && x.team.displayName) || '' });

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  try {
    const r = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    const ko = { r32: [], r16: [], qf: [], sf: [], f: [] };
    const out = [];
    (d.events || []).forEach((e) => {
      const rk = ROUND[(e.season || {}).slug || ''];
      if (!rk) return;
      const c = (e.competitions && e.competitions[0]) || {};
      if (((e.status || {}).type || {}).state !== 'post') return;
      const comps = c.competitors || [];
      const w = comps.find((x) => x.winner === true);
      const l = comps.find((x) => x.winner === false);
      if (w && w.team) ko[rk].push(T(w));
      if (l && l.team) out.push(T(l));
    });
    res.status(200).json({ updated: Date.now(), ko, out });
  } catch (e) {
    res.status(200).json({ updated: Date.now(), ko: { r32: [], r16: [], qf: [], sf: [], f: [] }, out: [], error: 'feed unavailable' });
  }
}
