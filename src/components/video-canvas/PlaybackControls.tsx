interface PlaybackControlsProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLooping: boolean;
  onTimeChange: (value: number | ((previous: number) => number)) => void;
  onPlayingChange: (playing: boolean) => void;
  onLoopingChange: (looping: boolean) => void;
  backgroundMode?: 'showroom' | 'dark' | 'checkerboard';
  onBackgroundModeChange?: (mode: 'showroom' | 'dark' | 'checkerboard') => void;
  onFullscreen?: () => void;
  theater?: boolean;
}

export function PlaybackControls(props: PlaybackControlsProps) {
  const step = (delta: number) => {
    props.onPlayingChange(false);
    props.onTimeChange(previous => Math.min(props.duration, Math.max(0, Number((previous + delta).toFixed(2)))));
  };
  return (
    <div className="playback-controls" style={props.theater ? { marginTop: 0, padding: '8px 16px', background: 'rgba(15,23,42,.85)', borderRadius: '24px' } : undefined}>
      <button className="control-btn" onClick={() => props.onTimeChange(0)} title="回到开始">⏮</button>
      <button className="control-btn step" onClick={() => step(-0.1)} title="前移 0.1 秒">◀</button>
      <button className="control-btn play-pause" onClick={() => props.onPlayingChange(!props.isPlaying)} title={props.isPlaying ? '暂停' : '播放'}>{props.isPlaying ? '⏸' : '▶'}</button>
      <button className="control-btn step" onClick={() => step(0.1)} title="后移 0.1 秒">▶</button>
      <button className={`control-btn ${props.isLooping ? 'active' : ''}`} onClick={() => props.onLoopingChange(!props.isLooping)} title="循环播放">🔁</button>
      <input type="range" min="0" max={props.duration} step="0.05" value={Math.min(props.currentTime, props.duration)} onChange={event => props.onTimeChange(Number(event.target.value))} className="slider-input" style={{ width: props.theater ? '160px' : '110px' }} />
      <div className="time-display"><span>{Math.min(props.currentTime, props.duration).toFixed(1)}s</span><span> / </span><span>{props.duration.toFixed(1)}s</span></div>
      {props.backgroundMode && props.onBackgroundModeChange && <div style={{ display: 'flex', gap: '3px' }}>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'showroom' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('showroom')}>🏛️</button>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'dark' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('dark')}>⬛</button>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'checkerboard' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('checkerboard')}>🏁</button>
      </div>}
      {props.onFullscreen && <button className="control-btn" onClick={props.onFullscreen} title="全屏审查">⛶</button>}
    </div>
  );
}
