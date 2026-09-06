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
}

export function AIWizardPanel({ contentRef, step, onStepChange, tryOnProps, storyboardProps, videoProps, configExpanded, onConfigToggle, backendUrl }: Props) {
  return <>
    <div className="drawer-header"><div className="drawer-title">AI 智能设计中心</div><div className="drawer-subtitle">依托深度算法，零门槛进行服装美化</div></div>
    <div ref={contentRef} className="drawer-content ai-wizard-content">
      <AIWizardNavigation currentStep={step} onStepChange={onStepChange} />
      {step === 1 && <TryOnStep {...tryOnProps} />}
      {step === 2 && <StoryboardStep {...storyboardProps} />}
      {step === 3 && <VideoStep {...videoProps} />}
      <AIServiceStatusCard expanded={configExpanded} onToggle={onConfigToggle} backendUrl={backendUrl} />
    </div>
  </>;
}
