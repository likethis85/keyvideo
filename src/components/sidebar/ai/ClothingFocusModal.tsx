import { createPortal } from 'react-dom';
import { AIIcon, type AIIconName } from './AIIcon';

export type ClothingFocus = 'top' | 'bottom' | 'both';

interface ClothingFocusModalProps {
  isOpen: boolean;
  hasReferenceOutfits: boolean;
  onClose: () => void;
  onSelect: (focus: ClothingFocus) => void;
}

const options: Array<{ id: ClothingFocus; icon: AIIconName; title: string; desc: string }> = [
  { id: 'top', icon: 'clothes', title: '重点推广上装', desc: 'AI 分镜将聚焦上装细节、领口、剪裁和材质' },
  { id: 'bottom', icon: 'clothes', title: '重点推广下装', desc: 'AI 分镜将聚焦下装版型、裙摆、裤脚和垂坠感' },
  { id: 'both', icon: 'model', title: '整体搭配展示', desc: '保持全身拍摄比例，兼顾服饰协调与整体搭配效果' }
];

export function ClothingFocusModal({ isOpen, hasReferenceOutfits, onClose, onSelect }: ClothingFocusModalProps) {
  if (!isOpen) return null;
  return createPortal(
    <div className="clothing-focus-modal-backdrop" onClick={onClose}>
      <div className="clothing-focus-modal" onClick={event => event.stopPropagation()}>
        <div className="clothing-focus-heading">
          <div className="clothing-focus-title"><span className="clothing-focus-title-icon"><AIIcon name="spark" size={25} /></span><span>选择分镜生成推广重点</span></div>
          <span className="clothing-focus-description">
            {hasReferenceOutfits ? '检测到您当前仅上传了「穿搭参考图」，未提供分体服装图。请选择本次生成的推广重点，以自动调整分镜构图和拍摄细节：' : '检测到您当前未上传具体的分体衣服图层（上装/下装）。请选择本次分镜生成的推广重点，以自动调整构图与拍摄细节：'}
          </span>
        </div>
        <div className="clothing-focus-options">
          {options.map(option => (
            <button className="clothing-focus-option" key={option.id} type="button" onClick={() => onSelect(option.id)}>
              <span className="clothing-focus-option-icon"><AIIcon name={option.icon} size={27} /></span>
              <span className="clothing-focus-option-copy"><span>{option.title}</span><small>{option.desc}</small></span>
              <AIIcon className="clothing-focus-option-arrow" name="arrow" size={19} />
            </button>
          ))}
        </div>
        <div className="clothing-focus-footer"><button className="btn-secondary clothing-focus-cancel" onClick={onClose}>取消</button></div>
      </div>
    </div>, document.body
  );
}
