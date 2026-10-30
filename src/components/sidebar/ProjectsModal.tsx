import React, { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AIProject } from '../SidebarDrawer';
import { importProjectPackage } from '../../utils/projectPackageExporter';
import type { KeyVideoProjectPackage } from '../../utils/projectPackageExporter';
import { toast } from '../toastStore';

type ProjectFilter = 'all' | 'draft' | 'generating' | 'ready' | 'complete';
type ProjectSort = 'recent' | 'progress' | 'name';
type WorkspaceTarget = 'editor' | 'timeline' | 'ai';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: AIProject[];
  activeProjectId: string;
  createNewProject: () => void;
  onCreateNamedProject?: (name: string) => void;
  switchProject: (id: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<AIProject[]>>;
  deleteProject: (id: string) => void;
  onExportPackage?: () => void;
  onImportPackage?: (pkg: KeyVideoProjectPackage) => void;
  onOpenWorkspace?: (target: WorkspaceTarget) => void;
}

interface ProjectStatus {
  key: Exclude<ProjectFilter, 'all'>;
  label: string;
  detail: string;
  color: string;
}

const Icon: React.FC<{ name: string; size?: number }> = ({ name, size = 18 }) => {
  const paths: Record<string, React.ReactNode> = {
    folder: <><path d="M3 6.5h6l2 2h10v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 8.5h18" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.5 4.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    import: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" /></>,
    export: <><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M4 20h16" /></>,
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5z" /><path d="m13.8 6.7 3.5 3.5" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6.5 7 7.5 20h9L17.5 7M9 7V4h6v3" /></>,
    play: <path d="m8 5 11 7-11 7z" />,
    timeline: <><path d="M4 6h16M4 12h10M4 18h16" /><path d="M8 3v18" /></>,
    spark: <><path d="m12 3 1.2 5.8L19 10l-5.8 1.2L12 17l-1.2-5.8L5 10l5.8-1.2z" /><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    filter: <><path d="M4 6h16M7 12h10M10 18h4" /></>,
    sort: <><path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3" /></>,
    film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
    chart: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };
  return <svg className="project-dashboard-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
};
const getStatus = (project: AIProject): ProjectStatus => {
  if (project.isI2vGenerating || project.isStoryboardGenerating || project.isOutfitImgGenerating) {
    const detail = project.isI2vGenerating ? '视频生成中' : project.isStoryboardGenerating ? '分镜生成中' : '模特图生成中';
    return { key: 'generating', label: '生成中', detail, color: '#67e8f9' };
  }
  if (project.i2vStep === 'video_generated') return { key: 'complete', label: '已完成', detail: '成片已生成', color: '#6ee7b7' };
  if (project.i2vStep === 'storyboard_generated' || project.storyboards.length > 0) return { key: 'ready', label: '可继续', detail: '已有分镜素材', color: '#c4b5fd' };
  return { key: 'draft', label: '未开始', detail: '等待创作', color: '#a5b4fc' };
};

const getProgress = (project: AIProject): number => {
  if (project.i2vStep === 'video_generated') return 100;
  const shots = project.storyboards || [];
  if (shots.length === 0) return project.modelOutfitImgUrl ? 18 : 0;
  const average = shots.reduce((sum, shot) => sum + Math.max(0, Math.min(100, shot.progress || 0)), 0) / shots.length;
  return Math.round(Math.max(20, average * 0.85));
};

const formatDate = (value?: string) => {
  if (!value) return '暂无记录';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '暂无记录';
  return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
};

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  createNewProject,
  onCreateNamedProject,
  switchProject,
  setProjects,
  deleteProject,
  onExportPackage,
  onImportPackage,
  onOpenWorkspace
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [sort, setSort] = useState<ProjectSort>('recent');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const stats = useMemo(() => ({
    total: projects.length,
    generating: projects.filter(project => getStatus(project).key === 'generating').length,
    completed: projects.filter(project => getStatus(project).key === 'complete').length,
    shots: projects.reduce((sum, project) => sum + project.storyboards.length, 0)
  }), [projects]);

  const visibleProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return projects
      .filter(project => {
        const matchesQuery = !normalized || project.name.toLowerCase().includes(normalized);
        const matchesFilter = filter === 'all' || getStatus(project).key === filter;
        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => {
        if (sort === 'name') return a.name.localeCompare(b.name, 'zh-CN');
        if (sort === 'progress') return getProgress(b) - getProgress(a);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filter, projects, query, sort]);

  if (!isOpen) return null;

  const openWorkspace = (projectId: string, target: WorkspaceTarget) => {
    switchProject(projectId);
    setOpenMenu(null);
    onClose();
    onOpenWorkspace?.(target);
  };

  const renameProject = (project: AIProject) => {
    const nextName = window.prompt('修改项目名称：', project.name);
    if (nextName && nextName.trim() && nextName.trim() !== project.name) {
      setProjects(previous => previous.map(item => item.id === project.id ? { ...item, name: nextName.trim() } : item));
      toast.success('项目名称已更新');
    }
  };

  const beginCreateProject = () => {
    setNewProjectName(`项目_${projects.length + 1}`);
    setIsCreatingProject(true);
  };

  const cancelCreateProject = () => {
    setIsCreatingProject(false);
    setNewProjectName('');
  };

  const confirmCreateProject = () => {
    const name = newProjectName.trim();
    if (!name) {
      toast.warning('请输入项目名称');
      return;
    }
    if (onCreateNamedProject) {
      onCreateNamedProject(name);
    } else {
      createNewProject();
    }
    cancelCreateProject();
    toast.success(`项目「${name}」已创建，当前仍停留在项目大屏看板`);
  };

  return createPortal(
    <div className="project-dashboard-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="project-dashboard" role="dialog" aria-modal="true" aria-labelledby="project-dashboard-title">
        <header className="project-dashboard-header">
          <div className="project-dashboard-heading">
            <div className="project-dashboard-title-icon"><Icon name="folder" size={25} /></div>
            <div><h2 id="project-dashboard-title">项目大屏看板</h2><p>集中管理项目进度、素材和创作入口</p></div>
          </div>
          <button type="button" className="project-dashboard-close" onClick={onClose} aria-label="关闭项目管理"><Icon name="close" size={22} /></button>
        </header>

        <div className="project-dashboard-stats" aria-label="项目统计">
          <div className="project-stat-card"><span className="project-stat-icon purple"><Icon name="folder" /></span><span><b>{stats.total}</b><small>全部项目</small></span></div>
          <div className="project-stat-card"><span className="project-stat-icon cyan"><Icon name="spark" /></span><span><b>{stats.generating}</b><small>生成任务</small></span></div>
          <div className="project-stat-card"><span className="project-stat-icon green"><Icon name="check" /></span><span><b>{stats.completed}</b><small>已完成成片</small></span></div>
          <div className="project-stat-card"><span className="project-stat-icon orange"><Icon name="film" /></span><span><b>{stats.shots}</b><small>分镜素材</small></span></div>
        </div>

        <div className="project-dashboard-toolbar">
          <label className="project-dashboard-search"><Icon name="search" size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索项目名称" aria-label="搜索项目名称" />{query && <button type="button" onClick={() => setQuery('')} aria-label="清除搜索"><Icon name="close" size={16} /></button>}</label>
          <div className="project-dashboard-filters" role="group" aria-label="项目状态筛选">
            {([['all', '全部'], ['draft', '未开始'], ['generating', '生成中'], ['ready', '可继续'], ['complete', '已完成']] as [ProjectFilter, string][]).map(([key, label]) => <button type="button" key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}{key !== 'all' && <em>{projects.filter(project => getStatus(project).key === key).length}</em>}</button>)}
          </div>
          <label className="project-dashboard-sort"><Icon name="sort" size={17} /><select value={sort} onChange={event => setSort(event.target.value as ProjectSort)} aria-label="项目排序"><option value="recent">最近创建</option><option value="progress">创作进度</option><option value="name">项目名称</option></select></label>
        </div>

        <div className="project-dashboard-actions">
          <span className="project-dashboard-result">显示 <b>{visibleProjects.length}</b> / {projects.length} 个项目</span>
          <div>
            <input type="file" ref={fileInputRef} accept=".json,.keyvideo.json" hidden onChange={async event => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                const pkg = await importProjectPackage(file);
                if (onImportPackage) {
                  onImportPackage(pkg);
                } else {
                  toast.success(`已读取工程包：${pkg.project.name}`);
                }
              } catch (error) {
                toast.error(`导入失败：${error instanceof Error ? error.message : String(error)}`);
              }
              event.target.value = '';
            }} />
            <button type="button" className="project-dashboard-secondary" onClick={() => fileInputRef.current?.click()}><Icon name="import" />导入工程包</button>
            {onExportPackage && <button type="button" className="project-dashboard-secondary" onClick={onExportPackage}><Icon name="export" />导出当前工程</button>}
            {isCreatingProject ? (
              <div className="project-dashboard-create-form" role="group" aria-label="新建项目">
                <Icon name="plus" size={18} />
                <input
                  value={newProjectName}
                  onChange={event => setNewProjectName(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') confirmCreateProject(); if (event.key === 'Escape') cancelCreateProject(); }}
                  placeholder="输入项目名称"
                  aria-label="项目名称"
                  autoFocus
                />
                <button type="button" className="project-dashboard-create-confirm" onClick={confirmCreateProject}>确认</button>
                <button type="button" className="project-dashboard-create-cancel" onClick={cancelCreateProject}>取消</button>
              </div>
            ) : (
              <button type="button" className="project-dashboard-primary" onClick={beginCreateProject}><Icon name="plus" />新建创作项目</button>
            )}
          </div>
        </div>

        <div className="project-dashboard-list" onMouseLeave={() => setOpenMenu(null)}>
          {visibleProjects.length === 0 ? (
            <div className="project-dashboard-empty"><span><Icon name={query || filter !== 'all' ? 'search' : 'folder'} size={28} /></span><strong>{query || filter !== 'all' ? '没有找到匹配项目' : '还没有创作项目'}</strong><p>{query || filter !== 'all' ? '试试修改搜索词或切换筛选条件' : '创建一个项目，开始你的第一条 AI 视频'}</p>{(query || filter !== 'all') ? <button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>清除筛选</button> : <button type="button" onClick={beginCreateProject}>创建第一个项目</button>}</div>
          ) : visibleProjects.map(project => {
            const status = getStatus(project);
            const progress = getProgress(project);
            const doneShots = project.storyboards.filter(shot => shot.progress >= 100).length;
            const isCurrent = project.id === activeProjectId;
            return (
              <article className={`project-dashboard-card ${isCurrent ? 'current' : ''} ${openMenu === project.id ? 'menu-open' : ''}`} key={project.id}>
                <div className="project-card-main">
                  <div className="project-card-mark"><Icon name={status.key === 'complete' ? 'check' : status.key === 'generating' ? 'spark' : 'folder'} size={21} /></div>
                  <div className="project-card-info"><div className="project-card-name"><h3>{project.name}</h3>{isCurrent && <span className="project-current-badge">当前项目</span>}</div><p>创建于 {formatDate(project.createdAt)}</p><div className="project-card-meta"><span><Icon name="film" size={14} />{project.storyboards.length} 个分镜</span><span><Icon name="chart" size={14} />{doneShots}/{project.storyboards.length || 0} 已完成</span><span className={`project-status-dot ${status.key}`}><i />{status.detail}</span></div></div>
                </div>
                <div className="project-card-progress"><div className="project-progress-label"><span>创作进度</span><b>{progress}%</b></div><div className="project-progress-track"><i style={{ width: `${progress}%` }} /></div></div>
                <div className="project-card-actions"><button type="button" className="project-card-open" onClick={() => openWorkspace(project.id, 'editor')}><Icon name="play" size={15} />继续编辑</button><button type="button" className="project-card-icon-action" onClick={() => openWorkspace(project.id, 'timeline')} title="打开时间轴"><Icon name="timeline" size={17} /><span>时间轴</span></button><button type="button" className="project-card-icon-action ai" onClick={() => openWorkspace(project.id, 'ai')} title="打开 AI 创作"><Icon name="spark" size={17} /><span>AI 创作</span></button><div className="project-card-menu-wrap"><button type="button" className="project-card-more" onClick={() => setOpenMenu(openMenu === project.id ? null : project.id)} aria-label="更多项目操作"><Icon name="more" /></button>{openMenu === project.id && <div className="project-card-menu"><button type="button" onClick={() => renameProject(project)}><Icon name="edit" />重命名</button>{projects.length > 1 && <button type="button" className="danger" onClick={() => { setOpenMenu(null); deleteProject(project.id); }}><Icon name="trash" />删除项目</button>}</div>}</div></div>
              </article>
            );
          })}
        </div>

        <footer className="project-dashboard-footer"><span><Icon name="check" size={16} />项目数据自动保存在本地，可随时导出工程包</span><button type="button" onClick={onClose}>完成</button></footer>
      </section>
    </div>,
    document.body
  );
};
