import { useEffect, useMemo, useRef, useState } from 'react';
import type { AIProject } from '../SidebarDrawer';

function ProjectIcon({ name }: { name: 'folder' | 'search' | 'plus' | 'dashboard' | 'check' | 'close' | 'spark' | 'video' }) {
  const paths = {
    folder: <><path d="M3 6.5h7l2 2h9v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 9h18" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    spark: <><path d="m12 3 1.4 5.1L18 10l-4.6 1.9L12 17l-1.4-5.1L6 10l4.6-1.9L12 3Z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" /></>,
    video: <><rect x="3" y="5" width="13" height="14" rx="2" /><path d="m16 10 5-3v10l-5-3" /><path d="m8 9 4 3-4 3V9Z" /></>
  };
  return <svg className="project-ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ChevronIcon() {
  return <svg className="project-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

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
  onOpenDashboard: () => void;
}

function ProjectStatus({ project }: { project: AIProject }) {
  if (project.isI2vGenerating) return <span className="project-status project-status-video"><ProjectIcon name="video" /> 生视频中</span>;
  if (project.isOutfitImgGenerating) return <span className="project-status project-status-outfit"><ProjectIcon name="spark" /> 生穿搭中</span>;
  if (project.i2vStep === 'video_generated') return <span className="project-status project-status-done"><ProjectIcon name="check" /> 已生视频</span>;
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
          <span className="project-folder-icon" aria-hidden="true"><ProjectIcon name="folder" /></span>
          <span className="project-selector-name">{activeProject?.name || '默认项目'}</span>
          <span className={`project-chevron ${isOpen ? 'open' : ''}`}><ChevronIcon /></span>
        </button>

        {isOpen && (
          <div className="glass-panel project-selector-menu">
            <div className="project-search"><ProjectIcon name="search" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`在 ${props.projects.length} 个项目中快速搜索...`} autoFocus />{query && <button aria-label="清除搜索" onClick={() => setQuery('')}><ProjectIcon name="close" /></button>}</div>
            <div className="project-list">
              {filteredProjects.length === 0 ? (
                <div className="project-empty">未找到与「{query}」相关的项目</div>
              ) : filteredProjects.map(project => {
                const active = project.id === props.activeProjectId;
                return (
                  <button key={project.id} className={`project-list-item ${active ? 'active' : ''}`} onClick={() => closeAnd(() => props.onSwitchProject(project.id))}>
                    <span className="project-list-name"><span className="project-list-mark"><ProjectIcon name={active ? 'check' : 'folder'} /></span><span title={project.name}>{project.name}</span></span>
                    <ProjectStatus project={project} />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <span className="project-actions-divider" />
      <button className="icon-btn-micro project-action project-action-labeled dashboard" onClick={props.onOpenDashboard} title="打开项目大屏看板"><ProjectIcon name="dashboard" /><span>项目大屏看板</span></button>
    </div>
  );
}
