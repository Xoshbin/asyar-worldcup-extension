import { describe, it, expect } from 'vitest';
import { scoreString, statusLabel, kickoffLabel } from './format';
import type { Match } from './types';

function m(over: Partial<Match>): Match {
  return {
    id: 1, utcDate: '2026-06-11T18:00:00Z', status: 'TIMED', stage: 'GROUP_STAGE',
    group: 'GROUP_A', matchday: 1,
    homeTeam: { id: 1, name: 'Brazil' }, awayTeam: { id: 2, name: 'Spain' },
    score: { winner: null, fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    ...over,
  };
}

describe('scoreString', () => {
  it('shows vs before kickoff, score once underway', () => {
    expect(scoreString(m({ status: 'TIMED' }))).toBe('Brazil vs Spain');
    expect(scoreString(m({ status: 'IN_PLAY', score: { winner: null, fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 } } })))
      .toBe('Brazil 2 – 1 Spain');
  });

  it('renders TBD for undetermined teams without throwing (null team or null name)', () => {
    // football-data returns null teams (or { name: null }) for not-yet-drawn knockout fixtures.
    expect(() => scoreString(m({ homeTeam: null, awayTeam: null }))).not.toThrow();
    expect(scoreString(m({ homeTeam: null, awayTeam: null }))).toBe('TBD vs TBD');
    expect(scoreString(m({ homeTeam: { id: 0, name: null as unknown as string }, awayTeam: { id: 2, name: 'Spain' } })))
      .toBe('TBD vs Spain');
  });
});

describe('statusLabel', () => {
  it('maps API status to a short human label', () => {
    expect(statusLabel('IN_PLAY')).toBe('Live');
    expect(statusLabel('FINISHED')).toBe('Full time');
    expect(statusLabel('TIMED')).toBe('Upcoming');
    expect(statusLabel('POSTPONED')).toBe('Postponed');
    expect(statusLabel('SCHEDULED')).toBe('Upcoming');
  });
});

describe('kickoffLabel', () => {
  it('formats kickoff in a given IANA timezone', () => {
    // 18:00 UTC in New York (UTC-4 in June) = 2:00 PM
    expect(kickoffLabel('2026-06-11T18:00:00Z', 'America/New_York')).toContain('2:00');
  });
  it('does not throw on an invalid IANA timezone, falling back to system zone', () => {
    let result: string | undefined;
    expect(() => { result = kickoffLabel('2026-06-11T18:00:00Z', 'Not/AZone'); }).not.toThrow();
    expect(result).toBeTruthy();
  });
});
