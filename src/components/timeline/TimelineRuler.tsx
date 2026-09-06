import type { MouseEventHandler, ReactNode, RefObject } from 'react';

interface TimelineRulerProps {
  rulerRef: RefObject<HTMLDivElement | null>;
  ticks: ReactNode;
  currentTime: number;
  totalDuration: number;
  snapLineTime: number | null;
  onMouseDown: MouseEventHandler<HTMLDivElement>;
}

export function TimelineRuler({ rulerRef, ticks, currentTime, totalDuration, snapLineTime, onMouseDown }: TimelineRulerProps) {
  const timeToPercent = (time: number) => `${(time / totalDuration) * 100}%`;

  return (
    <div className="timeline-ruler timeline-ruler-row">
      <div className="timeline-ruler-label" onMouseDown={event => event.stopPropagation()}>时间轴</div>
      <div ref={rulerRef} className="timeline-ruler-ticks" onMouseDown={onMouseDown}>
        {ticks}
        {snapLineTime !== null && (
          <div className="timeline-snap-line" style={{ left: timeToPercent(snapLineTime) }} />
        )}
        <div
          className="timeline-playhead"
          style={{ left: timeToPercent(Math.min(currentTime, totalDuration)) }}
        >
          <div className="timeline-playhead-cap" />
        </div>
      </div>
    </div>
  );
}
