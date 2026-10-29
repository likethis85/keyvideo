import type { ReactNode } from 'react';

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
  playbackRate?: number;
  onPlaybackRateChange?: (rate: number) => void;
  theater?: boolean;
}

const FPS = 30;

type PlaybackIconName = 'start' | 'prev' | 'play' | 'pause' | 'next' | 'end' | 'loop' | 'showroom' | 'dark' | 'checkerboard' | 'fullscreen' | 'speed';

function PlaybackIcon({ name, size = 18 }: { name: PlaybackIconName; size?: number }) {
  const content: Record<PlaybackIconName, ReactNode> = {
    start: <><path d="M6 5v14" /><path d="m18 6-8 6 8 6V6Z" fill="currentColor" stroke="none" /></>,
    prev: <path d="m17 6-8 6 8 6V6Z" fill="currentColor" stroke="none" />,
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14M16 5v14" /></>,
    next: <path d="m7 6 8 6-8 6V6Z" fill="currentColor" stroke="none" />,
    end: <><path d="M18 5v14" /><path d="m6 6 8 6-8 6V6Z" fill="currentColor" stroke="none" /></>,
    loop: <><path d="M7 7h10l-2.5-2.5M17 17H7l2.5 2.5" /><path d="M17 7a5 5 0 0 1 0 10M7 17A5 5 0 0 1 7 7" /></>,
    showroom: <><path d="M4 20h16M6 20V9h12v11M4 9h16L12 4 4 9ZM9 13h2v3H9v-3ZM13 13h2v3h-2v-3Z" /></>,
    dark: <><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none" /><path d="M8 8h.01M12 12h.01M16 16h.01" stroke="#0d111a" strokeWidth="2.5" /></>,
    checkerboard: <><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M5 10h14M5 15h14M10 5v14M15 5v14" /></>,
    fullscreen: <><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" /></>,
    speed: <><circle cx="12" cy="13" r="7" /><path d="M12 13 16 9M8 4h8" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content[name]}</svg>;
}

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
  const playbackRate = props.playbackRate ?? 1;
  const step = (delta: number) => {
    props.onPlayingChange(false);
    props.onTimeChange(previous => Math.min(props.duration, Math.max(0, Number((previous + delta).toFixed(4)))));
  };
  return (
    <div className={`playback-controls ${props.theater ? 'is-theater' : ''}`}>
      <div className="playback-transport-group" aria-label="播放控制">
        <button className="control-btn" onClick={() => { props.onPlayingChange(false); props.onTimeChange(0); }} title="回到片段开头" data-tooltip="回到开头" aria-label="回到片段开头"><PlaybackIcon name="start" /></button>
        <button className="control-btn step" onClick={() => step(-frameDuration)} title="上一帧（←）" data-tooltip="上一帧" aria-label="上一帧"><PlaybackIcon name="prev" /></button>
        <button className="control-btn play-pause" onClick={() => props.onPlayingChange(!props.isPlaying)} title={props.isPlaying ? '暂停（空格）' : '播放（空格）'} data-tooltip={props.isPlaying ? '暂停播放' : '播放'} aria-label={props.isPlaying ? '暂停播放' : '播放'}><PlaybackIcon name={props.isPlaying ? 'pause' : 'play'} size={props.isPlaying ? 21 : 23} /></button>
        <button className="control-btn step" onClick={() => step(frameDuration)} title="下一帧（→）" data-tooltip="下一帧" aria-label="下一帧"><PlaybackIcon name="next" /></button>
        <button className="control-btn" onClick={() => { props.onPlayingChange(false); props.onTimeChange(props.duration); }} title="跳到片段结尾" data-tooltip="跳到结尾" aria-label="跳到片段结尾"><PlaybackIcon name="end" /></button>
      </div>
      <div className="playback-progress-group">
        <input type="range" min="0" max={props.duration} step={frameDuration} value={Math.min(props.currentTime, props.duration)} onChange={event => props.onTimeChange(Number(event.target.value))} className="slider-input" aria-label="播放进度" title="拖动定位播放头" />
        <div className="time-display timecode-display" title="当前时间码 / 总时长" aria-label={`当前时间 ${formatTimecode(props.currentTime)}，总时长 ${formatTimecode(props.duration)}`}>
        <span className="timecode-current">{formatTimecode(props.currentTime)}</span>
        <span className="timecode-divider"> / </span>
        <span className="timecode-total">{formatTimecode(props.duration)}</span>
        </div>
      </div>
      <div className="playback-utility-group" aria-label="播放辅助工具">
        <button className={`control-btn loop-btn ${props.isLooping ? 'active' : ''}`} onClick={() => props.onLoopingChange(!props.isLooping)} title={props.isLooping ? '关闭循环播放' : '开启循环播放'} data-tooltip={props.isLooping ? '循环播放：开启' : '循环播放：关闭'} aria-label={props.isLooping ? '关闭循环播放' : '开启循环播放'} aria-pressed={props.isLooping}><PlaybackIcon name="loop" /></button>
        {props.onPlaybackRateChange && <label className="playback-speed-control" title="调整播放速度">
          <PlaybackIcon name="speed" size={17} />
          <span className="playback-speed-label">速度</span>
          <select value={playbackRate} onChange={event => props.onPlaybackRateChange?.(Number(event.target.value))} aria-label="播放速度">
            <option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option>
          </select>
        </label>}
      {props.backgroundMode && props.onBackgroundModeChange && <div className="playback-background-group">
        <button className={`bg-switcher-btn ${props.backgroundMode === 'showroom' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('showroom')} title="展厅背景：预览真实陈列环境" data-tooltip="展厅背景" aria-label="展厅背景" aria-pressed={props.backgroundMode === 'showroom'}><PlaybackIcon name="showroom" /></button>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'dark' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('dark')} title="深色背景：检查画面边缘" data-tooltip="深色背景" aria-label="深色背景" aria-pressed={props.backgroundMode === 'dark'}><PlaybackIcon name="dark" /></button>
        <button className={`bg-switcher-btn ${props.backgroundMode === 'checkerboard' ? 'active' : ''}`} onClick={() => props.onBackgroundModeChange?.('checkerboard')} title="透明棋盘：检查抠图透明区域" data-tooltip="透明棋盘" aria-label="透明棋盘" aria-pressed={props.backgroundMode === 'checkerboard'}><PlaybackIcon name="checkerboard" /></button>
      </div>}
      {props.onFullscreen && <button className="control-btn fullscreen-btn" onClick={props.onFullscreen} title="进入全屏审查模式" data-tooltip="全屏审查" aria-label="进入全屏审查模式"><PlaybackIcon name="fullscreen" /></button>}
      </div>
    </div>
  );
}
