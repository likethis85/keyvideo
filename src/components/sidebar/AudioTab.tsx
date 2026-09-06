import React from 'react';

export interface BgmItem {
  id: string;
  name: string;
  desc?: string;
  src: string;
}

interface AudioTabProps {
  isTauri: boolean;
  handleImportLocalAudio: () => void;
  handleBgmUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bgmLibrary: BgmItem[];
  selectBgm: (src: string, name: string) => void;
  togglePreviewAudio: (e: React.MouseEvent, src: string) => void;
  previewAudioSrc: string | null;
  handleBgmDelete: (e: React.MouseEvent, id: string) => void;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  isTauri,
  handleImportLocalAudio,
  handleBgmUpload,
  bgmLibrary,
  selectBgm,
  togglePreviewAudio,
  previewAudioSrc,
  handleBgmDelete
}) => {
  return (
    <>
      <div className="drawer-header">
        <div className="drawer-title">背景音乐与配音</div>
        <div className="drawer-subtitle">为视频匹配节奏感，添加真实人声配音</div>
      </div>
      <div className="drawer-content">
        <div className="property-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="property-label" style={{ margin: 0 }}>🎵 背景音乐库 (BGM)</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {isTauri && (
                <button
                  className="btn-primary"
                  onClick={handleImportLocalAudio}
                  style={{
                    padding: '3px 8px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    margin: 0,
                    borderRadius: '4px',
                    height: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: 'var(--accent-cyan)',
                    borderColor: 'var(--accent-cyan)'
                  }}
                >
                  导入本地音频
                </button>
              )}
              <label
                className="btn-primary"
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  margin: 0,
                  borderRadius: '4px',
                  height: 'auto',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                上传音乐
                <input type="file" accept="audio/*" onChange={handleBgmUpload} style={{ display: 'none' }} />
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '480px', overflowY: 'auto' }}>
            {bgmLibrary.map(bgm => (
              <div
                key={bgm.id}
                className="music-item"
                onClick={() => selectBgm(bgm.src, bgm.name)}
                title="点击设置为背景音乐"
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingRight: '60px',
                  position: 'relative'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="music-name">{bgm.name}</div>
                  <div className="music-meta">{bgm.desc || '自定义上传音乐'}</div>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    right: '35px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <button
                    onClick={(e) => togglePreviewAudio(e, bgm.src)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '4px'
                    }}
                    title={previewAudioSrc === bgm.src ? '暂停试听' : '点击试听'}
                  >
                    {previewAudioSrc === bgm.src ? '⏸️' : '▶️'}
                  </button>
                </div>
                <button
                  onClick={(e) => handleBgmDelete(e, bgm.id)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#ff5252',
                    fontSize: '16px',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="删除音乐"
                >
                  ×
                </button>
              </div>
            ))}

            {bgmLibrary.length === 0 && (
              <div
                style={{
                  padding: '10px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '4px',
                  marginTop: '4px'
                }}
              >
                暂无自定义上传音乐，点击右上角「上传音乐」进行维护。
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
