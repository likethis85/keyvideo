import type { RefObject } from 'react';
import { AIServiceStatusCard } from './AIServiceStatusCard';
import { AIWizardNavigation } from './AIWizardNavigation';
import { TryOnStep } from './TryOnStep';
import type { TryOnStepProps } from './TryOnStep';
import { StoryboardStep } from './StoryboardStep';
import type { StoryboardStepProps } from './StoryboardStep';
import { VideoStep } from './VideoStep';
import type { VideoStepProps } from './VideoStep';

interface Props {
  contentRef: RefObject<HTMLDivElement | null>;
  step: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  tryOnProps: TryOnStepProps;
  storyboardProps: StoryboardStepProps;
  videoProps: VideoStepProps;
  configExpanded: boolean;
  onConfigToggle: () => void;
  backendUrl?: string;
  onOpenInCanvas?: (options?: { type?: 'outfit' | 'storyboard' | 'image' | 'project'; src?: string; title?: string; prompt?: string }) => void;
}

export function AIWizardPanel({
  contentRef,
  step,
  onStepChange,
  tryOnProps,
  storyboardProps,
  videoProps,
  configExpanded,
  onConfigToggle,
  backendUrl,
  onOpenInCanvas
}: Props) {
  return (
    <>
      <div className="drawer-header" style={{ position: 'relative' }}>
        <div className="drawer-title">AI 智能设计中心</div>
        <div className="drawer-subtitle">依托深度算法，零门槛进行服装美化</div>
        {onOpenInCanvas && (
          <button
            type="button"
            onClick={() => onOpenInCanvas({ type: 'project' })}
            style={{
              marginTop: '8px',
              width: '100%',
              padding: '7px 12px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.12) 0%, rgba(121, 40, 202, 0.16) 100%)',
              border: '1px solid rgba(0, 242, 254, 0.35)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
            title="在无限画布中自由排布与连线当前工程的所有分镜与服装"
          >
            <span>🎨</span>
            <span>在无限画布中展开编辑此方案</span>
          </button>
        )}
      </div>
      <div ref={contentRef} className="drawer-content ai-wizard-content">
        <AIWizardNavigation currentStep={step} onStepChange={onStepChange} />
        {step === 1 && <TryOnStep {...tryOnProps} onOpenInCanvas={onOpenInCanvas} />}
        {step === 2 && <StoryboardStep {...storyboardProps} onOpenInCanvas={onOpenInCanvas} />}
        {step === 3 && <VideoStep {...videoProps} />}
        <AIServiceStatusCard expanded={configExpanded} onToggle={onConfigToggle} backendUrl={backendUrl} />
      </div>
    </>
  );
}
