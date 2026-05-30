export type MatchStatus =
  | 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED'
  | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED';

export type Stage =
  | 'GROUP_STAGE' | 'LAST_16' | 'QUARTER_FINALS'
  | 'SEMI_FINALS' | 'THIRD_PLACE' | 'FINAL';

export interface Team {
  // id/name are null on placeholder teams for not-yet-drawn knockout fixtures.
  id: number | null;
  name: string | null;
  shortName?: string;
  tla?: string;     // three-letter abbreviation, e.g. "BRA"
  crest?: string;   // image URL
}

export interface Match {
  id: number;
  utcDate: string;          // ISO 8601
  status: MatchStatus;
  stage: Stage;
  group: string | null;     // e.g. "GROUP_A" during group stage, null in knockouts
  matchday: number | null;
  homeTeam: Team | null;
  awayTeam: Team | null;
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

export interface TableRow {
  position: number;
  team: Team;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface StandingGroup {
  stage: Stage;
  type: string;             // "TOTAL" | "HOME" | "AWAY"
  group: string | null;     // "GROUP_A" …
  table: TableRow[];
}

export interface FollowedTeam {
  id: number;
  name: string;
  tla?: string;
}

export type NotifyMode = 'off' | 'team' | 'all';

/** A goal event derived by diffing two snapshots of the same match. */
export interface GoalEvent {
  matchId: number;
  homeName: string;
  awayName: string;
  home: number;
  away: number;
}
