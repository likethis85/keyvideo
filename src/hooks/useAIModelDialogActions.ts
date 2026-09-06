import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ModelAsset } from '../types/assets';

type PreviewModel = { id?: string; src: string; name: string; storyboardId?: string } | null;

interface AIModelDialogActionsOptions {
  gatewayUrl: string;
  gatewayToken: string;
  modelRefImageUrl: string;
  previewModel: PreviewModel;
  modelEditPrompt: string;
  customPrompt: string;
  generateModel: (input: { sourceUrl: string; prompt: string; existingModel?: ModelAsset }) => Promise<string>;
  setPreviewModel: Dispatch<SetStateAction<PreviewModel>>;
  setShowConfig: (show: boolean) => void;
}

export function useAIModelDialogActions(options: AIModelDialogActionsOptions) {
  const handleCustomModelSwap = useCallback(async (editPreview = false) => {
    if (!options.gatewayUrl.trim() || !options.gatewayToken.trim()) {
      alert(!options.gatewayUrl.trim()
        ? '请先在底部的「AI 网关配置」中输入您的 AI 网关地址！'
        : '请先在底部的「AI 网关配置」中输入您的 API Token！');
      options.setShowConfig(true);
      return;
    }

    const sourceUrl = editPreview && options.previewModel ? options.previewModel.src : (options.modelRefImageUrl || '/clothing_model.png');
    const existingModel = editPreview && options.previewModel?.id
      ? { id: options.previewModel.id, name: options.previewModel.name, src: options.previewModel.src, date: '' }
      : undefined;
    try {
      const generatedUrl = await options.generateModel({
        sourceUrl,
        prompt: (editPreview ? options.modelEditPrompt : options.customPrompt).trim(),
        existingModel
      });
      if (existingModel) {
        options.setPreviewModel(previous => previous ? { ...previous, src: generatedUrl } : null);
        alert('AI 模特修改重新生成成功！');
      } else {
        alert('AI 模特定制生成成功！已自动保存至您的「模特库」中。');
      }
    } catch (error) {
      console.error(error);
      alert(`AI 模特生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options]);

  return { handleCustomModelSwap };
}
