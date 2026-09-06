import { createPortal } from 'react-dom';
import type { Dispatch, SetStateAction } from 'react';
import { PlaybackControls } from './PlaybackControls';

interface FullscreenTheaterProps {
  visible: boolean;
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  width: number;
  height: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setIsPlaying: (playing: boolean) => void;
  setIsLooping: (looping: boolean) => void;
  drawFrame: (context: CanvasRenderingContext2D, time: number) => void;
  onClose: () => void;
}

export function FullscreenTheater(props: FullscreenTheaterProps) {
  if (!props.visible) return null;
  return createPortal(
    <div className="fullscreen-theater">
      <div className="fullscreen-theater-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><strong>🎬 全屏沉浸审查大屏</strong><span style={{ color: 'var(--accent-cyan)' }}>{props.ratio} 画幅</span></div>
        <button onClick={props.onClose} title="退出全屏预览">✕ 退出全屏 (Esc)</button>
      </div>
      <div className="fullscreen-theater-canvas-container">
        <div className={`canvas-wrapper ratio-${props.ratio}`} style={{ maxHeight: '82vh', maxWidth: '88vw' }}>
          <canvas
            ref={node => {
              if (!node) return;
              node.width = props.width;
              node.height = props.height;
              const context = node.getContext('2d');
              if (context) props.drawFrame(context, props.currentTime);
            }}
            className="main-canvas"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      </div>
      <PlaybackControls
        currentTime={props.currentTime}
        duration={props.duration}
        isPlaying={props.isPlaying}
        isLooping={props.isLooping}
        onTimeChange={props.setCurrentTime}
        onPlayingChange={props.setIsPlaying}
        onLoopingChange={props.setIsLooping}
        theater
      />
    </div>,
    document.body
  );
}
