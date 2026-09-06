import React from 'react';
import { OutfitResultsGallery } from './OutfitResultsGallery';
import type { OutfitPreview } from './OutfitResultsGallery';
import { TryOnModelSceneSelector } from './TryOnModelSceneSelector';
import type { AIProject } from '../../../types/aiProject';

interface ModelItem {
  id: string;
  src: string;
  name: string;
}

interface CustomSceneItem {
  id: string;
  src: string;
  name: string;
}

export interface TryOnStepProps {
  swapModelUrl: string;
  modelLibrary: ModelItem[];
  setIsModelSelectorModalOpen: (open: boolean) => void;
  modelScene: string;
  SCENE_BACKGROUNDS: Record<string, string>;
  customScenes: CustomSceneItem[];
  setIsSceneSelectorModalOpen: (open: boolean) => void;
  outfitGenInterrupted: boolean;
  setOutfitGenInterrupted: (val: boolean) => void;
  topClothingUrl: string;
  setTopClothingUrl: (url: string) => void;
  bottomClothingUrl: string;
  setBottomClothingUrl: (url: string) => void;
  handleTopClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBottomClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  triggerOutfitStylist: (top: string, bottom: string) => void;
  referenceOutfitUrls: string[];
  setReferenceOutfitUrls: React.Dispatch<React.SetStateAction<string[]>>;
  setReferenceOutfitUrl: (url: string) => void;
  handleReferenceOutfitUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeProjectId: string;
  projects: AIProject[];
  syncProjectToSupabase: (project: AIProject) => void | Promise<void>;
  deleteFileFromOSS: (url: string) => Promise<void>;
  matchingItemDesc: string;
  setMatchingItemDesc: (val: string) => void;
  shoesDesc: string;
  setShoesDesc: (val: string) => void;
  accessoriesDesc: string;
  setAccessoriesDesc: (val: string) => void;
  isStylingLoading: boolean;
  handleGenerateModelOutfit: () => void;
  isOutfitImgGenerating: boolean;
  modelOutfitImgUrls: string[];
  modelOutfitImgUrl: string | null;
  setPreviewModel: (model: OutfitPreview) => void;
  handleDeleteOutfitImg: (idx: number) => void;
  handleDeleteSingleOutfitImg: () => void;
  setAiWizardStep: (step: 1 | 2 | 3) => void;
  onOpenInCanvas?: (options?: { type?: 'outfit' | 'storyboard' | 'image' | 'project'; src?: string; title?: string; prompt?: string }) => void;
}

export const TryOnStep: React.FC<TryOnStepProps> = ({
  swapModelUrl,
  modelLibrary,
  setIsModelSelectorModalOpen,
  modelScene,
  SCENE_BACKGROUNDS,
  customScenes,
  setIsSceneSelectorModalOpen,
  outfitGenInterrupted,
  setOutfitGenInterrupted,
  topClothingUrl,
  setTopClothingUrl,
  bottomClothingUrl,
  setBottomClothingUrl,
  handleTopClothingUpload,
  handleBottomClothingUpload,
  triggerOutfitStylist,
  referenceOutfitUrls,
  setReferenceOutfitUrls,
  setReferenceOutfitUrl,
  handleReferenceOutfitUpload,
  activeProjectId,
  projects,
  syncProjectToSupabase,
  deleteFileFromOSS,
  matchingItemDesc,
  setMatchingItemDesc,
  shoesDesc,
  setShoesDesc,
  accessoriesDesc,
  setAccessoriesDesc,
  isStylingLoading,
  handleGenerateModelOutfit,
  isOutfitImgGenerating,
  modelOutfitImgUrls,
  modelOutfitImgUrl,
  setPreviewModel,
  handleDeleteOutfitImg,
  handleDeleteSingleOutfitImg,
  setAiWizardStep,
  onOpenInCanvas
}) => {
  return (
    <>
      <TryOnModelSceneSelector
        modelUrl={swapModelUrl}
        models={modelLibrary}
        sceneId={modelScene}
        sceneBackgrounds={SCENE_BACKGROUNDS}
        customScenes={customScenes}
        onOpenModels={() => setIsModelSelectorModalOpen(true)}
        onOpenScenes={() => setIsSceneSelectorModalOpen(true)}
      />

     {/* Clothing Flatlay Upload Panel (Direct Input) */}
      <div className="property-group" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '16px' }}>👕</span>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '0.01em' }}>配置服装与穿搭图</span>
        </div>

        {/* Interrupted generation warning banner */}
        {outfitGenInterrupted && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.4)', borderRadius: '8px', padding: '10px 12px' }}>
            <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309' }}>上次穿搭图生成被中断</span>
              <span style={{ fontSize: '10px', color: '#78350f', lineHeight: '1.4' }}>
                检测到上次页面刷新时「生成模特穿搭图」任务正在进行中，已被中断。请重新点击「一键生成」按钮。
              </span>
            </div>
            <button
              onClick={() => setOutfitGenInterrupted(false)}
              style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: '14px', padding: '0', flexShrink: 0, lineHeight: '1' }}
            >×</button>
          </div>
        )}

        {/* Upload Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {/* 1. Top Clothing Upload Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>上装白底图</span>
            {topClothingUrl ? (
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid var(--accent-cyan)', aspectRatio: '1/1', background: 'var(--bg-element)' }}>
                <img src={topClothingUrl} alt="top clothing" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '6px' }}>
                  <span style={{ fontSize: '9px', color: '#63cafd', fontWeight: '700' }}>✓ 已载入</span>
                </div>
                <button
                  onClick={() => { setTopClothingUrl(''); triggerOutfitStylist('', bottomClothingUrl); }}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,80,80,0.5)', color: '#ff6b6b', cursor: 'pointer', fontSize: '11px', padding: '0', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}
                >×</button>
              </div>
            ) : (
              <div
                onClick={() => document.getElementById('top-clothing-upload-trigger')?.click()}
                style={{
                  border: '1.5px dashed var(--border-color)',
                  borderRadius: '8px',
                  aspectRatio: '1/1',
                  cursor: 'pointer',
                  background: 'var(--bg-surface-solid)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
                onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; }}
              >
                <span style={{ fontSize: '20px' }}>📤</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'center' }}>上传上装</span>
              </div>
            )}
            <input id="top-clothing-upload-trigger" type="file" accept="image/*" onChange={handleTopClothingUpload} style={{ display: 'none' }} />
          </div>

          {/* 2. Bottom Clothing Upload Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>下装白底图</span>
            {bottomClothingUrl ? (
              <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid var(--accent-cyan)', aspectRatio: '1/1', background: 'var(--bg-element)' }}>
                <img src={bottomClothingUrl} alt="bottom clothing" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '6px' }}>
                  <span style={{ fontSize: '9px', color: '#63cafd', fontWeight: '700' }}>✓ 已载入</span>
                </div>
                <button
                  onClick={() => { setBottomClothingUrl(''); triggerOutfitStylist(topClothingUrl, ''); }}
                  style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,80,80,0.5)', color: '#ff6b6b', cursor: 'pointer', fontSize: '11px', padding: '0', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}
                >×</button>
              </div>
            ) : (
              <div
                onClick={() => document.getElementById('bottom-clothing-upload-trigger')?.click()}
                style={{
                  border: '1.5px dashed var(--border-color)',
                  borderRadius: '8px',
                  aspectRatio: '1/1',
                  cursor: 'pointer',
                  background: 'var(--bg-surface-solid)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
                onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)'; }}
                onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; }}
              >
                <span style={{ fontSize: '20px' }}>📤</span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', textAlign: 'center' }}>上传下装</span>
              </div>
            )}
            <input id="bottom-clothing-upload-trigger" type="file" accept="image/*" onChange={handleBottomClothingUpload} style={{ display: 'none' }} />
          </div>
        </div>

        {/* 3. Reference Outfit Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>穿搭参考图</span>
            <span style={{ fontSize: '10px', color: referenceOutfitUrls.length >= 3 ? 'var(--accent-red)' : 'var(--text-muted)', fontWeight: '600' }}>
              {referenceOutfitUrls.length}/3 套
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
            {referenceOutfitUrls.map((url, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1.5px solid var(--accent-purple)', aspectRatio: '3/4', background: 'var(--bg-element)' }}>
                  <img src={url} alt={`outfit ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 45%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '5px' }}>
                    <span style={{ fontSize: '9px', color: '#c084fc', fontWeight: '700' }}>套 {idx + 1}</span>
                  </div>
                  <button
                    onClick={async () => {
                      const urlToDelete = url;
                      setReferenceOutfitUrls(prev => {
                        const next = prev.filter((_, i) => i !== idx);
                        const nextUrl = next.length > 0 ? next[0] : '';
                        setReferenceOutfitUrl(nextUrl);

                        if (activeProjectId) {
                          const currentProj = projects.find(p => p.id === activeProjectId);
                          if (currentProj) {
                            const updated = {
                              ...currentProj,
                              referenceOutfitUrls: next,
                              referenceOutfitUrl: nextUrl
                            };
                            syncProjectToSupabase(updated);
                          }
                        }

                        return next;
                      });

                      try {
                        await deleteFileFromOSS(urlToDelete);
                        console.log('Deleted reference outfit from OSS successfully:', urlToDelete);
                      } catch (err) {
                        console.warn('Failed to delete reference outfit from OSS:', err);
                      }
                    }}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,80,80,0.5)', color: '#ff6b6b', cursor: 'pointer', fontSize: '10px', padding: '0', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}
                  >×</button>
                </div>
              </div>
            ))}
            {referenceOutfitUrls.length < 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div
                  onClick={() => document.getElementById('reference-outfit-upload-trigger')?.click()}
                  style={{
                    border: '1.5px dashed var(--accent-purple)',
                    borderRadius: '8px',
                    aspectRatio: '3/4',
                    cursor: 'pointer',
                    background: 'var(--bg-surface-solid)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'border-color 0.2s, background 0.2s'
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-accent)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent-purple)'; }}
                >
                  <span style={{ fontSize: '18px' }}>➕</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: '700', textAlign: 'center', lineHeight: '1.3' }}>
                    {referenceOutfitUrls.length === 0 ? '上传\n参考图' : '添加\n参考图'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <input id="reference-outfit-upload-trigger" type="file" accept="image/*" multiple={true} onChange={handleReferenceOutfitUpload} style={{ display: 'none' }} />
        </div>

        {/* Outfit Suggestions Panel */}
        {(topClothingUrl || bottomClothingUrl || (referenceOutfitUrls && referenceOutfitUrls.length > 0)) && (
          <div style={{
            background: 'var(--bg-surface-solid)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                ✨ AI 穿搭与配饰推荐
              </span>
              {isStylingLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ border: '1.5px solid var(--accent-purple)', borderTop: '1.5px solid transparent', borderRadius: '50%', width: '9px', height: '9px', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '10px', color: 'var(--accent-purple)' }}>设计搭配中...</span>
                </div>
              )}
            </div>

            {[
              { label: '下装/上装款式搭配', val: matchingItemDesc, set: setMatchingItemDesc, placeholder: 'AI 根据服装设计自动生成...' },
              { label: '鞋履搭配', val: shoesDesc, set: setShoesDesc, placeholder: 'AI 鞋子搭配建议...' },
              { label: '首饰包包配饰 (可选)', val: accessoriesDesc, set: setAccessoriesDesc, placeholder: 'AI 配饰建议...' }
            ].map(({ label, val, set, placeholder }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600' }}>{label}</span>
                <input
                  type="text"
                  value={val}
                  onChange={e => set(e.target.value)}
                  placeholder={placeholder}
                  style={{ background: 'var(--bg-element)', border: '1px solid var(--border-color)', borderRadius: '5px', color: 'var(--text-primary)', fontSize: '11px', padding: '6px 8px', width: '100%', boxSizing: 'border-box' }}
                  disabled={isStylingLoading}
                />
              </div>
            ))}
          </div>
        )}

        {/* Generation Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
          {(topClothingUrl || bottomClothingUrl || (referenceOutfitUrls && referenceOutfitUrls.length > 0)) && (
            <button
              onClick={handleGenerateModelOutfit}
              disabled={isOutfitImgGenerating}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontSize: '12px',
                padding: '9px 12px',
                fontWeight: '600',
                borderRadius: '8px'
              }}
            >
              {isOutfitImgGenerating ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                  <span>正在渲染穿搭图...</span>
                </div>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                  </svg>
                  一键生成模特服装穿搭图
                </span>
              )}
            </button>
          )}

          <OutfitResultsGallery
            imageUrls={modelOutfitImgUrls}
            fallbackImageUrl={modelOutfitImgUrl}
            onPreview={setPreviewModel}
            onDelete={handleDeleteOutfitImg}
            onDeleteFallback={handleDeleteSingleOutfitImg}
          />

          {onOpenInCanvas && (modelOutfitImgUrls.length > 0 || modelOutfitImgUrl) && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onOpenInCanvas({
                type: 'outfit',
                src: modelOutfitImgUrls[0] || modelOutfitImgUrl || undefined,
                title: '当前穿搭模特'
              })}
              style={{
                width: '100%',
                marginTop: '10px',
                padding: '8px 12px',
                fontSize: '11px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.1) 0%, rgba(121, 40, 202, 0.14) 100%)',
                border: '1px solid rgba(0, 242, 254, 0.3)',
                color: 'var(--accent-cyan, #00f2fe)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
              title="将此套模特穿搭导入无限画布，自由扩展多视角提示词与镜头生成管线"
            >
              <span>🎨</span>
              <span>在无限画布中衍生更多分镜与镜头</span>
            </button>
          )}
        </div>
      </div>

     {/* Step 1 Navigation Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
        <button
          className="btn-primary"
          onClick={() => setAiWizardStep(2)}
          style={{
            width: '100%',
            padding: '9px 16px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '8px',
            fontWeight: '600',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          下一步：配置场景分镜
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </>
  );
};
