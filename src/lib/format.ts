import type { Match, MatchStatus } from './types';

export function scoreString(match: Match): string {
  // Teams (or their names) are null for not-yet-drawn knockout fixtures.
  const home = match.homeTeam?.name ?? 'TBD';
  const away = match.awayTeam?.name ?? 'TBD';
  const score = match.score;
  const started = match.status === 'IN_PLAY' || match.status === 'PAUSED' || match.status === 'FINISHED';
  if (started && score?.fullTime?.home != null && score?.fullTime?.away != null) {
    return `${home} ${score.fullTime.home} – ${score.fullTime.away} ${away}`;
  }
  return `${home} vs ${away}`;
}

export function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'IN_PLAY': return 'Live';
    case 'PAUSED': return 'Half time';
    case 'FINISHED': return 'Full time';
    case 'SCHEDULED':
    case 'TIMED': return 'Upcoming';
    case 'SUSPENDED': return 'Suspended';
    case 'POSTPONED': return 'Postponed';
    case 'CANCELLED': return 'Cancelled';
  }
}

export function kickoffLabel(utcDate: string, timeZone: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', hour: 'numeric', minute: '2-digit' };
  if (timeZone) {
    try {
      // validate by constructing once; assign only if it doesn't throw
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(utcDate));
      opts.timeZone = timeZone;
    } catch { /* invalid IANA tz from prefs — fall back to system zone */ }
  }
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(utcDate));
}
