import { useEffect, useMemo, useRef, useState } from 'react';
import type { AIProject } from '../SidebarDrawer';

interface ProjectSelectorProps {
  projects: AIProject[];
  activeProjectId: string;
  isEditing: boolean;
  editingName: string;
  theme: 'dark' | 'light';
  onEditingNameChange: (value: string) => void;
  onCancelEditing: () => void;
  onSaveName: () => void;
  onSwitchProject: (id: string) => void;
  onCreateProject: () => void;
  onStartRename: () => void;
  onDeleteProject: (id: string) => void;
  onOpenDashboard: () => void;
}

function ProjectStatus({ project }: { project: AIProject }) {
  if (project.isI2vGenerating) return <span className="project-status project-status-video">⚡ 生视频中</span>;
  if (project.isOutfitImgGenerating) return <span className="project-status project-status-outfit">✨ 生穿搭中</span>;
  if (project.i2vStep === 'video_generated') return <span className="project-status project-status-done">✓ 已生视频</span>;
  return null;
}

export function ProjectSelector(props: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const activeProject = props.projects.find(project => project.id === props.activeProjectId);
  const filteredProjects = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return props.projects.filter(project => project.name.toLowerCase().includes(normalized));
  }, [props.projects, query]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const closeAnd = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  if (props.isEditing) {
    return (
      <div className="header-project-selector project-name-editor">
        <input
          value={props.editingName}
          onChange={event => props.onEditingNameChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') props.onSaveName();
            if (event.key === 'Escape') props.onCancelEditing();
          }}
          autoFocus
        />
        <button className="icon-btn-micro project-confirm" onClick={props.onSaveName} title="保存">✓</button>
        <button className="icon-btn-micro project-cancel" onClick={props.onCancelEditing} title="取消">×</button>
      </div>
    );
  }

  return (
    <div className="header-project-selector project-selector" ref={rootRef}>
      <div className="project-selector-popover">
        <button
          className={`project-selector-trigger ${isOpen ? 'open' : ''}`}
          onClick={() => { setIsOpen(open => !open); setQuery(''); }}
          title="点击展开/搜索项目列表"
        >
          <span className="project-folder-icon">▰</span>
          <span className="project-selector-name">{activeProject?.name || '默认项目'}</span>
          <span className={`project-chevron ${isOpen ? 'open' : ''}`}>⌄</span>
        </button>

        {isOpen && (
          <div className="glass-panel project-selector-menu">
            <div className="project-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`在 ${props.projects.length} 个项目中快速搜索...`} autoFocus />{query && <button onClick={() => setQuery('')}>×</button>}</div>
            <div className="project-list">
              {filteredProjects.length === 0 ? (
                <div className="project-empty">未找到与「{query}」相关的项目</div>
              ) : filteredProjects.map(project => {
                const active = project.id === props.activeProjectId;
                return (
                  <button key={project.id} className={`project-list-item ${active ? 'active' : ''}`} onClick={() => closeAnd(() => props.onSwitchProject(project.id))}>
                    <span className="project-list-name"><span>{active ? '✓' : '•'}</span><span title={project.name}>{project.name}</span></span>
                    <ProjectStatus project={project} />
                  </button>
                );
              })}
            </div>
            <div className="project-menu-footer">
              <button onClick={() => closeAnd(props.onCreateProject)}>＋ 新建项目</button>
              <button onClick={() => closeAnd(props.onOpenDashboard)}>▦ 大屏看板 ({props.projects.length})</button>
            </div>
          </div>
        )}
      </div>

      <span className="project-actions-divider" />
      <button className={`project-create-button ${props.theme}`} onClick={props.onCreateProject}>＋ <span>新建项目</span></button>
      <button className="icon-btn-micro project-action" onClick={props.onStartRename} title="重命名项目">✎</button>
      {props.projects.length > 1 && <button className="icon-btn-micro project-action delete" onClick={() => props.onDeleteProject(props.activeProjectId)} title="删除当前项目">♲</button>}
      <button className="icon-btn-micro project-action dashboard" onClick={props.onOpenDashboard} title="项目管理大屏看板">▦</button>
    </div>
  );
}
