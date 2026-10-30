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
        <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 14.5h18a7 7 0 0 1 7 7v4a7 7 0 0 1-7 7H11a7 7 0 0 1-7-7v-4a7 7 0 0 1 7-7Z" fill="rgba(255,255,255,.12)" />
          <path d="M13 14.5 10.5 9l5 2.7M27 14.5 29.5 9l-5 2.7" />
          <path d="M20 14.5V8" />
          <circle cx="14" cy="23" r="2" fill="currentColor" stroke="none" />
          <circle cx="26" cy="23" r="2" fill="currentColor" stroke="none" />
          <path d="M15.5 28c2.3 1.7 6.7 1.7 9 0" />
          <path d="M5 23H2m36 0h-3" />
        </svg>
        <i />
      </span>
      <span className="studio-ai-launcher-copy"><b>AI 助理</b><small>智能剪辑</small></span>
      <span className="studio-ai-launcher-grip" aria-hidden="true">⋮⋮</span>
    </button>
    <button type="button" className="studio-ai-launcher-hide" onClick={() => setHidden(true)} aria-label="隐藏 AI 剪辑助理" title="隐藏 AI 剪辑助理">×</button>
  </div>;
}
