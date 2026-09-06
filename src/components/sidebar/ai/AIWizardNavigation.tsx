interface AIWizardNavigationProps {
  currentStep: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
}

const steps = [
  { step: 1 as const, label: '1. 服装试衣' },
  { step: 2 as const, label: '2. 场景分镜' },
  { step: 3 as const, label: '3. 视频生成' }
];

export function AIWizardNavigation({ currentStep, onStepChange }: AIWizardNavigationProps) {
  return (
    <div className="ai-step-nav">
      {steps.map(item => (
        <button
          key={item.step}
          type="button"
          aria-pressed={currentStep === item.step}
          className={currentStep === item.step ? 'active' : ''}
          onClick={() => onStepChange(item.step)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
