import React from 'react';
import { StoryboardGenerationPanel } from './StoryboardGenerationPanel';
import type { StoryboardPreview } from './StoryboardGenerationPanel';
import type { AIProject } from '../../../types/aiProject';
import { MentionTextarea } from '../../common/MentionTextarea';
import type { MentionableItem } from '../../../utils/mentionResolver';

export interface StoryboardItem {
  id: string;
  name: string;
  imageSrc: string;
  videoSrc?: string | null;
  isGeneratingImage?: boolean;
  isGeneratingVideo?: boolean;
  videoTaskId?: string;
  shotType?: string;
}

export interface StoryboardStepProps {
  videoDuration: '3s' | '15s';
  setVideoDuration: (d: '3s' | '15s') => void;
  storyboardMode: 'individual' | 'composite_slice' | 'composite_no_slice';
  setStoryboardMode: (m: 'individual' | 'composite_slice' | 'composite_no_slice') => void;
  includeI2VSubtitles: boolean;
  setIncludeI2VSubtitles: (b: boolean) => void;
  includeI2VStickers: boolean;
  setIncludeI2VStickers: (b: boolean) => void;
  useSlowMotion: boolean;
  setUseSlowMotion: (b: boolean) => void;
  clothingFocus: 'top' | 'bottom' | 'both';
  setClothingFocus: (f: 'top' | 'bottom' | 'both') => void;
  handleGenerateStoryboards: () => void;
  isStoryboardGenerating: boolean;
  handleFetchRecentTasks: () => void;
  isFetchingRecent: boolean;
  storyboards: StoryboardItem[];
  draggedStoryboardIndex: number | null;
  setDraggedStoryboardIndex: (idx: number | null) => void;
  handleReorderStoryboards: (from: number, to: number) => void;
  isRegeneratingShotId: string | null;
  setPreviewModel: (model: StoryboardPreview) => void;
  modelOutfitImgUrl: string | null;
  handleGeneratePromptsFromSkill: () => void;
  isGeneratingPromptsFromSkill: boolean;
  i2vMasterPrompt15s: string;
  setI2vMasterPrompt15s: (val: string) => void;
  parse15sMasterPrompt: (prompt: string) => Record<string, string>;
  activeProjectId: string;
  setProjectI2vMasterPrompt15s: (projId: string, prompt: string) => void;
  i2vPrompts: AIProject['i2vPrompts'];
  setI2vPrompts: React.Dispatch<React.SetStateAction<AIProject['i2vPrompts']>>;
  setAiWizardStep: (step: 1 | 2 | 3) => void;
}

export const StoryboardStep: React.FC<StoryboardStepProps> = ({
  videoDuration,
  setVideoDuration,
  storyboardMode,
  setStoryboardMode,
  includeI2VSubtitles,
  setIncludeI2VSubtitles,
  includeI2VStickers,
  setIncludeI2VStickers,
  useSlowMotion,
  setUseSlowMotion,
  clothingFocus,
  setClothingFocus,
  handleGenerateStoryboards,
  isStoryboardGenerating,
  handleFetchRecentTasks,
  isFetchingRecent,
  storyboards,
  draggedStoryboardIndex,
  setDraggedStoryboardIndex,
  handleReorderStoryboards,
  isRegeneratingShotId,
  setPreviewModel,
  modelOutfitImgUrl,
  handleGeneratePromptsFromSkill,
  isGeneratingPromptsFromSkill,
  i2vMasterPrompt15s,
  setI2vMasterPrompt15s,
  parse15sMasterPrompt,
  activeProjectId,
  setProjectI2vMasterPrompt15s,
  i2vPrompts,
  setI2vPrompts,
  setAiWizardStep
}) => {
  const mentionableItems: MentionableItem[] = [
    ...(modelOutfitImgUrl ? [{ id: 'model_outfit', type: 'model' as const, label: '当前穿搭模特', previewUrl: modelOutfitImgUrl }] : []),
    ...storyboards.map((sb, idx) => ({
      id: sb.id,
      type: 'storyboard' as const,
      label: `分镜${idx + 1}`,
      description: sb.name,
      previewUrl: sb.imageSrc
    }))
  ];

  return (
    <>
      {/* I2V Storyboard Panel */}
      <div className="property-group" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px' }}>
        <span className="property-label" style={{ marginBottom: '6px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
          🎬 AI 智能图生视频分镜合成 (I2V 故事板)
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px', display: 'block' }}>
          一键通过 AI 模特分镜图调用「图生视频大模型」，进行多视角的视频片段合成与无缝卡点剪辑拼接：
        </span>

        {/* Video Duration Selector */}
        <div className="property-group" style={{ marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>选择视频时长</span>
          <select
            value={videoDuration}
            onChange={(e) => setVideoDuration(e.target.value as '3s' | '15s')}
            className="text-input"
            style={{ padding: '7px 10px', fontSize: '12px', width: '100%', background: 'var(--bg-surface-solid)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px' }}
          >
            <option value="3s">⏱️ 3秒 (分镜拼接 - 生成 5 段合成 15s 视频)</option>
            <option value="15s">⏱️ 15秒 (可灵单任务或分镜拼接 - 15s 视频)</option>
          </select>
        </div>

        {/* Storyboard Generation Mode Selector */}
        <div className="property-group" style={{ marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>分镜图生成模式</span>
          <select
            value={storyboardMode}
            onChange={(e) => {
              const val = e.target.value as 'individual' | 'composite_slice' | 'composite_no_slice';
              setStoryboardMode(val);
              localStorage.setItem('ai_storyboard_mode', val);
            }}
            className="text-input"
            style={{ padding: '7px 10px', fontSize: '12px', width: '100%', background: 'var(--bg-surface-solid)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px' }}
          >
            <option value="individual">🖼️ 独立分镜逐个生成 (多图模式)</option>
            <option value="composite_slice">✨ 合集单图生成并切割 (多分镜卡片)</option>
            <option value="composite_no_slice">🎬 16:9 合图不切割 (整图传视频模型)</option>
          </select>
        </div>

        {/* Checkbox for Subtitles and Stickers */}
        <div className="property-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeI2VSubtitles}
              onChange={(e) => setIncludeI2VSubtitles(e.target.checked)}
              style={{ accentColor: 'var(--border-accent)', width: '15px', height: '15px', cursor: 'pointer' }}
            />
            生成并添加卖点字幕文案
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={includeI2VStickers}
              onChange={(e) => setIncludeI2VStickers(e.target.checked)}
              style={{ accentColor: 'var(--border-accent)', width: '15px', height: '15px', cursor: 'pointer' }}
            />
            生成并添加 AI 贴纸
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={useSlowMotion}
              onChange={(e) => {
                const val = e.target.checked;
                setUseSlowMotion(val);
                localStorage.setItem('ai_use_slow_motion', String(val));
              }}
              style={{ accentColor: 'var(--border-accent)', width: '15px', height: '15px', cursor: 'pointer' }}
            />
            🏃‍♂️ 人物慢动作，注重镜头运镜
          </label>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', width: '100%' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>视频分镜推广重点</span>
            <select
              value={clothingFocus}
              onChange={(e) => {
                const val = e.target.value as 'top' | 'bottom' | 'both';
                setClothingFocus(val);
                localStorage.setItem('ai_clothing_focus', val);
              }}
              className="text-input"
              style={{ padding: '7px 10px', fontSize: '12px', width: '100%', background: 'var(--bg-surface-solid)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px' }}
            >
              <option value="both">👗 整体搭配 / 两者同样重要</option>
              <option value="top">👕 重点推广上装</option>
              <option value="bottom">👖 重点推广下装</option>
            </select>
          </div>
        </div>

        <StoryboardGenerationPanel
          storyboards={storyboards}
          generating={isStoryboardGenerating}
          fetchingRecent={isFetchingRecent}
          regeneratingId={isRegeneratingShotId}
          draggedIndex={draggedStoryboardIndex}
          onGenerate={handleGenerateStoryboards}
          onFetchRecent={handleFetchRecentTasks}
          onDraggedIndexChange={setDraggedStoryboardIndex}
          onReorder={handleReorderStoryboards}
          onPreview={setPreviewModel}
        />

       {/* Editable Storyboard Prompts */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
              🖊️ 编辑各分镜 Prompt 提示词 ({videoDuration === '15s' || videoDuration === '3s' ? '15s 模式 - 5段' : '4s 模式 - 3段'})
            </span>
            {modelOutfitImgUrl && (
              <button
                onClick={handleGeneratePromptsFromSkill}
                disabled={isGeneratingPromptsFromSkill}
                className="ai-btn"
                style={{
                  padding: '4px 8px',
                  fontSize: '9px',
                  background: 'var(--accent-purple)',
                  borderColor: 'transparent',
                  color: '#fff',
                  margin: 0,
                  height: 'auto',
                  lineHeight: '1.2',
                  cursor: isGeneratingPromptsFromSkill ? 'not-allowed' : 'pointer'
                }}
                title="根据模特穿搭图调用 I2V 规约智能生成分镜提示词"
              >
                {isGeneratingPromptsFromSkill ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ border: '1.5px solid #fff', borderTop: '1.5px solid transparent', borderRadius: '50%', width: '8px', height: '8px', animation: 'spin 1s linear infinite' }} />
                    AI 编排中...
                  </div>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    基于穿搭图智能编排
                  </span>
                )}
              </button>
            )}
          </div>

          {(videoDuration === '15s' || videoDuration === '3s') ? (
            storyboardMode === 'composite_no_slice' ? (
              <div className="property-group" style={{ marginBottom: 0, width: '100%' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '4px' }}>15s 视频完整脚本提示词 (输入 @ 可引用模特与分镜)</span>
                <MentionTextarea
                  value={i2vMasterPrompt15s}
                  onChange={setI2vMasterPrompt15s}
                  rows={9}
                  availableItems={mentionableItems}
                  placeholder="15秒快节奏连贯 5 幕叙事，输入 @ 即可引用模特或分镜。第一幕：... 镜头切换（Cut to）第二幕：..."
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(() => {
                  const parsed = parse15sMasterPrompt(i2vMasterPrompt15s);
                  const updateShotPrompt = (shotKey: 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5', newVal: string) => {
                    const currentProjId = activeProjectId;
                    if (!currentProjId) return;
                    
                    parsed[shotKey] = newVal;
                    
                    const audioMarker = '原生音效：';
                    const audioIdx = i2vMasterPrompt15s.indexOf(audioMarker);
                    const audioPart = audioIdx !== -1 ? i2vMasterPrompt15s.substring(audioIdx + audioMarker.length).trim() : '高级环境底噪 + 衣服摩擦与高跟鞋脚步拟音 Foley + 舒缓音乐 BGM。';
                    
                    const newMasterPrompt = `15秒快节奏连贯 5 幕叙事，引用参考图作为服装和模特的严格一致性参考。第一幕：${parsed['shot-1']} 镜头切换（Cut to）第二幕：${parsed['shot-2']} 镜头切换（Cut to）第三幕：${parsed['shot-3']} 镜头切换（Cut to）第四幕：${parsed['shot-4']} 镜头切换（Cut to）第五幕：${parsed['shot-5']} 原生音效：${audioPart}`;
                    
                    setI2vMasterPrompt15s(newMasterPrompt);
                    setProjectI2vMasterPrompt15s(currentProjId, newMasterPrompt);
                  };

                  return (
                    <>
                      <div className="property-group" style={{ marginBottom: 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜一：全身走秀出场 (0-3s)</span>
                        <textarea
                          value={parsed['shot-1']}
                          onChange={(e) => updateShotPrompt('shot-1', e.target.value)}
                          className="text-input"
                          rows={3}
                          style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            lineHeight: '1.6',
                            width: '100%',
                            resize: 'vertical',
                            background: 'var(--bg-element)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div className="property-group" style={{ marginBottom: 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜二：细节特写推镜 (3-6s)</span>
                        <textarea
                          value={parsed['shot-2']}
                          onChange={(e) => updateShotPrompt('shot-2', e.target.value)}
                          className="text-input"
                          rows={3}
                          style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            lineHeight: '1.6',
                            width: '100%',
                            resize: 'vertical',
                            background: 'var(--bg-element)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div className="property-group" style={{ marginBottom: 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜三：动态步态律动 (6-9s)</span>
                        <textarea
                          value={parsed['shot-3']}
                          onChange={(e) => updateShotPrompt('shot-3', e.target.value)}
                          className="text-input"
                          rows={3}
                          style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            lineHeight: '1.6',
                            width: '100%',
                            resize: 'vertical',
                            background: 'var(--bg-element)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div className="property-group" style={{ marginBottom: 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜四：侧身回眸展示 (9-12s)</span>
                        <textarea
                          value={parsed['shot-4']}
                          onChange={(e) => updateShotPrompt('shot-4', e.target.value)}
                          className="text-input"
                          rows={3}
                          style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            lineHeight: '1.6',
                            width: '100%',
                            resize: 'vertical',
                            background: 'var(--bg-element)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>
                      <div className="property-group" style={{ marginBottom: 0 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜五：黄金定格收尾 (12-15s)</span>
                        <textarea
                          value={parsed['shot-5']}
                          onChange={(e) => updateShotPrompt('shot-5', e.target.value)}
                          className="text-input"
                          rows={3}
                          style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            lineHeight: '1.6',
                            width: '100%',
                            resize: 'vertical',
                            background: 'var(--bg-element)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </>
                  );
                })()}
              </div>
            )
          ) : (
            <>
              <div className="property-group" style={{ marginBottom: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜一 (全身远景)</span>
                <input
                  type="text"
                  value={i2vPrompts['full-body']}
                  onChange={(e) => setI2vPrompts(prev => ({ ...prev, 'full-body': e.target.value }))}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '11px', background: 'var(--bg-element)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="property-group" style={{ marginBottom: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜二 (半身中景)</span>
                <input
                  type="text"
                  value={i2vPrompts['medium']}
                  onChange={(e) => setI2vPrompts(prev => ({ ...prev, 'medium': e.target.value }))}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '11px', background: 'var(--bg-element)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="property-group" style={{ marginBottom: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>分镜三 (细节特写)</span>
                <input
                  type="text"
                  value={i2vPrompts['close-up']}
                  onChange={(e) => setI2vPrompts(prev => ({ ...prev, 'close-up': e.target.value }))}
                  className="text-input"
                  style={{ padding: '6px 10px', fontSize: '11px', background: 'var(--bg-element)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Next/Prev Navigation */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '4px' }}>
        <button
          className="btn-secondary"
          onClick={() => setAiWizardStep(1)}
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            cursor: 'pointer',
            borderRadius: '8px',
            width: '48%',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: '600'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          上一步
        </button>
        <button
          className="btn-primary"
          onClick={() => setAiWizardStep(3)}
          disabled={storyboards.length === 0}
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            cursor: storyboards.length === 0 ? 'not-allowed' : 'pointer',
            borderRadius: '8px',
            fontWeight: '600',
            opacity: storyboards.length === 0 ? 0.5 : 1,
            width: '48%',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
          title={storyboards.length === 0 ? '请先一键生成分镜图再进入下一步' : ''}
        >
          下一步：生成视频
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>
    </>
  );
};
