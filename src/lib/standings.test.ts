import { describe, it, expect } from 'vitest';
import { sortTable, groupLabel } from './standings';
import type { TableRow } from './types';

function row(over: Partial<TableRow>): TableRow {
  return {
    position: 0, team: { id: 1, name: 'T' }, playedGames: 3,
    won: 0, draw: 0, lost: 0, points: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0,
    ...over,
  };
}

describe('sortTable', () => {
  it('sorts by points, then goal difference, then goals for', () => {
    const out = sortTable([
      row({ team: { id: 1, name: 'A' }, points: 6, goalDifference: 1, goalsFor: 3 }),
      row({ team: { id: 2, name: 'B' }, points: 9, goalDifference: 5, goalsFor: 7 }),
      row({ team: { id: 3, name: 'C' }, points: 6, goalDifference: 1, goalsFor: 5 }),
    ]).map((r) => r.team.name);
    expect(out).toEqual(['B', 'C', 'A']); // B(9) > C and A tie on 6/+1, C has more GF
  });
  it('breaks a full tie by the API-provided position', () => {
    const out = sortTable([
      row({ team: { id: 1, name: 'A' }, position: 2, points: 6, goalDifference: 1, goalsFor: 3 }),
      row({ team: { id: 2, name: 'B' }, position: 1, points: 6, goalDifference: 1, goalsFor: 3 }),
    ]).map((r) => r.team.name);
    expect(out).toEqual(['B', 'A']); // tie on pts/GD/GF → position 1 first
  });
});

describe('groupLabel', () => {
  it('humanizes API group codes', () => {
    expect(groupLabel('GROUP_A')).toBe('Group A');
    expect(groupLabel(null)).toBe('');
  });
});
