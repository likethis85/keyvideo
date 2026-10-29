import React, { useState } from 'react';
import { SCRIPT_TEMPLATES, type ScriptTemplate } from '../../config/scriptTemplates';

export interface OnboardingResult {
  name: string;
  ratio: '9-16' | '16-9';
  template: ScriptTemplate;
}

interface OnboardingWizardProps {
  isOpen: boolean;
  onSkip: () => void;
  onComplete: (result: OnboardingResult) => void;
}

const STEPS = [
  { title: '新建项目', desc: '命名、画幅，确定这条片子' },
  { title: '选择内容脚本', desc: '口播 / 穿搭 / 产品展示' },
  { title: '导入素材，开始创作', desc: '上传图片或使用示例素材' }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ isOpen, onSkip, onComplete }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('2026 秋冬 · 通勤羊毛大衣口播');
  const [ratio, setRatio] = useState<'9-16' | '16-9'>('9-16');
  const [templateId, setTemplateId] = useState(SCRIPT_TEMPLATES[0].id);

  if (!isOpen) return null;

  const selectedTemplate = SCRIPT_TEMPLATES.find(template => template.id === templateId) ?? SCRIPT_TEMPLATES[0];
  const finish = () => onComplete({
    name: name.trim() || '我的第一个项目',
    ratio,
    template: selectedTemplate
  });

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-label="首次使用引导">
      <div className="onboarding-modal">
        <aside className="onboarding-rail">
          <div className="onboarding-brand">
            <div className="onboarding-brand-mark">✦</div>
            <div>
              <b>KeyVideo</b>
              <span>智能剪辑工作台</span>
            </div>
          </div>

          <div className="onboarding-rail-copy">
            <h2>3 步，做出你的<br /><em>第一条视频</em></h2>
            <p>先建项目、再选脚本，最后导入素材。<br />每一步都能随时跳过。</p>
          </div>

          <div className="onboarding-step-list">
            {STEPS.map((item, index) => (
              <div key={item.title} className={`onboarding-step-item ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}>
                <span className="onboarding-step-number">{index < step ? '✓' : `0${index + 1}`}</span>
                <div>
                  <b>{item.title}</b>
                  <small>{item.desc}</small>
                </div>
              </div>
            ))}
          </div>

          <p className="onboarding-rail-note">完成后可在左上角切换项目。<br />脚本和素材都会自动保存在当前项目。</p>
        </aside>

        <section className="onboarding-main">
          <div className="onboarding-step-meta">STEP {step + 1} OF 3</div>

          {step === 0 && (
            <div className="onboarding-panel">
              <h3>先给这条视频起个名字</h3>
              <p>项目是后续脚本、分镜、时间轴和素材的容器。之后可以在左上角随时切换。</p>

              <label className="onboarding-field-label" htmlFor="onboarding-project-name">项目名称</label>
              <input
                id="onboarding-project-name"
                className="onboarding-input"
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={40}
                autoFocus
              />

              <div className="onboarding-label-row">
                <span className="onboarding-field-label">视频画幅</span>
                <small>影响分镜与导出</small>
              </div>
              <div className="onboarding-ratio-grid">
                <button
                  type="button"
                  className={`onboarding-ratio ${ratio === '9-16' ? 'active' : ''}`}
                  onClick={() => setRatio('9-16')}
                >
                  <span className="onboarding-ratio-shape portrait" />
                  <b>9:16</b>
                  <small>抖音 / 视频号</small>
                </button>
                <button
                  type="button"
                  className={`onboarding-ratio ${ratio === '16-9' ? 'active' : ''}`}
                  onClick={() => setRatio('16-9')}
                >
                  <span className="onboarding-ratio-shape landscape" />
                  <b>16:9</b>
                  <small>横屏 / 官网</small>
                </button>
              </div>

              <div className="onboarding-hint">💡 不知道选什么？先用 9:16，后面可以在项目设置里改，不会清空现有内容。</div>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-panel">
              <h3>这条片子想怎么讲？</h3>
              <p>先选一个内容脚本。它会预填主提示词、分镜提示词和字幕节奏，不是滤镜。</p>
              <div className="onboarding-template-grid">
                {SCRIPT_TEMPLATES.map(template => (
                  <button
                    type="button"
                    key={template.id}
                    className={`onboarding-template ${template.id === templateId ? 'active' : ''}`}
                    onClick={() => setTemplateId(template.id)}
                    style={{ '--template-accent': template.accent } as React.CSSProperties}
                  >
                    <span className="onboarding-template-icon">{template.icon}</span>
                    <span className="onboarding-template-name">{template.title}</span>
                    <span className="onboarding-template-meta">{template.duration} · {template.shots}</span>
                    <span className="onboarding-template-desc">{template.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-panel">
              <h3>准备开拍</h3>
              <p>项目创建后，直接从素材库上传服装图、模特图或本地视频。没有素材也可以先用示例走一遍。</p>
              <div className="onboarding-summary">
                <div><span>项目</span><b>{name.trim() || '我的第一个项目'}</b></div>
                <div><span>画幅</span><b>{ratio === '9-16' ? '9:16 竖屏' : '16:9 横屏'}</b></div>
                <div><span>脚本</span><b>{selectedTemplate.title}</b></div>
                <div><span>预填</span><b>{selectedTemplate.prefill}</b></div>
              </div>
              <div className="onboarding-hint">下一步会创建项目并打开素材库；上传入口就在素材库顶部。</div>
            </div>
          )}

          <footer className="onboarding-footer">
            <div className="onboarding-dots">
              {STEPS.map((item, index) => (
                <span key={item.title} className={index === step ? 'active' : ''} />
              ))}
            </div>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-skip" onClick={onSkip}>跳过引导</button>
              {step > 0 && (
                <button type="button" className="onboarding-back" onClick={() => setStep(previous => previous - 1)}>上一步</button>
              )}
              <button
                type="button"
                className="onboarding-next"
                onClick={() => step < 2 ? setStep(previous => previous + 1) : finish()}
              >
                {step < 2 ? '下一步 →' : '创建项目，开始创作 →'}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );
};
