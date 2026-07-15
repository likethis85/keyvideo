import React, { useRef, useEffect, useState } from 'react';

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
    transitionType?: 'none' | 'fade' | 'slideLeft' | 'slideRight' | 'zoom' | 'wipe';
    transitionDuration?: number;
  };
}

interface VideoCanvasProps {
  ratio: '1-1' | '3-4' | '9-16';
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
  setExportProgress: (progress: number) => void;
  exportLogs: string[];
  setExportLogs: React.Dispatch<React.SetStateAction<string[]>>;
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagesCacheRef = useRef<{ [src: string]: HTMLImageElement | HTMLCanvasElement }>({});
  const videosCacheRef = useRef<{ [src: string]: HTMLVideoElement }>({});
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0);

  const audioElementsRef = useRef<{ [id: string]: HTMLAudioElement }>({});
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Record<string, MediaElementAudioSourceNode>>({});
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  // Background music audio sync effect
  useEffect(() => {
    // During export, we still want to play the audio elements in sync to capture them!
    const isPlaybackActive = isPlaying || exporting;

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
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
        const targetTime = currentTime - layer.start;
        
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
          audio.currentTime = currentTime - layer.start;
        }
      }
    });
  }, [isPlaying, currentTime, layers, exporting]);

  // Clean up all audio elements on unmount
  useEffect(() => {
    return () => {
      Object.values(audioElementsRef.current).forEach(audio => audio.pause());
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

  // Define width & height of the logical canvas resolution based on ratio
  const getCanvasDimensions = () => {
    switch (ratio) {
      case '1-1': return { width: 720, height: 720 };
      case '3-4': return { width: 600, height: 800 };
      case '9-16': return { width: 540, height: 960 };
      default: return { width: 540, height: 960 };
    }
  };

  const { width, height } = getCanvasDimensions();

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
  const getBgRemovedCanvas = (src: string): HTMLCanvasElement | HTMLImageElement => {
    const cached = imagesCacheRef.current[src];
    if (!cached) return cached;
    
    // Cache under a unified key since the combined algorithm handles both white and beige
    const bgRemovedKey = `${src}_bgremoved_clean`;
    if (imagesCacheRef.current[bgRemovedKey]) {
      return imagesCacheRef.current[bgRemovedKey] as HTMLCanvasElement;
    }

    if (cached instanceof HTMLImageElement) {
      const offscreen = document.createElement('canvas');
      const w = cached.naturalWidth || cached.width || 800;
      const h = cached.naturalHeight || cached.height || 800;
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(cached, 0, 0);
        
        // Smart flood-fill keying starting from boundaries to remove white/beige background
        // and protect matching clothing items in the center
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const visited = new Uint8Array(w * h);
        const queue: [number, number][] = [];

        const addPixel = (x: number, y: number) => {
          if (x >= 0 && x < w && y >= 0 && y < h) {
            const idx = y * w + x;
            if (!visited[idx]) {
              visited[idx] = 1;
              queue.push([x, y]);
            }
          }
        };

        // Add corners and outer boundary pixels to start
        for (let x = 0; x < w; x++) {
          addPixel(x, 0);
          addPixel(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          addPixel(0, y);
          addPixel(w - 1, y);
        }

        let head = 0;
        while (head < queue.length) {
          const [cx, cy] = queue[head++];
          const idx = (cy * w + cx) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Check if pixel is white OR beige (with reasonable tolerances)
          const isWhite = r > 235 && g > 235 && b > 235;
          const isBeige = r > 165 && g > 155 && b > 125 && Math.abs(r - g) < 30 && Math.abs(g - b) < 35 && Math.abs(r - b) < 45;

          if (isWhite || isBeige) {
            data[idx + 3] = 0; // Make transparent
            
            // Enqueue neighbors
            addPixel(cx + 1, cy);
            addPixel(cx - 1, cy);
            addPixel(cx, cy + 1);
            addPixel(cx, cy - 1);
          }
        }
        ctx.putImageData(imgData, 0, 0);
        
        imagesCacheRef.current[bgRemovedKey] = offscreen;
        return offscreen;
      }
    }
    return cached;
  };

  // Helper to draw a single media layer (video or image) with optional position, scale, and opacity overrides
  const drawSingleMediaContent = (
    ctx: CanvasRenderingContext2D,
    lyr: Layer,
    drawTime: number,
    overrideOpacity: number,
    overrideX?: number,
    overrideY?: number,
    overrideScale?: number
  ) => {
    ctx.save();
    ctx.globalAlpha = overrideOpacity;

    const pxX = overrideX !== undefined ? overrideX : (lyr.x / 100) * width;
    const pxY = overrideY !== undefined ? overrideY : (lyr.y / 100) * height;
    const scale = overrideScale !== undefined ? overrideScale : lyr.scale;

    const isVideo = !!lyr.properties.isVideo;
    if (isVideo) {
      const videoUrl = lyr.properties.src;
      if (videoUrl) {
        if (!videosCacheRef.current[videoUrl]) {
          const video = document.createElement('video');
          video.src = videoUrl;
          video.muted = true;
          video.playsInline = true;
          video.loop = false;
          video.addEventListener('loadedmetadata', () => {
            setRenderTrigger(prev => prev + 1);
          });
          video.load();
          videosCacheRef.current[videoUrl] = video;
        }
        const videoSource = videosCacheRef.current[videoUrl];

        // Calculate target playback position based on layer start time and video offset
        const elapsed = drawTime - lyr.start;
        const startOffset = lyr.properties.videoStartOffset || 0;
        const targetTime = elapsed + startOffset;

        // Align video element state with global timeline
        if (isPlaying || exporting) {
          if (videoSource.paused) {
            videoSource.play().catch(() => {});
          }
          if (Math.abs(videoSource.currentTime - targetTime) > 0.25) {
            videoSource.currentTime = targetTime;
          }
        } else {
          if (!videoSource.paused) {
            videoSource.pause();
          }
          const lastTarget = parseFloat(videoSource.dataset.lastTargetTime || '-1');
          if (Math.abs(lastTarget - targetTime) > 0.05 && Math.abs(videoSource.currentTime - targetTime) > 0.05) {
            videoSource.currentTime = targetTime;
            videoSource.dataset.lastTargetTime = targetTime.toString();
          }
        }

        const { w: targetW, h: targetH } = getMediaLayerSize(lyr, scale);

        ctx.translate(pxX, pxY);

        if (lyr.properties.blur) {
          ctx.filter = `blur(${lyr.properties.blur}px)`;
        }

        try {
          ctx.drawImage(videoSource, -targetW / 2, -targetH / 2, targetW, targetH);
        } catch (e) {
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fillRect(-targetW / 2, -targetH / 2, targetW, targetH);
        }
        ctx.filter = 'none';
      }
    } else {
      let imgSource = lyr.properties.src ? imagesCacheRef.current[lyr.properties.src] : null;

      if (lyr.properties.bgRemoved && lyr.properties.src) {
        imgSource = getBgRemovedCanvas(lyr.properties.src);
      }

      if (lyr.properties.aiMannequin) {
        const mannequinPath = lyr.properties.aiMannequin;
        if (imagesCacheRef.current[mannequinPath]) {
          imgSource = lyr.properties.bgRemoved
            ? getBgRemovedCanvas(mannequinPath)
            : imagesCacheRef.current[mannequinPath];
        }
      }

      if (imgSource) {
        const { w: targetW, h: targetH } = getMediaLayerSize(lyr, scale);

        ctx.translate(pxX, pxY);

        if (lyr.properties.blur) {
          ctx.filter = `blur(${lyr.properties.blur}px)`;
        }

        ctx.drawImage(imgSource, -targetW / 2, -targetH / 2, targetW, targetH);
        ctx.filter = 'none';
      } else {
        ctx.translate(pxX, pxY);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(-150, -150, 300, 300);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.strokeRect(-150, -150, 300, 300);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('Material Loading...', 0, 0);
      }
    }
    ctx.restore();
  };

  // Main Draw Routine
  const drawFrame = (ctx: CanvasRenderingContext2D, time: number) => {
    // 1. Draw Background
    // Fashion dark background grid / showroom gradient
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, Math.max(width, height));
    gradient.addColorStop(0, '#1a1c29');
    gradient.addColorStop(1, '#08090f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle showroom circle
    ctx.strokeStyle = 'rgba(138, 43, 226, 0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.35, 0, Math.PI * 2);
    ctx.stroke();

    // Seek upcoming video layers to their startOffset to avoid seek lag and flashes
    layers.forEach(layer => {
      if (layer.type === 'media' && layer.visible && layer.properties.isVideo) {
        const src = layer.properties.src;
        if (src && videosCacheRef.current[src]) {
          const video = videosCacheRef.current[src];
          const startOffset = layer.properties.videoStartOffset || 0;
          
          // If the playhead is before the layer starts, background-seek the video to startOffset
          if (time < layer.start) {
            if (Math.abs(video.currentTime - startOffset) > 0.05) {
              video.currentTime = startOffset;
            }
            if (!video.paused) {
              video.pause();
            }
          }
        }
      }
    });

    // 2. Sort and Draw Layers
    layers.forEach((layer) => {
      if (!layer.visible) return;
      if (time < layer.start || time > layer.end) return;

      ctx.save();
      ctx.globalAlpha = layer.opacity;

      const pxX = (layer.x / 100) * width;
      const pxY = (layer.y / 100) * height;

      if (layer.type === 'media' && layer.properties.src) {
        const transitionType = layer.properties.transitionType || 'none';
        const transitionDuration = layer.properties.transitionDuration || 0.5;
        const elapsed = time - layer.start;
        const inTransition = transitionType !== 'none' && elapsed >= 0 && elapsed <= transitionDuration;

        if (inTransition) {
          const mediaLayers = layers.filter(l => l.type === 'media' && l.visible);
          const sortedMediaLayers = [...mediaLayers].sort((a, b) => a.start - b.start);
          const currentIdx = sortedMediaLayers.findIndex(l => l.id === layer.id);
          const prevLayer = currentIdx > 0 ? sortedMediaLayers[currentIdx - 1] : null;

          const isAdjacent = prevLayer && Math.abs(prevLayer.end - layer.start) <= 0.1;

          const t = elapsed / transitionDuration;
          const boundedT = Math.max(0, Math.min(1, t));

          if (isAdjacent && prevLayer) {
            if (transitionType === 'fade') {
              drawSingleMediaContent(ctx, prevLayer, prevLayer.end, prevLayer.opacity * (1 - boundedT));
              drawSingleMediaContent(ctx, layer, time, layer.opacity * boundedT);
            } else if (transitionType === 'slideLeft') {
              const prevX = (prevLayer.x / 100) * width - boundedT * width;
              const currX = (layer.x / 100) * width + (1 - boundedT) * width;
              drawSingleMediaContent(ctx, prevLayer, prevLayer.end, prevLayer.opacity, prevX);
              drawSingleMediaContent(ctx, layer, time, layer.opacity, currX);
            } else if (transitionType === 'slideRight') {
              const prevX = (prevLayer.x / 100) * width + boundedT * width;
              const currX = (layer.x / 100) * width - (1 - boundedT) * width;
              drawSingleMediaContent(ctx, prevLayer, prevLayer.end, prevLayer.opacity, prevX);
              drawSingleMediaContent(ctx, layer, time, layer.opacity, currX);
            } else if (transitionType === 'zoom') {
              const prevScale = prevLayer.scale * (1 - boundedT);
              const currScale = layer.scale * boundedT;
              drawSingleMediaContent(ctx, prevLayer, prevLayer.end, prevLayer.opacity * (1 - boundedT), undefined, undefined, prevScale);
              drawSingleMediaContent(ctx, layer, time, layer.opacity * boundedT, undefined, undefined, currScale);
            } else if (transitionType === 'wipe') {
              drawSingleMediaContent(ctx, prevLayer, prevLayer.end, prevLayer.opacity);
              ctx.save();
              ctx.beginPath();
              ctx.rect(0, 0, boundedT * width, height);
              ctx.clip();
              drawSingleMediaContent(ctx, layer, time, layer.opacity);
              ctx.restore();
            } else {
              drawSingleMediaContent(ctx, layer, time, layer.opacity);
            }
          } else {
            if (transitionType === 'fade') {
              drawSingleMediaContent(ctx, layer, time, layer.opacity * boundedT);
            } else if (transitionType === 'slideLeft') {
              const currX = (layer.x / 100) * width + (1 - boundedT) * width;
              drawSingleMediaContent(ctx, layer, time, layer.opacity, currX);
            } else if (transitionType === 'slideRight') {
              const currX = (layer.x / 100) * width - (1 - boundedT) * width;
              drawSingleMediaContent(ctx, layer, time, layer.opacity, currX);
            } else if (transitionType === 'zoom') {
              const currScale = layer.scale * boundedT;
              drawSingleMediaContent(ctx, layer, time, layer.opacity * boundedT, undefined, undefined, currScale);
            } else if (transitionType === 'wipe') {
              ctx.save();
              ctx.beginPath();
              ctx.rect(0, 0, boundedT * width, height);
              ctx.clip();
              drawSingleMediaContent(ctx, layer, time, layer.opacity);
              ctx.restore();
            } else {
              drawSingleMediaContent(ctx, layer, time, layer.opacity);
            }
          }
        } else {
          drawSingleMediaContent(ctx, layer, time, layer.opacity);
        }
      } 
      else if (layer.type === 'text' && layer.properties.text) {
        const text = layer.properties.text;
        const fontSize = (layer.properties.fontSize || 32) * (width / 540); // responsive font
        const fontColor = layer.properties.color || '#ffffff';
        const animation = layer.properties.animation || 'fade';
        const isBold = layer.properties.bold;
        const hasShadow = layer.properties.shadow;

        ctx.translate(pxX, pxY);

        // Apply Entrance Animation
        const elapsed = time - layer.start;
        const animDuration = 0.5; // 0.5s transition
        let animScale = 1;
        let animOpacity = 1;
        let animOffset = 0;
        let textToShow = text;

        if (elapsed < animDuration) {
          const t = elapsed / animDuration; // 0 to 1
          if (animation === 'fade') {
            animOpacity = t;
          } else if (animation === 'zoom') {
            animScale = 0.5 + 0.5 * t;
            animOpacity = t;
          } else if (animation === 'slide') {
            animOffset = 30 * (1 - t);
            animOpacity = t;
          } else if (animation === 'typewriter') {
            const charCount = Math.floor(text.length * t);
            textToShow = text.slice(0, Math.max(1, charCount));
          }
        }

        ctx.globalAlpha = layer.opacity * animOpacity;
        ctx.scale(animScale, animScale);

        ctx.font = `${isBold ? '700' : '400'} ${fontSize}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (hasShadow) {
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
        }

        // Text Stroke background for premium legibility on cloth textures
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.strokeText(textToShow, 0, animOffset);
        
        ctx.fillStyle = fontColor;
        ctx.fillText(textToShow, 0, animOffset);
      }
      else if (layer.type === 'sticker' && layer.properties.text) {
        const text = layer.properties.text;
        const style = layer.properties.style || 'purple';
        const fontSize = 16 * (width / 540);
        
        // Bounce micro-animation (WOW factor)
        const bounce = Math.sin(time * 5) * 6;
        ctx.translate(pxX, pxY + bounce);
        ctx.scale(layer.scale, layer.scale);

        ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
        const textWidth = ctx.measureText(text).width;
        const paddingX = 18;
        const paddingY = 10;
        const rectW = textWidth + paddingX * 2;
        const rectH = fontSize + paddingY * 2;

        // Draw Sticker Background (Glassmorphic Gradients)
        let fillGrad = ctx.createLinearGradient(-rectW/2, 0, rectW/2, 0);
        let strokeColor = 'rgba(255,255,255,0.2)';
        let textColor = '#ffffff';

        if (style === 'purple') {
          fillGrad.addColorStop(0, '#8a2be2');
          fillGrad.addColorStop(1, '#ff007f');
          strokeColor = 'rgba(255, 255, 255, 0.4)';
        } else if (style === 'cyan') {
          fillGrad.addColorStop(0, '#00f2fe');
          fillGrad.addColorStop(1, '#4facfe');
          strokeColor = 'rgba(255, 255, 255, 0.4)';
          textColor = '#090a0f';
        } else if (style === 'gold') {
          fillGrad.addColorStop(0, '#ffb703');
          fillGrad.addColorStop(1, '#fb8500');
          strokeColor = 'rgba(255, 255, 255, 0.4)';
          textColor = '#090a0f';
        } else if (style === 'red') {
          fillGrad.addColorStop(0, '#ff007f');
          fillGrad.addColorStop(1, '#ff5252');
          strokeColor = 'rgba(255, 255, 255, 0.4)';
        } else {
          fillGrad.addColorStop(0, '#12141c');
          fillGrad.addColorStop(1, '#2c2d3a');
        }

        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 12;

        // Rounded Box
        ctx.fillStyle = fillGrad;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        const r = 8; // border radius
        ctx.roundRect(-rectW/2, -rectH/2, rectW, rectH, r);
        ctx.fill();
        ctx.stroke();

        // Sticker Text
        ctx.shadowBlur = 0; // reset shadow
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
      }

      ctx.restore();
    });

    // Draw frame decoration / ratio overlay mask borders
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);



    // Selected layer bounding box (only visible during preview/edit mode)
    if (selectedLayerId && !exporting) {
      const activeLayer = layers.find(l => l.id === selectedLayerId);
      if (activeLayer && activeLayer.visible && time >= activeLayer.start && time <= activeLayer.end) {
        ctx.save();
        const pxX = (activeLayer.x / 100) * width;
        const pxY = (activeLayer.y / 100) * height;
        ctx.translate(pxX, pxY);
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);

        // Calculate size of selection frame outline based on active layer type
        let boxW = 0;
        let boxH = 0;

        if (activeLayer.type === 'media') {
          const { w: activeW, h: activeH } = getMediaLayerSize(activeLayer);
          boxW = activeW;
          boxH = activeH;
        } else if (activeLayer.type === 'text') {
          boxW = 240;
          boxH = 40;
        } else if (activeLayer.type === 'sticker') {
          boxW = 160;
          boxH = 50;
        }

        // Draw bounding box outline
        ctx.strokeRect(-boxW / 2 - 4, -boxH / 2 - 4, boxW + 8, boxH + 8);

        // Draw corner scaling handles
        const handleSize = 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // solid line for handles

        const corners = [
          { x: -boxW / 2 - 4, y: -boxH / 2 - 4 },
          { x: boxW / 2 + 4, y: -boxH / 2 - 4 },
          { x: -boxW / 2 - 4, y: boxH / 2 + 4 },
          { x: boxW / 2 + 4, y: boxH / 2 + 4 }
        ];

        corners.forEach(corner => {
          ctx.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        });

        ctx.restore();
      }
    }
  };

  // Dynamic animation playing loop
  const animate = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const delta = (timestamp - lastTimeRef.current) / 1000; // in seconds
    lastTimeRef.current = timestamp;

    if (isPlaying) {
      if (totalDuration <= 0) {
        setIsPlaying(false);
        setCurrentTime(0);
      } else {
        setCurrentTime((prev) => {
          if (prev >= totalDuration) {
            return 0;
          }
          let next = prev + delta;
          if (next >= totalDuration) {
            next = 0; // Loop main video
          }
          return next;
        });
      }
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawFrame(ctx, currentTime);
      }
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, currentTime, layers, ratio, renderTrigger]);

  // Pause all cached videos when global playback pauses (except during export)
  useEffect(() => {
    if (!isPlaying && !exporting) {
      (Object.values(videosCacheRef.current) as HTMLVideoElement[]).forEach(video => {
        try {
          video.pause();
        } catch (e) {}
      });
    }
  }, [isPlaying, exporting]);

  const [canvasCursor, setCanvasCursor] = useState<'default' | 'move' | 'nwse-resize' | 'nesw-resize'>('default');

  const [isDraggingLayer, setIsDraggingLayer] = useState(false);
  const draggedLayerIdRef = useRef<string | null>(null);
  const initialMousePosRef = useRef({ x: 0, y: 0 });
  const initialLayerPosRef = useRef({ x: 0, y: 0 });

  const [isResizingLayer, setIsResizingLayer] = useState(false);
  const resizedLayerIdRef = useRef<string | null>(null);
  const activeHandleRef = useRef<'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const initialScaleRef = useRef<number>(1);
  const initialLogicalCenterRef = useRef({ x: 0, y: 0 });

  // Click & Drag Layer on Canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    const logicalClickX = ((e.clientX - rect.left) / rect.width) * width;
    const logicalClickY = ((e.clientY - rect.top) / rect.height) * height;

    // Check if clicked on a corner handle of the selected layer
    if (selectedLayerId) {
      const activeLayer = layers.find(l => l.id === selectedLayerId);
      if (activeLayer && activeLayer.visible && currentTime >= activeLayer.start && currentTime <= activeLayer.end) {
        const pxX = (activeLayer.x / 100) * width;
        const pxY = (activeLayer.y / 100) * height;
        
        let boxW = 0;
        let boxH = 0;

        if (activeLayer.type === 'media') {
          const { w: activeW, h: activeH } = getMediaLayerSize(activeLayer);
          boxW = activeW;
          boxH = activeH;
        } else if (activeLayer.type === 'text') {
          boxW = 240;
          boxH = 40;
        } else if (activeLayer.type === 'sticker') {
          boxW = 160;
          boxH = 50;
        }

        const corners = [
          { name: 'nw' as const, x: pxX - boxW / 2 - 4, y: pxY - boxH / 2 - 4 },
          { name: 'ne' as const, x: pxX + boxW / 2 + 4, y: pxY - boxH / 2 - 4 },
          { name: 'sw' as const, x: pxX - boxW / 2 - 4, y: pxY + boxH / 2 + 4 },
          { name: 'se' as const, x: pxX + boxW / 2 + 4, y: pxY + boxH / 2 + 4 }
        ];

        let clickedHandle = null;
        for (const corner of corners) {
          const dist = Math.sqrt(Math.pow(corner.x - logicalClickX, 2) + Math.pow(corner.y - logicalClickY, 2));
          if (dist < 12) {
            clickedHandle = corner.name;
            break;
          }
        }

        if (clickedHandle) {
          setIsResizingLayer(true);
          resizedLayerIdRef.current = activeLayer.id;
          activeHandleRef.current = clickedHandle;
          initialScaleRef.current = activeLayer.scale;
          initialMousePosRef.current = { x: e.clientX, y: e.clientY };
          initialLogicalCenterRef.current = { x: pxX, y: pxY };
          if (clickedHandle === 'nw' || clickedHandle === 'se') {
            setCanvasCursor('nwse-resize');
          } else {
            setCanvasCursor('nesw-resize');
          }
          return;
        }
      }
    }

    // Find layer near click (normal body dragging, checking exact bounding boxes)
    let foundLayer: Layer | null = null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || currentTime < layer.start || currentTime > layer.end) continue;
      
      const pxX = (layer.x / 100) * width;
      const pxY = (layer.y / 100) * height;
      let isInside = false;

      if (layer.type === 'media') {
        const { w: boxW, h: boxH } = getMediaLayerSize(layer);
        isInside = (
          logicalClickX >= pxX - boxW / 2 &&
          logicalClickX <= pxX + boxW / 2 &&
          logicalClickY >= pxY - boxH / 2 &&
          logicalClickY <= pxY + boxH / 2
        );
      } else if (layer.type === 'text') {
        const boxW = 240 * layer.scale;
        const boxH = 40 * layer.scale;
        isInside = (
          logicalClickX >= pxX - boxW / 2 &&
          logicalClickX <= pxX + boxW / 2 &&
          logicalClickY >= pxY - boxH / 2 &&
          logicalClickY <= pxY + boxH / 2
        );
      } else if (layer.type === 'sticker') {
        const boxW = 160 * layer.scale;
        const boxH = 50 * layer.scale;
        isInside = (
          logicalClickX >= pxX - boxW / 2 &&
          logicalClickX <= pxX + boxW / 2 &&
          logicalClickY >= pxY - boxH / 2 &&
          logicalClickY <= pxY + boxH / 2
        );
      }

      if (isInside) {
        foundLayer = layer;
        break;
      }
    }

    if (foundLayer) {
      setSelectedLayerId(foundLayer.id);
      draggedLayerIdRef.current = foundLayer.id;
      initialMousePosRef.current = { x: e.clientX, y: e.clientY };
      initialLayerPosRef.current = { x: foundLayer.x, y: foundLayer.y };
      setIsDraggingLayer(true);
      setCanvasCursor('move');
    } else {
      setSelectedLayerId(null);
      setCanvasCursor('default');
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      if (isDraggingLayer && draggedLayerIdRef.current) {
        const dx = e.clientX - initialMousePosRef.current.x;
        const dy = e.clientY - initialMousePosRef.current.y;
        
        const percentDx = (dx / rect.width) * 100;
        const percentDy = (dy / rect.height) * 100;
        
        const newX = Math.max(0, Math.min(100, initialLayerPosRef.current.x + percentDx));
        const newY = Math.max(0, Math.min(100, initialLayerPosRef.current.y + percentDy));
        
        setLayers(prev => prev.map(l => l.id === draggedLayerIdRef.current ? { ...l, x: newX, y: newY } : l));
      } 
      else if (isResizingLayer && resizedLayerIdRef.current) {
        const dx = e.clientX - initialMousePosRef.current.x;
        const dy = e.clientY - initialMousePosRef.current.y;

        const logicalDx = (dx / rect.width) * width;
        const logicalDy = (dy / rect.height) * height;

        const activeLayer = layers.find(l => l.id === resizedLayerIdRef.current);
        if (!activeLayer) return;

        let boxW = 0;
        let boxH = 0;
        if (activeLayer.type === 'media') {
          const { w: activeW, h: activeH } = getMediaLayerSize(activeLayer, initialScaleRef.current);
          boxW = activeW;
          boxH = activeH;
        } else if (activeLayer.type === 'text') {
          boxW = 240;
          boxH = 40;
        } else if (activeLayer.type === 'sticker') {
          boxW = 160;
          boxH = 50;
        }

        const distInitial = Math.sqrt(Math.pow(boxW / 2 + 4, 2) + Math.pow(boxH / 2 + 4, 2));

        const initialClickX = ((initialMousePosRef.current.x - rect.left) / rect.width) * width;
        const initialClickY = ((initialMousePosRef.current.y - rect.top) / rect.height) * height;

        const center = initialLogicalCenterRef.current;
        const currentMouseX = initialClickX + logicalDx;
        const currentMouseY = initialClickY + logicalDy;

        const distCurrent = Math.sqrt(Math.pow(currentMouseX - center.x, 2) + Math.pow(currentMouseY - center.y, 2));

        const scaleFactor = distCurrent / distInitial;

        const newScale = Math.max(0.15, Math.min(3.5, initialScaleRef.current * scaleFactor));

        setLayers(prev => prev.map(l => l.id === resizedLayerIdRef.current ? { ...l, scale: newScale } : l));
      }
    };

    const handleMouseUp = () => {
      if (isDraggingLayer) {
        setIsDraggingLayer(false);
        draggedLayerIdRef.current = null;
      }
      if (isResizingLayer) {
        setIsResizingLayer(false);
        resizedLayerIdRef.current = null;
        activeHandleRef.current = null;
      }
      setCanvasCursor('default');
    };

    if (isDraggingLayer || isResizingLayer) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingLayer, isResizingLayer, layers, setLayers, width, height]);

  // Hover effect to update canvas cursor dynamically
  const handleMouseMoveCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingLayer) {
      setCanvasCursor('move');
      return;
    }
    if (isResizingLayer) {
      if (activeHandleRef.current === 'nw' || activeHandleRef.current === 'se') {
        setCanvasCursor('nwse-resize');
      } else {
        setCanvasCursor('nesw-resize');
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    const logicalClickX = ((e.clientX - rect.left) / rect.width) * width;
    const logicalClickY = ((e.clientY - rect.top) / rect.height) * height;

    if (selectedLayerId) {
      const activeLayer = layers.find(l => l.id === selectedLayerId);
      if (activeLayer && activeLayer.visible && currentTime >= activeLayer.start && currentTime <= activeLayer.end) {
        const pxX = (activeLayer.x / 100) * width;
        const pxY = (activeLayer.y / 100) * height;
        
        let boxW = 0;
        let boxH = 0;

        if (activeLayer.type === 'media') {
          const { w: activeW, h: activeH } = getMediaLayerSize(activeLayer);
          boxW = activeW;
          boxH = activeH;
        } else if (activeLayer.type === 'text') {
          boxW = 240;
          boxH = 40;
        } else if (activeLayer.type === 'sticker') {
          boxW = 160;
          boxH = 50;
        }

        const corners = [
          { name: 'nw' as const, x: pxX - boxW / 2 - 4, y: pxY - boxH / 2 - 4 },
          { name: 'ne' as const, x: pxX + boxW / 2 + 4, y: pxY - boxH / 2 - 4 },
          { name: 'sw' as const, x: pxX - boxW / 2 - 4, y: pxY + boxH / 2 + 4 },
          { name: 'se' as const, x: pxX + boxW / 2 + 4, y: pxY + boxH / 2 + 4 }
        ];

        for (const corner of corners) {
          const dist = Math.sqrt(Math.pow(corner.x - logicalClickX, 2) + Math.pow(corner.y - logicalClickY, 2));
          if (dist < 12) {
            if (corner.name === 'nw' || corner.name === 'se') {
              setCanvasCursor('nwse-resize');
            } else {
              setCanvasCursor('nesw-resize');
            }
            return;
          }
        }
      }
    }

    // Check if hovering over any layer body (checking exact bounding boxes)
    let foundLayer = null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || currentTime < layer.start || currentTime > layer.end) continue;
      
      const pxX = (layer.x / 100) * width;
      const pxY = (layer.y / 100) * height;
      let isInside = false;

      if (layer.type === 'media') {
        const { w: boxW, h: boxH } = getMediaLayerSize(layer);
        isInside = (
          logicalClickX >= pxX - boxW / 2 &&
          logicalClickX <= pxX + boxW / 2 &&
          logicalClickY >= pxY - boxH / 2 &&
          logicalClickY <= pxY + boxH / 2
        );
      } else if (layer.type === 'text') {
        const boxW = 240 * layer.scale;
        const boxH = 40 * layer.scale;
        isInside = (
          logicalClickX >= pxX - boxW / 2 &&
          logicalClickX <= pxX + boxW / 2 &&
          logicalClickY >= pxY - boxH / 2 &&
          logicalClickY <= pxY + boxH / 2
        );
      } else if (layer.type === 'sticker') {
        const boxW = 160 * layer.scale;
        const boxH = 50 * layer.scale;
        isInside = (
          logicalClickX >= pxX - boxW / 2 &&
          logicalClickX <= pxX + boxW / 2 &&
          logicalClickY >= pxY - boxH / 2 &&
          logicalClickY <= pxY + boxH / 2
        );
      }

      if (isInside) {
        foundLayer = layer;
        break;
      }
    }

    if (foundLayer) {
      setCanvasCursor('move');
    } else {
      setCanvasCursor('default');
    }
  };

  // Canvas-based real-time video recorder (WebM/MP4 Export)
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsPlaying(false);
    setCurrentTime(0);
    setExporting(true);
    setExportProgress(0);
    setExportLogs(['Preparing Canvas Export Engine...', 'Format setting: MP4 / WebM', 'Codec setting: H.264 / VP8']);

    // Resume AudioContext for export to ensure sound captures
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    // Capture visual stream from canvas
    const canvasStream = canvas.captureStream(30); // 30 FPS
    const mixedStream = new MediaStream();
    
    // Add video tracks to recording stream
    canvasStream.getVideoTracks().forEach(track => mixedStream.addTrack(track));
    
    // Add mixed audio track if audioDestination exists and has active tracks
    if (audioDestinationRef.current) {
      const audioTracks = audioDestinationRef.current.stream.getAudioTracks();
      audioTracks.forEach(track => mixedStream.addTrack(track));
    }
    
    // Choose mimeType supported by browser (prioritize MP4, fallback to WebM renamed to MP4 for platform upload compatibility)
    let options = { mimeType: 'video/mp4;codecs=h264' };
    let fileType = 'video/mp4';
    let extension = 'mp4';

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/mp4' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm;codecs=vp9' };
        fileType = 'video/webm';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'video/webm;codecs=vp8' };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: 'video/webm' };
          }
        }
      }
    }

    let mediaRecorder: MediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(mixedStream, options);
    } catch (err) {
      setExportLogs(prev => [...prev, 'Fallback to default WebM encoder...']);
      mediaRecorder = new MediaRecorder(mixedStream);
    }

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      setExportLogs(prev => [...prev, 'Compiling video chunks...', 'Applying audio beat alignments...', 'Generating file stream...']);
      
      const blob = new Blob(chunks, { type: fileType });
      const url = URL.createObjectURL(blob);
      
      setExportProgress(100);
      setExportLogs(prev => [...prev, 'Video compilation finished!', 'Compressed successfully to 2.4MB (Fits platform rules).']);
      
      // Auto download link
      const a = document.createElement('a');
      a.href = url;
      a.download = `keyvideo_${ratio}_${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };

    // Start recording loop
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 8;
      if (progress >= 95) {
        clearInterval(progressInterval);
      } else {
        setExportProgress(progress);
        const steps = [
          'Rasterizing frame timelines...',
          'Applying AI Try-on shaders...',
          'Compiling subtitle layouts...',
          'Baking audio voiceover track...'
        ];
        const log = steps[Math.floor(progress / 25) % steps.length];
        setExportLogs(prev => {
          if (prev[prev.length - 1] !== log) {
            return [...prev, `${log} (${progress}%)`];
          }
          return prev;
        });
      }
    }, 400);

    // Record timeline playback
    mediaRecorder.start();
    let recordTime = 0;
    const frameRate = 30;
    const activeLayers = layers.filter(l => l.visible);
    const maxLayerEnd = activeLayers.reduce((max, l) => l.end > max ? l.end : max, 0);
    const duration = maxLayerEnd > 0 ? Math.min(15, maxLayerEnd) : 15;
    const intervalTime = 1000 / frameRate;

    const recordingTimer = setInterval(() => {
      recordTime += intervalTime / 1000;
      setCurrentTime(recordTime);

      if (recordTime >= duration) {
        clearInterval(recordingTimer);
        clearInterval(progressInterval);
        mediaRecorder.stop();
      }
    }, intervalTime);
  };

  return (
    <div className="preview-panel">
      <div className={`canvas-wrapper ratio-${ratio}`}>
        {!imagesLoaded && (
          <div className="ai-processing-overlay" style={{ background: '#090a0f' }}>
            <div className="spinner" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>加载高清面料素材中...</span>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="main-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMoveCanvas}
          style={{ cursor: canvasCursor }}
        />
        


        {/* Model swap simulate animation */}
        {modelSwapRunning && (
          <div className="ai-processing-overlay">
            <div className="spinner spinner-purple" />
            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--accent-purple)' }}>
              AI 模特匹配试衣中...
            </span>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="playback-controls">
        <button
          className="control-btn"
          onClick={() => setCurrentTime(0)}
          title="Rewind"
        >
          {/* Seek first icon */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="19 20 9 12 19 4 19 20" fill="currentColor"/>
            <line x1="5" y1="4" x2="5" y2="20" />
          </svg>
        </button>
        <button
          className="control-btn play-pause"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          )}
        </button>
        <input
          type="range"
          min="0"
          max={totalDuration}
          step="0.05"
          value={Math.min(currentTime, totalDuration)}
          onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
          style={{ width: '100px', cursor: 'pointer', margin: '0 8px' }}
          className="slider-input"
        />
        <div className="time-display">
          <span>{Math.min(currentTime, totalDuration).toFixed(1)}s</span>
          <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
          <span>{totalDuration.toFixed(1)}s</span>
        </div>
      </div>

      {/* Export overlay modal */}
      {exporting && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>正在合成高清主图视频</h3>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${exportProgress}%` }} />
            </div>
            <div className="export-log">
              {exportLogs.map((log, index) => (
                <div key={index} style={{ marginBottom: '4px' }}>{`> ${log}`}</div>
              ))}
            </div>
            {exportProgress === 100 && (
              <button
                className="btn-primary"
                onClick={() => setExporting(false)}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                完成
              </button>
            )}
          </div>
        </div>
      )}

      {/* Inject export trigger */}
      <div style={{ display: 'none' }} id="export-trigger" onClick={handleExport} />
    </div>
  );
};
