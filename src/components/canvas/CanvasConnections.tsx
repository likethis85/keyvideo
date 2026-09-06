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
  onRemoveConnection: (id: string) => void;
}

export const CanvasConnections: React.FC<CanvasConnectionsProps> = ({
  connections,
  nodes,
  connectingState,
  onRemoveConnection
}) => {
  const nodeMap = useMemo(() => {
    const map = new Map<string, CanvasNodeData>();
    nodes.forEach(n => map.set(n.id, n));
    return map;
  }, [nodes]);

  // Calculate bezier curve path between source (right handle) and target (left handle)
  const getCurvePath = (from: CanvasNodeData, to: CanvasNodeData) => {
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = to.position.x;
    const endY = to.position.y + to.height / 2;

    const dx = Math.max(Math.abs(endX - startX) * 0.5, 40);
    return `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
  };

  const getDragCurvePath = (from: CanvasNodeData, mousePos: Position) => {
    const startX = from.position.x + from.width;
    const startY = from.position.y + from.height / 2;
    const endX = mousePos.x;
    const endY = mousePos.y;

    const dx = Math.max(Math.abs(endX - startX) * 0.5, 40);
    return `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
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
        <filter id="glow-effect" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
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

        const pathData = getCurvePath(fromNode, toNode);
        const midX = (fromNode.position.x + fromNode.width + toNode.position.x) / 2;
        const midY = (fromNode.position.y + fromNode.height / 2 + toNode.position.y + toNode.height / 2) / 2;

        return (
          <g key={conn.id} className="canvas-connection-group" style={{ pointerEvents: 'auto' }}>
            {/* Wider transparent hit area for easy clicking */}
            <path
              d={pathData}
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ cursor: 'pointer' }}
              onClick={() => onRemoveConnection(conn.id)}
            />
            {/* Actual glowing aesthetic line */}
            <path
              d={pathData}
              fill="none"
              stroke="url(#conn-gradient)"
              strokeWidth={2.5}
              strokeDasharray="6 4"
              className="connection-line-animated"
              style={{ filter: 'url(#glow-effect)' }}
            />
            {/* Optional delete badge at midpoint */}
            <g
              transform={`translate(${midX}, ${midY})`}
              className="conn-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveConnection(conn.id);
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle r={10} fill="var(--bg-surface-solid, #12141c)" stroke="var(--border-color, rgba(255,255,255,0.2))" strokeWidth={1} />
              <path d="M -4 -4 L 4 4 M 4 -4 L -4 4" stroke="var(--text-muted, #9ca3af)" strokeWidth={1.5} />
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
          strokeWidth={2.5}
          strokeDasharray="4 4"
          style={{ filter: 'drop-shadow(0 0 6px rgba(0, 242, 254, 0.6))' }}
        />
      )}
    </svg>
  );
};
