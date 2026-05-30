import type { Match, Stage } from './types';

const STAGE_ORDER: Record<Stage, number> = {
  GROUP_STAGE: 0, LAST_16: 1, QUARTER_FINALS: 2,
  SEMI_FINALS: 3, THIRD_PLACE: 4, FINAL: 5,
};

export function isLive(match: Match): boolean {
  return match.status === 'IN_PLAY' || match.status === 'PAUSED';
}

function sameUtcDay(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear()
    && a.getUTCMonth() === b.getUTCMonth()
    && a.getUTCDate() === b.getUTCDate();
}

export function isToday(match: Match, now: Date): boolean {
  return sameUtcDay(new Date(match.utcDate), now);
}

export function matchesOn(matches: Match[], day: Date): Match[] {
  return matches.filter((m) => isToday(m, day));
}

export function matchesForTeam(matches: Match[], teamId: number): Match[] {
  return matches.filter((m) => m.homeTeam?.id === teamId || m.awayTeam?.id === teamId);
}

export function sortByStage(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const s = (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99);
    if (s !== 0) return s;
    return new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime();
  });
}
