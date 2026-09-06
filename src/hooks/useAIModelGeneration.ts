import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ModelAsset } from '../types/assets';
import { generateMannequinImage } from '../utils/aiGateway';

type ModelGender = 'female' | 'male';
type ModelRegion = 'east-asian' | 'western';
type CanvasRatio = '1-1' | '3-4' | '9-16' | '16-9';

const supportedScenes = new Set(['street', 'studio', 'home', 'office', 'beach', 'runway', 'minimalist']);

interface AIModelGenerationOptions {
  gatewayUrl: string;
  gatewayToken: string;
  gender: ModelGender;
  region: ModelRegion;
  scene: string;
  ratio: CanvasRatio;
  setModelSwapRunning: (running: boolean) => void;
  setModelLibrary: Dispatch<SetStateAction<ModelAsset[]>>;
  saveModelLibrary: (models: ModelAsset[]) => ModelAsset[];
  addModel: (name: string, sourceUrl: string) => Promise<ModelAsset | null>;
}

interface GenerateModelOptions {
  sourceUrl: string;
  prompt: string;
  existingModel?: Pick<ModelAsset, 'id' | 'src' | 'name'>;
}

export function useAIModelGeneration({
  gatewayUrl,
  gatewayToken,
  gender,
  region,
  scene,
  ratio,
  setModelSwapRunning,
  setModelLibrary,
  saveModelLibrary,
  addModel
}: AIModelGenerationOptions) {
  const [isGeneratingModel, setIsGeneratingModel] = useState(false);

  const generateModel = useCallback(async ({
    sourceUrl,
    prompt,
    existingModel
  }: GenerateModelOptions): Promise<string> => {
    setIsGeneratingModel(true);
    setModelSwapRunning(true);
    try {
      const regionLabel = region === 'east-asian' ? 'East Asian' : 'Western';
      const genderLabel = gender === 'female' ? 'female' : 'male';
      const basicClothing = gender === 'female'
        ? 'wearing a simple minimalist beige tank top and beige shorts'
        : 'wearing a simple plain beige t-shirt and beige shorts';
      const editPrompt = prompt.trim();
      const generationPrompt = existingModel
        ? `Character sheet, concept art, model reference sheet. This is an image-to-image edit of the provided input model image. You must strictly preserve the model's exact facial features, facial structure, facial expression, hair color, skin tone, and body proportions from the input image. Keep the same model identity. Apply the following modifications to this model: ${editPrompt || 'regenerate cleanly'}. Keep the 3 panels (front view portrait of the face, side profile view of the face, and full body pose) arranged side-by-side in a single image, posing against a clean solid white background, matching the style and layout of the input image.`
        : `Character sheet, concept art, model reference sheet. A high-resolution photo of the same professional ${regionLabel} ${genderLabel} model, ${basicClothing}: featuring a front view portrait of the face, a side profile view of the face, and a full body pose showing the entire figure, all presented side-by-side in a single image. ${editPrompt ? `${editPrompt}.` : ''} Posing against a clean solid white background. Flat studio lighting, detailed skin texture, realistic clothing folds, premium catalog quality.`;

      const generatedUrl = await generateMannequinImage({
        imageUrl: sourceUrl,
        gender,
        region,
        scene: supportedScenes.has(scene) ? scene : 'studio',
        ratio,
        gatewayUrl,
        gatewayToken,
        customPrompt: generationPrompt
      });

      if (existingModel) {
        setModelLibrary(previous => saveModelLibrary(
          previous.map(model => model.id === existingModel.id ? { ...model, src: generatedUrl } : model)
        ));
      } else {
        const name = `参考卡-${gender === 'female' ? '女' : '男'}-${region === 'east-asian' ? '东亚' : '欧美'}`;
        await addModel(name, generatedUrl);
      }
      return generatedUrl;
    } finally {
      setIsGeneratingModel(false);
      setModelSwapRunning(false);
    }
  }, [addModel, gatewayToken, gatewayUrl, gender, ratio, region, saveModelLibrary, scene, setModelLibrary, setModelSwapRunning]);

  return { isGeneratingModel, generateModel };
}
