<script lang="ts">
  // Contextual setup guidance, shown only when a view hits an error — most
  // commonly a missing/blocked API key. Points the user at where to get a key
  // and where to paste it, and explains the free-plan season limit.
</script>

<div class="wc-hint">
  <p class="wc-hint-title">Need an API key?</p>
  <ol class="wc-hint-steps">
    <li>Get a free key at <span class="wc-hint-link">dashboard.api-football.com</span></li>
    <li>Add it in <strong>Settings → Extensions → World Cup → “API-Football API key”</strong></li>
  </ol>
  <p class="wc-hint-note">
    The free plan covers seasons <strong>2022–2024</strong>. Set
    <strong>“Tournament season”</strong> to <strong>2022</strong> to try it now; the
    <strong>2026</strong> tournament needs a paid plan.
  </p>
</div>

<style>
  .wc-hint {
    margin-top: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    max-width: 520px;
  }
  .wc-hint-title { margin: 0 0 var(--space-2); color: var(--text-primary); font-weight: 600; }
  .wc-hint-steps { margin: 0 0 var(--space-2); padding-left: 1.25em; display: flex; flex-direction: column; gap: var(--space-1); }
  .wc-hint-link { color: var(--text-primary); font-weight: 500; }
  .wc-hint-note { margin: 0; font-size: var(--font-size-xs); }
</style>
