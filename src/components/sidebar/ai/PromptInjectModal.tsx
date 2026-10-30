import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PromptItem } from '../../../config/promptLibraryData';
import {
  resolvePromptVariables,
  interpolatePromptVariables,
  type PromptVariableContext
} from '../../../utils/promptVariableInterpolator';
import { parseFiveShotPrompt } from '../../../services/storyboardPromptParser';

export type InjectionTarget =
  | 'shot-1'
  | 'shot-2'
  | 'shot-3'
  | 'shot-4'
  | 'shot-5'
  | 'master'
  | 'text_layer';

export type InjectionMode = 'append' | 'replace' | 'prepend';

interface PromptInjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PromptItem | null;
  variableContext: PromptVariableContext;
  currentMasterPrompt: string;
  onConfirmInject: (params: {
    target: InjectionTarget;
    mode: InjectionMode;
    text: string;
    navigateToStoryboard?: boolean;
  }) => void;
}

const SHOT_OPTIONS: Array<{ key: InjectionTarget; label: string; icon: string; desc: string }> = [
  { key: 'shot-1', label: '分镜一：出场与吸睛钩子', icon: '🚶‍♀️', desc: '0-3s 模特走入画面，建立第一眼记忆点' },
  { key: 'shot-2', label: '分镜二：细节特写微距推镜', icon: '🔍', desc: '3-6s 聚焦面料、缝线和服装工艺' },
  { key: 'shot-3', label: '分镜三：张力与律动步态', icon: '💃', desc: '6-9s 走秀动感、环绕与裙摆垂坠' },
  { key: 'shot-4', label: '分镜四：微动与物理褶皱', icon: '✨', desc: '9-12s 侧身微动，表现真实重力关系' },
  { key: 'shot-5', label: '分镜五：黄金定格全身比例', icon: '👑', desc: '12-15s 全身定格，完成品牌展示与促单' },
  { key: 'master', label: '15s 完整主提示词', icon: '📜', desc: '写入全局连贯五幕脚本' },
  { key: 'text_layer', label: '时间轴文案图层', icon: '📝', desc: '加入可编辑的字幕图层，可在剪辑页调整' }
];

const INJECTION_MODES: Array<{ mode: InjectionMode; label: string; icon: string; desc: string }> = [
  { mode: 'append', label: '追加到末尾', icon: '＋', desc: '保留原内容，补充新灵感' },
  { mode: 'replace', label: '替换当前内容', icon: '↻', desc: '用新提示词覆盖当前镜头' },
  { mode: 'prepend', label: '置于开头', icon: '↥', desc: '让新提示词优先生效' }
];

const targetLabel = (target: InjectionTarget) => {
  if (target === 'master') return '15s 完整主提示词';
  if (target === 'text_layer') return '时间轴文案图层';
  return SHOT_OPTIONS.find(option => option.key === target)?.label || '当前分镜';
};

export const PromptInjectModal: React.FC<PromptInjectModalProps> = ({
  isOpen,
  onClose,
  item,
  variableContext,
  currentMasterPrompt,
  onConfirmInject
}) => {
  const variables = useMemo(() => resolvePromptVariables(variableContext), [variableContext]);
  const interpolatedContent = interpolatePromptVariables(item?.content ?? '', variables);
  const initialTarget: InjectionTarget = useMemo(() => {
    if (item?.recommendedShot && item.recommendedShot !== 'all') return item.recommendedShot;
    if (item?.category === 'copy') return 'shot-1';
    if (item?.category === 'fabric') return 'shot-2';
    return 'shot-1';
  }, [item]);
  const [selectedTarget, setSelectedTarget] = useState<InjectionTarget>(initialTarget);
  const [injectionMode, setInjectionMode] = useState<InjectionMode>('append');
  const [useInterpolated, setUseInterpolated] = useState(true);
  const [customText, setCustomText] = useState(interpolatedContent);

  useEffect(() => {
    setCustomText(useInterpolated ? interpolatedContent : (item?.content ?? ''));
    setSelectedTarget(initialTarget);
  }, [item, interpolatedContent, useInterpolated, initialTarget]);

  const parsedCurrentShots = useMemo(() => parseFiveShotPrompt(currentMasterPrompt), [currentMasterPrompt]);
  const previewResult = useMemo(() => {
    if (selectedTarget === 'text_layer') return `将在时间轴新增文案图层：${customText}`;
    if (selectedTarget === 'master') {
      if (injectionMode === 'replace') return customText;
      if (injectionMode === 'prepend') return currentMasterPrompt ? `${customText}，${currentMasterPrompt}` : customText;
      return currentMasterPrompt ? `${currentMasterPrompt}，${customText}` : customText;
    }
    const currentShotText = parsedCurrentShots[selectedTarget as keyof typeof parsedCurrentShots] || '';
    if (injectionMode === 'replace') return customText;
    if (injectionMode === 'prepend') return currentShotText ? `${customText}，${currentShotText}` : customText;
    return currentShotText ? `${currentShotText.replace(/[，,、\s]+$/, '')}，${customText}` : customText;
  }, [selectedTarget, injectionMode, customText, parsedCurrentShots, currentMasterPrompt]);

  if (!isOpen || !item) return null;

  const handleConfirm = (navigateToStoryboard = false) => {
    if (!customText.trim()) {
      window.alert('请先填写要注入的内容');
      return;
    }
    onConfirmInject({ target: selectedTarget, mode: injectionMode, text: customText.trim(), navigateToStoryboard });
    onClose();
  };

  return createPortal(
    <div className="prompt-inject-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="prompt-inject-modal" role="dialog" aria-modal="true" aria-labelledby="prompt-inject-title">
        <header className="prompt-inject-header">
          <div className="prompt-inject-heading"><span className="prompt-inject-mark">⚡</span><div><h2 id="prompt-inject-title">定向注入分镜向导</h2><p>将「{item.title}」应用到剪辑工程中的指定位置</p></div></div>
          <button type="button" className="prompt-inject-close" onClick={onClose} aria-label="关闭注入向导">×</button>
        </header>

        <div className="prompt-inject-body">
          <section className="prompt-inject-section">
            <div className="prompt-inject-section-title"><span>01</span><div><b>选择注入目标</b><small>决定这段灵感写入哪个剪辑内容</small></div></div>
            <div className="prompt-inject-targets">{SHOT_OPTIONS.map(option => <button key={option.key} type="button" className={selectedTarget === option.key ? 'active' : ''} onClick={() => setSelectedTarget(option.key)}><span className="prompt-inject-option-icon">{option.icon}</span><span><b>{option.label}</b><small>{option.desc}</small></span>{selectedTarget === option.key && <i>✓</i>}</button>)}</div>
          </section>

          {selectedTarget !== 'text_layer' && <section className="prompt-inject-section"><div className="prompt-inject-section-title"><span>02</span><div><b>选择注入方式</b><small>预览会实时反映当前操作</small></div></div><div className="prompt-inject-modes">{INJECTION_MODES.map(option => <button key={option.mode} type="button" className={injectionMode === option.mode ? 'active' : ''} onClick={() => setInjectionMode(option.mode)}><strong>{option.icon}</strong><span><b>{option.label}</b><small>{option.desc}</small></span></button>)}</div></section>}

          <section className="prompt-inject-section"><div className="prompt-inject-section-title"><span>{selectedTarget === 'text_layer' ? '02' : '03'}</span><div><b>编辑注入内容</b><small>可以直接修改，确认后会同步到当前项目</small></div>{item.hasVariables && <button type="button" className={`prompt-inject-variable-toggle ${useInterpolated ? 'active' : ''}`} onClick={() => setUseInterpolated(previous => !previous)}>{useInterpolated ? '已填充项目变量' : '使用变量模板'}</button>}</div><textarea className="prompt-inject-editor" value={customText} onChange={event => setCustomText(event.target.value)} rows={4} placeholder="输入要注入到分镜或时间轴的内容" /><div className="prompt-inject-editor-meta"><span>{customText.length} 字</span><button type="button" onClick={() => setCustomText('')} disabled={!customText}>清空内容</button></div></section>

          <section className="prompt-inject-preview"><div className="prompt-inject-preview-title"><span>✓</span><div><b>注入结果预览</b><small>{targetLabel(selectedTarget)} · {selectedTarget === 'text_layer' ? '新增图层' : INJECTION_MODES.find(mode => mode.mode === injectionMode)?.label}</small></div></div><p>{previewResult || '填写内容后，这里会显示注入后的最终结果'}</p></section>
        </div>

        <footer className="prompt-inject-footer"><span>确认后可在剪辑页继续调整，支持 Ctrl + Z 撤销</span><div><button type="button" className="prompt-inject-cancel" onClick={onClose}>取消</button><button type="button" className="prompt-inject-secondary" onClick={() => handleConfirm(false)}>⚡ 仅注入</button><button type="button" className="prompt-inject-primary" onClick={() => handleConfirm(true)}>🚀 注入并前往分镜向导</button></div></footer>
      </section>
    </div>,
    document.body
  );
};
