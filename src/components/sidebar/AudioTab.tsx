import React, { useMemo, useState } from 'react';

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

const BUILT_IN_BGM: BgmItem[] = [
  { id: 'builtin-fashion-beat', name: 'Fashion Beat', desc: '轻快 · 时尚卡点', src: '/video.mp4' },
  { id: 'builtin-soft-light', name: 'Soft Light', desc: '轻柔 · 日常氛围', src: '/video.mp4' },
  { id: 'builtin-city-walk', name: 'City Walk', desc: '律动 · 城市生活', src: '/video.mp4' }
];

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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'全部' | '内置' | '我的音乐'>('全部');
  const items = useMemo(() => {
    const all = filter === '内置' ? BUILT_IN_BGM : filter === '我的音乐' ? bgmLibrary : [...BUILT_IN_BGM, ...bgmLibrary];
    const normalized = query.trim().toLowerCase();
    return all.filter(item => !normalized || `${item.name} ${item.desc || ''}`.toLowerCase().includes(normalized));
  }, [bgmLibrary, filter, query]);

  return <main className="audio-studio-page">
    <header className="audio-studio-heading">
      <div><span className="text-studio-eyebrow">AUDIO & MUSIC</span><h1>音乐工作台</h1><p>为画面选择合适的节奏，试听、应用和管理背景音乐。</p></div>
      <div className="audio-studio-heading-actions"><span className="audio-studio-status"><i /> 音频引擎就绪</span><label className="audio-upload-button">＋ 上传音乐<input type="file" accept="audio/*" onChange={handleBgmUpload} /></label>{isTauri && <button type="button" className="audio-import-button" onClick={handleImportLocalAudio}>⌁ 导入本地</button>}</div>
    </header>
    <section className="audio-studio-toolbar">
      <div className="audio-studio-tabs">{(['全部', '内置', '我的音乐'] as const).map(item => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
      <label className="audio-studio-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索音乐名称或氛围" /></label>
      <span className="audio-studio-count">{items.length} 首音乐</span>
    </section>
    <section className="audio-library-grid">
      {items.map(item => {
        const builtIn = item.id.startsWith('builtin-');
        const playing = previewAudioSrc === item.src;
        return <article className={'audio-track-card' + (playing ? ' playing' : '')} key={item.id}>
          <div className="audio-track-art"><span>{playing ? 'Ⅱ' : '♫'}</span><i /></div>
          <div className="audio-track-info"><b>{item.name}</b><span>{item.desc || '自定义上传音乐'}</span><small>{builtIn ? '内置音乐' : '我的音乐'}</small></div>
          <div className="audio-track-actions"><button type="button" className="audio-preview-button" onClick={event => togglePreviewAudio(event, item.src)} title={playing ? '暂停试听' : '试听'}>{playing ? 'Ⅱ' : '▶'}</button><button type="button" className="audio-use-button" onClick={() => selectBgm(item.src, item.name)}>使用</button>{!builtIn && <button type="button" className="audio-delete-button" onClick={event => handleBgmDelete(event, item.id)} title="删除音乐">×</button>}</div>
        </article>;
      })}
      {items.length === 0 && <div className="audio-studio-empty"><span>♫</span><b>{query ? '没有匹配的音乐' : '还没有上传音乐'}</b><p>上传一首本地音乐，或从内置音乐开始搭配视频节奏。</p><label className="audio-upload-button">＋ 上传第一首<input type="file" accept="audio/*" onChange={handleBgmUpload} /></label></div>}
    </section>
    <div className="audio-studio-tip"><span>⌁</span><p>点击“使用”会把音乐加入时间轴并自动同步到当前工程；试听不会改变工程内容。</p></div>
  </main>;
};
