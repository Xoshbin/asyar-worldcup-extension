import { describe, it, expect } from 'vitest';
import {
  fixturesRequest, standingsRequest, teamsRequest,
  parseMatches, parseStandings, parseTeams,
  statusFromShort, stageFromRound, groupFromRound,
} from './api';

const KEY = 'test-key-abc';
const BASE = 'https://v3.football.api-sports.io';

// ─── Request builders ──────────────────────────────────────────────────────

describe('request builders', () => {
  it('fixturesRequest: correct URL + x-apisports-key header, season passed through', () => {
    const r = fixturesRequest(KEY, 2026);
    expect(r.url).toBe(`${BASE}/fixtures?league=1&season=2026`);
    expect(r.options.headers).toEqual({ 'x-apisports-key': KEY });
  });

  it('standingsRequest: correct URL + header', () => {
    const r = standingsRequest(KEY, 2026);
    expect(r.url).toBe(`${BASE}/standings?league=1&season=2026`);
    expect(r.options.headers).toEqual({ 'x-apisports-key': KEY });
  });

  it('teamsRequest: correct URL + header', () => {
    const r = teamsRequest(KEY, 2026);
    expect(r.url).toBe(`${BASE}/teams?league=1&season=2026`);
    expect(r.options.headers).toEqual({ 'x-apisports-key': KEY });
  });

  it('season is configurable (e.g. 2022 for the free plan)', () => {
    expect(fixturesRequest(KEY, 2022).url).toBe(`${BASE}/fixtures?league=1&season=2022`);
  });
});

// ─── statusFromShort ──────────────────────────────────────────────────────

describe('statusFromShort', () => {
  it('NS → TIMED', () => expect(statusFromShort('NS')).toBe('TIMED'));
  it('TBD → TIMED', () => expect(statusFromShort('TBD')).toBe('TIMED'));
  it('1H → IN_PLAY', () => expect(statusFromShort('1H')).toBe('IN_PLAY'));
  it('2H → IN_PLAY', () => expect(statusFromShort('2H')).toBe('IN_PLAY'));
  it('ET → IN_PLAY', () => expect(statusFromShort('ET')).toBe('IN_PLAY'));
  it('BT → IN_PLAY', () => expect(statusFromShort('BT')).toBe('IN_PLAY'));
  it('P → IN_PLAY', () => expect(statusFromShort('P')).toBe('IN_PLAY'));
  it('LIVE → IN_PLAY', () => expect(statusFromShort('LIVE')).toBe('IN_PLAY'));
  it('INT → IN_PLAY', () => expect(statusFromShort('INT')).toBe('IN_PLAY'));
  it('HT → PAUSED', () => expect(statusFromShort('HT')).toBe('PAUSED'));
  it('FT → FINISHED', () => expect(statusFromShort('FT')).toBe('FINISHED'));
  it('AET → FINISHED', () => expect(statusFromShort('AET')).toBe('FINISHED'));
  it('PEN → FINISHED', () => expect(statusFromShort('PEN')).toBe('FINISHED'));
  it('PST → POSTPONED', () => expect(statusFromShort('PST')).toBe('POSTPONED'));
  it('SUSP → SUSPENDED', () => expect(statusFromShort('SUSP')).toBe('SUSPENDED'));
  it('CANC → CANCELLED', () => expect(statusFromShort('CANC')).toBe('CANCELLED'));
  it('ABD → CANCELLED', () => expect(statusFromShort('ABD')).toBe('CANCELLED'));
  it('AWD → CANCELLED', () => expect(statusFromShort('AWD')).toBe('CANCELLED'));
  it('WO → CANCELLED', () => expect(statusFromShort('WO')).toBe('CANCELLED'));
  it('unknown → SCHEDULED', () => expect(statusFromShort('XYZ')).toBe('SCHEDULED'));
});

// ─── stageFromRound ───────────────────────────────────────────────────────

describe('stageFromRound', () => {
  it('"Group A - 1" → GROUP_STAGE', () => expect(stageFromRound('Group A - 1')).toBe('GROUP_STAGE'));
  it('"group stage" → GROUP_STAGE', () => expect(stageFromRound('group stage')).toBe('GROUP_STAGE'));
  it('"Round of 16" → LAST_16', () => expect(stageFromRound('Round of 16')).toBe('LAST_16'));
  it('"8th Finals" → LAST_16', () => expect(stageFromRound('8th Finals')).toBe('LAST_16'));
  it('"Quarter-Finals" → QUARTER_FINALS', () => expect(stageFromRound('Quarter-Finals')).toBe('QUARTER_FINALS'));
  it('"Semi-Finals" → SEMI_FINALS', () => expect(stageFromRound('Semi-Finals')).toBe('SEMI_FINALS'));
  it('"3rd Place" → THIRD_PLACE', () => expect(stageFromRound('3rd Place')).toBe('THIRD_PLACE'));
  it('"Third Place" → THIRD_PLACE', () => expect(stageFromRound('Third Place')).toBe('THIRD_PLACE'));
  it('"Final" → FINAL', () => expect(stageFromRound('Final')).toBe('FINAL'));
  it('"The Final" → FINAL', () => expect(stageFromRound('The Final')).toBe('FINAL'));
  it('empty string → GROUP_STAGE', () => expect(stageFromRound('')).toBe('GROUP_STAGE'));
});

// ─── groupFromRound ───────────────────────────────────────────────────────

describe('groupFromRound', () => {
  it('"Group A - 1" → GROUP_A', () => expect(groupFromRound('Group A - 1')).toBe('GROUP_A'));
  it('"Group C - 2" → GROUP_C', () => expect(groupFromRound('Group C - 2')).toBe('GROUP_C'));
  it('"group h" → GROUP_H', () => expect(groupFromRound('group h')).toBe('GROUP_H'));
  it('"Round of 16" → null', () => expect(groupFromRound('Round of 16')).toBeNull());
  it('"Final" → null', () => expect(groupFromRound('Final')).toBeNull());
});

// ─── parseMatches ─────────────────────────────────────────────────────────

const GROUP_FIXTURE = {
  fixture: {
    id: 239625,
    date: '2026-06-11T18:00:00+00:00',
    status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
  },
  league: { id: 1, season: 2026, round: 'Group A - 1' },
  teams: {
    home: { id: 967, name: 'Brazil', logo: 'https://example.com/bra.png', winner: true },
    away: { id: 968, name: 'Spain',  logo: 'https://example.com/esp.png', winner: false },
  },
  goals: { home: 2, away: 1 },
  score: {
    halftime: { home: 1, away: 0 },
    fulltime:  { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty:   { home: null, away: null },
  },
};

const KNOCKOUT_FIXTURE = {
  fixture: {
    id: 239700,
    date: '2026-07-01T20:00:00+00:00',
    status: { long: 'Time To Be Defined', short: 'TBD', elapsed: null },
  },
  league: { id: 1, season: 2026, round: 'Round of 16' },
  teams: {
    home: { id: null as null, name: null as null, logo: '', winner: null },
    away: { id: null as null, name: null as null, logo: '', winner: null },
  },
  goals: { home: null, away: null },
  score: {
    halftime: { home: null, away: null },
    fulltime:  { home: null, away: null },
    extratime: { home: null, away: null },
    penalty:   { home: null, away: null },
  },
};

const LIVE_FIXTURE = {
  fixture: {
    id: 239800,
    date: '2026-06-20T14:00:00+00:00',
    status: { long: 'First Half', short: '1H', elapsed: 33 },
  },
  league: { id: 1, season: 2026, round: 'Group B - 2' },
  teams: {
    home: { id: 100, name: 'Germany', logo: 'https://example.com/ger.png', winner: null },
    away: { id: 101, name: 'France',  logo: 'https://example.com/fra.png', winner: null },
  },
  goals: { home: 1, away: 0 },
  score: {
    halftime: { home: null, away: null },
    fulltime:  { home: null, away: null },
    extratime: { home: null, away: null },
    penalty:   { home: null, away: null },
  },
};

const HT_FIXTURE = {
  fixture: {
    id: 239801,
    date: '2026-06-21T14:00:00+00:00',
    status: { long: 'Halftime', short: 'HT', elapsed: 45 },
  },
  league: { id: 1, season: 2026, round: 'Group C - 1' },
  teams: {
    home: { id: 200, name: 'Argentina', logo: '', winner: null },
    away: { id: 201, name: 'Mexico',    logo: '', winner: null },
  },
  goals: { home: 1, away: 1 },
  score: {
    halftime: { home: 1, away: 1 },
    fulltime:  { home: null, away: null },
    extratime: { home: null, away: null },
    penalty:   { home: null, away: null },
  },
};

function makeFixturesBody(...fixtures: object[]): string {
  return JSON.stringify({
    get: 'fixtures',
    parameters: { league: '1', season: '2026' },
    errors: [],
    results: fixtures.length,
    paging: { current: 1, total: 1 },
    response: fixtures,
  });
}

describe('parseMatches', () => {
  it('maps a finished group-stage fixture correctly', () => {
    const [m] = parseMatches(makeFixturesBody(GROUP_FIXTURE));
    expect(m.id).toBe(239625);
    expect(m.utcDate).toBe('2026-06-11T18:00:00+00:00');
    expect(m.status).toBe('FINISHED');
    expect(m.stage).toBe('GROUP_STAGE');
    expect(m.group).toBe('GROUP_A');
    expect(m.matchday).toBeNull();
    expect(m.homeTeam).toEqual({ id: 967, name: 'Brazil', crest: 'https://example.com/bra.png' });
    expect(m.awayTeam).toEqual({ id: 968, name: 'Spain',  crest: 'https://example.com/esp.png' });
    expect(m.score.fullTime).toEqual({ home: 2, away: 1 });
    expect(m.score.halfTime).toEqual({ home: 1, away: 0 });
    expect(m.score.winner).toBe('HOME_TEAM');
  });

  it('maps a TBD knockout fixture with null teams', () => {
    const [m] = parseMatches(makeFixturesBody(KNOCKOUT_FIXTURE));
    expect(m.id).toBe(239700);
    expect(m.status).toBe('TIMED');
    expect(m.stage).toBe('LAST_16');
    expect(m.group).toBeNull();
    expect(m.homeTeam).toBeNull();
    expect(m.awayTeam).toBeNull();
    expect(m.score.fullTime).toEqual({ home: null, away: null });
    expect(m.score.winner).toBeNull();
  });

  it('maps a live in-play fixture (1H)', () => {
    const [m] = parseMatches(makeFixturesBody(LIVE_FIXTURE));
    expect(m.status).toBe('IN_PLAY');
    expect(m.group).toBe('GROUP_B');
    expect(m.score.fullTime).toEqual({ home: 1, away: 0 });
    expect(m.score.winner).toBeNull();
  });

  it('maps a half-time (PAUSED) fixture', () => {
    const [m] = parseMatches(makeFixturesBody(HT_FIXTURE));
    expect(m.status).toBe('PAUSED');
    expect(m.group).toBe('GROUP_C');
    expect(m.score.halfTime).toEqual({ home: 1, away: 1 });
    // both teams have winner null + not finished → no winner
    expect(m.score.winner).toBeNull();
  });

  it('throws when errors array is non-empty', () => {
    const body = JSON.stringify({
      errors: [{ token: 'Error/Missing application key' }],
      results: 0,
      response: [],
    });
    expect(() => parseMatches(body)).toThrow();
  });

  it('throws when errors object has keys', () => {
    const body = JSON.stringify({
      errors: { token: 'Error/Missing application key' },
      results: 0,
      response: [],
    });
    expect(() => parseMatches(body)).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseMatches('not json')).toThrow();
  });

  it('returns [] when response is empty array', () => {
    const body = JSON.stringify({ errors: [], results: 0, response: [] });
    expect(parseMatches(body)).toEqual([]);
  });

  it('parses multiple fixtures', () => {
    const matches = parseMatches(makeFixturesBody(GROUP_FIXTURE, KNOCKOUT_FIXTURE));
    expect(matches).toHaveLength(2);
  });

  it('DRAW winner when both winner=false and status is FINISHED', () => {
    const drawFixture = {
      ...GROUP_FIXTURE,
      fixture: { ...GROUP_FIXTURE.fixture, status: { long: 'Match Finished', short: 'FT', elapsed: 90 } },
      teams: {
        home: { id: 10, name: 'USA', logo: '', winner: false as const },
        away: { id: 11, name: 'England', logo: '', winner: false as const },
      },
      goals: { home: 1, away: 1 },
    };
    const [m] = parseMatches(makeFixturesBody(drawFixture));
    expect(m.score.winner).toBe('DRAW');
  });
});

// ─── parseStandings ───────────────────────────────────────────────────────

const STANDINGS_ROW_1 = {
  rank: 1,
  team: { id: 2384, name: 'Brazil', logo: 'https://example.com/bra.png' },
  points: 9,
  goalsDiff: 5,
  group: 'Group A',
  all: { played: 3, win: 3, draw: 0, lose: 0, goals: { for: 7, against: 2 } },
};
const STANDINGS_ROW_2 = {
  rank: 2,
  team: { id: 2385, name: 'Spain', logo: 'https://example.com/esp.png' },
  points: 6,
  goalsDiff: 2,
  group: 'Group A',
  all: { played: 3, win: 2, draw: 0, lose: 1, goals: { for: 5, against: 3 } },
};

function makeStandingsBody(groups: object[][]): string {
  return JSON.stringify({
    get: 'standings',
    parameters: { league: '1', season: '2026' },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        league: {
          id: 1,
          season: 2026,
          standings: groups,
        },
      },
    ],
  });
}

describe('parseStandings', () => {
  it('maps a standings envelope with one group', () => {
    const body = makeStandingsBody([[STANDINGS_ROW_1, STANDINGS_ROW_2]]);
    const [g] = parseStandings(body);
    expect(g.stage).toBe('GROUP_STAGE');
    expect(g.type).toBe('TOTAL');
    expect(g.group).toBe('GROUP_A');
    expect(g.table).toHaveLength(2);

    const row1 = g.table[0];
    expect(row1.position).toBe(1);
    expect(row1.team).toEqual({ id: 2384, name: 'Brazil', crest: 'https://example.com/bra.png' });
    expect(row1.playedGames).toBe(3);
    expect(row1.won).toBe(3);
    expect(row1.draw).toBe(0);
    expect(row1.lost).toBe(0);
    expect(row1.points).toBe(9);
    expect(row1.goalsFor).toBe(7);
    expect(row1.goalsAgainst).toBe(2);
    expect(row1.goalDifference).toBe(5);
  });

  it('maps multiple groups', () => {
    const groupB1 = { ...STANDINGS_ROW_1, group: 'Group B' };
    const body = makeStandingsBody([[STANDINGS_ROW_1], [groupB1]]);
    const groups = parseStandings(body);
    expect(groups).toHaveLength(2);
    expect(groups[0].group).toBe('GROUP_A');
    expect(groups[1].group).toBe('GROUP_B');
  });

  it('returns [] when response is empty', () => {
    const body = JSON.stringify({ errors: [], results: 0, response: [] });
    expect(parseStandings(body)).toEqual([]);
  });

  it('returns [] when standings array is missing from response[0]', () => {
    const body = JSON.stringify({
      errors: [],
      results: 1,
      response: [{ league: { id: 1 } }],
    });
    expect(parseStandings(body)).toEqual([]);
  });

  it('throws on non-empty errors object', () => {
    const body = JSON.stringify({
      errors: { token: 'Error/Missing application key' },
      results: 0,
      response: [],
    });
    expect(() => parseStandings(body)).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseStandings('{')).toThrow();
  });
});

// ─── parseTeams ───────────────────────────────────────────────────────────

function makeTeamsBody(...teams: object[]): string {
  return JSON.stringify({
    get: 'teams',
    parameters: { league: '1', season: '2026' },
    errors: [],
    results: teams.length,
    paging: { current: 1, total: 1 },
    response: teams,
  });
}

describe('parseTeams', () => {
  it('maps team items correctly', () => {
    const body = makeTeamsBody(
      { team: { id: 2384, name: 'Brazil', code: 'BRA', logo: 'https://example.com/bra.png' }, venue: {} },
      { team: { id: 2385, name: 'Spain',  code: 'ESP', logo: 'https://example.com/esp.png' }, venue: {} },
    );
    const teams = parseTeams(body);
    expect(teams).toHaveLength(2);
    expect(teams[0]).toEqual({ id: 2384, name: 'Brazil', tla: 'BRA', crest: 'https://example.com/bra.png' });
    expect(teams[1]).toEqual({ id: 2385, name: 'Spain',  tla: 'ESP', crest: 'https://example.com/esp.png' });
  });

  it('returns [] when response is empty', () => {
    const body = JSON.stringify({ errors: [], results: 0, response: [] });
    expect(parseTeams(body)).toEqual([]);
  });

  it('throws on non-empty errors array', () => {
    const body = JSON.stringify({
      errors: ['You have reached the request limit for the day.'],
      results: 0,
      response: [],
    });
    expect(() => parseTeams(body)).toThrow();
  });

  it('throws on invalid JSON', () => {
    expect(() => parseTeams('{')).toThrow();
  });
});
