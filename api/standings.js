// Live World Cup group standings, proxied from ESPN. Edge-cached ~60s.
const FEED = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
  try {
    const r = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    const num = (e, name) => {
      const s = (e.stats || []).find((x) => x.name === name);
      return s ? (s.value != null ? s.value : s.displayValue) : null;
    };
    const groups = (d.children || []).map((g) => ({
      group: (g.name || '').replace(/^Group\s+/i, ''),
      teams: (g.standings && g.standings.entries || []).map((e) => ({
        abbr: (e.team && e.team.abbreviation) || '',
        name: (e.team && (e.team.shortDisplayName || e.team.displayName)) || '?',
        full: (e.team && e.team.displayName) || '',
        rank: num(e, 'rank'),
        w: num(e, 'wins'), d: num(e, 'ties'), l: num(e, 'losses'),
        gp: num(e, 'gamesPlayed'), gd: num(e, 'pointDifferential'),
        pts: num(e, 'points'),
      })).sort((a, b) => (a.rank || 99) - (b.rank || 99)),
    }));
    res.status(200).json({ updated: Date.now(), groups });
  } catch (e) {
    res.status(200).json({ updated: Date.now(), groups: [], error: 'feed unavailable' });
  }
}
