import React from 'react';
import type { CanvasNodeData, CanvasViewport } from '../../types/canvas';

interface CanvasMinimapProps {
  nodes: CanvasNodeData[];
  viewport: CanvasViewport;
  containerWidth: number;
  containerHeight: number;
  onPanTo: (worldX: number, worldY: number) => void;
}

export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  nodes,
  viewport,
  containerWidth,
  containerHeight,
  onPanTo
}) => {
  const mapWidth = 200;
  const mapHeight = 130;

  // Calculate bounding box of all nodes plus current viewport
  const viewLeft = -viewport.x / viewport.scale;
  const viewTop = -viewport.y / viewport.scale;
  const viewRight = viewLeft + containerWidth / viewport.scale;
  const viewBottom = viewTop + containerHeight / viewport.scale;

  let minX = viewLeft;
  let minY = viewTop;
  let maxX = viewRight;
  let maxY = viewBottom;

  nodes.forEach(n => {
    minX = Math.min(minX, n.position.x - 100);
    minY = Math.min(minY, n.position.y - 100);
    maxX = Math.max(maxX, n.position.x + n.width + 100);
    maxY = Math.max(maxY, n.position.y + n.height + 100);
  });

  const totalWidth = Math.max(maxX - minX, 1000);
  const totalHeight = Math.max(maxY - minY, 800);

  const scaleX = mapWidth / totalWidth;
  const scaleY = mapHeight / totalHeight;
  const mapScale = Math.min(scaleX, scaleY);

  const worldToMap = (wx: number, wy: number) => ({
    x: (wx - minX) * mapScale,
    y: (wy - minY) * mapScale
  });

  const viewRect = {
    ...worldToMap(viewLeft, viewTop),
    width: (containerWidth / viewport.scale) * mapScale,
    height: (containerHeight / viewport.scale) * mapScale
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const targetWorldX = clickX / mapScale + minX;
    const targetWorldY = clickY / mapScale + minY;

    onPanTo(targetWorldX, targetWorldY);
  };

  return (
    <div className="canvas-minimap-container" onClick={handleMapClick}>
      <div className="minimap-header">
        <span>小地图</span>
      </div>

      <svg width={mapWidth} height={mapHeight} className="minimap-svg">
        {/* Render node boxes */}
        {nodes.map(n => {
          const { x, y } = worldToMap(n.position.x, n.position.y);
          const w = Math.max(n.width * mapScale, 4);
          const h = Math.max(n.height * mapScale, 4);

          let fill = 'var(--accent-purple, #8a2be2)';
          if (n.type === 'clothing') fill = '#ff007f';
          if (n.type === 'prompt') fill = '#00f2fe';
          if (n.type === 'video') fill = '#ffb703';
          if (n.type === 'workflow') fill = '#10b981';

          return (
            <rect
              key={n.id}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={2}
              fill={fill}
              opacity={0.7}
            />
          );
        })}

        {/* Viewport frame */}
        <rect
          x={viewRect.x}
          y={viewRect.y}
          width={Math.max(viewRect.width, 10)}
          height={Math.max(viewRect.height, 10)}
          fill="rgba(0, 242, 254, 0.08)"
          stroke="var(--accent-cyan, #00f2fe)"
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
};
