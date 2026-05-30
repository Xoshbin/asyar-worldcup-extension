<script lang="ts">
  import { onMount } from 'svelte';
  import type { Match, Stage } from '../lib/types';
  import { scoreString } from '../lib/format';
  import SetupHint from '../components/SetupHint.svelte';

  interface ContextLike { request<T = unknown>(id: string, p?: unknown, o?: { timeoutMs?: number }): Promise<T>; getService<T>(n: string): T; }
  let { context }: { context: ContextLike } = $props();

  let matches = $state<Match[]>([]);
  let error   = $state<string | null>(null);
  let loading = $state(true);

  const KO: Array<{ stage: Stage; title: string }> = [
    { stage: 'LAST_16', title: 'Round of 16' },
    { stage: 'QUARTER_FINALS', title: 'Quarter-finals' },
    { stage: 'SEMI_FINALS', title: 'Semi-finals' },
    { stage: 'THIRD_PLACE', title: 'Third place' },
    { stage: 'FINAL', title: 'Final' },
  ];
  const columns = $derived(KO.map((c) => ({ ...c, list: matches.filter((m) => m.stage === c.stage) })));

  function label(m: Match): string {
    if (!m.homeTeam?.name || !m.awayTeam?.name) return 'TBD vs TBD';
    return scoreString(m);
  }

  onMount(async () => {
    try { matches = await context.request<Match[]>('getMatches', {}, { timeoutMs: 30_000 }); }
    catch (e) { error = e instanceof Error ? e.message : 'Could not load bracket.'; }
    finally { loading = false; }
  });
</script>

<div class="wc-page">
  <h1>Bracket</h1>
  {#if loading}
    <p class="wc-muted">Loading…</p>
  {:else if error}
    <p class="wc-error">{error}</p>
    <SetupHint />
  {:else if columns.every((c) => c.list.length === 0)}
    <p class="wc-muted">The bracket fills in once the group stage ends.</p>
  {:else}
    <div class="wc-bracket">
      {#each columns as col (col.stage)}
        <div class="wc-col">
          <h2>{col.title}</h2>
          {#each col.list as m (m.id)}
            <div class="wc-tie">{label(m)}</div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wc-page { padding: var(--space-4); color: var(--text-primary); }
  h1 { font-size: var(--font-size-lg); font-weight: 600; margin: 0 0 var(--space-3); }
  h2 { font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin: 0 0 var(--space-2); }
  .wc-bracket { display: flex; gap: var(--space-4); overflow-x: auto; }
  .wc-col { display: flex; flex-direction: column; gap: var(--space-3); min-width: 180px; }
  .wc-tie { padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); background: var(--bg-secondary); font-size: var(--font-size-sm); }
  .wc-muted { color: var(--text-secondary); }
  .wc-error { color: var(--accent-danger); }
</style>
