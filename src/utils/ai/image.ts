import { fetchImageAsBase64, findImageUrlInObject, getGatewayRequestConfig } from './helpers';

export interface ModelSwapParams {
  imageUrl: string;
  gender: 'female' | 'male';
  region: 'east-asian' | 'western';
  scene: 'street' | 'studio' | 'home' | 'office' | 'beach' | 'runway' | 'minimalist';
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  gatewayUrl: string;
  gatewayToken: string;
  customPrompt?: string;
}

/**
 * Call the AI Gateway /chat/completions endpoint using the gemini-3.1-flash-image model.
 */
export const generateMannequinImage = async (params: ModelSwapParams): Promise<string> => {
  const { imageUrl, gender, region, ratio, gatewayUrl, gatewayToken, customPrompt } = params;

  if (!gatewayUrl) {
    throw new Error('AI Gateway URL is required. Please check your settings.');
  }
  if (!gatewayToken) {
    throw new Error('AI Gateway API Token is required. Please check your settings.');
  }

  // 1. Fetch image as base64
  let base64Image: string;
  try {
    base64Image = await fetchImageAsBase64(imageUrl);
  } catch (error: any) {
    throw new Error(`无法加载商品图片: ${error.message}`);
  }

  // 2. Build the visual prompt for the model swap
  const genderStr = gender === 'female' ? 'female' : 'male';
  const regionStr = region === 'east-asian' ? 'East Asian' : 'Western';

  let textPrompt = customPrompt ||
    `A premium quality fashion catalog photo. A high-resolution photo of a professional ${regionStr} ${genderStr} model wearing this clothing, posing against a clean solid white background. Highly detailed, realistic skin texture and clothing folds. Flat studio lighting.`;

  // Prevent watermarks, logos, text, or signatures in the generated output image
  textPrompt += " The generated image must be clean and must not contain any text, letters, words, numbers, writing, signatures, logos, watermarks, stamps, tags, or captions.";

  // 3. Map aspect ratio from 1-1 to 1:1 format
  const apiAspectRatio = ratio.replace('-', ':'); // e.g. "1-1" -> "1:1", "3-4" -> "3:4"

  // 4. Build API Request Body
  const requestBody = {
    model: 'gemini-3.1-flash-image',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: textPrompt
          },
          {
            type: 'image_url',
            image_url: {
              url: base64Image
            }
          }
        ]
      }
    ],
    modalities: ['image'],
    eca_image_config: {
      aspect_ratio: apiAspectRatio,
      image_size: '1K'
    },
    stream: false // Using non-stream mode for simple JSON response handling
  };

  // 5. Get request url and headers
  const { requestUrl, headers } = getGatewayRequestConfig({
    path: '/chat/completions',
    gatewayUrl,
    gatewayToken
  });

  // 6. Perform the fetch request
  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.error?.message || errorText;
    } catch {
      // Not a JSON response, keep raw text
    }
    throw new Error(`AI Gateway 接口调用失败 (${response.status}): ${errorDetail}`);
  }

  const responseData = await response.json();

  // 7. Parse the base64 or URL image from the JSON response choices[0].message.content
  const choices = responseData.choices;
  if (!choices || choices.length === 0) {
    throw new Error('AI 响应内容为空，未生成图片数据');
  }

  const firstChoice = choices[0];
  if (firstChoice.finish_reason === 'content_filtered') {
    throw new Error('AI 平台安全过滤拦截：因为提示词包含了过于暴露的服装描述（如胸罩、光膀子等），请使用更保守的打底服饰（如背心、T恤）重试。');
  }

  const message = firstChoice.message;
  if (!message) {
    throw new Error('未找到 API 响应的选择消息体 (choices[0].message)');
  }

  let resultImageUrl = '';
  const content = message.content;

  // 1. Handle standard choice content format as Array
  if (Array.isArray(content)) {
    const imgItem = content.find((item: any) => item.type === 'image_url');
    if (imgItem?.image_url?.url) {
      resultImageUrl = imgItem.image_url.url;
    } else {
      const genericImageItem = content.find((item: any) => item.type === 'image');
      if (genericImageItem?.image) {
        if (typeof genericImageItem.image === 'string') {
          resultImageUrl = genericImageItem.image;
        } else if (genericImageItem.image.url) {
          resultImageUrl = genericImageItem.image.url;
        }
      }
    }
  }
  // 2. Handle if content is returned as a JSON string (as seen in some gateway converters)
  else if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      resultImageUrl = findImageUrlInObject(parsed);
    } catch {
      // Fallback: If it's a raw base64 or URL string directly
      if (content.startsWith('data:image/') || content.startsWith('http')) {
        resultImageUrl = content;
      }
    }
  }

  // 3. Ultimate Fallback: search the entire responseData recursively!
  if (!resultImageUrl) {
    resultImageUrl = findImageUrlInObject(responseData);
  }

  if (!resultImageUrl) {
    console.error('Unparsed content structure:', JSON.stringify(responseData));
    throw new Error('未能从 API 响应中解析出生成的图片，请检查网络或网关日志');
  }

  return resultImageUrl;
};

export interface TryOnParams {
  clothingUrl: string | string[];
  clothingBottomUrl?: string; // Optional bottom garment image
  modelUrl: string | string[];
  gender: 'female' | 'male';
  region: 'east-asian' | 'western';
  scene: 'street' | 'studio' | 'home' | 'office' | 'beach' | 'runway' | 'minimalist';
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  gatewayUrl: string;
  gatewayToken: string;
  customPrompt?: string;
  backgroundImageUrl?: string;
  poseImageUrl?: string; // Optional pose/posture reference image
}

export const TRYON_SCENE_PROMPT_DESCRIPTIONS: Record<string, string> = {
  street: 'posing in a modern urban street with city lights and soft outdoor background',
  studio: 'posing in a professional indoor photo studio with clean lighting and neutral studio backdrop',
  home: 'posing in a cozy warm living room with soft lighting, high-end modern home background',
  office: 'posing in a sleek modern corporate office space, high-end building interior',
  beach: 'posing on a beautiful sunny holiday beach with soft sand and gentle ocean waves',
  runway: 'posing on a fashion show runway with stage lights and professional modeling setup',
  minimalist: 'posing against a minimalist wabi-sabi concrete wall with artistic soft shadows'
};

export const generateTryOnImage = async (params: TryOnParams): Promise<string> => {
  const { clothingUrl, clothingBottomUrl, modelUrl, gender, region, scene, ratio, gatewayUrl, gatewayToken, customPrompt, backgroundImageUrl, poseImageUrl } = params;

  if (!gatewayUrl) {
    throw new Error('AI Gateway URL is required. Please check your settings.');
  }
  if (!gatewayToken) {
    throw new Error('AI Gateway API Token is required. Please check your settings.');
  }

  // 1. Fetch images as base64
  let base64Clothings: string[] = [];
  let base64Bottom: string | null = null;
  let base64Models: string[] = [];
  let base64Background: string | null = null;
  let base64Pose: string | null = null;

  if (poseImageUrl) {
    try {
      base64Pose = await fetchImageAsBase64(poseImageUrl);
    } catch (error: any) {
      console.warn(`无法加载姿势参考图: ${error.message}`);
    }
  }

  if (Array.isArray(clothingUrl)) {
    for (const url of clothingUrl) {
      if (url) {
        try {
          const b64 = await fetchImageAsBase64(url);
          base64Clothings.push(b64);
        } catch (error: any) {
          throw new Error(`无法加载服装参考图: ${error.message}`);
        }
      }
    }
  } else {
    try {
      const b64 = await fetchImageAsBase64(clothingUrl);
      base64Clothings = [b64];
    } catch (error: any) {
      throw new Error(`无法加载主要服装图: ${error.message}`);
    }
  }

  if (clothingBottomUrl) {
    try {
      base64Bottom = await fetchImageAsBase64(clothingBottomUrl);
    } catch (error: any) {
      throw new Error(`无法加载下装服装图: ${error.message}`);
    }
  }
  
  if (Array.isArray(modelUrl)) {
    for (const url of modelUrl) {
      if (url) {
        try {
          const b64 = await fetchImageAsBase64(url);
          base64Models.push(b64);
        } catch (error: any) {
          throw new Error(`无法加载参考模特图: ${error.message}`);
        }
      }
    }
  } else {
    try {
      const b64 = await fetchImageAsBase64(modelUrl);
      base64Models = [b64];
    } catch (error: any) {
      throw new Error(`无法加载参考模特图: ${error.message}`);
    }
  }

  if (backgroundImageUrl) {
    try {
      base64Background = await fetchImageAsBase64(backgroundImageUrl);
    } catch (error: any) {
      console.warn(`无法加载背景参考图: ${error.message}`);
    }
  }

  // 2. Build visual prompt
  const genderStr = gender === 'female' ? 'female' : 'male';
  const regionStr = region === 'east-asian' ? 'East Asian' : 'Western';
  const sceneDesc = TRYON_SCENE_PROMPT_DESCRIPTIONS[scene] || 'posing in a matching catalog studio setting';

  let textPrompt = customPrompt ||
    `A premium quality fashion catalog photo. A high-resolution photo of the same professional ${regionStr} ${genderStr} model from the model reference image wearing the clothing item(s) provided. The model should be posing elegantly in the following setting: ${sceneDesc}. Posing against a clean professional catalog background. High-fidelity garment texture transfer, realistic drapery, correct draping and fit. Detailed skin, natural lighting.`;

  if (base64Pose) {
    const poseIndex = 1 + base64Clothings.length + (base64Bottom ? 1 : 0) + base64Models.length;
    textPrompt += ` The messages contain a pose reference image (图${poseIndex}). You must strictly copy the pose, posture, gesture, camera angle, and composition of the model in the pose reference image (图${poseIndex}) onto the target model.`;
  }

  if (base64Background) {
    const bgIndex = 1 + base64Clothings.length + (base64Bottom ? 1 : 0) + base64Models.length + (base64Pose ? 1 : 0);
    textPrompt += ` The background scene of the generated image must strictly match the style, color scheme, environment, lighting, and layout of the background reference image (图${bgIndex}) provided. Place the model seamlessly into this background.`;
  }

  textPrompt += " The generated image must be clean and must not contain any text, letters, words, numbers, writing, signatures, logos, watermarks, stamps, tags, or captions.";

  const apiAspectRatio = ratio.replace('-', ':');

  // 3. Build multi-image chat completion body
  const messagesContent: any[] = [
    {
      type: 'text',
      text: textPrompt
    }
  ];

  base64Clothings.forEach((b64Clothing) => {
    messagesContent.push({
      type: 'image_url',
      image_url: {
        url: b64Clothing
      }
    });
  });

  if (base64Bottom) {
    messagesContent.push({
      type: 'image_url',
      image_url: {
        url: base64Bottom
      }
    });
  }

  base64Models.forEach((b64Model) => {
    messagesContent.push({
      type: 'image_url',
      image_url: {
        url: b64Model
      }
    });
  });

  if (base64Pose) {
    messagesContent.push({
      type: 'image_url',
      image_url: {
        url: base64Pose
      }
    });
  }

  if (base64Background) {
    messagesContent.push({
      type: 'image_url',
      image_url: {
        url: base64Background
      }
    });
  }

  const requestBody = {
    model: 'gemini-3.1-flash-image',
    messages: [
      {
        role: 'user',
        content: messagesContent
      }
    ],
    modalities: ['image'],
    eca_image_config: {
      aspect_ratio: apiAspectRatio,
      image_size: '1K'
    },
    stream: false
  };

  // 4. Get request URL and headers
  const { requestUrl, headers } = getGatewayRequestConfig({
    path: '/chat/completions',
    gatewayUrl,
    gatewayToken
  });

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = errorText;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.error?.message || errorText;
    } catch {
      // Not a JSON response, keep raw text
    }
    throw new Error(`AI Gateway 接口调用失败 (${response.status}): ${errorDetail}`);
  }

  const responseData = await response.json();

  const choices = responseData.choices;
  if (!choices || choices.length === 0) {
    throw new Error('AI 响应内容为空，未生成图片数据');
  }

  const firstChoice = choices[0];
  if (firstChoice.finish_reason === 'content_filtered') {
    throw new Error('AI 平台安全过滤拦截：检测到可能的暴露衣物，请重试并使用更保守的安全提示词。');
  }

  const message = firstChoice.message;
  if (!message) {
    throw new Error('未找到 API 响应的选择消息体 (choices[0].message)');
  }

  let resultImageUrl = '';
  const content = message.content;

  if (Array.isArray(content)) {
    const imgItem = content.find((item: any) => item.type === 'image_url');
    if (imgItem?.image_url?.url) {
      resultImageUrl = imgItem.image_url.url;
    } else {
      const genericImageItem = content.find((item: any) => item.type === 'image');
      if (genericImageItem?.image) {
        if (typeof genericImageItem.image === 'string') {
          resultImageUrl = genericImageItem.image;
        } else if (genericImageItem.image.url) {
          resultImageUrl = genericImageItem.image.url;
        }
      }
    }
  } else if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      resultImageUrl = findImageUrlInObject(parsed);
    } catch {
      if (content.startsWith('data:image/') || content.startsWith('http')) {
        resultImageUrl = content;
      }
    }
  }

  if (!resultImageUrl) {
    resultImageUrl = findImageUrlInObject(responseData);
  }

  if (!resultImageUrl) {
    console.error('Unparsed content structure:', JSON.stringify(responseData));
    throw new Error('未能从 API 响应中解析出生成的图片，请检查网络或网关日志');
  }

  return resultImageUrl;
};

export interface BackgroundGenParams {
  prompt: string;
  ratio: '1-1' | '3-4' | '9-16' | '16-9';
  gatewayUrl: string;
  gatewayToken: string;
  refImageUrl?: string;
}

export const generateBackgroundImage = async (params: BackgroundGenParams): Promise<string> => {
  const { prompt, ratio, gatewayUrl, gatewayToken, refImageUrl } = params;

  if (!gatewayUrl) {
    throw new Error('AI Gateway URL is required.');
  }
  if (!gatewayToken) {
    throw new Error('AI Gateway API Token is required.');
  }

  const apiAspectRatio = ratio.replace('-', ':');

  const requestContent: any[] = [
    {
      type: 'text',
      text: `A professional commercial background scene, high resolution, photorealistic, empty setting for fashion model photoshoot, clean composition, studio lighting. Scene description: ${prompt}. No people, no models, no text, no watermarks.`
    }
  ];

  if (refImageUrl) {
    try {
      const base64Ref = await fetchImageAsBase64(refImageUrl);
      requestContent.push({
        type: 'image_url',
        image_url: { url: base64Ref }
      });
    } catch (err: any) {
      console.warn('Failed to load scene reference image, proceeding with text prompt only', err);
    }
  }

  const requestBody = {
    model: 'gemini-3.1-flash-image',
    messages: [
      {
        role: 'user',
        content: requestContent
      }
    ],
    modalities: ['image'],
    eca_image_config: {
      aspect_ratio: apiAspectRatio,
      image_size: '1K'
    },
    stream: false
  };

  // Get request URL and headers
  const { requestUrl, headers } = getGatewayRequestConfig({
    path: '/chat/completions',
    gatewayUrl,
    gatewayToken
  });

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Background Gen failed (${response.status}): ${errorText}`);
  }

  const responseData = await response.json();
  const choices = responseData.choices;
  if (!choices || choices.length === 0) {
    throw new Error('No content returned from AI Background Gen');
  }

  const message = choices[0]?.message;
  if (!message) {
    throw new Error('No message returned from AI Background Gen');
  }

  const resultImageUrl = findImageUrlInObject(message);
  if (!resultImageUrl) {
    throw new Error('Failed to find generated background image in response');
  }

  return resultImageUrl;
};
