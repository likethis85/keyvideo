import React, { useState, useMemo } from 'react';
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
  { key: 'shot-1', label: '分镜一：出场与吸睛钩子', icon: '🚶‍♀️', desc: '0-3s 模特走入画面或前3秒视觉抓眼球' },
  { key: 'shot-2', label: '分镜二：细节特写微距推镜', icon: '🔍', desc: '3-6s 聚焦面料细节、做工缝线与领口' },
  { key: 'shot-3', label: '分镜三：张力与律动步态', icon: '💃', desc: '6-9s 360°环绕、走秀动感与裙摆垂坠' },
  { key: 'shot-4', label: '分镜四：微动与物理褶皱', icon: '✨', desc: '9-12s 侧身45度、真实重力微动' },
  { key: 'shot-5', label: '分镜五：黄金定格全身比例', icon: '👑', desc: '12-15s 广角全身定格、品牌出镜与促单' },
  { key: 'master', label: '15s 完整主提示词', icon: '📜', desc: '追加至全局连贯 5 幕脚本' },
  { key: 'text_layer', label: '创建为画布文案图层', icon: '📝', desc: '在时间轴上生成可编辑的带动画文字图层' }
];

export const PromptInjectModal: React.FC<PromptInjectModalProps> = ({
  isOpen,
  onClose,
  item,
  variableContext,
  currentMasterPrompt,
  onConfirmInject
}) => {
  // 1. Resolve variables
  const variables = useMemo(() => resolvePromptVariables(variableContext), [variableContext]);

  // 2. Interpolate prompt content
  const interpolatedContent = interpolatePromptVariables(item?.content ?? '', variables);

  // 3. Determine initial recommended target
  const initialTarget: InjectionTarget = useMemo(() => {
    if (item?.recommendedShot && item.recommendedShot !== 'all') {
      return item.recommendedShot;
    }
    if (item?.category === 'copy') return 'shot-1';
    if (item?.category === 'fabric') return 'shot-2';
    return 'shot-1';
  }, [item]);

  const [selectedTarget, setSelectedTarget] = useState<InjectionTarget>(initialTarget);
  const [injectionMode, setInjectionMode] = useState<InjectionMode>('append');
  const [useInterpolated, setUseInterpolated] = useState(true);
  const [customText, setCustomText] = useState(interpolatedContent);

  // Synchronize when item changes
  React.useEffect(() => {
    setCustomText(useInterpolated ? interpolatedContent : (item?.content ?? ''));
    setSelectedTarget(initialTarget);
  }, [item, interpolatedContent, useInterpolated, initialTarget]);

  // 4. Calculate target preview
  const parsedCurrentShots = useMemo(() => {
    return parseFiveShotPrompt(currentMasterPrompt);
  }, [currentMasterPrompt]);

  const previewResult = useMemo(() => {
    if (selectedTarget === 'text_layer') {
      return `[将在画布新增文字图层]: "${customText}"`;
    }
    if (selectedTarget === 'master') {
      if (injectionMode === 'replace') return customText;
      if (injectionMode === 'prepend') return `${customText}，${currentMasterPrompt}`;
      return `${currentMasterPrompt}，${customText}`;
    }

    const currentShotText = parsedCurrentShots[selectedTarget as keyof typeof parsedCurrentShots] || '';
    if (injectionMode === 'replace') return customText;
    if (injectionMode === 'prepend') {
      return currentShotText ? `${customText}，${currentShotText}` : customText;
    }
    return currentShotText ? `${currentShotText.replace(/[，,、\s]+$/, '')}，${customText}` : customText;
  }, [selectedTarget, injectionMode, customText, parsedCurrentShots, currentMasterPrompt]);

  if (!isOpen || !item) return null;

  const handleConfirm = (navigateToStoryboard = false) => {
    onConfirmInject({
      target: selectedTarget,
      mode: injectionMode,
      text: customText,
      navigateToStoryboard
    });
    onClose();
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '580px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: 'linear-gradient(135deg, #161826 0%, #10121d 100%)',
          border: '1px solid rgba(138, 43, 226, 0.4)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(124, 58, 237, 0.2)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #00f2fe 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.3px' }}>
                定向注入分镜向导
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                将「{item.title}」结合当前服装与模特参数精准注入
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '18px 20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* Target Shot Selector Matrix */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '8px' }}>
              🎯 选择注入目标
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {SHOT_OPTIONS.map(opt => {
                const isSelected = selectedTarget === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedTarget(opt.key)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isSelected
                        ? '1px solid #00f2fe'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected
                        ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)'
                        : 'rgba(255, 255, 255, 0.03)',
                      color: isSelected ? '#ffffff' : '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '9px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Injection Mode */}
          {selectedTarget !== 'text_layer' && (
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                🔀 注入操作方式
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {[
                  { mode: 'append' as const, label: '追加至末尾 (推荐)', icon: '➕' },
                  { mode: 'replace' as const, label: '完全替换该镜头', icon: '🔄' },
                  { mode: 'prepend' as const, label: '前置于开头', icon: '⏮️' }
                ].map(m => (
                  <button
                    key={m.mode}
                    type="button"
                    onClick={() => setInjectionMode(m.mode)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: injectionMode === m.mode
                        ? '1px solid #7c3aed'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      background: injectionMode === m.mode ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      color: injectionMode === m.mode ? '#ffffff' : '#94a3b8',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Variable Toggle & Text Editor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1' }}>
                📝 注入文本内容
              </span>
              {item.hasVariables && (
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !useInterpolated;
                    setUseInterpolated(nextVal);
                    setCustomText(nextVal ? interpolatedContent : item.content);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: useInterpolated ? '#00f2fe' : '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{useInterpolated ? '⚡ 已填充项目变量 (点击切回模板)' : '⚙️ 原始变量模板 (点击自动填充)'}</span>
                </button>
              )}
            </div>

            <textarea
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '11px',
                lineHeight: '1.6',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Real-Time Preview after injection */}
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px dashed rgba(0, 242, 254, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>👁️ 注入后实时合成效果预览</span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#e2e8f0',
                lineHeight: '1.5',
                maxHeight: '70px',
                overflowY: 'auto'
              }}
            >
              {previewResult}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            style={{ padding: '6px 14px', fontSize: '12px', margin: 0 }}
          >
            取消
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => handleConfirm(false)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              margin: 0,
              background: 'rgba(124, 58, 237, 0.15)',
              borderColor: 'rgba(124, 58, 237, 0.4)',
              color: '#c084fc'
            }}
          >
            ⚡ 仅注入
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleConfirm(true)}
            style={{
              padding: '6px 18px',
              fontSize: '12px',
              fontWeight: 700,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #00f2fe 100%)',
              boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)'
            }}
          >
            <span>🚀 注入并前往分镜向导</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
