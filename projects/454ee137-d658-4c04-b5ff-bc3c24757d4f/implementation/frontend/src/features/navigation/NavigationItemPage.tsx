import type { Board, NavigationKind } from '../../types/board';
import { navigationKind } from '../../types/board';
import { CreateItemMenu } from './BoardNavigation';

type Props = {
  item: Board;
  items: Board[];
  onUpdate: (id: string, patch: Partial<Pick<Board, 'assignee' | 'deadline' | 'description' | 'documentText'>>) => void;
  onCreate: (parent: string | null, kind: NavigationKind) => void;
  onOpen: (id: string) => void;
  onOpenBoard: (id: string) => void;
};

const icons: Record<NavigationKind, string> = { board: '▧', menu: '☷', list: '☰', task: '✓', document: '▤' };

export default function NavigationItemPage({ item, items, onUpdate, onCreate, onOpen, onOpenBoard }: Props) {
  const children = items.filter((candidate) => candidate.parent === item.id);
  const kind = navigationKind(item);
  return <section className="item-details-page">
    <div className="item-details-heading">
      <div className="item-details-icon" aria-hidden="true">{icons[kind]}</div>
      <div><span className="eyebrow">{kind.toUpperCase()}</span><h1>{item.name}</h1><p>Details and nested workspace items. Changes save automatically on this device.</p></div>
      <div className="item-details-actions">{kind === 'board' && <button className="primary" onClick={() => onOpenBoard(item.id)}>Open board</button>}<CreateItemMenu parent={item.id} onCreate={onCreate} /></div>
    </div>

    <div className="item-fields-grid">
      <label className="item-field"><span>Assigned to</span><input value={item.assignee ?? ''} onChange={(event) => onUpdate(item.id, { assignee: event.target.value })} placeholder="Name or email" /></label>
      <label className="item-field"><span>Deadline</span><input type="date" value={item.deadline ?? ''} onChange={(event) => onUpdate(item.id, { deadline: event.target.value })} /></label>
    </div>
    <label className="item-field item-field-block"><span>Description</span><textarea rows={3} value={item.description ?? ''} onChange={(event) => onUpdate(item.id, { description: event.target.value })} placeholder="Add context, requirements, or notes…" /></label>
    <label className="item-field item-field-block"><span>Document text</span><textarea className="document-editor" value={item.documentText ?? ''} onChange={(event) => onUpdate(item.id, { documentText: event.target.value })} placeholder="Write or paste the document content for this item…" /></label>

    <div className="item-children-section">
      <div className="item-children-heading"><div><span className="eyebrow">NESTED ITEMS</span><h2>Inside {item.name}</h2></div><CreateItemMenu parent={item.id} onCreate={onCreate} /></div>
      {children.length ? <div className="item-child-list">{children.map((child) => <button className="item-child-card" key={child.id} onClick={() => onOpen(child.id)}><span className="item-kind-icon" aria-hidden="true">{icons[navigationKind(child)]}</span><span className="item-child-copy"><strong>{child.name}</strong><small>{navigationKind(child)}{child.assignee ? ` · ${child.assignee}` : ''}{child.deadline ? ` · Due ${child.deadline}` : ''}</small></span><span aria-hidden="true">›</span></button>)}</div> : <div className="item-empty-children">No nested items yet. Add a menu, list, task, document, or board; every child can contain the same kinds of items.</div>}
    </div>
  </section>;
}
