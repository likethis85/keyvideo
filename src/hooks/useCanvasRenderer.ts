import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Layer } from '../components/VideoCanvas';

interface Options {
  imagesCacheRef: MutableRefObject<Record<string, HTMLImageElement | HTMLCanvasElement>>;
  videosCacheRef: MutableRefObject<Record<string, HTMLVideoElement>>;
  isOfflineExportingRef: MutableRefObject<boolean>;
  width: number;
  height: number;
  canvasBgMode: 'showroom' | 'dark' | 'checkerboard';
  layers: Layer[];
  selectedLayerId: string | null;
  getMediaLayerSize: (layer: Layer, customScale?: number) => { w: number; h: number };
  isPlaying: boolean;
  exporting: boolean;
  setRenderTrigger: Dispatch<SetStateAction<number>>;
}

export function useCanvasRenderer(options: Options) {
  const { imagesCacheRef, videosCacheRef, isOfflineExportingRef, width, height, canvasBgMode, layers, selectedLayerId, getMediaLayerSize, isPlaying, exporting, setRenderTrigger } = options;

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
          if (isOfflineExportingRef.current) {
            if (!videoSource.paused) videoSource.pause();
          } else if (isPlaying || exporting) {
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
          } catch {
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
      // 1. Draw Background based on canvasBgMode
      if (canvasBgMode === 'dark') {
        ctx.fillStyle = '#06070a';
        ctx.fillRect(0, 0, width, height);
      } else if (canvasBgMode === 'checkerboard') {
        ctx.fillStyle = '#11131a';
        ctx.fillRect(0, 0, width, height);
        const tileSize = 36;
        ctx.fillStyle = '#1c1f2d';
        for (let y = 0; y < height; y += tileSize) {
          for (let x = 0; x < width; x += tileSize) {
            if ((Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0) {
              ctx.fillRect(x, y, tileSize, tileSize);
            }
          }
        }
      } else {
        // Default: High-end luxury showroom radial gradient
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
      }
  
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
          const fillGrad = ctx.createLinearGradient(-rectW/2, 0, rectW/2, 0);
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

  return { drawFrame };
}
