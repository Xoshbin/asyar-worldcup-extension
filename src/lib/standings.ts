import type { TableRow } from './types';

export function sortTable(rows: TableRow[]): TableRow[] {
  return [...rows].sort((a, b) =>
    b.points - a.points ||
    b.goalDifference - a.goalDifference ||
    b.goalsFor - a.goalsFor ||
    a.position - b.position,
  );
}

export function groupLabel(group: string | null): string {
  if (!group) return '';
  return group
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
