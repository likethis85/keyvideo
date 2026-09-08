import React, { useMemo } from 'react';
import type { CanvasConnection, CanvasNodeData, Position } from '../../types/canvas';

interface CanvasConnectionsProps {
  connections: CanvasConnection[];
  nodes: CanvasNodeData[];
  connectingState: {
    fromNodeId: string;
    fromHandle?: string;
    currentMousePos: Position;
  } | null;
  selectedConnectionId?: string | null;
  onSelectConnection?: (id: string | null) => void;
  onRemoveConnection: (id: string) => void;
}

export const CanvasConnections: React.FC<CanvasConnectionsProps> = ({
  connections,
  nodes,
  connectingState,
  selectedConnectionId,
  onSelectConnection,
  onRemoveConnection
}) => {
  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNodeData>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Adaptive direction-aware bezier curve path calculation
  const getCurvePath = (from: CanvasNodeData, to: CanvasNodeData) => {
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x;
    const endY = to.position.y + to.height / 2;

    // Standard forward flow (L -> R)
    if (endX >= startX + 40) {
      const dx = Math.max(Math.abs(endX - startX) * 0.5, 50);
      return `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
    }

    // Reverse, backward, or vertically aligned routing:
    // Expand control points outwards to loop gracefully around node cards
    const dxOffset = Math.max(100, Math.abs(endY - startY) * 0.4);
    const cp1X = startX + dxOffset;
    const cp1Y = startY;
    const cp2X = endX - dxOffset;
    const cp2Y = endY;
    return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
  };

  const getDragCurvePath = (from: CanvasNodeData, mousePos: Position) => {
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = mousePos.x;
    const endY = mousePos.y;

    if (endX >= startX + 40) {
      const dx = Math.max(Math.abs(endX - startX) * 0.5, 50);
      return `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
    }

    const dxOffset = Math.max(90, Math.abs(endY - startY) * 0.4);
    return `M ${startX} ${startY} C ${startX + dxOffset} ${startY}, ${endX - dxOffset} ${endY}, ${endX} ${endY}`;
  };

  return (
    <svg
      className="canvas-connections-layer"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible'
      }}
    >
      <defs>
        <linearGradient id="conn-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-purple, #8a2be2)" />
          <stop offset="100%" stopColor="var(--accent-cyan, #00f2fe)" />
        </linearGradient>

        <linearGradient id="conn-gradient-active" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="50%" stopColor="#8a2be2" />
          <stop offset="100%" stopColor="#00f2fe" />
        </linearGradient>

        <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="glow-selected" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Existing connections */}
      {connections.map(conn => {
        const fromNode = nodeMap.get(conn.fromNodeId);
        const toNode = nodeMap.get(conn.toNodeId);
        if (!fromNode || !toNode) return null;

        const isSelected = selectedConnectionId === conn.id;
        const isUpstreamLoading = fromNode.status === 'loading';
        const pathData = getCurvePath(fromNode, toNode);

        // Calculate approximate midpoint for label & delete badge
        const startX = fromNode.position.x + fromNode.width;
        const startY = fromNode.position.y + fromNode.height / 2;
        const endX = toNode.position.x;
        const endY = toNode.position.y + toNode.height / 2;
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;

        return (
          <g
            key={conn.id}
            className={`canvas-connection-group ${isSelected ? 'is-selected' : ''} ${isUpstreamLoading ? 'is-flowing' : ''}`}
            style={{ pointerEvents: 'auto' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectConnection?.(isSelected ? null : conn.id);
            }}
          >
            {/* Wider transparent hit area for easy clicking & selection */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth={20}
              style={{ cursor: 'pointer' }}
            />

            {/* Glowing aesthetic base line */}
            <path
              d={pathData}
              fill="none"
              stroke={isSelected ? '#00f2fe' : isUpstreamLoading ? 'url(#conn-gradient-active)' : 'url(#conn-gradient)'}
              strokeWidth={isSelected ? 3.5 : isUpstreamLoading ? 3 : 2.5}
              strokeDasharray={isUpstreamLoading ? '8 4' : isSelected ? 'none' : '6 4'}
              className={`connection-line-path ${isUpstreamLoading ? 'connection-line-fast' : 'connection-line-animated'}`}
              style={{ filter: isSelected ? 'url(#glow-selected)' : 'url(#glow-effect)' }}
            />

            {/* Connection Label Pill (if label exists) */}
            {conn.label && (
              <g transform={`translate(${midX}, ${midY - 14})`} style={{ pointerEvents: 'none' }}>
                <rect
                  x={-conn.label.length * 6 - 8}
                  y={-9}
                  width={conn.label.length * 12 + 16}
                  height={18}
                  rx={9}
                  fill="rgba(15, 23, 42, 0.9)"
                  stroke={isSelected ? '#00f2fe' : 'rgba(255, 255, 255, 0.2)'}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill={isSelected ? '#00f2fe' : '#e2e8f0'}
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="sans-serif"
                >
                  {conn.label}
                </text>
              </g>
            )}

            {/* Delete Badge at midpoint */}
            <g
              transform={`translate(${midX}, ${midY})`}
              className="conn-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveConnection(conn.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <title>点击断开此连线</title>
              <circle
                r={10}
                fill="var(--bg-surface-solid, #12141c)"
                stroke={isSelected ? '#00f2fe' : 'var(--border-color, rgba(255,255,255,0.25))'}
                strokeWidth={1.5}
              />
              <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="#ff6b6b" strokeWidth={1.8} strokeLinecap="round" />
            </g>
          </g>
        );
      })}

      {/* Dragging connection in progress */}
      {connectingState && nodeMap.get(connectingState.fromNodeId) && (
        <path
          d={getDragCurvePath(nodeMap.get(connectingState.fromNodeId)!, connectingState.currentMousePos)}
          fill="none"
          stroke="var(--accent-cyan, #00f2fe)"
          strokeWidth={2.8}
          strokeDasharray="5 3"
          style={{ filter: 'drop-shadow(0 0 8px rgba(0, 242, 254, 0.75))' }}
        />
      )}
    </svg>
  );
};
