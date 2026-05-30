import { describe, it, expect } from 'vitest';
import { matchesNeedingAlert, detectGoals } from './notify';
import type { Match } from './types';

function m(over: Partial<Match>): Match {
  return {
    id: 1, utcDate: '2026-06-11T18:00:00Z', status: 'TIMED', stage: 'GROUP_STAGE',
    group: 'GROUP_A', matchday: 1,
    homeTeam: { id: 10, name: 'Brazil' }, awayTeam: { id: 20, name: 'Spain' },
    score: { winner: null, fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    ...over,
  };
}

const KICKOFF = Date.parse('2026-06-11T18:00:00Z');

describe('matchesNeedingAlert', () => {
  const within = KICKOFF - 5 * 60_000;   // 5 min before kickoff
  const tooEarly = KICKOFF - 30 * 60_000; // 30 min before

  it('mode "off" never alerts', () => {
    expect(matchesNeedingAlert([m({})], { now: within, leadMin: 10, mode: 'off', followedId: null, alerted: new Set() })).toEqual([]);
  });
  it('mode "all" alerts inside the lead window only', () => {
    expect(matchesNeedingAlert([m({})], { now: tooEarly, leadMin: 10, mode: 'all', followedId: null, alerted: new Set() })).toEqual([]);
    expect(matchesNeedingAlert([m({})], { now: within, leadMin: 10, mode: 'all', followedId: null, alerted: new Set() }).map((x) => x.id)).toEqual([1]);
  });
  it('mode "team" alerts only for the followed team', () => {
    const other = m({ id: 2, homeTeam: { id: 99, name: 'X' }, awayTeam: { id: 98, name: 'Y' } });
    const out = matchesNeedingAlert([m({}), other], { now: within, leadMin: 10, mode: 'team', followedId: 10, alerted: new Set() });
    expect(out.map((x) => x.id)).toEqual([1]);
  });
  it('does not re-alert an already-alerted match', () => {
    expect(matchesNeedingAlert([m({})], { now: within, leadMin: 10, mode: 'all', followedId: null, alerted: new Set([1]) })).toEqual([]);
  });
  it('ignores matches that already kicked off', () => {
    expect(matchesNeedingAlert([m({})], { now: KICKOFF + 60_000, leadMin: 10, mode: 'all', followedId: null, alerted: new Set() })).toEqual([]);
  });
});

describe('detectGoals', () => {
  const prev = [m({ id: 1, status: 'IN_PLAY', score: { winner: null, fullTime: { home: 0, away: 0 }, halfTime: { home: 0, away: 0 } } })];
  it('reports a goal for the followed team', () => {
    const curr = [m({ id: 1, status: 'IN_PLAY', score: { winner: null, fullTime: { home: 1, away: 0 }, halfTime: { home: 0, away: 0 } } })];
    const out = detectGoals(prev, curr, 10);
    expect(out).toEqual([{ matchId: 1, homeName: 'Brazil', awayName: 'Spain', home: 1, away: 0 }]);
  });
  it('ignores goals when followed team is not in the match', () => {
    const curr = [m({ id: 1, status: 'IN_PLAY', score: { winner: null, fullTime: { home: 1, away: 0 }, halfTime: { home: 0, away: 0 } } })];
    expect(detectGoals(prev, curr, 777)).toEqual([]);
  });
  it('null followedId means no goal alerts', () => {
    const curr = [m({ id: 1, status: 'IN_PLAY', score: { winner: null, fullTime: { home: 1, away: 0 }, halfTime: { home: 0, away: 0 } } })];
    expect(detectGoals(prev, curr, null)).toEqual([]);
  });
});
