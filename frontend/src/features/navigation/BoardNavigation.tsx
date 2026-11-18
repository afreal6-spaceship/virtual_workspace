import { useMemo } from 'react';
import type { Board, NavigationKind } from '../../types/board';
import { NAVIGATION_KINDS, navigationKind } from '../../types/board';

type Props = {
  boards: Board[];
  active: string;
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  onDetails: (id: string) => void;
  onCreate: (parent: string | null, kind: NavigationKind) => void;
  onRename: (board: Board) => void;
  onDuplicate: (board: Board) => void;
  onDelete: (board: Board) => void;
};

export function CreateItemMenu({ parent, onCreate }: { parent: string | null; onCreate: Props['onCreate'] }) {
  return <details className="item-menu add-item-menu">
    <summary aria-label={parent ? 'Add nested item' : 'Create workspace item'} title="Add item">＋</summary>
    <div className="menu-popover">
      {NAVIGATION_KINDS.map(({ kind, label }) => <button key={kind} onClick={() => onCreate(parent, kind)}>{label}</button>)}
    </div>
  </details>;
}

export default function BoardNavigation({ boards, active, query, onQueryChange, onSelect, onDetails, onCreate, onRename, onDuplicate, onDelete }: Props) {
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    const byId = new Map(boards.map((item) => [item.id, item]));
    return boards.filter((item) => item.name.toLowerCase().includes(needle)).map((item) => {
      const parts = [item.name]; let parent = item.parent; let guard = 0;
      while (parent && guard++ < 50) { const ancestor = byId.get(parent); if (!ancestor) break; parts.unshift(ancestor.name); parent = ancestor.parent; }
      return { ...item, path: parts.join(' / ') };
    });
  }, [boards, query]);

  function renderTree(parent: string | null, path = new Set<string>(), depth = 0) {
    if (depth >= 50) return null;
    return boards.filter((item) => item.parent === parent && !path.has(item.id)).map((item) => {
      const nextPath = new Set(path).add(item.id);
      const kind = navigationKind(item);
      const icon = NAVIGATION_KINDS.find((entry) => entry.kind === kind)?.icon ?? '▧';
      return <div className="branch" key={item.id}>
        <div className="navrow">
          <button className={`nav-item ${active === item.id ? 'active' : ''}`} title={`${item.name} · ${kind}`} onClick={() => onSelect(item.id)}><span className="item-kind-icon" aria-hidden="true">{icon}</span><span className="nav-item-name">{item.name}</span></button>
          <CreateItemMenu parent={item.id} onCreate={onCreate} />
          <details className="item-menu"><summary aria-label={`Actions for ${item.name}`} title="Item actions">···</summary><div className="menu-popover">
            <button onClick={() => onDetails(item.id)}>Edit details</button><button onClick={() => onRename(item)}>Rename</button><button onClick={() => onDuplicate(item)}>Duplicate</button><button onClick={() => onDelete(item)}>Delete</button>
          </div></details>
        </div>
        {renderTree(item.id, nextPath, depth + 1)}
      </div>;
    });
  }

  return <>
    <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search workspace items" aria-label="Search workspace items" />{query && <button onClick={() => onQueryChange('')} aria-label="Clear search">×</button>}</label>
    <nav className="board-tree" aria-label="Workspace navigation">{query.trim() ? matches.map((item) => <button key={item.id} className={`search-result ${active === item.id ? 'active' : ''}`} onClick={() => onSelect(item.id)}><span>{NAVIGATION_KINDS.find((entry) => entry.kind === navigationKind(item))?.icon}</span><span>{item.path}</span></button>) : renderTree(null)}</nav>
  </>;
}
