import { createPortal } from 'react-dom';

export type ClothingFocus = 'top' | 'bottom' | 'both';

interface ClothingFocusModalProps {
  isOpen: boolean;
  hasReferenceOutfits: boolean;
  onClose: () => void;
  onSelect: (focus: ClothingFocus) => void;
}

const options: Array<{ id: ClothingFocus; icon: string; title: string; desc: string }> = [
  { id: 'top', icon: '👕', title: '重点推广上装', desc: 'AI 分镜将聚焦上装细节、领口、剪裁和材质' },
  { id: 'bottom', icon: '👖', title: '重点推广下装', desc: 'AI 分镜将聚焦下装版型、裙摆/裤脚、垂坠感' },
  { id: 'both', icon: '👗', title: '两者同样重要 / 整体搭配', desc: '保持全身拍摄比例，兼顾整体服饰的协调与搭配展示' }
];

export function ClothingFocusModal({ isOpen, hasReferenceOutfits, onClose, onSelect }: ClothingFocusModalProps) {
  if (!isOpen) return null;
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9, 10, 15, 0.85)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, animation: 'fadeIn 0.25s ease-out' }} onClick={onClose}>
      <div style={{ width: '420px', background: 'rgba(20, 21, 32, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px', padding: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(138, 43, 226, 0.1)', display: 'flex', flexDirection: 'column', gap: '20px', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif' }} onClick={event => event.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ fontSize: '20px' }}>🎯</span><span style={{ fontSize: '16px', fontWeight: '700' }}>选择分镜生成推广重点</span></div>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', lineHeight: '1.4' }}>
            {hasReferenceOutfits ? '检测到您当前仅上传了「穿搭参考图」，未提供分体服装图。请选择本次生成的推广重点，以自动调整分镜构图和拍摄细节：' : '检测到您当前未上传具体的分体衣服图层（上装/下装）。请选择本次分镜生成的推广重点，以自动调整构图与拍摄细节：'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {options.map(option => (
            <button key={option.id} type="button" onClick={() => onSelect(option.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
              <span style={{ fontSize: '24px' }}>{option.icon}</span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}><span style={{ fontSize: '13px', fontWeight: '600' }}>{option.title}</span><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>{option.desc}</span></span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}><button className="btn-secondary" onClick={onClose} style={{ padding: '8px 20px', fontSize: '12px', cursor: 'pointer', margin: 0, borderRadius: '8px' }}>取消</button></div>
      </div>
    </div>, document.body
  );
}
