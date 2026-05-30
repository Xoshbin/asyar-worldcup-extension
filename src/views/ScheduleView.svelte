<script lang="ts">
  import { onMount } from 'svelte';
  import type { Match, Stage } from '../lib/types';
  import { sortByStage } from '../lib/schedule';
  import { scoreString, statusLabel, kickoffLabel } from '../lib/format';
  import SetupHint from '../components/SetupHint.svelte';

  interface ContextLike { request<T = unknown>(id: string, p?: unknown, o?: { timeoutMs?: number }): Promise<T>; getService<T>(n: string): T; }
  let { context }: { context: ContextLike } = $props();

  let matches = $state<Match[]>([]);
  let error   = $state<string | null>(null);
  let loading = $state(true);
  let filter  = $state('');
  let tz      = $state('');

  const STAGE_TITLES: Record<Stage, string> = {
    GROUP_STAGE: 'Group Stage', LAST_16: 'Round of 16', QUARTER_FINALS: 'Quarter-finals',
    SEMI_FINALS: 'Semi-finals', THIRD_PLACE: 'Third place', FINAL: 'Final',
  };

  const filtered = $derived(
    sortByStage(matches.filter((m) => {
      const q = filter.trim().toLowerCase();
      if (!q) return true;
      return (m.homeTeam?.name ?? '').toLowerCase().includes(q) || (m.awayTeam?.name ?? '').toLowerCase().includes(q);
    })),
  );
  const grouped = $derived(
    filtered.reduce<Array<[Stage, Match[]]>>((acc, m) => {
      const last = acc[acc.length - 1];
      if (last && last[0] === m.stage) last[1].push(m);
      else acc.push([m.stage, [m]]);
      return acc;
    }, []),
  );

  onMount(async () => {
    try { tz = await context.request<string>('getTimezone', {}, { timeoutMs: 10_000 }); } catch { /* keep system default */ }
    try {
      const r = await context.request<Match[]>('getMatches', {}, { timeoutMs: 30_000 });
      matches = Array.isArray(r) ? r : [];
      if (!Array.isArray(r)) error = `Unexpected worker response: ${typeof r} ${JSON.stringify(r)?.slice(0, 200)}`;
    }
    catch (e) { error = e instanceof Error ? e.message : 'Could not load schedule.'; }
    finally { loading = false; }
  });
</script>

<div class="wc-page">
  <h1>Schedule</h1>
  <input class="wc-filter" placeholder="Filter by team…" bind:value={filter} />
  {#if loading}
    <p class="wc-muted">Loading…</p>
  {:else if error}
    <p class="wc-error">{error}</p>
    <SetupHint />
  {:else}
    {#each grouped as [stage, list] (stage)}
      <h2>{STAGE_TITLES[stage]}</h2>
      <ul class="wc-list">
        {#each list as m (m.id)}
          <li class="wc-row">
            <span class="wc-score">{scoreString(m)}</span>
            <span class="wc-meta">{kickoffLabel(m.utcDate, tz)} · {statusLabel(m.status)}</span>
          </li>
        {/each}
      </ul>
    {/each}
  {/if}
</div>

<style>
  .wc-page { padding: var(--space-4); color: var(--text-primary); }
  h1 { font-size: var(--font-size-lg); font-weight: 600; margin: 0 0 var(--space-3); }
  h2 { font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin: var(--space-4) 0 var(--space-2); }
  .wc-filter { width: 100%; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-tertiary); color: inherit; margin-bottom: var(--space-2); font: inherit; }
  .wc-filter:focus { outline: none; box-shadow: var(--shadow-focus); }
  .wc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .wc-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); background: var(--bg-secondary); }
  .wc-meta { color: var(--text-secondary); font-size: var(--font-size-xs); }
  .wc-muted { color: var(--text-secondary); }
  .wc-error { color: var(--accent-danger); }
</style>
