import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SceneAsset } from '../types/assets';

type PreviewScene = { id?: string; src: string; name: string } | null;

interface AISceneDialogActionsOptions {
  prompt: string;
  referenceImage: string | null;
  multiView: boolean;
  gatewayUrl: string;
  gatewayToken: string;
  previewScene: PreviewScene;
  editPrompt: string;
  modelScene: string;
  generateScene: (input: { prompt: string; referenceImage: string | null; multiView: boolean }) => Promise<SceneAsset>;
  regenerateScene: (scene: SceneAsset, prompt: string) => Promise<SceneAsset>;
  setModelScene: (id: string) => void;
  setActiveTab: (tab: 'ai') => void;
  setShowConfig: (show: boolean) => void;
  setShowModal: (show: boolean) => void;
  setPrompt: (prompt: string) => void;
  setReferenceImage: (url: string | null) => void;
  setMultiView: (enabled: boolean) => void;
  setPreviewScene: Dispatch<SetStateAction<PreviewScene>>;
}

export function useAISceneDialogActions(options: AISceneDialogActionsOptions) {
  const validateGateway = useCallback(() => {
    if (options.gatewayUrl.trim() && options.gatewayToken.trim()) return true;
    alert('请确保在底部的「AI 网关配置」中输入了正确的网关地址与 Token！');
    options.setShowConfig(true);
    return false;
  }, [options]);

  const handleGenerateAiScene = useCallback(async () => {
    if (!options.prompt.trim() && !options.referenceImage) return alert('请输入背景场景描述词或上传场景参考图！');
    if (!validateGateway()) return;
    try {
      const scene = await options.generateScene({ prompt: options.prompt, referenceImage: options.referenceImage, multiView: options.multiView });
      options.setModelScene(scene.id);
      alert(`已成功生成背景场景「${scene.name}」并自动选定为 AI 绘图的参考背景！`);
      options.setActiveTab('ai');
      options.setShowModal(false);
      options.setPrompt('');
      options.setReferenceImage(null);
      options.setMultiView(false);
    } catch (error) {
      console.error(error);
      alert(`AI 场景生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options, validateGateway]);

  const handleRegenerateScene = useCallback(async () => {
    if (!options.previewScene?.id || !validateGateway()) return;
    try {
      const updated = await options.regenerateScene({ ...options.previewScene, id: options.previewScene.id }, options.editPrompt);
      options.setPreviewScene(updated);
      if (options.modelScene === options.previewScene.id) options.setModelScene(updated.id);
      alert('背景场景修改成功！');
    } catch (error) {
      console.error(error);
      alert(`背景场景修改生成失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [options, validateGateway]);

  return { handleGenerateAiScene, handleRegenerateScene };
}
