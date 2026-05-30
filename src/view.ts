import { mount } from 'svelte';
import { ExtensionContext, registerIconElement } from 'asyar-sdk/view';
import type { IActionService } from 'asyar-sdk/contracts';
import TodayView     from './views/TodayView.svelte';
import ScheduleView  from './views/ScheduleView.svelte';
import StandingsView from './views/StandingsView.svelte';
import BracketView   from './views/BracketView.svelte';
import FollowTeamView from './views/FollowTeamView.svelte';

// On-screen error reporter — surface uncaught errors/rejections in the panel
// itself so failures are visible without devtools (and never freeze silently).
function showFatal(label: string, detail: string): void {
  const el = document.getElementById('app');
  if (!el) return;
  const pre = document.createElement('pre');
  pre.style.cssText =
    'white-space:pre-wrap;word-break:break-word;padding:16px;margin:0;' +
    'color:#ff6b6b;font:12px/1.5 ui-monospace,monospace';
  pre.textContent = `[World Cup ${label}]\n${detail}`; // textContent — no HTML injection
  el.replaceChildren(pre);
}
window.addEventListener('error', (e: ErrorEvent) => {
  showFatal('error', e.error?.stack ?? `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`);
});
window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const r = e.reason;
  showFatal('unhandledrejection', r?.stack ?? String(r));
});

const extensionId = resolveExtensionId();
const context = new ExtensionContext();
context.setExtensionId(extensionId);
registerIconElement();

window.parent.postMessage({ type: 'asyar:extension:loaded', extensionId, role: 'view' }, '*');

const actions = context.getService<IActionService>('actions');
const viewName = new URLSearchParams(window.location.search).get('view') || 'TodayView';
const target = document.getElementById('app')!;
const props = { context, actions, extensionId } as Record<string, unknown>;

const views: Record<string, typeof TodayView> = {
  TodayView, ScheduleView, StandingsView, BracketView, FollowTeamView,
};
mount(views[viewName] ?? TodayView, { target, props });

function resolveExtensionId(): string {
  const fallback = 'org.asyar.worldcup';
  if (window.location.hostname === 'localhost' || window.location.hostname === 'asyar-extension.localhost') {
    return window.location.pathname.split('/').filter(Boolean)[0] || fallback;
  }
  return window.location.hostname || fallback;
}
