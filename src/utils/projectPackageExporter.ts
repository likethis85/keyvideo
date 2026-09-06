import type { Layer } from '../components/VideoCanvas';
import type { AspectRatio } from './smartReflow';
import type { StoryboardItem, AIProject } from '../types/aiProject';

export interface KeyVideoProjectPackage {
  version: '1.0.0';
  exportTime: string;
  project: {
    id: string;
    name: string;
    description?: string;
  };
  canvas: {
    ratio: AspectRatio;
    layers: Layer[];
  };
  aiState?: {
    storyboards?: StoryboardItem[];
    modelOutfitImgUrl?: string | null;
    referenceOutfitUrls?: string[];
    modelScene?: string;
    customPrompt?: string;
  };
}

/**
 * Serializes and triggers a browser download for the current project as `.keyvideo.json`
 */
export const exportProjectPackage = (data: {
  project?: AIProject | null;
  ratio: AspectRatio;
  layers: Layer[];
  storyboards?: StoryboardItem[];
  modelOutfitImgUrl?: string | null;
  referenceOutfitUrls?: string[];
  modelScene?: string;
  customPrompt?: string;
}): void => {
  const pkg: KeyVideoProjectPackage = {
    version: '1.0.0',
    exportTime: new Date().toISOString(),
    project: {
      id: data.project?.id || `proj_${Date.now()}`,
      name: data.project?.name || '未命名短视频工程',
      description: '由 KeyVideo 导出的完整工程包'
    },
    canvas: {
      ratio: data.ratio,
      layers: data.layers
    },
    aiState: {
      storyboards: data.storyboards,
      modelOutfitImgUrl: data.modelOutfitImgUrl,
      referenceOutfitUrls: data.referenceOutfitUrls,
      modelScene: data.modelScene,
      customPrompt: data.customPrompt
    }
  };

  const jsonString = JSON.stringify(pkg, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (data.project?.name || 'keyvideo_project').replace(/[\s/\\?%*:|"<>]/g, '_');
  a.href = url;
  a.download = `${safeName}_${new Date().toISOString().slice(0, 10)}.keyvideo.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Parses and validates an uploaded project JSON file
 */
export const importProjectPackage = async (file: File): Promise<KeyVideoProjectPackage> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as unknown;

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('无效的 JSON 文件内容');
        }

        const pkg = parsed as Partial<KeyVideoProjectPackage>;
        if (!pkg.canvas || !Array.isArray(pkg.canvas.layers)) {
          throw new Error('缺少有效的图层配置数据 (canvas.layers)');
        }

        resolve(pkg as KeyVideoProjectPackage);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('工程包解析失败'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
};
