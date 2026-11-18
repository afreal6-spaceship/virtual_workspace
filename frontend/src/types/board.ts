export type NavigationKind = 'board' | 'menu' | 'list' | 'task' | 'document';

export const NAVIGATION_KINDS: { kind: NavigationKind; label: string; icon: string }[] = [
  { kind: 'board', label: 'Visual board', icon: '▧' },
  { kind: 'menu', label: 'Menu', icon: '☷' },
  { kind: 'list', label: 'List', icon: '☰' },
  { kind: 'task', label: 'Task', icon: '✓' },
  { kind: 'document', label: 'Document', icon: '▤' },
];

export type Board = {
  id: string;
  parent: string | null;
  name: string;
  projectId: string;
  kind?: NavigationKind;
  assignee?: string;
  deadline?: string;
  description?: string;
  documentText?: string;
};

export const navigationKind = (item: Board): NavigationKind => item.kind ?? 'board';
