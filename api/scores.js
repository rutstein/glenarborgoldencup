// Live World Cup scores, proxied from ESPN's public scoreboard feed.
// Edge-cached ~30s so it's fast, cheap, and doesn't hammer ESPN.
const FEED = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  try {
    const r = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const d = await r.json();
    const team = (x) => ({
      name: (x && x.team && (x.team.shortDisplayName || x.team.displayName)) || '?',
      logo: (x && x.team && x.team.logo) || '',
      score: x && x.score != null ? x.score : '',
    });
    const events = (d.events || []).map((e) => {
      const c = (e.competitions && e.competitions[0]) || {};
      const comps = c.competitors || [];
      const home = comps.find((x) => x.homeAway === 'home') || comps[0] || {};
      const away = comps.find((x) => x.homeAway === 'away') || comps[1] || {};
      const st = e.status || c.status || {};
      const t = st.type || {};
      return {
        id: e.id,
        date: e.date,
        state: t.state || 'pre',          // pre | in | post
        detail: t.shortDetail || t.detail || '',
        home: team(home),
        away: team(away),
        group: (c.notes && c.notes[0] && c.notes[0].headline) || '',
      };
    });
    res.status(200).json({ updated: Date.now(), events });
  } catch (e) {
    res.status(200).json({ updated: Date.now(), events: [], error: 'feed unavailable' });
  }
}
