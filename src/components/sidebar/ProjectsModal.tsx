import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import type { AIProject } from '../SidebarDrawer';
import { importProjectPackage } from '../../utils/projectPackageExporter';
import type { KeyVideoProjectPackage } from '../../utils/projectPackageExporter';
import { toast } from '../toastStore';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: AIProject[];
  activeProjectId: string;
  createNewProject: () => void;
  switchProject: (id: string) => void;
  setProjects: React.Dispatch<React.SetStateAction<AIProject[]>>;
  deleteProject: (id: string) => void;
  onExportPackage?: () => void;
  onImportPackage?: (pkg: KeyVideoProjectPackage) => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  createNewProject,
  switchProject,
  setProjects,
  deleteProject,
  onExportPackage,
  onImportPackage
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(9, 10, 15, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div
        style={{
          width: '680px',
          background: 'rgba(20, 21, 31, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(138, 43, 226, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          color: '#ffffff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '14px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📁 AI 创作项目管理看板
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', transition: 'color 0.2s' }}
            onMouseOver={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseOut={(e) => (e.currentTarget.style.color = '#9ca3af')}
          >
            ×
          </button>
        </div>

        {/* Top Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            您当前共有 <strong style={{ color: 'var(--accent-purple)' }}>{projects.length}</strong> 个创作项目，支持在后台并行执行生成。
          </span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.keyvideo.json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const pkg = await importProjectPackage(file);
                  if (onImportPackage) {
                    onImportPackage(pkg);
                  } else {
                    toast.success(`成功读取工程包: ${pkg.project.name}`);
                  }
                } catch (err) {
                  toast.error(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
                }
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', margin: 0 }}
              title="导入 .keyvideo.json 工程包"
            >
              📥 导入工程包
            </button>
            {onExportPackage && (
              <button
                type="button"
                className="btn-secondary"
                onClick={onExportPackage}
                style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', margin: 0 }}
                title="导出当前工程为 .keyvideo.json"
              >
                📦 导出当前工程
              </button>
            )}
            <button
              className="btn-primary"
              onClick={createNewProject}
              style={{
                padding: '6px 16px',
                fontSize: '12px',
                borderRadius: '6px',
                margin: 0,
                background: 'var(--accent-purple)',
                borderColor: 'var(--accent-purple)'
              }}
            >
              ➕ 新建创作项目
            </button>
          </div>
        </div>

        {/* Projects Table List */}
        <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', background: 'rgba(0,0,0,0.2)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>项目名称</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>创建时间</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600' }}>当前状态</th>
                <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => {
                const isCurrent = p.id === activeProjectId;
                let statusColor = 'var(--text-muted)';
                let statusBg = 'rgba(255,255,255,0.05)';
                let statusDesc = '未开始';

                if (p.isI2vGenerating) {
                  statusColor = 'var(--accent-cyan)';
                  statusBg = 'rgba(0, 242, 254, 0.1)';
                  const completed = p.storyboards.filter(s => s.progress === 100).length;
                  statusDesc = `生成视频中 (${completed}/${p.storyboards.length || 5})`;
                } else if (p.isStoryboardGenerating) {
                  statusColor = 'var(--accent-purple)';
                  statusBg = 'rgba(138, 43, 226, 0.1)';
                  statusDesc = '生成分镜图中...';
                } else if (p.isOutfitImgGenerating) {
                  statusColor = 'var(--accent-purple)';
                  statusBg = 'rgba(138, 43, 226, 0.1)';
                  statusDesc = '渲染穿搭图中...';
                } else if (p.i2vStep === 'video_generated') {
                  statusColor = '#4caf50';
                  statusBg = 'rgba(76, 175, 80, 0.1)';
                  statusDesc = '已生成视频';
                } else if (p.i2vStep === 'storyboard_generated') {
                  statusColor = 'var(--accent-purple)';
                  statusBg = 'rgba(138, 43, 226, 0.1)';
                  statusDesc = '已生成分镜图';
                }

                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isCurrent ? 'rgba(138, 43, 226, 0.04)' : 'transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    {/* Name */}
                    <td style={{ padding: '12px 16px', fontWeight: isCurrent ? '600' : 'normal' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.name}
                        {isCurrent && <span style={{ fontSize: '10px', color: '#4caf50', background: 'rgba(76,175,80,0.15)', padding: '2px 6px', borderRadius: '4px' }}>当前</span>}
                      </span>
                    </td>
                    {/* Created At */}
                    <td style={{ padding: '12px 16px', color: '#9ca3af' }}>
                      {p.createdAt ? new Date(p.createdAt).toLocaleString('zh-CN', { hour12: false }) : '-'}
                    </td>
                    {/* Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: statusColor, background: statusBg, padding: '3px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', display: 'inline-block' }}>
                        {statusDesc}
                      </span>
                    </td>
                    {/* Actions */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {!isCurrent && (
                          <button
                            className="btn-primary"
                            onClick={() => {
                              switchProject(p.id);
                            }}
                            style={{ padding: '4px 10px', fontSize: '10px', margin: 0, background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}
                          >
                            切换进入
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            const newName = prompt('修改项目名称：', p.name);
                            if (newName && newName.trim()) {
                              setProjects(prev => prev.map(proj => proj.id === p.id ? { ...proj, name: newName.trim() } : proj));
                            }
                          }}
                          style={{ padding: '4px 8px', fontSize: '10px', margin: 0 }}
                        >
                          重命名
                        </button>
                        {projects.length > 1 && (
                          <button
                            className="btn-secondary"
                            onClick={() => deleteProject(p.id)}
                            style={{ padding: '4px 8px', fontSize: '10px', margin: 0, color: 'var(--accent-red)' }}
                          >
                            删除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
          <button
            className="btn-primary"
            onClick={onClose}
            style={{ padding: '8px 24px', fontSize: '12px', cursor: 'pointer', margin: 0 }}
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
