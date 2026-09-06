import React, { useEffect, useRef } from 'react';
import type { CanvasNodeData, CanvasNodeType } from '../../../types/canvas';

export interface NextNodeOption {
  type: CanvasNodeType;
  label: string;
  icon: string;
  desc: string;
  isRecommended?: boolean;
  defaultTitle?: string;
}

/**
 * 根据上游源节点类型，智能推荐允许与适合延伸的下游节点类型
 */
function getAllowedNextNodeTypes(sourceNode: CanvasNodeData): NextNodeOption[] {
  switch (sourceNode.type) {
    case 'clothing':
      return [
        {
          type: 'image',
          label: 'AI 试衣模特成图',
          icon: '🖼️',
          desc: '以该服装为原料，生成高拟真模特上身效果图',
          isRecommended: true,
          defaultTitle: 'AI 试衣模特'
        },
        {
          type: 'prompt',
          label: '场景与风格提示词',
          icon: '✍️',
          desc: '为该服装搭配专属电商光影、影棚与运镜提示词',
          defaultTitle: '穿搭场景提示词'
        },
        {
          type: 'workflow',
          label: '多搭配流程中继',
          icon: '⚡',
          desc: '汇聚上下装多原料输入，统一分发至多组分镜',
          defaultTitle: '款式组合中继'
        },
        {
          type: 'video',
          label: '分镜视频生成',
          icon: '🎬',
          desc: '直接由款式原料生成 3 秒动态电商展示镜头',
          defaultTitle: '动态展示镜头'
        }
      ];

    case 'prompt':
      return [
        {
          type: 'image',
          label: 'AI 试衣/生图成图',
          icon: '🖼️',
          desc: '基于提示词光影与构图描述，生成高质感画面',
          isRecommended: true,
          defaultTitle: 'AI 试衣成图'
        },
        {
          type: 'video',
          label: '分镜视频生成',
          icon: '🎬',
          desc: '使用运镜与画面风格提示词驱动 3 秒视频生成',
          isRecommended: true,
          defaultTitle: '分镜视频'
        },
        {
          type: 'workflow',
          label: '全局提示词配置中继',
          icon: '⚡',
          desc: '将风格提示词作为共享参数注入下游全部镜头',
          defaultTitle: '风格配置中继'
        }
      ];

    case 'image':
      return [
        {
          type: 'video',
          label: '分镜视频生成 (首帧生视频)',
          icon: '🎬',
          desc: '以当前成图为首帧底图，生成 3 秒高清电商镜头',
          isRecommended: true,
          defaultTitle: '分镜视频'
        },
        {
          type: 'image',
          label: '衍生图像 (重绘/裁切/超分)',
          icon: '🖼️',
          desc: '对当前成图进行局部涂抹重绘或超分辨率细节增强',
          defaultTitle: '衍生图像'
        },
        {
          type: 'workflow',
          label: '分镜分发展开中继',
          icon: '⚡',
          desc: '将基底成图一键分流至 5 幕不同景别的视频节点',
          defaultTitle: '分镜分发中继'
        },
        {
          type: 'prompt',
          label: '运镜调整提示词',
          icon: '✍️',
          desc: '根据当前成图效果追加局部动作与镜头修正词',
          defaultTitle: '镜头调整词'
        }
      ];

    case 'video':
      return [
        {
          type: 'video',
          label: '续写下一幕分镜视频',
          icon: '🎬',
          desc: '承接当前镜头的机位与人物姿态，延续生成下一幕',
          isRecommended: true,
          defaultTitle: '下一幕分镜'
        },
        {
          type: 'workflow',
          label: '视频后期与转场中继',
          icon: '⚡',
          desc: '进行视频变速、转场淡入淡出或滤镜调色汇聚',
          defaultTitle: '视频后处理中继'
        },
        {
          type: 'prompt',
          label: '分镜旁白/文案提示词',
          icon: '✍️',
          desc: '为视频镜头添加卖点旁白文案或配音解说词',
          defaultTitle: '卖点解说词'
        }
      ];

    case 'workflow':
    default:
      return [
        {
          type: 'image',
          label: 'AI 试衣成图',
          icon: '🖼️',
          desc: '接收上游输入执行模特穿搭生图',
          isRecommended: true,
          defaultTitle: 'AI 试衣成图'
        },
        {
          type: 'video',
          label: '分镜视频生成',
          icon: '🎬',
          desc: '生成高质量电商动态视频镜头',
          isRecommended: true,
          defaultTitle: '分镜视频'
        },
        {
          type: 'prompt',
          label: '营销提示词',
          icon: '✍️',
          desc: '添加风格描述与运镜指导',
          defaultTitle: '营销提示词'
        },
        {
          type: 'clothing',
          label: '服装原料参考',
          icon: '👗',
          desc: '导入新的款式原料',
          defaultTitle: '服装款式'
        }
      ];
  }
}

interface CanvasSpawnNodeMenuProps {
  sourceNode: CanvasNodeData;
  screenPos: { x: number; y: number };
  containerDimensions: { width: number; height: number };
  onSelect: (type: CanvasNodeType, defaultTitle?: string) => void;
  onClose: () => void;
}

export const CanvasSpawnNodeMenu: React.FC<CanvasSpawnNodeMenuProps> = ({
  sourceNode,
  screenPos,
  containerDimensions,
  onSelect,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const options = getAllowedNextNodeTypes(sourceNode);

  // 边界保护：确保弹出框完全在屏幕可视区域内
  const menuWidth = 280;
  const menuHeight = 360;

  let left = screenPos.x;
  let top = screenPos.y - 40;

  if (left + menuWidth > containerDimensions.width - 20) {
    left = Math.max(16, containerDimensions.width - menuWidth - 24);
  }
  if (top + menuHeight > containerDimensions.height - 20) {
    top = Math.max(16, containerDimensions.height - menuHeight - 24);
  }
  if (left < 16) left = 16;
  if (top < 16) top = 16;

  // 点击外部自动关闭
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="canvas-spawn-menu"
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${menuWidth}px`,
        zIndex: 9999
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* 头部标题与上游源节点说明 */}
      <div className="canvas-spawn-menu-header">
        <div className="spawn-header-info">
          <div className="spawn-header-title">
            <span className="spawn-glow-dot" />
            <span>延伸下游节点</span>
          </div>
          <div className="spawn-header-sub" title={sourceNode.title}>
            上游：{sourceNode.title}
          </div>
        </div>
        <button className="spawn-close-btn" onClick={onClose} title="取消 (Esc)">
          ×
        </button>
      </div>

      {/* 允许创建的节点选项列表 */}
      <div className="canvas-spawn-menu-list">
        {options.map(opt => (
          <button
            key={opt.type + (opt.defaultTitle || '')}
            type="button"
            className={`canvas-spawn-item ${opt.isRecommended ? 'recommended' : ''}`}
            onClick={() => onSelect(opt.type, opt.defaultTitle)}
          >
            <div className="spawn-item-icon-box">
              <span className="spawn-item-icon">{opt.icon}</span>
            </div>

            <div className="spawn-item-body">
              <div className="spawn-item-row">
                <span className="spawn-item-name">{opt.label}</span>
                {opt.isRecommended && (
                  <span className="spawn-recommend-badge">推荐</span>
                )}
              </div>
              <span className="spawn-item-desc">{opt.desc}</span>
            </div>

            <div className="spawn-item-arrow">→</div>
          </button>
        ))}
      </div>

      <div className="canvas-spawn-footer">
        <span>释放连线即可自动建立数据通道</span>
      </div>
    </div>
  );
};
