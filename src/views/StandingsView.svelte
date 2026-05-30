<script lang="ts">
  import { onMount } from 'svelte';
  import type { StandingGroup } from '../lib/types';
  import { sortTable, groupLabel } from '../lib/standings';
  import SetupHint from '../components/SetupHint.svelte';

  interface ContextLike { request<T = unknown>(id: string, p?: unknown, o?: { timeoutMs?: number }): Promise<T>; getService<T>(n: string): T; }
  let { context }: { context: ContextLike } = $props();

  let groups  = $state<StandingGroup[]>([]);
  let error   = $state<string | null>(null);
  let loading = $state(true);

  const totals = $derived(groups.filter((g) => g.type === 'TOTAL'));

  onMount(async () => {
    try { groups = await context.request<StandingGroup[]>('getStandings', {}, { timeoutMs: 30_000 }); }
    catch (e) { error = e instanceof Error ? e.message : 'Could not load standings.'; }
    finally { loading = false; }
  });
</script>

<div class="wc-page">
  <h1>Standings</h1>
  {#if loading}
    <p class="wc-muted">Loading…</p>
  {:else if error}
    <p class="wc-error">{error}</p>
    <SetupHint />
  {:else if totals.length === 0}
    <p class="wc-muted">Group tables appear once the tournament begins.</p>
  {:else}
    {#each totals as g (g.group)}
      <h2>{groupLabel(g.group)}</h2>
      <table class="wc-table">
        <thead><tr><th>#</th><th>Team</th><th>P</th><th>GD</th><th>Pts</th></tr></thead>
        <tbody>
          {#each sortTable(g.table) as r, i (r.team.id)}
            <tr><td>{i + 1}</td><td>{r.team.name}</td><td>{r.playedGames}</td><td>{r.goalDifference}</td><td><strong>{r.points}</strong></td></tr>
          {/each}
        </tbody>
      </table>
    {/each}
  {/if}
</div>

<style>
  .wc-page { padding: var(--space-4); color: var(--text-primary); }
  h1 { font-size: var(--font-size-lg); font-weight: 600; margin: 0 0 var(--space-3); }
  h2 { font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); margin: var(--space-4) 0 var(--space-2); }
  .wc-table { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
  .wc-table th { text-align: left; color: var(--text-secondary); font-weight: 500; padding: var(--space-1) var(--space-2); }
  .wc-table td { padding: var(--space-2); border-top: 1px solid var(--separator); }
  .wc-muted { color: var(--text-secondary); }
  .wc-error { color: var(--accent-danger); }
</style>
