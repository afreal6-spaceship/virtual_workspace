import type { CSSProperties } from 'react';
import type { Board } from '../../types/board';
import { navigationKind } from '../../types/board';
import type { Project } from '../../types/project';

function DeleteButton({ name, onClick }: { name: string; onClick: () => void }) {
  return <button type="button" className="delete-item-button" title={`Delete ${name}`} aria-label={`Delete ${name}`} onClick={onClick}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg></button>;
}

type Props = {
  projects: Project[];
  boards: Board[];
  projectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onCreateBoard: (projectId: string) => void;
  onOpenBoard: (id: string) => void;
  onDeleteProject: (project: Project) => void;
  onDeleteBoard: (board: Board) => void;
  onRenameProject: (project: Project) => void;
};

export default function ProjectsPage({ projects, boards, projectId, onSelectProject, onCreateProject, onCreateBoard, onOpenBoard, onRenameProject, onDeleteProject, onDeleteBoard }: Props) {
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;
  const projectItems = selectedProject ? boards.filter((board) => board.projectId === selectedProject.id) : [];
  const projectBoards = projectItems.filter((item) => navigationKind(item) === 'board');
  const rootItems = projectItems.filter((item) => !item.parent);
  const recentBoards = [...boards].reverse().slice(0, 6);

  if (selectedProject) return <div className="projects-page project-detail-page">
    <button className="back-link" onClick={() => onSelectProject('')}>← All projects</button>
    <div className="project-page-heading">
      <div className="project-heading-icon" style={{ '--project-color': selectedProject.color } as CSSProperties & { '--project-color': string }}>▧</div>
      <div className="project-heading-copy"><span className="eyebrow">PROJECT OVERVIEW</span><h1>{selectedProject.name}</h1><p>{selectedProject.description || 'Boards and work for this project.'}</p></div>
      <div className="project-heading-actions"><DeleteButton name={selectedProject.name} onClick={() => onDeleteProject(selectedProject)} /><button onClick={() => onRenameProject(selectedProject)}>Edit project</button><button className="primary" onClick={() => onCreateBoard(selectedProject.id)}>＋ New board</button></div>
    </div>
    <div className="project-stats"><div><strong>{projectBoards.length}</strong><span>Visual boards</span></div><div><strong>{rootItems.length}</strong><span>Top-level items</span></div><div><strong>Local</strong><span>Storage</span></div></div>
    <div className="page-section-heading"><div><span className="eyebrow">PROJECT CONTENT</span><h2>Workspace items</h2></div></div>
    {rootItems.length ? <div className="board-card-grid">{rootItems.map((board) => {
      const nestedCount = projectItems.filter((item) => item.parent === board.id).length;
      const itemKind = navigationKind(board);
      const icon = itemKind === 'menu' ? '☷' : itemKind === 'list' ? '☰' : itemKind === 'task' ? '✓' : itemKind === 'document' ? '▤' : '▧';
      return <div className="deletable-card" key={board.id}><button className="project-board-card" onClick={() => onOpenBoard(board.id)}><span className="board-card-icon">{icon}</span><strong>{board.name}</strong><span>{itemKind === 'board' ? `${nestedCount ? `${nestedCount} nested item${nestedCount === 1 ? '' : 's'}` : 'Visual board'}` : `${itemKind}${nestedCount ? ` · ${nestedCount} nested item${nestedCount === 1 ? '' : 's'}` : ''}`}</span><span className="board-card-arrow">↗</span></button><DeleteButton name={board.name} onClick={() => onDeleteBoard(board)} /></div>;
    })}<button className="project-board-card add-board-card" onClick={() => onCreateBoard(selectedProject.id)}><span className="add-board-plus">＋</span><strong>Create a board</strong><span>Start a new canvas</span></button></div> : <div className="empty-project"><div className="empty-project-icon">▧</div><h3>This project is ready for its first board</h3><p>Create a canvas to map ideas, workflows, and system designs.</p><button className="primary" onClick={() => onCreateBoard(selectedProject.id)}>＋ Create board</button></div>}
  </div>;

  return <div className="projects-page dashboard-page">
    <div className="dashboard-welcome"><div><span className="eyebrow">WORKSPACE</span><h1>Good to see you</h1><p>Choose a project to continue, or create a new workspace for your work.</p></div><button className="primary" onClick={onCreateProject}>＋ New project</button></div>
    <div className="dashboard-metrics"><div><strong>{projects.length}</strong><span>Projects</span></div><div><strong>{boards.filter((item) => navigationKind(item) === 'board').length}</strong><span>Visual boards</span></div><div><strong>On this device</strong><span>Workspace storage</span></div></div>
    <div className="page-section-heading"><div><span className="eyebrow">YOUR WORK</span><h2>Projects</h2></div><button className="subtle-button" onClick={onCreateProject}>Create project <span>＋</span></button></div>
    <div className="project-card-grid">{projects.map((project) => {
      const count = boards.filter((board) => board.projectId === project.id && navigationKind(board) === 'board').length;
      const previews = boards.filter((board) => board.projectId === project.id && !board.parent).slice(0, 3);
      return <div className="deletable-card" key={project.id}><button className="project-card" onClick={() => onSelectProject(project.id)}>
        <span className="project-card-top"><span className="project-card-icon" style={{ '--project-color': project.color } as CSSProperties & { '--project-color': string }}>▧</span><span className="project-arrow">↗</span></span>
        <strong>{project.name}</strong><span className="project-description">{project.description || 'A space for project boards and plans.'}</span>
        <span className="project-card-footer"><span>{count} board{count === 1 ? '' : 's'}</span><span className="project-preview-names">{previews.map((board) => board.name).join(' · ') || 'No boards yet'}</span></span>
      </button><DeleteButton name={project.name} onClick={() => onDeleteProject(project)} /></div>;
    })}<button className="project-card create-project-card" onClick={onCreateProject}><span className="create-project-plus">＋</span><strong>New project</strong><span className="project-description">Organize boards around a goal or team.</span></button></div>
    <div className="page-section-heading recent-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recent items</h2></div></div>
    {recentBoards.length ? <div className="recent-board-list">{recentBoards.map((board) => <div className="recent-item-row" key={board.id}><button onClick={() => onOpenBoard(board.id)}><span className="recent-board-icon">▧</span><span className="recent-board-copy"><strong>{board.name}</strong><small>{projects.find((project) => project.id === board.projectId)?.name ?? 'Project'}</small></span><span className="recent-board-arrow">↗</span></button><DeleteButton name={board.name} onClick={() => onDeleteBoard(board)} /></div>)}</div> : <div className="empty-recent">Your boards will show here as you create them.</div>}
  </div>;
}
