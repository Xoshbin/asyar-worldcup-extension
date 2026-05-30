<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { ExtensionStateProxy } from 'asyar-sdk/contracts';
  import type { Match } from '../lib/types';
  import { matchesOn, isLive, sortByStage } from '../lib/schedule';
  import { scoreString, statusLabel, kickoffLabel } from '../lib/format';
  import SetupHint from '../components/SetupHint.svelte';

  interface ContextLike {
    request<T = unknown>(id: string, payload?: unknown, opts?: { timeoutMs?: number }): Promise<T>;
    getService<T>(namespace: string): T;
  }
  let { context }: { context: ContextLike } = $props();

  let stateService: ExtensionStateProxy;

  let matches = $state<Match[]>([]);
  let error   = $state<string | null>(null);
  let loading = $state(true);
  let tz      = $state('');

  const today = $derived(sortByStage(matchesOn(matches, new Date())));
  const disposers: Array<() => Promise<void>> = [];

  onMount(async () => {
    stateService = context.getService<ExtensionStateProxy>('state');
    disposers.push(await stateService.subscribe('matches', (v) => {
      if (Array.isArray(v)) matches = v as Match[];
    }));
    try { tz = await context.request<string>('getTimezone', {}, { timeoutMs: 10_000 }); } catch { /* keep system default */ }
    try {
      const r = await context.request<{ matches: Match[] }>('refresh', {}, { timeoutMs: 30_000 });
      matches = r.matches;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load matches.';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => { void Promise.all(disposers.map((d) => d())); });
</script>

<div class="wc-page">
  <h1>Today</h1>
  {#if loading}
    <p class="wc-muted">Loading…</p>
  {:else if error}
    <p class="wc-error">{error}</p>
    <SetupHint />
  {:else if today.length === 0}
    <p class="wc-muted">No World Cup matches today.</p>
  {:else}
    <ul class="wc-list">
      {#each today as m (m.id)}
        <li class="wc-row" class:live={isLive(m)}>
          <span class="wc-score">{scoreString(m)}</span>
          <span class="wc-meta">{isLive(m) ? statusLabel(m.status) : kickoffLabel(m.utcDate, tz)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wc-page { padding: var(--space-4); color: var(--text-primary); }
  h1 { font-size: var(--font-size-lg); font-weight: 600; margin: 0 0 var(--space-3); }
  .wc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
  .wc-row { display: flex; justify-content: space-between; align-items: center; padding: var(--space-2) var(--space-3); border-radius: var(--radius-lg); background: var(--bg-secondary); }
  .wc-row.live { box-shadow: inset 0 0 0 1px var(--accent-success); }
  .wc-meta { color: var(--text-secondary); font-size: var(--font-size-xs); }
  .wc-muted { color: var(--text-secondary); }
  .wc-error { color: var(--accent-danger); }
</style>
