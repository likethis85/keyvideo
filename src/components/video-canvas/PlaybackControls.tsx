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

const FPS = 30;

function formatTimecode(seconds: number, fps = FPS) {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalFrames = Math.round(safeSeconds * fps);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`
    : `${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function PlaybackControls(props: PlaybackControlsProps) {
  const frameDuration = 1 / FPS;
  const step = (delta: number) => {
    props.onPlayingChange(false);
    props.onTimeChange(previous => Math.min(props.duration, Math.max(0, Number((previous + delta).toFixed(4)))));
  };
  return (
    <div className="playback-controls" style={props.theater ? { marginTop: 0, padding: '8px 16px', background: 'rgba(15,23,42,.85)', borderRadius: '24px' } : undefined}>
      <button className="control-btn" onClick={() => props.onTimeChange(0)} title="回到开始">⏮</button>
      <button className="control-btn step" onClick={() => step(-frameDuration)} title="上一帧（←）">◀</button>
      <button className="control-btn play-pause" onClick={() => props.onPlayingChange(!props.isPlaying)} title={props.isPlaying ? '暂停（空格）' : '播放（空格）'}>{props.isPlaying ? '⏸' : '▶'}</button>
      <button className="control-btn step" onClick={() => step(frameDuration)} title="下一帧（→）">▶</button>
      <button className="control-btn" onClick={() => props.onTimeChange(props.duration)} title="跳到结尾">⏭</button>
      <button className={`control-btn ${props.isLooping ? 'active' : ''}`} onClick={() => props.onLoopingChange(!props.isLooping)} title="循环播放">🔁</button>
      <input type="range" min="0" max={props.duration} step={frameDuration} value={Math.min(props.currentTime, props.duration)} onChange={event => props.onTimeChange(Number(event.target.value))} className="slider-input" style={{ width: props.theater ? '160px' : '110px' }} aria-label="播放进度" />
      <div className="time-display timecode-display" title="当前时间码 / 总时长">
        <span className="timecode-current">{formatTimecode(props.currentTime)}</span>
        <span className="timecode-divider"> / </span>
        <span className="timecode-total">{formatTimecode(props.duration)}</span>
      </div>
      {props.backgroundMode && props.onBackgroundModeChange && <div style={{ display: 'flex', gap: '3px' }}>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'showroom' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('showroom')} title="展厅背景">🏛️</button>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'dark' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('dark')} title="深色背景">⬛</button>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'checkerboard' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('checkerboard')} title="透明棋盘">🏁</button>
      </div>}
      {props.onFullscreen && <button className="control-btn" onClick={props.onFullscreen} title="全屏审查">⛶</button>}
    </div>
  );
}
