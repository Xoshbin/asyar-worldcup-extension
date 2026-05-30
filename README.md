# World Cup

A FIFA World Cup companion for [Asyar](https://asyar.org) — live scores, the full
schedule, group standings, the knockout bracket, a followed-team picker with match
reminders, and AI tools to ask about the tournament in plain language.

## Commands

| Command | What it shows |
|---------|---------------|
| **World Cup Today** | Live + today's matches, scores, local kickoff times |
| **World Cup Schedule** | Every fixture, grouped by stage, filter by team |
| **World Cup Standings** | Group tables (P · GD · Pts) |
| **World Cup Bracket** | Knockout tree (Round of 16 → Final) |
| **Follow a Team** | Pick a team to follow for reminders + a tray countdown |

It also exposes AI tools so you can ask things like *"what World Cup games are on
today?"* or *"when does Brazil play next?"*.

## Setup — API key (required)

The extension gets its data from **[API-Football](https://www.api-football.com/)**
(api-sports.io). You need a free API key:

1. Create a free account at **<https://dashboard.api-football.com/register>**.
2. Copy your API key from the dashboard.
3. In Asyar, open **Settings → Extensions → World Cup** and paste it into the
   **“API-Football API key”** field.

That's it — open **World Cup Schedule** and the fixtures load.

### Choosing the season ⚠️ important

API-Football's **free plan only includes seasons 2022–2024**. The **2026** tournament
requires a **paid** API-Football plan.

The extension has a **“Tournament season (year)”** preference (default `2026`):

- **On a free key:** set it to **`2022`** to see the extension working with the real
  Qatar 2022 World Cup right now.
- **On a paid key:** leave it at **`2026`** (or set the edition year you want).

If you see *“Free plans do not have access to this season…”*, your key's plan doesn't
cover that season — switch the season to `2022` or upgrade your plan.

## Preferences

| Preference | Default | Notes |
|------------|---------|-------|
| API-Football API key | — | Required. From dashboard.api-football.com |
| Tournament season (year) | `2026` | Free plan covers 2022–2024; set `2022` to try |
| Match reminders | Only my followed team | `Off` · `Only my followed team` · `All matches` |
| Remind me before kickoff (minutes) | `10` | Lead time for the pre-match notification |
| Goal alerts for my followed team | on | Fires when your team scores |
| Show next-match countdown in tray | on | Tray shows the next (or live) match |
| Time zone (IANA, blank = system) | system | e.g. `Europe/London`, `America/New_York` |

## Rate limits

The free API-Football plan allows roughly **100 requests/day** (10/min). The extension
is built around this:

- Schedule, standings, teams, and the bracket are **cached** (fixtures ~90s, standings
  ~1h, teams ~24h).
- Live scores refresh only **while a match is actually in progress**.
- Kickoff reminders are computed from the **cached** fixtures, so they cost no requests.

So live scores are *near-live*, not second-by-second — comfortable within the free cap.

## Development

```bash
pnpm install        # from the monorepo root
pnpm --filter org.asyar.worldcup test:run   # unit tests
pnpm --filter org.asyar.worldcup build      # build dist/
asyar attach        # from this folder, then reload the launcher
```

The data layer lives in `src/lib/api.ts` (API-Football requests + mapping into the
internal `Match` / `Team` / `StandingGroup` types). Views and the worker consume those
internal types, so the data source can be swapped by changing only `api.ts`.
