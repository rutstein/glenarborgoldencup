// Live World Cup knockout results from ESPN. Edge-cached ~60s.
// ko[round] = winners (advanced). out = teams that lost a KO match. field = all 32 teams that reached the Round of 32.
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
    const out = [], field = [];
    (d.events || []).forEach((e) => {
      const slug = (e.season || {}).slug || '';
      const c = (e.competitions && e.competitions[0]) || {};
      const comps = c.competitors || [];
      if (slug === 'round-of-32') comps.forEach((x) => { if (x.team) field.push(T(x)); });
      const rk = ROUND[slug];
      if (!rk) return;
      if (((e.status || {}).type || {}).state !== 'post') return;
      const w = comps.find((x) => x.winner === true);
      const l = comps.find((x) => x.winner === false);
      if (w && w.team) ko[rk].push(T(w));
      if (l && l.team) out.push(T(l));
    });
    res.status(200).json({ updated: Date.now(), ko, out, field });
  } catch (e) {
    res.status(200).json({ updated: Date.now(), ko: { r32: [], r16: [], qf: [], sf: [], f: [] }, out: [], field: [], error: 'feed unavailable' });
  }
}
