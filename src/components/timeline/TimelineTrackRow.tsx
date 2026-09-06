import type { ReactNode } from 'react';

interface TimelineTrackRowProps {
  label: string;
  accent: string;
  glow: string;
  icon: ReactNode;
  children: ReactNode;
}

export function TimelineTrackRow({ label, accent, glow, icon, children }: TimelineTrackRowProps) {
  return (
    <div className="timeline-track">
      <div className="track-label timeline-track-label" onMouseDown={event => event.stopPropagation()}>
        <span className="timeline-track-dot" style={{ background: accent, boxShadow: `0 0 6px ${glow}` }} />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          {icon}
        </svg>
        {label}
      </div>
      <div className="track-content timeline-track-content">{children}</div>
    </div>
  );
}
