import {
  ExtensionContext as WorkerExtensionContext,
  extensionBridge,
} from 'asyar-sdk/worker';
import type {
  Extension,
  ExtensionContext,
  ExtensionResult,
  INetworkService,
  IStorageService,
  IStatusBarService,
  INotificationService,
  IToolsService,
  ManifestTool,
  ExtensionStateProxy,
} from 'asyar-sdk/contracts';
import manifest from '../manifest.json';

import {
  fixturesRequest, standingsRequest, teamsRequest,
  parseMatches, parseStandings, parseTeams, DEFAULT_SEASON, type ApiRequest,
} from './lib/api';
import { isFresh, RateLimiter, type CacheEnvelope } from './lib/cache';
import { matchesOn, matchesForTeam, sortByStage, isLive } from './lib/schedule';
import { sortTable, groupLabel } from './lib/standings';
import { scoreString, statusLabel, kickoffLabel } from './lib/format';
import { matchesNeedingAlert, detectGoals } from './lib/notify';
import type { Match, StandingGroup, Team, FollowedTeam, NotifyMode } from './lib/types';

const extensionId = resolveExtensionId();
const ctx = new WorkerExtensionContext();
ctx.setExtensionId(extensionId);

const network       = ctx.getService<INetworkService>('network');
const storage       = ctx.getService<IStorageService>('storage');
const statusBar     = ctx.getService<IStatusBarService>('statusBar');
const notifications = ctx.getService<INotificationService>('notifications');
const tools         = ctx.getService<IToolsService>('tools');
const state         = ctx.getService<ExtensionStateProxy>('state');

// ─── preferences helpers ─────────────────────────────────────────────────
function prefs(): Record<string, unknown> {
  return (ctx.preferences.values as Record<string, unknown> | undefined) ?? {};
}
function apiKey(): string { return String(prefs().apiKey ?? '').trim(); }
function notifyMode(): NotifyMode {
  const v = String(prefs().notifyMode ?? 'team');
  return (v === 'off' || v === 'team' || v === 'all') ? v : 'team';
}
function leadMin(): number {
  const n = Number(prefs().notifyLeadTime ?? 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}
function goalsEnabled(): boolean { return prefs().notifyGoals !== false; }
function showTray(): boolean { return prefs().showTray !== false; }
function timeZone(): string { return String(prefs().timezone ?? '').trim(); }
function season(): number {
  const n = Number(prefs().season ?? DEFAULT_SEASON);
  return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : DEFAULT_SEASON;
}

// ─── cache + rate limiting ───────────────────────────────────────────────
const TTL = { matches: 90_000, standings: 60 * 60_000, teams: 24 * 60 * 60_000 };
const limiter = new RateLimiter(9, 60_000); // 9 < free cap of 10/min

const mem: {
  matches: CacheEnvelope<Match[]> | null;
  standings: CacheEnvelope<StandingGroup[]> | null;
  teams: CacheEnvelope<Team[]> | null;
} = { matches: null, standings: null, teams: null };

async function fetchJson(req: ApiRequest): Promise<string> {
  const res = await network.fetch(req.url, { headers: req.options.headers });
  if (!res.ok) throw new Error(`api-football ${res.status}`);
  return res.body;
}

/** Returns cached data when fresh; otherwise fetches (respecting the limiter). */
async function load<T>(
  kind: 'matches' | 'standings' | 'teams',
  ttl: number,
  build: (key: string, season: number) => ApiRequest,
  parse: (body: string) => T,
): Promise<T> {
  const now = Date.now();
  const env = mem[kind] as CacheEnvelope<T> | null;
  if (isFresh(env, ttl, now)) return env!.data;

  let key = apiKey();
  if (!key) {
    // The worker's preferences push can race or be missed entirely (the
    // background worker may never receive `preferences:set-all`), leaving the
    // boot snapshot empty. Pull the current values on demand before giving up.
    try { await ctx.preferences.refresh(); } catch { /* ignore — handled below */ }
    key = apiKey();
  }
  if (!key) throw new Error('Set your API-Football API key in the extension preferences.');
  if (!limiter.tryAcquire(now)) {
    if (env) return env.data;                 // serve stale rather than fail
    throw new Error('Rate limit reached — try again in a moment.');
  }
  const data = parse(await fetchJson(build(key, season())));
  (mem[kind] as CacheEnvelope<T>) = { data, savedAt: now };
  await state.set(kind, data);
  return data;
}

const loadMatches   = () => load<Match[]>('matches', TTL.matches, fixturesRequest, parseMatches);
const loadStandings = () => load<StandingGroup[]>('standings', TTL.standings, standingsRequest, parseStandings);
const loadTeams     = () => load<Team[]>('teams', TTL.teams, teamsRequest, parseTeams);

// ─── followed team (persisted) ───────────────────────────────────────────
const FOLLOW_KEY = 'followedTeam';
async function getFollowed(): Promise<FollowedTeam | null> {
  const raw = await storage.get(FOLLOW_KEY);
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw) as FollowedTeam; } catch { return null; }
}
async function setFollowed(team: FollowedTeam | null): Promise<void> {
  if (team) await storage.set(FOLLOW_KEY, JSON.stringify(team));
  else await storage.delete(FOLLOW_KEY);
  await state.set('followedTeam', team);
}

// ─── tray ────────────────────────────────────────────────────────────────
const TRAY_ID = 'next-match';
let trayRegistered = false;
async function refreshTray(matches: Match[]): Promise<void> {
  if (!showTray()) {
    if (trayRegistered) { statusBar.unregisterItem(TRAY_ID); trayRegistered = false; }
    return;
  }
  const followed = await getFollowed();
  const pool = followed ? matchesForTeam(matches, followed.id) : matches;
  const now = Date.now();
  const next = sortByStage(pool).find((m) => Date.parse(m.utcDate) > now || isLive(m));
  const text = next
    ? (isLive(next) ? `⚽ ${scoreString(next)}` : `⚽ ${kickoffLabel(next.utcDate, timeZone())}`)
    : '⚽ World Cup';
  if (!trayRegistered) {
    statusBar.registerItem({ id: TRAY_ID, icon: '⚽', text });
    trayRegistered = true;
  } else {
    statusBar.updateItem(TRAY_ID, { text });
  }
}

// ─── notifications (driven by the 60s tick) ──────────────────────────────
// Intentionally never cleared: tracks match ids already alerted this worker
// session. Bounded by the tournament size (~64 matches), so it cannot grow
// unbounded and is not a leak.
const alerted = new Set<number>();
let prevMatches: Match[] = [];

async function runTick(): Promise<void> {
  // ── Seed on first tick ──────────────────────────────────────────────────
  // When the cache is empty, do ONE fetch to initialise the baseline.
  // We skip notifications on this pass so we don't re-announce goals that
  // already happened before the extension started.
  if (!mem.matches) {
    try { const seed = await loadMatches(); prevMatches = seed; await refreshTray(seed); }
    catch { /* no key / offline → skip */ }
    return;
  }

  // ── Use the cached snapshot for reminders (quota-free) ─────────────────
  // loadMatches() respects TTL internally — calling it here is safe, but
  // for reminder / goal-alert logic we explicitly read the in-memory cache
  // to avoid burning quota on every 60s tick.
  const cached = mem.matches.data;

  // Only hit the network if at least one match is currently IN_PLAY or PAUSED
  // (so we get fresh scores for goal detection). If cache is also stale
  // loadMatches() will re-fetch; if it's still fresh it returns cached.
  const anyLive = cached.some(isLive);
  let matches = cached;
  if (anyLive) {
    try { matches = await loadMatches(); }
    catch { /* serve stale on error */ }
  }

  const followed = await getFollowed();
  const now = Date.now();

  // Pre-match reminders.
  const due = matchesNeedingAlert(matches, {
    now, leadMin: leadMin(), mode: notifyMode(),
    followedId: followed?.id ?? null, alerted,
  });
  for (const m of due) {
    alerted.add(m.id);
    await notifications.send({
      title: `Kickoff soon: ${m.homeTeam?.name ?? 'TBD'} vs ${m.awayTeam?.name ?? 'TBD'}`,
      body: `${kickoffLabel(m.utcDate, timeZone())} · ${groupLabel(m.group) || statusLabel(m.status)}`,
      icon: '⚽',
      actions: [{ id: 'open', title: 'View', commandId: 'today' }],
    });
  }

  // Goal alerts for the followed team (only meaningful when we just fetched
  // fresh data while a match is live).
  if (goalsEnabled()) {
    for (const g of detectGoals(prevMatches, matches, followed?.id ?? null)) {
      await notifications.send({
        title: '⚽ GOAL!',
        body: `${g.homeName} ${g.home} – ${g.away} ${g.awayName}`,
        icon: '⚽',
        actions: [{ id: 'open', title: 'View', commandId: 'today' }],
      });
    }
  }
  prevMatches = matches;
  await refreshTray(matches);
}

// ─── RPC handlers (views call these via context.request) ──────────────────
ctx.onRequest<undefined, Match[]>('getMatches', async () => loadMatches());
ctx.onRequest<undefined, StandingGroup[]>('getStandings', async () => loadStandings());
ctx.onRequest<undefined, Team[]>('getTeams', async () => loadTeams());
ctx.onRequest<undefined, FollowedTeam | null>('getFollowedTeam', async () => getFollowed());
ctx.onRequest<FollowedTeam | null, void>('setFollowedTeam', async (team) => { await setFollowed(team ?? null); });
ctx.onRequest<undefined, string>('getTimezone', async () => timeZone());
ctx.onRequest<undefined, { matches: Match[]; standings: StandingGroup[] }>('refresh', async () => {
  const [m, s] = await Promise.all([loadMatches(), loadStandings()]);
  await refreshTray(m);
  return { matches: m, standings: s };
});

// ─── AI tools ──────────────────────────────────────────────────────────────
function findTeamMatches(matches: Match[], name: string): Match[] {
  const q = name.toLowerCase();
  return matches.filter((m) =>
    (m.homeTeam?.name ?? '').toLowerCase().includes(q) || (m.awayTeam?.name ?? '').toLowerCase().includes(q) ||
    (m.homeTeam?.tla ?? '').toLowerCase() === q || (m.awayTeam?.tla ?? '').toLowerCase() === q);
}

function registerTools(): void {
  const byId = (id: string): ManifestTool | undefined =>
    (manifest.tools as ManifestTool[] | undefined)?.find((t) => t.id === id);

  const reg = (id: string, handler: (args: Record<string, unknown>) => Promise<unknown>) => {
    const tool = byId(id);
    if (tool) void tools.registerTool(tool, (args) => handler((args ?? {}) as Record<string, unknown>));
  };

  reg('wc-matches-today', async () => {
    const today = matchesOn(await loadMatches(), new Date());
    return { matches: today.map((m) => ({ match: scoreString(m), status: statusLabel(m.status), kickoff: kickoffLabel(m.utcDate, timeZone()) })) };
  });
  reg('wc-team-fixtures', async (a) => {
    const name = String(a.team ?? '');
    const fixtures = sortByStage(findTeamMatches(await loadMatches(), name));
    return { team: name, fixtures: fixtures.map((m) => ({ match: scoreString(m), status: statusLabel(m.status), kickoff: kickoffLabel(m.utcDate, timeZone()), stage: m.stage })) };
  });
  reg('wc-standings', async (a) => {
    const wanted = String(a.group ?? '').toUpperCase().replace(/\s+/g, '_').replace(/^GROUP_?/, 'GROUP_');
    const groups = (await loadStandings()).filter((g) => g.type === 'TOTAL');
    const picked = wanted && wanted !== 'GROUP_'
      ? groups.filter((g) => (g.group ?? '').toUpperCase().includes(wanted.replace('GROUP_', '')))
      : groups;
    return { groups: picked.map((g) => ({ group: groupLabel(g.group), table: sortTable(g.table).map((r) => ({ team: r.team?.name ?? 'TBD', played: r.playedGames, points: r.points, gd: r.goalDifference })) })) };
  });
  reg('wc-match-score', async (a) => {
    const found = findTeamMatches(await loadMatches(), String(a.team ?? ''));
    const live = found.find(isLive) ?? found.find((m) => m.status === 'FINISHED') ?? found[0];
    return live ? { match: scoreString(live), status: statusLabel(live.status) } : { error: 'No match found for that team.' };
  });
  reg('wc-next-followed', async () => {
    const followed = await getFollowed();
    if (!followed) return { error: 'No team is being followed yet.' };
    const now = Date.now();
    const next = sortByStage(matchesForTeam(await loadMatches(), followed.id)).find((m) => Date.parse(m.utcDate) > now || isLive(m));
    return next ? { team: followed.name, next: scoreString(next), kickoff: kickoffLabel(next.utcDate, timeZone()), status: statusLabel(next.status) } : { team: followed.name, error: 'No upcoming match.' };
  });
}

// ─── extension shell ───────────────────────────────────────────────────────
class WorldCupExt implements Extension {
  async initialize(_c: ExtensionContext): Promise<void> {}
  async activate(): Promise<void> {}
  async deactivate(): Promise<void> {}
  async executeCommand(id: string, _args?: Record<string, unknown>): Promise<unknown> {
    if (id === 'tick') { await runTick(); }
    return undefined;
  }
  async search(_query: string): Promise<ExtensionResult[]> { return []; }
}

const ext = new WorldCupExt();
extensionBridge.registerManifest(manifest as unknown as Parameters<typeof extensionBridge.registerManifest>[0]);
extensionBridge.registerExtensionImplementation(extensionId, ext);
registerTools();

window.parent.postMessage({ type: 'asyar:extension:loaded', extensionId, role: 'worker' }, '*');

function resolveExtensionId(): string {
  const fallback = 'org.asyar.worldcup';
  if (window.location.hostname === 'localhost' || window.location.hostname === 'asyar-extension.localhost') {
    return window.location.pathname.split('/').filter(Boolean)[0] || fallback;
  }
  return window.location.hostname || fallback;
}
