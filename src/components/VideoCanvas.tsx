import React, { useRef, useEffect, useState } from 'react';
import { ExportProgressOverlay } from './video-canvas/ExportProgressOverlay';
import { ExportSettingsModal } from './video-canvas/ExportSettingsModal';
import { PlaybackControls } from './video-canvas/PlaybackControls';
import { FullscreenTheater } from './video-canvas/FullscreenTheater';
import { CanvasStage } from './video-canvas/CanvasStage';
import { ExportTrigger } from './video-canvas/ExportTrigger';
import { useCanvasFullscreen } from '../hooks/useCanvasFullscreen';
import { getCanvasDimensions } from '../utils/canvasDimensions';
import { useVideoExport } from '../hooks/useVideoExport';
import { useCanvasLayerInteraction } from '../hooks/useCanvasLayerInteraction';
import { useCanvasRenderer } from '../hooks/useCanvasRenderer';

export interface Layer {
  id: string;
  type: 'media' | 'text' | 'sticker' | 'audio';
  name: string;
  start: number;
  end: number;
  visible: boolean;
  x: number; // percentage from left, 0 to 100
  y: number; // percentage from top, 0 to 100
  scale: number; // 0.1 to 3
  opacity: number; // 0 to 1
  properties: {
    src?: string;
    text?: string;
    fontSize?: number;
    color?: string;
    animation?: 'fade' | 'typewriter' | 'zoom' | 'slide';
    bold?: boolean;
    shadow?: boolean;
    style?: 'red' | 'gold' | 'cyan' | 'black' | 'purple';
    bgRemoved?: boolean;
    aiMannequin?: string | null;
    volume?: number;
    blur?: number;
    isVideo?: boolean;
    videoStartOffset?: number;
    videoEndOffset?: number;
    speed?: number;
    loop?: boolean;
    audioStartOffset?: number;
    transitionType?: 'none' | 'fade' | 'slideLeft' | 'slideRight' | 'zoom' | 'wipe';
    transitionDuration?: number;
  };
}

interface VideoCanvasProps {
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  layers: Layer[];
  setLayers: React.Dispatch<React.SetStateAction<Layer[]>>;
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  modelSwapRunning: boolean;
  exporting: boolean;
  setExporting: (exporting: boolean) => void;
  exportProgress: number;
  setExportProgress: React.Dispatch<React.SetStateAction<number>> | ((progress: number) => void);
  exportLogs: string[];
  setExportLogs: React.Dispatch<React.SetStateAction<string[]>>;
  isFullscreen?: boolean;
  setIsFullscreen?: (val: boolean) => void;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  ratio,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  layers,
  setLayers,
  selectedLayerId,
  setSelectedLayerId,
  modelSwapRunning,
  exporting,
  setExporting,
  exportProgress,
  setExportProgress,
  exportLogs,
  setExportLogs,
  isFullscreen: propIsFullscreen,
  setIsFullscreen: propSetIsFullscreen,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesCacheRef = useRef<{ [src: string]: HTMLImageElement | HTMLCanvasElement }>({});
  const videosCacheRef = useRef<{ [src: string]: HTMLVideoElement }>({});
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);

  const [exportFps, setExportFps] = useState<number | null>(null);
  const [exportEngine, setExportEngine] = useState<'webcodecs' | 'mediarecorder'>('webcodecs');
  const [isExportSettingsOpen, setIsExportSettingsOpen] = useState(false);

  const [canvasBgMode, setCanvasBgMode] = useState<'showroom' | 'dark' | 'checkerboard'>('showroom');
  const [isLooping, setIsLooping] = useState(true);
  const { isFullscreen, enterFullscreen, exitFullscreen } = useCanvasFullscreen({
    controlledValue: propIsFullscreen,
    onControlledChange: propSetIsFullscreen,
    isPlaying,
    setIsPlaying
  });

  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Record<string, MediaElementAudioSourceNode>>({});
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const isOfflineExportingRef = useRef(false);

  // Background music audio sync effect
  useEffect(() => {
    // During export, we still want to play the audio elements in sync to capture them!
    const isPlaybackActive = isPlaying || (exporting && exportEngine === 'mediarecorder');

    const audioLayers = layers.filter(l => l.type === 'audio' && l.visible);

    // Clean up elements that are no longer present
    Object.keys(audioElementsRef.current).forEach(id => {
      if (!audioLayers.some(l => l.id === id)) {
        audioElementsRef.current[id].pause();
        delete audioElementsRef.current[id];
        if (audioSourcesRef.current[id]) {
          audioSourcesRef.current[id].disconnect();
          delete audioSourcesRef.current[id];
        }
      }
    });

    audioLayers.forEach(layer => {
      const src = layer.properties.src;
      if (!src) return;

      let audio = audioElementsRef.current[layer.id];
      if (!audio || audio.src !== src) {
        if (audio) audio.pause();
        
        audio = new Audio();
        // Only set crossOrigin for external URLs to prevent CORS errors on local assets
        if (src.startsWith('http://') || src.startsWith('https://')) {
          audio.crossOrigin = 'anonymous';
        }
        audio.src = src;
        audioElementsRef.current[layer.id] = audio;

        // Initialize Web Audio API nodes
        try {
          if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) throw new Error('Web Audio API is unavailable');
            audioCtxRef.current = new AudioContextClass();
            audioDestinationRef.current = audioCtxRef.current.createMediaStreamDestination();
          }
          const ctx = audioCtxRef.current;
          const source = ctx.createMediaElementSource(audio);
          audioSourcesRef.current[layer.id] = source;
          
          source.connect(audioDestinationRef.current!);
          source.connect(ctx.destination);
        } catch (e) {
          console.warn('Web Audio API integration failed:', e);
        }
      }

      // Update volume
      const vol = typeof layer.properties.volume === 'number' ? layer.properties.volume : 0.8;
      audio.volume = vol;

      // Check if timeline currentTime falls within the audio track bounds
      const isInRange = currentTime >= layer.start && currentTime <= layer.end;

      if (isPlaybackActive && isInRange) {
        const targetTime = currentTime - layer.start + (layer.properties.audioStartOffset || 0);
        
        // Ensure AudioContext is active
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }

        // If the audio is paused, play it
        if (audio.paused) {
          audio.currentTime = targetTime;
          audio.play().catch(err => console.warn('Sync audio play failed:', err));
        } else {
          // If already playing, check drift and resync if needed (> 0.15s)
          if (Math.abs(audio.currentTime - targetTime) > 0.15) {
            audio.currentTime = targetTime;
          }
        }
      } else {
        if (!audio.paused) {
          audio.pause();
        }
        if (isInRange) {
          audio.currentTime = currentTime - layer.start + (layer.properties.audioStartOffset || 0);
        }
      }
    });
  }, [isPlaying, currentTime, layers, exporting, exportEngine]);

  // Clean up all audio elements on unmount
  useEffect(() => {
    const audioElements = audioElementsRef.current;
    return () => {
      Object.values(audioElements).forEach(audio => audio.pause());
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(e => console.error(e));
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Preload all video and image assets when layers change
  useEffect(() => {
    layers.forEach(layer => {
      if (layer.type !== 'media' || !layer.properties.src) return;

      const src = layer.properties.src;
      const isVideo = !!layer.properties.isVideo;

      if (isVideo) {
        if (!videosCacheRef.current[src]) {
          const video = document.createElement('video');
          video.src = src;
          video.muted = true;
          video.playsInline = true;
          video.loop = false;
          // Set crossOrigin if it is an external URL to prevent CORS errors in Web Audio/Canvas
          if (src.startsWith('http://') || src.startsWith('https://')) {
            video.crossOrigin = 'anonymous';
          }
          video.addEventListener('loadedmetadata', () => {
            setRenderTrigger(prev => prev + 1);
          });
          video.addEventListener('canplaythrough', () => {
            setRenderTrigger(prev => prev + 1);
          });
          video.load();
          videosCacheRef.current[src] = video;
        }
      } else {
        if (!imagesCacheRef.current[src]) {
          const img = new Image();
          if (src.startsWith('http://') || src.startsWith('https://')) {
            img.crossOrigin = 'anonymous';
          }
          img.src = src;
          img.onload = () => {
            imagesCacheRef.current[src] = img;
            setRenderTrigger(prev => prev + 1);
          };
          imagesCacheRef.current[src] = img; // cache it immediately to show placeholder
        }
      }
    });
  }, [layers]);

  const activeLayers = layers.filter(l => l.visible);
  const maxLayerEnd = activeLayers.reduce((max, l) => l.end > max ? l.end : max, 0);
  const totalDuration = maxLayerEnd > 0 ? Math.min(15, maxLayerEnd) : 15;

  // Clamp currentTime to totalDuration when layers change
  useEffect(() => {
    if (currentTime > totalDuration) {
      setCurrentTime(totalDuration);
    }
  }, [totalDuration, currentTime, setCurrentTime]);

  const { width, height } = getCanvasDimensions(ratio);

  const getMediaLayerSize = (layer: Layer, customScale?: number) => {
    const scale = customScale !== undefined ? customScale : layer.scale;
    let imgW = 500;
    let imgH = 500;
    const isVideo = !!layer.properties.isVideo;
    if (isVideo) {
      const videoUrl = layer.properties.src;
      if (videoUrl && videosCacheRef.current[videoUrl]) {
        const cachedVid = videosCacheRef.current[videoUrl];
        imgW = cachedVid.videoWidth || 720;
        imgH = cachedVid.videoHeight || 1280;
      } else {
        imgW = 720;
        imgH = 1280;
      }
      const boxW = width * scale;
      const boxH = (imgH / imgW) * boxW;
      return { w: boxW, h: boxH };
    } else {
      const imgSrc = layer.properties.aiMannequin || layer.properties.src;
      if (imgSrc && imagesCacheRef.current[imgSrc]) {
        const cachedImg = imagesCacheRef.current[imgSrc];
        imgW = cachedImg.width || 500;
        imgH = cachedImg.height || 500;
      }
      const boxW = width * 0.8 * scale;
      const boxH = (imgH / imgW) * boxW;
      return { w: boxW, h: boxH };
    }
  };

  // Load and pre-cache images
  useEffect(() => {
    const srcList = [
      '/clothing_shirt.png',
      '/clothing_model.png',
      '/clothing_flatlay.png',
      '/clothing_model_yoga.png',
      '/clothing_model_male.png',
      '/logo.png'
    ];
    let loadedCount = 0;

    srcList.forEach((src) => {
      if (imagesCacheRef.current[src]) {
        loadedCount++;
        if (loadedCount === srcList.length) setImagesLoaded(true);
        return;
      }
      const img = new Image();
      img.src = src;
      img.onload = () => {
        imagesCacheRef.current[src] = img;
        loadedCount++;
        if (loadedCount === srcList.length) {
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        // Fallback placeholder drawn via canvas if failed
        loadedCount++;
        if (loadedCount === srcList.length) setImagesLoaded(true);
      };
    });
  }, []);

  // Load dynamic layer sources or AI generated mannequins dynamically
  useEffect(() => {
    layers.forEach(layer => {
      if (layer.type === 'media') {
        const src = layer.properties.src;
        if (src && !imagesCacheRef.current[src]) {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            imagesCacheRef.current[src] = img;
            setRenderTrigger(prev => prev + 1);
          };
        }
        const mannequin = layer.properties.aiMannequin;
        if (mannequin && !imagesCacheRef.current[mannequin]) {
          const img = new Image();
          img.src = mannequin;
          img.onload = () => {
            imagesCacheRef.current[mannequin] = img;
            setRenderTrigger(prev => prev + 1);
          };
        }
      }
    });
  }, [layers]);

  // Background keying filter (Chroma Key for beige background)
  const { drawFrame } = useCanvasRenderer({
    imagesCacheRef, videosCacheRef, isOfflineExportingRef, width, height, canvasBgMode,
    layers, selectedLayerId, getMediaLayerSize, isPlaying, exporting, setRenderTrigger
  });
  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        if (totalDuration <= 0) {
          setIsPlaying(false);
          setCurrentTime(0);
        } else {
          setCurrentTime((previousTime) => {
            if (previousTime >= totalDuration) {
              if (isLooping) return 0;
              setIsPlaying(false);
              return totalDuration;
            }
            const nextTime = previousTime + delta;
            if (nextTime < totalDuration) return nextTime;
            if (isLooping) return 0;
            setIsPlaying(false);
            return totalDuration;
          });
        }
      }

      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (context) drawFrame(context, currentTime);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [currentTime, drawFrame, isLooping, isPlaying, renderTrigger, setCurrentTime, setIsPlaying, totalDuration]);

  // Pause all cached videos when global playback pauses (except during export)
  useEffect(() => {
    if (!isPlaying && !exporting) {
      (Object.values(videosCacheRef.current) as HTMLVideoElement[]).forEach(video => {
        try {
          video.pause();
        } catch (error) {
          console.warn('Unable to pause cached video:', error);
        }
      });
    }
  }, [isPlaying, exporting]);

  const { canvasCursor, handleMouseDown, handleMouseMoveCanvas } = useCanvasLayerInteraction({
    canvasRef, layers, setLayers, selectedLayerId, setSelectedLayerId, width, height, currentTime, getMediaLayerSize
  });
  const {
    handleExport,
    handleCancel,
    handleSaveCloud,
    currentFrame,
    totalFrames,
    estimatedSecondsRemaining,
    estimatedSizeMb,
    previewSnapshotUrl,
    exportResult
  } = useVideoExport({
    canvasRef, audioCtxRef, audioDestinationRef, videosCacheRef, isOfflineExportingRef, layers, ratio,
    width, height, exporting, drawFrame, setCurrentTime, setIsPlaying, setExporting,
    setExportProgress: (p: number) => setExportProgress(p),
    setExportLogs, setExportFps, setExportEngine
  });

  return (
    <div className="preview-panel">
      <CanvasStage
        ratio={ratio}
        canvasRef={canvasRef}
        width={width}
        height={height}
        cursor={canvasCursor}
        imagesLoaded={imagesLoaded}
        modelSwapRunning={modelSwapRunning}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveCanvas}
      />

     <PlaybackControls
        currentTime={currentTime}
        duration={totalDuration}
        isPlaying={isPlaying}
        isLooping={isLooping}
        onTimeChange={setCurrentTime}
        onPlayingChange={setIsPlaying}
        onLoopingChange={setIsLooping}
        backgroundMode={canvasBgMode}
        onBackgroundModeChange={setCanvasBgMode}
        onFullscreen={enterFullscreen}
      />

      <FullscreenTheater
        visible={isFullscreen}
        ratio={ratio}
        width={width}
        height={height}
        currentTime={currentTime}
        duration={totalDuration}
        isPlaying={isPlaying}
        isLooping={isLooping}
        setCurrentTime={setCurrentTime}
        setIsPlaying={setIsPlaying}
        setIsLooping={setIsLooping}
        drawFrame={drawFrame}
        onClose={exitFullscreen}
      />

      <ExportProgressOverlay
        visible={exporting}
        fps={exportFps}
        engine={exportEngine}
        progress={exportProgress}
        logs={exportLogs}
        currentFrame={currentFrame}
        totalFrames={totalFrames}
        estimatedSecondsRemaining={estimatedSecondsRemaining}
        estimatedSizeMb={estimatedSizeMb}
        previewSnapshotUrl={previewSnapshotUrl}
        exportResult={exportResult}
        onCancel={handleCancel}
        onClose={() => setExporting(false)}
        onSaveCloud={handleSaveCloud}
      />

      <ExportSettingsModal
        isOpen={isExportSettingsOpen}
        onClose={() => setIsExportSettingsOpen(false)}
        onConfirmExport={(cfg) => handleExport(cfg)}
        ratio={ratio}
        totalDuration={totalDuration}
        nativeWidth={width}
        nativeHeight={height}
      />

      <ExportTrigger onExport={() => setIsExportSettingsOpen(true)} />
    </div>
  );
};
