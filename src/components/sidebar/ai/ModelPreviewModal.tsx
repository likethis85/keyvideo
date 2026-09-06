import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { StoryboardItem } from '../../../types/aiProject';

export interface PreviewModelState {
  id?: string;
  src: string;
  name: string;
  storyboardId?: string;
}

interface ModelPreviewModalProps {
  preview: PreviewModelState | null;
  storyboards: StoryboardItem[];
  editingName: boolean;
  nameValue: string;
  storyboardPrompt: string;
  storyboardBackground: string | null;
  outfitPrompt: string;
  poseImage: string | null;
  usePoseCameraFraming: boolean;
  modelPrompt: string;
  regeneratingStoryboardId: string | null;
  outfitGenerating: boolean;
  modelGenerating: boolean;
  isOutfitPreview: boolean;
  onClose: () => void;
  onPreviewChange: (preview: PreviewModelState) => void;
  onStartRename: () => void;
  onCancelRename: () => void;
  onNameChange: (value: string) => void;
  onSaveName: () => void | Promise<void>;
  onDownload: (url: string, name: string) => void | Promise<void>;
  onStoryboardPromptChange: (value: string) => void;
  onStoryboardBackgroundChange: (value: string | null) => void;
  onRegenerateStoryboard: (id: string, prompt: string, background: string | null) => void | Promise<void>;
  onOutfitPromptChange: (value: string) => void;
  onPoseUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPoseImageClear: () => void;
  onPoseCameraFramingChange: (value: boolean) => void;
  onGenerateOutfit: () => void | Promise<void>;
  onModelPromptChange: (value: string) => void;
  onEditModel: () => void | Promise<void>;
  onApplyModel: (src: string, name: string) => void;
}

export function ModelPreviewModal(props: ModelPreviewModalProps) {
  useEffect(() => {
    if (!props.preview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props.preview, props.onClose]);

  if (!props.preview) return null;
  const preview = props.preview;
  const storyboardIndex = preview.storyboardId
    ? props.storyboards.findIndex(item => item.id === preview.storyboardId)
    : -1;
  const storyboardLoading = !!preview.storyboardId && props.regeneratingStoryboardId === preview.storyboardId;
  const loading = storyboardLoading || (!preview.storyboardId && (props.outfitGenerating || props.modelGenerating));

  const navigate = (offset: number) => {
    const item = props.storyboards[storyboardIndex + offset];
    if (item) {
      props.onPreviewChange({ src: item.imageSrc, name: `${item.name} (静态分镜)`, storyboardId: item.id });
    }
  };

  const loadBackground = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => props.onStoryboardBackgroundChange(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const previewTypeTitle = preview.storyboardId
    ? '分镜预览'
    : props.isOutfitPreview
    ? '穿搭图预览'
    : '模特卡预览';

  const previewIcon = preview.storyboardId ? '🎬' : props.isOutfitPreview ? '👗' : '👤';

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 6, 12, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: '640px',
          maxWidth: '92vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--modal-bg, #14151f)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
          borderRadius: '16px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          color: 'var(--text-primary, #ffffff)',
          boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border-color, rgba(255, 255, 255, 0.05))',
          position: 'relative'
        }}
        onClick={event => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            paddingBottom: '14px'
          }}
        >
          {props.editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginRight: '16px' }}>
              <input
                value={props.nameValue}
                onChange={event => props.onNameChange(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void props.onSaveName();
                  if (event.key === 'Escape') props.onCancelRename();
                }}
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--accent-purple, #8a2be2)',
                  background: 'var(--bg-element, rgba(255, 255, 255, 0.05))',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => void props.onSaveName()}
              >
                保存
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={props.onCancelRename}
              >
                取消
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.2), rgba(0, 242, 254, 0.15))',
                  border: '1px solid rgba(138, 43, 226, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                {previewIcon}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary, #ffffff)' }}>
                    {previewTypeTitle}: {preview.name}
                  </h3>
                  {preview.id && (
                    <button
                      type="button"
                      onClick={props.onStartRename}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary, #9ca3af)',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.color = 'var(--text-primary, #ffffff)';
                        e.currentTarget.style.background = 'var(--bg-element-hover, rgba(255,255,255,0.08))';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
                        e.currentTarget.style.background = 'transparent';
                      }}
                      title="重命名"
                    >
                      ✎ 改名
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void props.onDownload(preview.src, preview.name || 'model_outfit_image')}
              style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="下载当前原图到本地"
            >
              <span>📥</span>
              <span>下载图片</span>
            </button>
            <button
              type="button"
              onClick={props.onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #9ca3af)',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = 'var(--bg-element-hover, rgba(255,255,255,0.08))';
                e.currentTarget.style.color = 'var(--text-primary, #ffffff)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
              }}
              title="关闭 (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Image Preview Container with Carousel Arrows */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
          {preview.storyboardId && (
            <button
              type="button"
              disabled={storyboardIndex <= 0 || storyboardLoading}
              onClick={() => navigate(-1)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                background: 'var(--bg-element, rgba(255,255,255,0.06))',
                color: 'var(--text-primary, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                cursor: storyboardIndex <= 0 || storyboardLoading ? 'not-allowed' : 'pointer',
                opacity: storyboardIndex <= 0 || storyboardLoading ? 0.3 : 1,
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              title="上一个分镜"
            >
              ‹
            </button>
          )}

          <div
            style={{
              position: 'relative',
              flex: 1,
              maxHeight: '48vh',
              background: '#07080d',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}
          >
            <img
              src={preview.src}
              alt={preview.name}
              style={{
                maxWidth: '100%',
                maxHeight: '45vh',
                objectFit: 'contain',
                borderRadius: '8px',
                opacity: loading ? 0.3 : 1,
                transition: 'opacity 0.2s ease'
              }}
            />
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  background: 'rgba(7, 8, 13, 0.75)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.2)',
                    borderTopColor: 'var(--accent-purple, #8a2be2)',
                    animation: 'spin 0.8s linear infinite'
                  }}
                />
                <span>⏳ 正在重新生成，请稍候...</span>
              </div>
            )}
          </div>

          {preview.storyboardId && (
            <button
              type="button"
              disabled={storyboardIndex < 0 || storyboardIndex >= props.storyboards.length - 1 || storyboardLoading}
              onClick={() => navigate(1)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
                background: 'var(--bg-element, rgba(255,255,255,0.06))',
                color: 'var(--text-primary, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                cursor: storyboardIndex < 0 || storyboardIndex >= props.storyboards.length - 1 || storyboardLoading ? 'not-allowed' : 'pointer',
                opacity: storyboardIndex < 0 || storyboardIndex >= props.storyboards.length - 1 || storyboardLoading ? 0.3 : 1,
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              title="下一个分镜"
            >
              ›
            </button>
          )}
        </div>

        {/* Controls Section Based on Mode */}
        {preview.storyboardId ? (
          /* Case 1: Storyboard shot adjustment */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--card-bg, rgba(255, 255, 255, 0.02))',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #9ca3af)' }}>
                ✨ 修改/局部重绘提示词
              </label>
              <textarea
                value={props.storyboardPrompt}
                onChange={event => props.onStoryboardPromptChange(event.target.value)}
                placeholder="例如：模特微微侧身，面部表情自然微笑，背景光线稍微明亮一些..."
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  background: 'var(--bg-element, rgba(255, 255, 255, 0.05))',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            {/* Background reference */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>
              <span>场景参考图：</span>
              {props.storyboardBackground ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={props.storyboardBackground}
                    alt="场景参考"
                    style={{ width: 44, height: 44, borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => props.onStoryboardBackgroundChange(null)}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    ✕ 移除
                  </button>
                </div>
              ) : (
                <label
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', margin: 0 }}
                >
                  📁 上传场景图
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={event => loadBackground(event.target.files?.[0])}
                  />
                </label>
              )}
            </div>

            {/* Bottom buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button type="button" className="btn-secondary" onClick={props.onClose} style={{ padding: '8px 18px', fontSize: '13px' }}>
                关闭
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={storyboardLoading}
                onClick={() => void props.onRegenerateStoryboard(preview.storyboardId!, props.storyboardPrompt, props.storyboardBackground)}
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                {storyboardLoading ? '⏳ 重新生成中...' : '🔄 重新生成此分镜'}
              </button>
            </div>
          </div>
        ) : props.isOutfitPreview ? (
          /* Case 2: Outfit model preview */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--card-bg, rgba(255, 255, 255, 0.02))',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #9ca3af)' }}>
                ✨ 穿搭图修改提示词
              </label>
              <textarea
                value={props.outfitPrompt}
                onChange={event => props.onOutfitPromptChange(event.target.value)}
                placeholder="例如：提升面料光泽感，更自然的坐姿微动作，法式高级感..."
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  background: 'var(--bg-element, rgba(255, 255, 255, 0.05))',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            {/* Pose reference */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary, #9ca3af)' }}>
              <span>姿势参考：</span>
              {props.poseImage ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src={props.poseImage}
                    alt="姿势参考"
                    style={{ width: 44, height: 44, borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={props.onPoseImageClear}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    ✕ 移除姿势图
                  </button>
                </div>
              ) : (
                <label
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px', cursor: 'pointer', margin: 0 }}
                >
                  📁 上传姿势参考
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={props.onPoseUpload}
                  />
                </label>
              )}
            </div>

            {props.poseImage && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary, #9ca3af)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={props.usePoseCameraFraming}
                  onChange={event => props.onPoseCameraFramingChange(event.target.checked)}
                />
                同时参考镜头画面与景别构图
              </label>
            )}

            {/* Bottom buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button type="button" className="btn-secondary" onClick={props.onClose} style={{ padding: '8px 18px', fontSize: '13px' }}>
                关闭
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={props.outfitGenerating}
                onClick={() => void props.onGenerateOutfit()}
                style={{ padding: '8px 20px', fontSize: '13px' }}
              >
                {props.outfitGenerating ? '⏳ 重新生成中...' : '🔄 重新生成穿搭图'}
              </button>
            </div>
          </div>
        ) : preview.id ? (
          /* Case 3: Model card reference preview (with edit & apply options) */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px',
              borderRadius: '12px',
              background: 'var(--card-bg, rgba(255, 255, 255, 0.02))',
              border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary, #9ca3af)' }}>
                ✨ 模特修改提示词
              </label>
              <textarea
                value={props.modelPrompt}
                onChange={event => props.onModelPromptChange(event.target.value)}
                placeholder="例如：面部轮廓更柔和，高鼻梁，微卷黑色长发，高级摄影棚打光..."
                rows={2}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.12))',
                  background: 'var(--bg-element, rgba(255, 255, 255, 0.05))',
                  color: 'var(--text-primary, #ffffff)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            {/* Bottom buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={props.onClose}
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                关闭
              </button>
              <button
                type="button"
                onClick={() => {
                  props.onApplyModel(preview.src, preview.name);
                  props.onClose();
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'rgba(2, 132, 199, 0.15)',
                  border: '1px solid rgba(2, 132, 199, 0.35)',
                  color: 'var(--accent-cyan, #0284c7)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = 'rgba(2, 132, 199, 0.25)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'rgba(2, 132, 199, 0.15)';
                }}
              >
                <span>✓</span>
                <span>使用此模特</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={props.modelGenerating}
                onClick={() => void props.onEditModel()}
                style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 600 }}
              >
                {props.modelGenerating ? '⏳ 重新生成中...' : '🔄 重新生成模特'}
              </button>
            </div>
          </div>
        ) : (
          /* Case 4: Default fallback model preview */
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={props.onClose}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            >
              关闭
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                props.onApplyModel(preview.src, preview.name);
                props.onClose();
              }}
              style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 600 }}
            >
              ✓ 使用此模特
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
