import { useEffect, useRef, useState } from 'react';
import { RATIO_CONFIGS } from '../../utils/smartReflow';
import type { AspectRatio } from '../../utils/smartReflow';

interface Props {
  ratio: AspectRatio;
  onRatioChange: (ratio: AspectRatio) => void;
  onSmartReflow: () => void;
}

const ratios: AspectRatio[] = ['9-16', '3-4', '1-1', '16-9'];
const dimensions: Record<AspectRatio, { width: number; height: number }> = {
  '9-16': { width: 10, height: 16 }, '3-4': { width: 11, height: 14 },
  '1-1': { width: 12, height: 12 }, '16-9': { width: 16, height: 9 }
};

function RatioIcon({ ratio }: { ratio: AspectRatio }) {
  const size = dimensions[ratio];
  return <span className="ratio-icon-wrap"><span className="ratio-icon" style={{ width: size.width, height: size.height }} /></span>;
}

function ReflowIcon() {
  return <svg className="ratio-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h7M4 12h5M4 17h7" /><path d="m15 5 5 3-5 3V5Zm0 8 5 3-5 3v-6Z" /></svg>;
}

function ChevronIcon() {
  return <svg className="ratio-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

export function AspectRatioSelector({ ratio, onRatioChange, onSmartReflow }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="ratio-selector" ref={rootRef}>
      <div className="ratio-selector-pill">
        <button className="ratio-trigger" onClick={() => setOpen(value => !value)} title={`当前画幅：${RATIO_CONFIGS[ratio].label}（${RATIO_CONFIGS[ratio].name}）`}>
          <RatioIcon ratio={ratio} /><span>{RATIO_CONFIGS[ratio].label}</span><span className={open ? 'ratio-chevron open' : 'ratio-chevron'}><ChevronIcon /></span>
        </button>
        <span className="ratio-divider" />
        <button className="ratio-reflow" onClick={onSmartReflow} title="依据当前画幅安全边距自动重排文本与贴纸"><ReflowIcon /><span>智能排版</span></button>
      </div>
      {open && <div className="ratio-menu"><div className="ratio-menu-heading"><strong>画幅比例</strong><small>选择发布平台与画面方向</small></div>{ratios.map(key => { const config = RATIO_CONFIGS[key]; return <button key={key} className={ratio === key ? 'active' : ''} onClick={() => { onRatioChange(key); setOpen(false); }}><RatioIcon ratio={key} /><span><b>{config.label} <small>({config.name})</small></b><small>{config.platform}</small></span>{ratio === key && <i aria-label="当前选择"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></i>}</button>; })}</div>}
    </div>
  );
}
