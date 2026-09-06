import type { MouseEventHandler, RefObject } from 'react';
import type { AspectRatio } from '../../utils/smartReflow';

interface Props {
  ratio: AspectRatio;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  cursor: string;
  imagesLoaded: boolean;
  modelSwapRunning: boolean;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
}

export function CanvasStage({ ratio, canvasRef, width, height, cursor, imagesLoaded, modelSwapRunning, onMouseDown, onMouseMove }: Props) {
  return <div className={`canvas-wrapper ratio-${ratio}`}>
    {!imagesLoaded && <div className="ai-processing-overlay canvas-loading-overlay"><div className="spinner" /><span>加载高清面料素材中...</span></div>}
    <canvas ref={canvasRef} width={width} height={height} className="main-canvas" onMouseDown={onMouseDown} onMouseMove={onMouseMove} style={{ cursor }} />
    {modelSwapRunning && <div className="ai-processing-overlay"><div className="spinner spinner-purple" /><span className="canvas-model-loading-text">AI 模特匹配试衣中...</span></div>}
  </div>;
}
