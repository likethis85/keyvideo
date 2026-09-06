import { useCallback, useRef, useState } from 'react';

export type AiWizardStep = 1 | 2 | 3;

export function useAiWizardNavigation() {
  const aiDrawerContentRef = useRef<HTMLDivElement | null>(null);
  const [aiWizardStep, setAiWizardStep] = useState<AiWizardStep>(1);

  const changeAiWizardStep = useCallback((step: AiWizardStep) => {
    setAiWizardStep(step);
    requestAnimationFrame(() => {
      aiDrawerContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  return { aiDrawerContentRef, aiWizardStep, changeAiWizardStep };
}
