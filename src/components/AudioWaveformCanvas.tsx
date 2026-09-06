import React, { useEffect, useRef, useState } from 'react';
import { extractAudioWaveform } from '../utils/audioWaveform';

interface AudioWaveformCanvasProps {
  src: string;
  height?: number;
  barColor?: string;
  activeColor?: string;
}

export const AudioWaveformCanvas: React.FC<AudioWaveformCanvasProps> = ({
  src,
  height = 24,
  barColor = 'rgba(0, 242, 254, 0.45)',
  activeColor = 'rgba(138, 43, 226, 0.6)'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [peaks, setPeaks] = useState<number[]>([]);

  useEffect(() => {
    let isCancelled = false;
    if (!src) return;

    extractAudioWaveform(src).then(data => {
      if (!isCancelled) {
        setPeaks(data);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [src]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, width, h);

    const barWidth = 2;
    const barGap = 1.5;
    const totalBars = Math.floor(width / (barWidth + barGap));
    const step = peaks.length / totalBars;

    // Subtle gradient for waveform bars
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, barColor);
    gradient.addColorStop(0.5, activeColor);
    gradient.addColorStop(1, barColor);

    ctx.fillStyle = gradient;

    for (let i = 0; i < totalBars; i++) {
      const peakIndex = Math.min(peaks.length - 1, Math.floor(i * step));
      const amplitude = peaks[peakIndex] || 0.1;
      const barHeight = Math.max(3, amplitude * (h - 4));
      const x = i * (barWidth + barGap);
      const y = (h - barHeight) / 2;

      // Draw rounded bar
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }
  }, [peaks, barColor, activeColor]);

  // Use ResizeObserver to resize canvas resolution to match container width
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      if (canvas.parentElement) {
        const rect = canvas.parentElement.getBoundingClientRect();
        if (rect.width > 0 && canvas.width !== Math.floor(rect.width)) {
          canvas.width = Math.floor(rect.width);
          canvas.height = height;
        }
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => observer.disconnect();
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 1,
        opacity: 0.85
      }}
    />
  );
};
