import type { Match, NotifyMode, GoalEvent } from './types';

export interface AlertContext {
  now: number;            // unix millis
  leadMin: number;        // minutes before kickoff to alert
  mode: NotifyMode;
  followedId: number | null;
  alerted: Set<number>;   // match ids already alerted this session
}

function involvesTeam(match: Match, teamId: number | null): boolean {
  if (teamId === null) return false;
  return match.homeTeam?.id === teamId || match.awayTeam?.id === teamId;
}

export function matchesNeedingAlert(matches: Match[], ctx: AlertContext): Match[] {
  if (ctx.mode === 'off') return [];
  const leadMs = ctx.leadMin * 60_000;
  return matches.filter((m) => {
    if (ctx.alerted.has(m.id)) return false;
    if (ctx.mode === 'team' && !involvesTeam(m, ctx.followedId)) return false;
    const kickoff = Date.parse(m.utcDate);
    if (Number.isNaN(kickoff)) return false;
    // window: kickoff is in the future but within leadMs from now.
    return kickoff > ctx.now && kickoff - ctx.now <= leadMs;
  });
}

function total(score: Match['score']): number {
  return (score.fullTime.home ?? 0) + (score.fullTime.away ?? 0);
}

export function detectGoals(prev: Match[], curr: Match[], followedId: number | null): GoalEvent[] {
  if (followedId === null) return [];
  const prevById = new Map(prev.map((m) => [m.id, m]));
  const events: GoalEvent[] = [];
  for (const c of curr) {
    if (!involvesTeam(c, followedId)) continue;
    const p = prevById.get(c.id);
    if (!p) continue;
    if (total(c.score) > total(p.score)) {
      // NOTE: one GoalEvent per match per polling interval, carrying the CURRENT
      // score. If multiple goals land in the same ~60s window we intentionally
      // fire a single notification (showing the up-to-date score) rather than
      // several identical buzzes.
      events.push({
        matchId: c.id,
        homeName: c.homeTeam?.name ?? 'TBD',
        awayName: c.awayTeam?.name ?? 'TBD',
        home: c.score.fullTime.home ?? 0,
        away: c.score.fullTime.away ?? 0,
      });
    }
  }
  return events;
}
