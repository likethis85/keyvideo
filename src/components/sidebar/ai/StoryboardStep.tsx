import React, { useState } from 'react';
import { StoryboardGenerationPanel } from './StoryboardGenerationPanel';
import type { StoryboardPreview } from './StoryboardGenerationPanel';
import type { AIProject } from '../../../types/aiProject';
import { MentionTextarea } from '../../common/MentionTextarea';
import type { MentionableItem } from '../../../utils/mentionResolver';
import {
  replaceSingleShotInMasterPrompt,
  reconstructFiveShotMasterPrompt
} from '../../../services/storyboardPromptParser';
import {
  FIVE_SHOT_STORYBOARD_SUITES,
  PROMPT_LIBRARY
} from '../../../config/promptLibraryData';
import {
  resolvePromptVariables,
  interpolatePromptVariables
} from '../../../utils/promptVariableInterpolator';
import { toast } from '../../toastStore';

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
  apparelStyle?: 'dress' | 'suit' | 'street' | 'neo_chinese' | 'overcoat' | 'knitwear' | 'general';
  setApparelStyle?: (style: 'dress' | 'suit' | 'street' | 'neo_chinese' | 'overcoat' | 'knitwear' | 'general') => void;
  cameraStyle?: 'cinematic_dolly' | 'orbit_360' | 'macro_rack' | 'low_angle' | 'default';
  setCameraStyle?: (style: 'cinematic_dolly' | 'orbit_360' | 'macro_rack' | 'low_angle' | 'default') => void;
  lightingMood?: 'editorial_soft' | 'golden_hour' | 'wabi_sabi' | 'cyber_night' | 'default';
  setLightingMood?: (mood: 'editorial_soft' | 'golden_hour' | 'wabi_sabi' | 'cyber_night' | 'default') => void;
  polishingShotIndex?: number | null;
  onPolishSingleShot?: (shotIndex: 1 | 2 | 3 | 4 | 5) => void;
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
  onOpenInCanvas?: (options?: { type?: 'outfit' | 'storyboard' | 'image' | 'project'; src?: string; title?: string; prompt?: string }) => void;
  modelGender?: string;
  modelRegion?: string;
  modelScene?: string;
  onNavigateToPromptTab?: () => void;
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
  apparelStyle = 'general',
  setApparelStyle,
  cameraStyle = 'cinematic_dolly',
  setCameraStyle,
  lightingMood = 'editorial_soft',
  setLightingMood,
  polishingShotIndex = null,
  onPolishSingleShot,
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
  setAiWizardStep,
  onOpenInCanvas,
  modelGender,
  modelRegion,
  modelScene,
  onNavigateToPromptTab
}) => {
  const [inspirationShotIndex, setInspirationShotIndex] = useState<number | null>(null);
  const [libraryShotIndex, setLibraryShotIndex] = useState<number | null>(null);
  const [showSuiteSelector, setShowSuiteSelector] = useState(false);

  // Compute resolved project variables for prompt templates
  const projectVariables = React.useMemo(() => {
    return resolvePromptVariables({
      modelGender,
      modelRegion,
      modelScene,
      apparelStyle,
      cameraStyle,
      lightingMood,
      useSlowMotion,
      clothingFocus
    });
  }, [modelGender, modelRegion, modelScene, apparelStyle, cameraStyle, lightingMood, useSlowMotion, clothingFocus]);

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

          {/* 服装品类专属物理力学规约 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', width: '100%' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>👗 服装品类专属物理力学</span>
            <select
              value={apparelStyle}
              onChange={(e) => {
                const val = e.target.value as typeof apparelStyle;
                setApparelStyle?.(val);
                localStorage.setItem('ai_apparel_style', val);
              }}
              className="text-input"
              style={{ padding: '7px 10px', fontSize: '12px', width: '100%', background: 'var(--bg-surface-solid)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px' }}
            >
              <option value="general">✨ 通用高端时尚 (自然重力垂坠与微褶皱)</option>
              <option value="dress">👗 优雅长裙/礼服 (流线垂坠与波浪飘逸)</option>
              <option value="suit">👔 职场通勤/正装西服 (挺阔肩线与精纺哑光)</option>
              <option value="overcoat">🧥 风衣/大衣外套 (大衣下摆开合/带风气场)</option>
              <option value="neo_chinese">🪭 新中式/国风汉服 (广袖流云与丝绸暗光)</option>
              <option value="street">🧢 潮酷高街/运动机能 (机能抽绳/弹性质感)</option>
              <option value="knitwear">🧶 软糯针织/静奢羊绒 (羊绒微纤肌理与悬垂)</option>
            </select>
          </div>

          {/* 镜头运镜调性 & 光影美学 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>🎥 运镜调性</span>
              <select
                value={cameraStyle}
                onChange={(e) => {
                  const val = e.target.value as typeof cameraStyle;
                  setCameraStyle?.(val);
                  localStorage.setItem('ai_camera_style', val);
                }}
                className="text-input"
                style={{ padding: '7px 8px', fontSize: '11px', width: '100%', background: 'var(--bg-surface-solid)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px' }}
              >
                <option value="cinematic_dolly">🎬 电影慢推微移</option>
                <option value="orbit_360">🔄 秀场360°环绕</option>
                <option value="macro_rack">🔍 微距变焦特写</option>
                <option value="low_angle">📐 低视角超模跟拍</option>
                <option value="default">✨ 经典大片运镜</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>💡 光影美学</span>
              <select
                value={lightingMood}
                onChange={(e) => {
                  const val = e.target.value as typeof lightingMood;
                  setLightingMood?.(val);
                  localStorage.setItem('ai_lighting_mood', val);
                }}
                className="text-input"
                style={{ padding: '7px 8px', fontSize: '11px', width: '100%', background: 'var(--bg-surface-solid)', borderColor: 'var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px' }}
              >
                <option value="editorial_soft">💡 大牌杂志柔光</option>
                <option value="golden_hour">🌅 黄金时刻暖逆光</option>
                <option value="wabi_sabi">🏛️ 侘寂几何硬影</option>
                <option value="cyber_night">🌃 夜色街头霓虹</option>
                <option value="default">✨ 自然通透光影</option>
              </select>
            </div>
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

        {onOpenInCanvas && storyboards.length > 0 && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onOpenInCanvas({ type: 'storyboard' })}
            style={{
              width: '100%',
              margin: '8px 0',
              padding: '8px 12px',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(121, 40, 202, 0.14) 0%, rgba(0, 242, 254, 0.1) 100%)',
              border: '1px solid rgba(121, 40, 202, 0.35)',
              color: '#c084fc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            title="在无限画布中自由拖拽比对、重新连线或调整分镜顺序"
          >
            <span>🎨</span>
            <span>在无限画布中自由排版、比对与调序 (5镜拓扑)</span>
          </button>
        )}

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
                {/* 5-Shot Storyboard Suites Accordion */}
                <div
                  style={{
                    background: 'var(--bg-surface-solid)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => setShowSuiteSelector(prev => !prev)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>🪄</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        5幕电商成套爆款模版 (一键套用全量脚本)
                      </span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 600 }}>
                      {showSuiteSelector ? '收起 ▲' : '选择风格 (5套) ▼'}
                    </span>
                  </div>

                  {showSuiteSelector && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '6px', marginTop: '4px' }}>
                      {FIVE_SHOT_STORYBOARD_SUITES.map(suite => (
                        <div
                          key={suite.id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: 'var(--bg-element)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: '18px' }}>{suite.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{suite.title}</span>
                                <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(124, 58, 237, 0.15)', color: '#c084fc', fontWeight: 500 }}>
                                  {suite.tagline}
                                </span>
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {suite.description}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => {
                              const resolvedShots: Record<'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5', string> = {
                                'shot-1': interpolatePromptVariables(suite.shots['shot-1'], projectVariables),
                                'shot-2': interpolatePromptVariables(suite.shots['shot-2'], projectVariables),
                                'shot-3': interpolatePromptVariables(suite.shots['shot-3'], projectVariables),
                                'shot-4': interpolatePromptVariables(suite.shots['shot-4'], projectVariables),
                                'shot-5': interpolatePromptVariables(suite.shots['shot-5'], projectVariables)
                              };
                              const newMaster = reconstructFiveShotMasterPrompt(resolvedShots, `原生音效：${suite.audioPart}`);
                              setI2vMasterPrompt15s(newMaster);
                              if (activeProjectId) {
                                setProjectI2vMasterPrompt15s(activeProjectId, newMaster);
                              }
                              toast.success(`已一键套用「${suite.title}」全量 5 幕剧本`);
                              setShowSuiteSelector(false);
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '10px',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              margin: 0,
                              height: '26px'
                            }}
                          >
                            一键套用
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(() => {
                  const parsed = parse15sMasterPrompt(i2vMasterPrompt15s);
                  const updateShotPrompt = (shotKey: 'shot-1' | 'shot-2' | 'shot-3' | 'shot-4' | 'shot-5', newVal: string) => {
                    const currentProjId = activeProjectId;
                    if (!currentProjId) return;
                    
                    const newMasterPrompt = replaceSingleShotInMasterPrompt(i2vMasterPrompt15s, shotKey, newVal);
                    setI2vMasterPrompt15s(newMasterPrompt);
                    setProjectI2vMasterPrompt15s(currentProjId, newMasterPrompt);
                  };

                  const FIVE_SHOTS = [
                    { key: 'shot-1' as const, index: 1 as const, title: '分镜一：出场与超模气场', duration: '0-3s', icon: '🚶‍♀️', tip: '首帧画外边缘迈步，优雅走入中央站定' },
                    { key: 'shot-2' as const, index: 2 as const, title: '分镜二：细节特写微距推镜', duration: '3-6s', icon: '🔍', tip: '极慢平推，聚焦领口做工与微观面料' },
                    { key: 'shot-3' as const, index: 3 as const, title: '分镜三：张力与律动步态', duration: '6-9s', icon: '💃', tip: '平滑环绕，展示面料流线垂坠与舒展' },
                    { key: 'shot-4' as const, index: 4 as const, title: '分镜四：微动与物理褶皱', duration: '9-12s', icon: '✨', tip: '平缓微移，模特微倾身姿，真实面料重力' },
                    { key: 'shot-5' as const, index: 5 as const, title: '分镜五：黄金定格全身比例', duration: '12-15s', icon: '👑', tip: '缓缓拉远，纵深空间背景下高冷定格' }
                  ];

                  const QUICK_INSPIRATIONS = [
                    { label: '🎥 极慢平推', text: '摄像机极其缓慢向前平推 (Ultra-slow Dolly In)，' },
                    { label: '🔄 360°环绕', text: '平滑轨道环绕镜头慢速运镜，全方位展示服装版型，' },
                    { label: '🔍 面料微距', text: '微距镜头极其细腻拉近，聚焦衣物微观织物肌理与五金辅料，' },
                    { label: '👗 裙摆飘垂', text: '微风轻拂裙摆产生优雅的波浪状流线垂坠感 (Fluid drape)，' },
                    { label: '👔 挺阔肩线', text: '身形挺拔步伐沉稳从容，呈现立体挺阔的高级剪裁轮廓，' },
                    { label: '🌅 逆光丁达尔', text: '自然柔和的侧逆光斜射，发丝泛起温暖光晕与立体空间层次，' },
                    { label: '💃 优雅微侧身', text: '模特极从容徐缓地优雅微侧身45度并眼神微转，' }
                  ];

                  return (
                    <>
                      {FIVE_SHOTS.map((shot) => {
                        const currentVal = parsed[shot.key] || '';
                        const isPolishing = polishingShotIndex === shot.index;
                        const showInspiration = inspirationShotIndex === shot.index;
                        const showLibrary = libraryShotIndex === shot.index;

                        // Filter prompts relevant to this shot
                        const shotLibraryItems = PROMPT_LIBRARY.filter(item => {
                          if (item.recommendedShot === shot.key) return true;
                          if (shot.index === 1 && (item.category === 'copy' || item.category === 'camera')) return true;
                          if (shot.index === 2 && (item.category === 'fabric' || item.id === 'cam_push_in' || item.id === 'cam_macro_focus')) return true;
                          if (shot.index === 3 && (item.id === 'cam_orbit_360' || item.category === 'camera')) return true;
                          if (shot.index === 4 && (item.category === 'fabric' || item.id === 'cam_slow_mo')) return true;
                          if (shot.index === 5 && (item.category === 'copy' || item.id === 'cam_low_angle')) return true;
                          return false;
                        }).slice(0, 4);

                        return (
                          <div
                            key={shot.key}
                            style={{
                              background: 'var(--bg-surface-solid)',
                              border: isPolishing ? '1px solid var(--accent-purple)' : '1px solid var(--border-color)',
                              borderRadius: '6px',
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              transition: 'border-color 0.2s ease'
                            }}
                          >
                            {/* Card Header with Shot Title & Actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '13px' }}>{shot.icon}</span>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                  {shot.title}
                                </span>
                                <span
                                  style={{
                                    fontSize: '9px',
                                    fontWeight: '600',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-element)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-color)'
                                  }}
                                >
                                  {shot.duration}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {/* Quick Inspiration Toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLibraryShotIndex(null);
                                    setInspirationShotIndex(prev => prev === shot.index ? null : shot.index);
                                  }}
                                  style={{
                                    fontSize: '9px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: showInspiration ? 'rgba(0, 242, 254, 0.15)' : 'var(--bg-element)',
                                    border: showInspiration ? '1px solid #00f2fe' : '1px solid var(--border-color)',
                                    color: showInspiration ? '#00f2fe' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="展开灵感预设短语，点击即可一键插入"
                                >
                                  <span>💡</span>
                                  <span>灵感</span>
                                </button>

                                {/* Prompt Library Drawer Toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspirationShotIndex(null);
                                    setLibraryShotIndex(prev => prev === shot.index ? null : shot.index);
                                  }}
                                  style={{
                                    fontSize: '9px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: showLibrary ? 'rgba(124, 58, 237, 0.2)' : 'var(--bg-element)',
                                    border: showLibrary ? '1px solid #7c3aed' : '1px solid var(--border-color)',
                                    color: showLibrary ? '#c084fc' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title="从电商灵感词库中选择适合此镜头的运镜、面料或文案"
                                >
                                  <span>📚</span>
                                  <span>词库</span>
                                </button>

                                {/* AI Single-Shot Polish Button */}
                                {onPolishSingleShot && (
                                  <button
                                    type="button"
                                    onClick={() => onPolishSingleShot(shot.index)}
                                    disabled={polishingShotIndex !== null || !modelOutfitImgUrl}
                                    style={{
                                      fontSize: '9px',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      background: isPolishing ? 'var(--accent-purple)' : 'linear-gradient(135deg, rgba(121, 40, 202, 0.15) 0%, rgba(0, 242, 254, 0.1) 100%)',
                                      border: '1px solid rgba(121, 40, 202, 0.4)',
                                      color: isPolishing ? '#fff' : '#c084fc',
                                      cursor: polishingShotIndex !== null || !modelOutfitImgUrl ? 'not-allowed' : 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title="结合当前选定的服装品类力学与运镜风格，针对该分镜进行独立优化润色"
                                  >
                                    {isPolishing ? (
                                      <>
                                        <div style={{ border: '1px solid #fff', borderTop: '1px solid transparent', borderRadius: '50%', width: '7px', height: '7px', animation: 'spin 1s linear infinite' }} />
                                        <span>润色中</span>
                                      </>
                                    ) : (
                                      <>
                                        <span>✨</span>
                                        <span>AI润色</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Quick Inspiration Chip Tray */}
                            {showInspiration && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '4px',
                                  padding: '6px',
                                  background: 'var(--bg-element)',
                                  borderRadius: '5px',
                                  border: '1px dashed var(--border-color)',
                                  animation: 'fadeIn 0.2s ease'
                                }}
                              >
                                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', width: '100%', marginBottom: '2px' }}>
                                  点击下方灵感词直接追加至该分镜：
                                </span>
                                {QUICK_INSPIRATIONS.map((chip, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                      const updated = currentVal ? `${currentVal.replace(/[，,、\s]+$/, '')}，${chip.text}` : chip.text;
                                      updateShotPrompt(shot.key, updated);
                                    }}
                                    style={{
                                      fontSize: '9px',
                                      padding: '2px 6px',
                                      borderRadius: '3px',
                                      background: 'var(--card-bg)',
                                      border: '1px solid var(--border-color)',
                                      color: 'var(--text-primary)',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {chip.label}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Embedded Prompt Library Tray */}
                            {showLibrary && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '6px',
                                  padding: '8px',
                                  background: 'rgba(124, 58, 237, 0.05)',
                                  borderRadius: '6px',
                                  border: '1px dashed rgba(124, 58, 237, 0.3)',
                                  animation: 'fadeIn 0.2s ease'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 600 }}>
                                    📚 推荐适应该分镜的电商词库灵感：
                                  </span>
                                  {onNavigateToPromptTab && (
                                    <button
                                      type="button"
                                      onClick={onNavigateToPromptTab}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#00f2fe',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        padding: 0
                                      }}
                                    >
                                      打开完整词库 →
                                    </button>
                                  )}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {shotLibraryItems.map(item => {
                                    const interpolated = interpolatePromptVariables(item.content, projectVariables);
                                    return (
                                      <div
                                        key={item.id}
                                        style={{
                                          padding: '5px 8px',
                                          borderRadius: '4px',
                                          background: 'var(--bg-surface-solid)',
                                          border: '1px solid var(--border-color)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: '6px'
                                        }}
                                      >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                            {item.title}
                                          </div>
                                          <div
                                            style={{
                                              fontSize: '9px',
                                              color: 'var(--text-secondary)',
                                              whiteSpace: 'nowrap',
                                              overflow: 'hidden',
                                              textOverflow: 'ellipsis'
                                            }}
                                            title={interpolated}
                                          >
                                            {interpolated}
                                          </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const updated = currentVal
                                                ? `${currentVal.replace(/[，,、\s]+$/, '')}，${interpolated}`
                                                : interpolated;
                                              updateShotPrompt(shot.key, updated);
                                              toast.success(`已追加「${item.title}」至${shot.title.slice(0, 4)}`);
                                            }}
                                            style={{
                                              fontSize: '9px',
                                              padding: '2px 5px',
                                              borderRadius: '3px',
                                              background: 'rgba(0, 242, 254, 0.12)',
                                              border: '1px solid rgba(0, 242, 254, 0.3)',
                                              color: '#00f2fe',
                                              cursor: 'pointer'
                                            }}
                                            title="追加至当前分镜末尾"
                                          >
                                            追加
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              updateShotPrompt(shot.key, interpolated);
                                              toast.success(`已替换${shot.title.slice(0, 4)}为「${item.title}」`);
                                            }}
                                            style={{
                                              fontSize: '9px',
                                              padding: '2px 5px',
                                              borderRadius: '3px',
                                              background: 'rgba(124, 58, 237, 0.15)',
                                              border: '1px solid rgba(124, 58, 237, 0.4)',
                                              color: '#c084fc',
                                              cursor: 'pointer'
                                            }}
                                            title="完全替换当前分镜"
                                          >
                                            替换
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Textarea Input */}
                            <textarea
                              value={currentVal}
                              onChange={(e) => updateShotPrompt(shot.key, e.target.value)}
                              className="text-input"
                              rows={3}
                              placeholder={shot.tip}
                              style={{
                                padding: '8px 10px',
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

                            {/* Live Character Count */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '9px', color: 'var(--text-secondary)' }}>
                              <span>{currentVal.length} 字</span>
                            </div>
                          </div>
                        );
                      })}
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
