// Live World Cup knockout winners per round, from ESPN. Edge-cached ~60s.
// Each round = the set of teams that WON that round (advanced). 3rd-place match ignored.
const FEED = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260626-20260722';
const ROUND = { 'round-of-32': 'r32', 'round-of-16': 'r16', 'quarterfinals': 'qf', 'semifinals': 'sf', 'final': 'f' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  try {
    const r = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    const ko = { r32: [], r16: [], qf: [], sf: [], f: [] };
    (d.events || []).forEach((e) => {
      const rk = ROUND[(e.season || {}).slug || ''];
      if (!rk) return;
      const c = (e.competitions && e.competitions[0]) || {};
      if (((e.status || {}).type || {}).state !== 'post') return;
      const w = (c.competitors || []).find((x) => x.winner === true);
      if (!w || !w.team) return;
      ko[rk].push({
        abbr: w.team.abbreviation || '',
        name: w.team.shortDisplayName || w.team.displayName || '',
        full: w.team.displayName || '',
      });
    });
    res.status(200).json({ updated: Date.now(), ko });
  } catch (e) {
    res.status(200).json({ updated: Date.now(), ko: { r32: [], r16: [], qf: [], sf: [], f: [] }, error: 'feed unavailable' });
  }
}
