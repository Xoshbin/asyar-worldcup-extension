import type { Match, MatchStatus, Stage, StandingGroup, Team } from './types';

const BASE = 'https://v3.football.api-sports.io';
const WC_LEAGUE = 1;            // FIFA World Cup
export const DEFAULT_SEASON = 2026;

export interface ApiRequest {
  url: string;
  options: { headers: Record<string, string> };
}

function req(path: string, apiKey: string, season: number): ApiRequest {
  return {
    url: `${BASE}${path}?league=${WC_LEAGUE}&season=${season}`,
    options: { headers: { 'x-apisports-key': apiKey } },
  };
}

export const fixturesRequest  = (apiKey: string, season: number): ApiRequest => req('/fixtures',  apiKey, season);
export const standingsRequest = (apiKey: string, season: number): ApiRequest => req('/standings', apiKey, season);
export const teamsRequest     = (apiKey: string, season: number): ApiRequest => req('/teams',     apiKey, season);

// ─── Error-aware unwrap ────────────────────────────────────────────────────

/**
 * Parse an API-Football response body, throw on non-empty `errors`, and
 * return the `response` array.  API-Football returns HTTP 200 even for
 * auth/quota failures, putting the reason in the `errors` field.
 */
export function unwrap(body: string): unknown[] {
  const json = JSON.parse(body);          // throws on invalid JSON — intentional

  const errors: unknown = json?.errors;
  if (Array.isArray(errors)) {
    if (errors.length > 0) {
      const first = errors[0];
      const msg = typeof first === 'string' ? first
        : (typeof first === 'object' && first !== null ? Object.values(first)[0] : String(first));
      throw new Error(String(msg));
    }
  } else if (errors !== null && typeof errors === 'object') {
    const keys = Object.keys(errors as object);
    if (keys.length > 0) {
      const msg = (errors as Record<string, unknown>)[keys[0]];
      throw new Error(String(msg));
    }
  }

  const response: unknown = json?.response;
  return Array.isArray(response) ? response : [];
}

// ─── Pure mapping helpers (exported so they're unit-testable) ─────────────

export function statusFromShort(short: string): MatchStatus {
  switch (short) {
    case 'NS':
    case 'TBD':
      return 'TIMED';
    case '1H':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'LIVE':
    case 'INT':
      return 'IN_PLAY';
    case 'HT':
      return 'PAUSED';
    case 'FT':
    case 'AET':
    case 'PEN':
      return 'FINISHED';
    case 'PST':
      return 'POSTPONED';
    case 'SUSP':
      return 'SUSPENDED';
    case 'CANC':
    case 'ABD':
    case 'AWD':
    case 'WO':
      return 'CANCELLED';
    default:
      return 'SCHEDULED';
  }
}

export function stageFromRound(round: string): Stage {
  const r = round.toLowerCase();
  if (r.includes('group'))                                   return 'GROUP_STAGE';
  // "Round of 16" or "8th Finals" (1/8-final = round of 16)
  if (r.includes('16') || r.includes('8th'))                return 'LAST_16';
  if (r.includes('quarter'))                                 return 'QUARTER_FINALS';
  if (r.includes('semi'))                                    return 'SEMI_FINALS';
  if (r.includes('3rd place') || r.includes('third place')) return 'THIRD_PLACE';
  // "Final" last — ensure LAST_16/QUARTER/SEMI/3RD have already been picked
  if (r.includes('final'))                                   return 'FINAL';
  return 'GROUP_STAGE';
}

export function groupFromRound(round: string): string | null {
  const match = round.match(/group\s+([a-z])/i);
  if (!match) return null;
  return `GROUP_${match[1].toUpperCase()}`;
}

// ─── Fixture → Match mapping ───────────────────────────────────────────────

interface ApiTeamEntry {
  id: number | null;
  name: string | null;
  logo?: string;
  winner?: boolean | null;
}

function mapTeam(entry: ApiTeamEntry): Team | null {
  // null id + null name = placeholder / not-yet-drawn knockout slot
  if (entry.id == null && entry.name == null) return null;
  return { id: entry.id ?? null, name: entry.name ?? null, crest: entry.logo };
}

function mapWinner(
  home: ApiTeamEntry,
  away: ApiTeamEntry,
  status: MatchStatus,
): Match['score']['winner'] {
  if (home.winner === true)  return 'HOME_TEAM';
  if (away.winner === true)  return 'AWAY_TEAM';
  const finished = status === 'FINISHED';
  if (finished && home.winner === false && away.winner === false) return 'DRAW';
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFixture(item: any): Match {
  const { fixture, league, teams, goals, score } = item;
  const statusShort: string = fixture?.status?.short ?? '';
  const round: string       = league?.round ?? '';
  const matchStatus         = statusFromShort(statusShort);

  return {
    id:       fixture.id,
    utcDate:  fixture.date,
    status:   matchStatus,
    stage:    stageFromRound(round),
    group:    groupFromRound(round),
    matchday: null,
    homeTeam: teams?.home ? mapTeam(teams.home as ApiTeamEntry) : null,
    awayTeam: teams?.away ? mapTeam(teams.away as ApiTeamEntry) : null,
    score: {
      winner:   mapWinner(
        (teams?.home ?? {}) as ApiTeamEntry,
        (teams?.away ?? {}) as ApiTeamEntry,
        matchStatus,
      ),
      fullTime: {
        home: goals?.home ?? null,
        away: goals?.away ?? null,
      },
      halfTime: {
        home: score?.halftime?.home ?? null,
        away: score?.halftime?.away ?? null,
      },
    },
  };
}

export function parseMatches(body: string): Match[] {
  const items = unwrap(body);   // throws on errors / invalid JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return items.map((item: any) => mapFixture(item));
}

// ─── Standings mapping ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStandingsGroup(group: any[]): StandingGroup {
  const firstRow = group[0] ?? {};
  const rawGroup: string = firstRow.group ?? '';
  const groupKey = (() => {
    const m = rawGroup.match(/group\s+([a-z])/i);
    return m ? `GROUP_${m[1].toUpperCase()}` : rawGroup;
  })();

  return {
    stage: 'GROUP_STAGE',
    type:  'TOTAL',
    group: groupKey || null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: group.map((row: any) => ({
      position:       row.rank,
      team:           { id: row.team?.id, name: row.team?.name, crest: row.team?.logo },
      playedGames:    row.all?.played,
      won:            row.all?.win,
      draw:           row.all?.draw,
      lost:           row.all?.lose,
      points:         row.points,
      goalsFor:       row.all?.goals?.for,
      goalsAgainst:   row.all?.goals?.against,
      goalDifference: row.goalsDiff,
    })),
  };
}

export function parseStandings(body: string): StandingGroup[] {
  const response = unwrap(body);  // throws on errors / invalid JSON
  if (response.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const first: any = response[0];
  const groups: unknown = first?.league?.standings;
  if (!Array.isArray(groups)) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (groups as any[][]).map(mapStandingsGroup);
}

// ─── Teams mapping ─────────────────────────────────────────────────────────

export function parseTeams(body: string): Team[] {
  const response = unwrap(body);  // throws on errors / invalid JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.map((item: any) => ({
    id:     item.team?.id,
    name:   item.team?.name,
    tla:    item.team?.code,
    crest:  item.team?.logo,
  }));
}
