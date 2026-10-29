import { useEffect, useRef, useState } from 'react';

interface AICopilotLauncherProps {
  onClick: () => void;
}

type LauncherPosition = { x: number; y: number };

/** Global assistant control. It can be repositioned for the current editing session. */
export function AICopilotLauncher({ onClick }: AICopilotLauncherProps) {
  const [hidden, setHidden] = useState(false);
  const [position, setPosition] = useState<LauncherPosition | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    const updatePosition = () => {
      setPosition(current => current ?? {
        x: Math.max(18, window.innerWidth - 190),
        y: Math.max(72, window.innerHeight - 112)
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const maxX = Math.max(8, window.innerWidth - 184);
      const maxY = Math.max(8, window.innerHeight - 88);
      const nextX = Math.max(8, Math.min(maxX, drag.originX + event.clientX - drag.startX));
      const nextY = Math.max(8, Math.min(maxY, drag.originY + event.clientY - drag.startY));
      if (Math.abs(nextX - drag.originX) > 3 || Math.abs(nextY - drag.originY) > 3) movedRef.current = true;
      setPosition({ x: nextX, y: nextY });
    };
    const finish = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  if (hidden) {
    return <button type="button" className="studio-ai-launcher-reopen" onClick={() => setHidden(false)} aria-label="显示 AI 剪辑助理" title="显示 AI 剪辑助理"><span>‹</span><small>AI</small></button>;
  }

  const style = position ? { left: position.x, top: position.y } : undefined;
  return <div className="studio-ai-launcher-wrap" style={style}>
    <button
      type="button"
      className="studio-ai-launcher"
      onPointerDown={event => {
        movedRef.current = false;
        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: position?.x ?? 0, originY: position?.y ?? 0 };
      }}
      onClick={event => {
        if (movedRef.current) {
          event.preventDefault();
          movedRef.current = false;
          return;
        }
        onClick();
      }}
      aria-label="打开 AI 剪辑助理"
      title="点击打开 AI 剪辑助理，拖动调整位置"
    >
      <span className="studio-ai-launcher-icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 12.5h12a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-5a4 4 0 0 1 4-4Z" />
          <path d="M16 12.5V8m0 0-2-2m2 2 2-2" />
          <circle cx="12" cy="19" r="1.5" fill="currentColor" />
          <circle cx="20" cy="19" r="1.5" fill="currentColor" />
          <path d="M12 23h8M6 18H3m26 0h-3" />
        </svg>
        <i />
      </span>
      <span className="studio-ai-launcher-copy"><b>AI 助理</b><small>智能剪辑</small></span>
      <span className="studio-ai-launcher-grip" aria-hidden="true">⋮⋮</span>
    </button>
    <button type="button" className="studio-ai-launcher-hide" onClick={() => setHidden(true)} aria-label="隐藏 AI 剪辑助理" title="隐藏 AI 剪辑助理">×</button>
  </div>;
}
