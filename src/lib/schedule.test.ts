import { describe, it, expect } from 'vitest';
import { matchesOn, matchesForTeam, sortByStage, isLive, isToday } from './schedule';
import type { Match } from './types';

function m(over: Partial<Match>): Match {
  return {
    id: 1, utcDate: '2026-06-11T18:00:00Z', status: 'TIMED', stage: 'GROUP_STAGE',
    group: 'GROUP_A', matchday: 1,
    homeTeam: { id: 1, name: 'Home' }, awayTeam: { id: 2, name: 'Away' },
    score: { winner: null, fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    ...over,
  };
}

describe('isLive', () => {
  it('IN_PLAY and PAUSED are live, others are not', () => {
    expect(isLive(m({ status: 'IN_PLAY' }))).toBe(true);
    expect(isLive(m({ status: 'PAUSED' }))).toBe(true);
    expect(isLive(m({ status: 'FINISHED' }))).toBe(false);
    expect(isLive(m({ status: 'TIMED' }))).toBe(false);
  });
});

describe('isToday / matchesOn', () => {
  it('matches a given UTC calendar day', () => {
    const a = m({ id: 1, utcDate: '2026-06-11T18:00:00Z' });
    const b = m({ id: 2, utcDate: '2026-06-12T18:00:00Z' });
    expect(isToday(a, new Date('2026-06-11T23:00:00Z'))).toBe(true);
    expect(isToday(b, new Date('2026-06-11T23:00:00Z'))).toBe(false);
    expect(matchesOn([a, b], new Date('2026-06-12T01:00:00Z')).map((x) => x.id)).toEqual([2]);
  });
});

describe('matchesForTeam', () => {
  it('returns matches where the team plays either side', () => {
    const a = m({ id: 1, homeTeam: { id: 10, name: 'BRA' } });
    const b = m({ id: 2, awayTeam: { id: 10, name: 'BRA' } });
    const c = m({ id: 3 });
    expect(matchesForTeam([a, b, c], 10).map((x) => x.id)).toEqual([1, 2]);
  });
});

describe('sortByStage', () => {
  it('orders group stage before knockouts, final last', () => {
    const order = sortByStage([
      m({ id: 1, stage: 'FINAL' }),
      m({ id: 2, stage: 'GROUP_STAGE' }),
      m({ id: 3, stage: 'QUARTER_FINALS' }),
    ]).map((x) => x.stage);
    expect(order).toEqual(['GROUP_STAGE', 'QUARTER_FINALS', 'FINAL']);
  });
});
