<script lang="ts">
  import { onMount } from 'svelte';
  import type { Team, FollowedTeam } from '../lib/types';
  import SetupHint from '../components/SetupHint.svelte';

  interface ContextLike { request<T = unknown>(id: string, p?: unknown, o?: { timeoutMs?: number }): Promise<T>; getService<T>(n: string): T; }
  let { context }: { context: ContextLike } = $props();

  let teams    = $state<Team[]>([]);
  let followed = $state<FollowedTeam | null>(null);
  let error    = $state<string | null>(null);
  let loading  = $state(true);
  let query    = $state('');

  const shown = $derived(
    teams
      .filter((t) => (t.name ?? '').toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
  );

  async function follow(t: Team) {
    if (t.id == null || t.name == null) return; // skip placeholder/undetermined teams
    const ft: FollowedTeam = { id: t.id, name: t.name, tla: t.tla };
    try { await context.request('setFollowedTeam', ft); followed = ft; }
    catch (e) { error = e instanceof Error ? e.message : 'Could not save team.'; }
  }
  async function clear() {
    try { await context.request('setFollowedTeam', null); followed = null; }
    catch (e) { error = e instanceof Error ? e.message : 'Could not clear team.'; }
  }

  onMount(async () => {
    try {
      [teams, followed] = await Promise.all([
        context.request<Team[]>('getTeams', {}, { timeoutMs: 30_000 }),
        context.request<FollowedTeam | null>('getFollowedTeam', {}, { timeoutMs: 10_000 }),
      ]);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load teams.';
    } finally {
      loading = false;
    }
  });
</script>

<div class="wc-page">
  <h1>Follow a Team</h1>
  {#if followed}
    <p class="wc-following">Following <strong>{followed.name}</strong>
      <button class="wc-clear" onclick={clear}>Clear</button>
    </p>
  {/if}
  {#if loading}
    <p class="wc-muted">Loading teams…</p>
  {:else if error}
    <p class="wc-error">{error}</p>
    <SetupHint />
  {:else}
    <input class="wc-filter" placeholder="Search teams…" bind:value={query} />
    <ul class="wc-list">
      {#each shown as t (t.id)}
        <li>
          <button class="wc-team" class:active={followed?.id === t.id} onclick={() => follow(t)}>
            {t.name}{#if t.tla}<span class="wc-tla">{t.tla}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .wc-page { padding: var(--space-4); color: var(--text-primary); }
  h1 { font-size: var(--font-size-lg); font-weight: 600; margin: 0 0 var(--space-3); }
  .wc-following { color: var(--text-secondary); display: flex; align-items: center; gap: var(--space-2); }
  .wc-clear { background: none; border: 1px solid var(--border-color); color: inherit; border-radius: var(--radius-sm); padding: var(--space-1) var(--space-2); cursor: pointer; font: inherit; font-size: var(--font-size-xs); transition: var(--transition-normal); }
  .wc-clear:hover { background: var(--bg-hover); }
  .wc-filter { width: 100%; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); border: 1px solid var(--border-color); background: var(--bg-tertiary); color: inherit; margin: var(--space-2) 0; font: inherit; }
  .wc-filter:focus { outline: none; box-shadow: var(--shadow-focus); }
  .wc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
  .wc-team { width: 100%; text-align: left; display: flex; justify-content: space-between; padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); border: none; background: var(--bg-secondary); color: inherit; cursor: pointer; font: inherit; transition: var(--transition-normal); }
  .wc-team:hover { background: var(--bg-hover); }
  .wc-team.active { box-shadow: inset 0 0 0 1px var(--accent-success); }
  .wc-tla { color: var(--text-secondary); font-size: var(--font-size-xs); }
  .wc-muted { color: var(--text-secondary); }
  .wc-error { color: var(--accent-danger); }
</style>
