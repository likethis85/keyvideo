import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Convert local relative assets (like /clothing_model.png) to base64 data URLs
const resolveLocalAssetToBase64 = (imageUrl) => {
  if (typeof imageUrl !== 'string') return imageUrl;
  if (imageUrl.startsWith('/')) {
    try {
      // Find file in frontend public folder (relative to backend/)
      const localPath = path.join(__dirname, '..', 'public', imageUrl);
      if (fs.existsSync(localPath)) {
        const fileBuffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase().replace('.', '');
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
      }
    } catch (e) {
      console.warn(`Failed to resolve local asset ${imageUrl} to base64:`, e);
    }
  }
  return imageUrl;
};

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const TRYON_SCENE_PROMPT_DESCRIPTIONS = {
  street: 'posing in a modern urban street with city lights and soft outdoor background',
  studio: 'posing in a professional indoor photo studio with clean lighting and neutral studio backdrop',
  home: 'posing in a cozy warm living room with soft lighting, high-end modern home background',
  office: 'posing in a sleek modern corporate office space, high-end building interior',
  beach: 'posing on a beautiful sunny holiday beach with soft sand and gentle ocean waves',
  runway: 'posing on a fashion show runway with stage lights and professional modeling setup',
  minimalist: 'posing against a minimalist wabi-sabi concrete wall with artistic soft shadows'
};

// Helper: Fetch remote image as Base64 Data URL
const fetchImageAsBase64 = async (url) => {
  if (url.startsWith('data:image/')) {
    return url;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/png';
  const base64 = Buffer.from(buffer).toString('base64');
  return `data:${contentType};base64,${base64}`;
};

// Helper: Recursively search object for image URL or base64 data
const findImageUrlInObject = (obj) => {
  if (!obj) return '';
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') || obj.startsWith('http://') || obj.startsWith('https://')) {
      return obj;
    }
    const cleanStr = obj.replace(/\s/g, '');
    if (cleanStr.length > 500 && /^[A-Za-z0-9+/=]+$/.test(cleanStr.substring(0, 100))) {
      let mime = 'png';
      if (cleanStr.startsWith('/9j/')) mime = 'jpeg';
      else if (cleanStr.startsWith('R0lGOD')) mime = 'gif';
      else if (cleanStr.startsWith('UklGR')) mime = 'webp';
      return `data:image/${mime};base64,${cleanStr}`;
    }
    return '';
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findImageUrlInObject(item);
      if (found) return found;
    }
  }
  if (typeof obj === 'object') {
    if (obj.url && typeof obj.url === 'string') {
      return obj.url;
    }
    for (const key of Object.keys(obj)) {
      const found = findImageUrlInObject(obj[key]);
      if (found) return found;
    }
  }
  return '';
};

// Helper: Submit task to sandbase.ai (with automatic retries on 5xx / Bad Gateway)
const submitSandbaseTask = async (payload) => {
  const apiKey = process.env.SANDBASE_API_KEY || process.env.AIGATEWAY_TOKEN;
  const maxRetries = 4;
  let delay = 1500;

  console.log(`\n[Sandbase API] >>> Submitting task with model: "${payload.model}"`);
  console.log(`[Sandbase API] Prompt: "${payload.prompt}"`);
  if (payload.images && payload.images.length > 0) {
    console.log(`[Sandbase API] Input images count: ${payload.images.length}`);
    payload.images.forEach((img, idx) => {
      console.log(`  - Image[${idx}]: ${img.substring(0, 120)}${img.length > 120 ? '...' : ''}`);
    });
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.sandbase.ai/v1/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        // If it's a server error (502, 503, 504, 500) or rate limit (429), retry
        if (response.status >= 500 || response.status === 429) {
          if (attempt < maxRetries) {
            console.warn(`[Sandbase API] Submission failed with status ${response.status}. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff
            continue;
          }
        }
        throw new Error(`Sandbase submission failed (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (!data.id) {
        throw new Error(`Sandbase submission did not return a task ID. Response: ${JSON.stringify(data)}`);
      }
      console.log(`[Sandbase API] Task submitted. Task ID: ${data.id} | Initial Status: ${data.status}`);
      return data.id;
    } catch (err) {
      if (attempt === maxRetries) {
        throw err;
      }
      console.warn(`[Sandbase API] Submission error: ${err.message}. Retrying in ${delay}ms... (Attempt ${attempt}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

// Helper: Poll sandbase.ai task until completed (with retry on transient errors)
const pollSandbaseTask = async (taskId) => {
  const apiKey = process.env.SANDBASE_API_KEY || process.env.AIGATEWAY_TOKEN;
  const maxRetries = 60; // 60 retries * 2 seconds = 120 seconds max
  const pollInterval = 2000;

  console.log(`[Sandbase API] <<< Started polling for Task ID: ${taskId}`);

  for (let i = 0; i < maxRetries; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    try {
      const response = await fetch(`https://api.sandbase.ai/v1/run/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        // If it's a server error (502, 503, 504) or rate limit (429), don't crash, just log and continue polling
        if (response.status >= 500 || response.status === 429) {
          console.warn(`[Sandbase API] Polling returned transient status ${response.status}. Retrying on next tick...`);
          continue;
        }
        const errText = await response.text();
        throw new Error(`Sandbase polling failed (${response.status}): ${errText}`);
      }

      const data = await response.json();
      console.log(`[Sandbase API] Polling Task ID: ${taskId} | Status: ${data.status}`);

      if (data.status === 'completed') {
        if (data.outputs && data.outputs.length > 0 && data.outputs[0].url) {
          console.log(`[Sandbase API] Task ${taskId} completed! Output URL: ${data.outputs[0].url}`);
          return data.outputs[0].url;
        }
        if (data.result && data.result.images && data.result.images.length > 0) {
          console.log(`[Sandbase API] Task ${taskId} completed! Output URL: ${data.result.images[0]}`);
          return data.result.images[0];
        }
        throw new Error('Sandbase task completed but no images returned');
      } else if (data.status === 'failed') {
        throw new Error(`Sandbase task failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      // Log error and continue loop unless it's a non-transient assertion failure
      if (err.message.includes('Sandbase task failed') || err.message.includes('no images returned')) {
        throw err;
      }
      console.warn(`[Sandbase API] Polling encountered network error: ${err.message}. Retrying on next tick...`);
    }
  }
  throw new Error('Sandbase task timed out');
};


// 1. Raw Binary Upload to Aliyun OSS (drop-in replacement for Vite configureServer proxy)
app.post('/api/upload', (req, res) => {
  const fileName = req.query.name || 'file.mp3';
  const chunks = [];
  
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      if (chunks.length === 0) {
        return res.status(400).json({ error: 'No file data received' });
      }
      
      const buffer = Buffer.concat(chunks);
      const client = new OSS({
        region: process.env.OSS_REGION || 'oss-cn-shanghai',
        accessKeyId: process.env.OSS_ACCESS_KEY_ID,
        accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
        bucket: process.env.OSS_BUCKET,
        secure: true
      });

      const fileExt = fileName.split('.').pop() || 'mp3';
      const randomName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${fileExt}`;
      const ossPath = `audio/${randomName}`;
      const result = await client.put(ossPath, buffer);

      res.status(200).json({ url: result.url });
    } catch (err) {
      console.error('Alibaba Cloud OSS upload failed:', err);
      res.status(500).json({ error: err.message || 'Upload failed' });
    }
  });
});

// 2. AI Mannequin Model Swap
app.post('/api/ai/mannequin', async (req, res) => {
  try {
    const { imageUrl, gender, region, ratio, customPrompt } = req.body;

    const genderStr = gender === 'female' ? 'female' : 'male';
    const regionStr = region === 'east-asian' ? 'East Asian' : 'Western';

    let textPrompt = customPrompt ||
      `A premium quality fashion catalog photo. A high-resolution photo of a professional ${regionStr} ${genderStr} model wearing this clothing, posing against a clean solid white background. Highly detailed, realistic skin texture and clothing folds. Flat studio lighting.`;
    textPrompt += " The generated image must be clean and must not contain any text, letters, words, numbers, writing, signatures, logos, watermarks, stamps, tags, or captions.";

    const apiAspectRatio = ratio.replace('-', ':');

    const sandbasePayload = {
      model: 'google/nano-banana-2/edit',
      images: [imageUrl],
      prompt: textPrompt,
      resolution: '1K',
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    const taskId = await submitSandbaseTask(sandbasePayload);
    const resultImageUrl = await pollSandbaseTask(taskId);

    // Convert to base64 to bypass browser CORS on frontend
    const base64DataUrl = await fetchImageAsBase64(resultImageUrl);

    res.status(200).json({ url: base64DataUrl });
  } catch (err) {
    console.error('Mannequin generation failed:', err);
    res.status(500).json({ error: err.message || 'Mannequin generation failed' });
  }
});


// 3. AI Try-On & Pose Integration
app.post('/api/ai/tryon', async (req, res) => {
  try {
    const { clothingUrl, clothingBottomUrl, modelUrl, gender, region, scene, ratio, customPrompt, backgroundImageUrl, poseImageUrl } = req.body;

    console.log(`[/api/ai/tryon] backgroundImageUrl present: ${!!backgroundImageUrl}, length: ${backgroundImageUrl ? backgroundImageUrl.length : 0}, prefix: ${backgroundImageUrl ? backgroundImageUrl.substring(0, 40) : 'N/A'}`);

    let rawImages = [];

    if (Array.isArray(clothingUrl)) {
      clothingUrl.forEach(url => { if (url) rawImages.push(url); });
    } else if (clothingUrl) {
      rawImages.push(clothingUrl);
    }

    if (clothingBottomUrl) {
      rawImages.push(clothingBottomUrl);
    }

    if (Array.isArray(modelUrl)) {
      modelUrl.forEach(url => { if (url) rawImages.push(url); });
    } else if (modelUrl) {
      rawImages.push(modelUrl);
    }

    if (poseImageUrl) {
      rawImages.push(poseImageUrl);
    }

    if (backgroundImageUrl) {
      rawImages.push(backgroundImageUrl);
    }

    // Resolve any local relative assets to base64 before sending to Sandbase API
    let images = [];
    for (const img of rawImages) {
      images.push(await resolveLocalAssetToBase64(img));
    }

    const genderStr = gender === 'female' ? 'female' : 'male';
    const regionStr = region === 'east-asian' ? 'East Asian' : 'Western';
    const sceneDesc = TRYON_SCENE_PROMPT_DESCRIPTIONS[scene] || 'posing in a matching catalog studio setting';

    const clothingsCount = Array.isArray(clothingUrl) ? clothingUrl.filter(Boolean).length : (clothingUrl ? 1 : 0);
    const bottomCount = clothingBottomUrl ? 1 : 0;
    const modelsCount = Array.isArray(modelUrl) ? modelUrl.filter(Boolean).length : (modelUrl ? 1 : 0);
    const poseCount = poseImageUrl ? 1 : 0;

    // Build explicit role indexing mappings in 图X format to guide the AI model
    let clothingIndexText = '';
    if (clothingsCount === 1) {
      clothingIndexText = '图1';
    } else if (clothingsCount > 1) {
      clothingIndexText = `图1至图${clothingsCount}`;
    }

    let bottomIndexText = '';
    if (bottomCount > 0) {
      bottomIndexText = `图${1 + clothingsCount}`;
    }

    const modelStartIndex = 1 + clothingsCount + bottomCount;
    let modelIndexText = '';
    if (modelsCount === 1) {
      modelIndexText = `图${modelStartIndex}`;
    } else if (modelsCount > 1) {
      modelIndexText = `图${modelStartIndex}至图${modelStartIndex + modelsCount - 1}`;
    }

    const indexingInstruction = `Image Index Reference: The input images include the clothing reference (which is ${clothingIndexText})${bottomIndexText ? ` and the bottom clothing reference (which is ${bottomIndexText})` : ''} and the target model reference (which is ${modelIndexText}). You must transfer the exact outfit from the clothing reference (${clothingIndexText}) onto the target model from the target model reference (${modelIndexText}), while replacing the clothing reference model's face, hair, and skin tone with the face, hair, and body features of the target model from the target model reference (${modelIndexText}).`;

    let textPrompt = indexingInstruction + ' ' + (customPrompt ||
      `A premium quality fashion catalog photo. A high-resolution photo of the same professional ${regionStr} ${genderStr} model from the model reference image wearing the clothing item(s) provided. The model should be posing elegantly in the following setting: ${sceneDesc}. Posing against a clean professional catalog background. High-fidelity garment texture transfer, realistic drapery, correct draping and fit. Detailed skin, natural lighting.`);

    if (poseImageUrl) {
      const poseIndex = 1 + clothingsCount + bottomCount + modelsCount;
      textPrompt += ` The input images contain a pose reference image (图${poseIndex}). You must strictly copy the pose, posture, gesture, camera angle, and composition of the model in the pose reference image (图${poseIndex}) onto the target model.`;
    }

    if (backgroundImageUrl) {
      const bgIndex = 1 + clothingsCount + bottomCount + modelsCount + poseCount;
      textPrompt += ` The background scene of the generated image must strictly match the style, color scheme, environment, lighting, and layout of the background reference image (图${bgIndex}) provided. Place the model seamlessly into this background.`;
    }

    textPrompt += " The generated image must be clean and must not contain any text, letters, words, numbers, writing, signatures, logos, watermarks, stamps, tags, or captions.";

    const apiAspectRatio = ratio.replace('-', ':');

    const sandbasePayload = {
      model: 'google/nano-banana-2/edit',
      images: images,
      prompt: textPrompt,
      resolution: '1K',
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    const taskId = await submitSandbaseTask(sandbasePayload);
    const resultImageUrl = await pollSandbaseTask(taskId);

    // Convert to base64 to bypass browser CORS on frontend
    const base64DataUrl = await fetchImageAsBase64(resultImageUrl);

    res.status(200).json({ url: base64DataUrl });
  } catch (err) {
    console.error('Try-on failed:', err);
    res.status(500).json({ error: err.message || 'Try-on failed' });
  }
});

// 4. AI Background Scene Generation
app.post('/api/ai/background', async (req, res) => {
  try {
    const { prompt, ratio, refImageUrl } = req.body;

    const apiAspectRatio = ratio.replace('-', ':');
    const backgroundPrompt = `A professional commercial background scene, high resolution, photorealistic, empty setting for fashion model photoshoot, clean composition, studio lighting. Scene description: ${prompt}. No people, no models, no text, no watermarks.`;

    const sandbasePayload = {
      model: refImageUrl ? 'google/nano-banana-2/edit' : 'google/nano-banana-2',
      prompt: backgroundPrompt,
      resolution: '1K',
      aspect_ratio: apiAspectRatio,
      output_format: 'png',
      enable_web_search: false,
      enable_image_search: false
    };

    if (refImageUrl) {
      sandbasePayload.images = [refImageUrl];
    }

    const taskId = await submitSandbaseTask(sandbasePayload);
    const resultImageUrl = await pollSandbaseTask(taskId);

    // Convert to base64 to bypass browser CORS on frontend
    const base64DataUrl = await fetchImageAsBase64(resultImageUrl);

    res.status(200).json({ url: base64DataUrl });
  } catch (err) {
    console.error('Background generation failed:', err);
    res.status(500).json({ error: err.message || 'Background generation failed' });
  }
});

// 5. Stylist Garment Suggestion
app.post('/api/ai/stylist', async (req, res) => {
  try {
    const { topUrl, bottomUrl } = req.body;

    const contentArray = [
      {
        type: 'text',
        text: `You are a professional fashion stylist. Analyze the uploaded garment(s) and generate matching recommendations for a fashion catalog photoshoot model.
If only one item (top or bottom) is provided, you must recommend the perfect match for the other half (style, color, fit).
If both are provided, summarize their style.
Also provide a recommendation for footwear (shoes) and accessories/bags (optional).
Output your recommendations strictly in the following JSON format:
{
  "matchingItem": "款式与配色描述 (例如：搭配高腰深蓝色直筒牛仔裤)",
  "shoes": "鞋履建议描述 (例如：搭配白色简约平底运动鞋)",
  "accessories": "配饰与包包建议描述 (例如：搭配银色简约细耳环，手持黑色复古皮质小包)"
}
Output ONLY the JSON object, no markdown wrappers, no other text.`
      }
    ];

    if (topUrl) {
      const base64Top = await fetchImageAsBase64(topUrl);
      contentArray.push({ type: 'image_url', image_url: { url: base64Top } });
    }
    if (bottomUrl) {
      const base64Bottom = await fetchImageAsBase64(bottomUrl);
      contentArray.push({ type: 'image_url', image_url: { url: base64Bottom } });
    }

    const requestBody = {
      model: 'gemini-3.1-flash-image',
      messages: [{ role: 'user', content: contentArray }],
      response_format: { type: 'json_object' },
      max_tokens: 1024,
      stream: false
    };

    const gatewayUrl = process.env.AIGATEWAY_URL;
    const gatewayToken = process.env.AIGATEWAY_TOKEN;
    const requestUrl = gatewayUrl.endsWith('/') ? `${gatewayUrl}chat/completions` : `${gatewayUrl}/chat/completions`;

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) throw new Error(`AI Stylist failed (${response.status})`);

    const responseData = await response.json();
    const choiceContent = responseData.choices?.[0]?.message?.content;
    if (!choiceContent) throw new Error('No message content returned from AI Stylist');

    const cleanJsonStr = choiceContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    let jsonToParse = cleanJsonStr;
    const firstBraceIdx = cleanJsonStr.indexOf('{');
    const lastBraceIdx = cleanJsonStr.lastIndexOf('}');
    if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
      jsonToParse = cleanJsonStr.substring(firstBraceIdx, lastBraceIdx + 1);
    }

    const sanitizedJsonStr = jsonToParse.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match, p1) => {
      const escaped = p1.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
      return `"${escaped}"`;
    });

    const parsed = JSON.parse(sanitizedJsonStr);
    res.status(200).json({
      matchingItem: parsed.matchingItem || '',
      shoes: parsed.shoes || '',
      accessories: parsed.accessories || ''
    });
  } catch (err) {
    console.error('Stylist suggestion failed:', err);
    res.status(500).json({ error: err.message || 'Suggestion failed' });
  }
});

// 6. Prompts Generation from Skill (Enriched)
app.post('/api/ai/prompts-skill', async (req, res) => {
  try {
    const {
      modelOutfitImgUrl,
      videoDuration,
      matchingItemDesc = '',
      shoesDesc = '',
      accessoriesDesc = '',
      modelScene = 'street',
      customScenes = [],
      storyboardImgUrls = [],
      backgroundImageUrl = '',
      model = '',
      storyboardMode = 'individual',
      useSlowMotion = false,
      focus = 'both'
    } = req.body;

    const base64Outfit = await fetchImageAsBase64(modelOutfitImgUrl);
    let base64Background = null;
    if (backgroundImageUrl) {
      try {
        base64Background = await fetchImageAsBase64(backgroundImageUrl);
      } catch (err) {
        console.warn('Failed to load background reference image:', err.message);
      }
    }

    const is15s = videoDuration === '15s' || videoDuration === '3s';
    const customSceneObj = customScenes.find(s => s.id === modelScene);
    
    const ENRICHED_SCENE_DESCRIPTIONS = {
      street: '高档电影感多层都市街景（包括光滑的建筑金属板材墙面、通透的橱窗玻璃反射出温暖室内光、干净湿润的沥青地面映射出街灯倒影，后景有都市车流虚化形成的灿烂焦外光斑，多重光影交错）',
      studio: '侘寂风极简艺术画廊影棚（包括斑驳微水泥质感墙面、优雅几何弧形墙体设计、大落地窗斜射入的丁达尔几何光束阴影，空旷的画廊感空间纵深，摆放有极简洞石器皿与设计师单椅，光影交错极具呼吸感）',
      home: '奢华极简主义建筑别墅内景（包括抛光微水泥地面、温润的大理石/洞石岩板质感、隐藏式温暖线型灯带，落地玻璃窗外隐约可见葱郁且带薄雾的庭院植被，虚实对比强烈，极具深度空间层次）',
      office: '现代极简主义高档商务空间（包括大面积通透落地玻璃幕墙、后景隐约可见微雾暮色中的都市摩天大楼天际线、水磨石反射地面、高档金属与深色实木饰面，干净洗练的线性反射光）',
      beach: '高档热带海滨度假酒店一角（包括细腻洁净的沙滩、极简白色混凝土拱门廊柱建筑结构、斑驳的棕榈树叶阴影投射在浅色微水泥墙面上、远处有波光粼粼的蔚蓝海面焦外光斑，晨曦柔和侧光）',
      runway: '前卫概念时尚大秀秀场（包括粗犷的清水混凝土粗骨料墙体、光滑深色Catwalk镜面折射舞台高对比度射灯、轻微的环境烟雾漫反射氛围、上方几何光源形成极具时装大片质感的明暗轮廓）',
      minimalist: '高端侘寂风美术馆角落（包括柔和的微水泥米色弧形墙面、艺术阴影凹槽、空间几何留白、局部极简柔和光束，营造出极高冷、质感纯净的品牌画册大片拍摄环境）'
    };

    const sceneDetail = customSceneObj 
      ? `自定义参考场景：${customSceneObj.name}` 
      : (ENRICHED_SCENE_DESCRIPTIONS[modelScene] || '高端商业大片时尚摄影背景（包含高级微水泥墙面、几何光影与空间物理材质细节）');

    const base64Storyboards = await Promise.all(
      storyboardImgUrls.map(async (url) => {
        try {
          if (!url) return null;
          return await fetchImageAsBase64(url);
        } catch (err) {
          console.warn(`Failed to fetch storyboard image: ${url}`, err.message);
          return null;
        }
      })
    );
    const validBase64Storyboards = base64Storyboards.filter(b => b !== null);

    const isNoSlice = storyboardMode === 'composite_no_slice';
    let promptText = '';

    const slowMotionInstruction = useSlowMotion ? `
【人物慢动作与注重运镜特殊强化约束】：
- 核心要求：当前模式下，智能生成的提示词必须以【人物慢动作】与【高端镜头运镜】为绝对核心与视觉主体。
- 人物慢动作：每一幕的人物动作描述必须明确包含“慢动作 (slow motion)”、“超慢速 (ultra-slow)”、“极致缓步”等词汇。模特的行走、转身、回眸、整理衣物等所有动态必须被描述为“极其缓慢、带有延迟感的电影级慢动作”，展现出面料在极慢速动态下的高级飘逸感与重力感。
- 注重镜头运镜：运镜描述必须非常具体且有强烈的镜头动感。必须在每一幕显式描述摄像机的轨迹，例如“极其缓慢地向前平推 (Ultra-slow Dolly In)”、“视差缓慢横移 (Parallax slow panning)”、“极其平滑的轨道环绕镜头 (Slow 360-degree camera orbit)”、“极慢变焦拉近 (Slow focal zoom in)”，突出镜头与主体人物之间的运动轨迹和距离变化，营造出强烈的高端时装电影运镜质感。
` : '';

    if (isNoSlice) {
      promptText = `你是一个专业的电商时尚视频编导。请根据上传的[模特穿搭主图]（作为输入的第一张图像，即图1）和提供的场景及搭配参数，结合我们生成并作为图2传入给你的[16:9 五格分镜合集参考图]（即图2，这是一张完整的16:9图片，里面按顺序水平排列了5个分镜的小画面），${base64Background ? `以及作为图3传入给你的[背景场景模板图]（即图3，干净没有任何人物的场景空图），` : ''}调用以下视频提示词智能编排规约，生成一整段用于图生视频的15秒/12秒视频提示词。
 
【输入参数】：
- 穿搭图配饰/鞋子搭配建议：${matchingItemDesc} ${shoesDesc} ${accessoriesDesc}
- 目标环境场景空间与材质细节：${sceneDetail}
- 重点推广与展示部位：${focus === 'top' ? '重点推广上装 (Topwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘上衣/外套的设计细节、肩线与胸口裁剪、衣领、袖口和上身材质，把上装作为视觉焦点。' : focus === 'bottom' ? '重点推广下装 (Bottomwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘下装/裤子/裙子的垂坠物理特性、裤腿/裙摆摆动细节、腰线设计与下身材质，把下装作为视觉焦点。' : '重点推广整体搭配与服饰协调度 (Overall)。保持全身或中景构图，合理兼顾展示整套衣服的搭配协调度。'}
${slowMotionInstruction}
 
【技能规约核心框架】：
- 严格图像序号命名规约：生成内容中引用的任何图像，必须且只能命名为「图1」、「图2」、「图3」、「图4」、「图5」、「图6」或「图7」格式。严禁在输出的提示词中出现任何诸如「@image_0.png」、「@image_1.png」、「image_0.png」、「@input_file_0.png」等临时变量名或具体图像文件名，必须将其映射为中文序号。
模块一：视觉资产解耦与锚定 (Asset Decoupling & Anchoring)
- 主体锚点（引用 图1）：锁定主体细节。整个视频生成过程中，必须严格锁定图1中的人物五官、身材比例、服装款式、色彩及面料细节，确保 100% 一致性。
- 时空锚点（引用 图2）：图2是一整张16:9分镜合集大图。请指导视频模型直接以这整张16:9的五格合集图作为蓝本，顺序连贯地从左到右过渡（从第一格动画推演到最后一格），平滑在分镜的不同视图之间切换推演。
${base64Background ? `- 场景背景锚点（引用 图3）：整个生成过程中，必须读取图3所示的纯净场景模板，确保在每一幕分镜中详细描述并严格还原图3的背景细节（包括色调、光线投射方向、室内外布景以及陈设物品），锁定生成视频的背景一致性。` : ''}
- 场景空间深度与背景细节：绝对不允许描述成单调的‘在影棚’或‘在街头’。你必须结合给定的“- 目标环境场景空间与材质细节”，在每一幕中详细拓展和描绘“多层空间透视、精细的墙面地面物理材质（如微水泥质感、湿沥青地面反射、镜面大理石纹理）、独特的氛围光线（如几何丁达尔斜射光、温暖的橱窗折射、柔焦焦外光斑）以及极简的高档软装摆件（如弧形门廊、洞石器皿、花瓶干树枝、设计师单椅）”，使得生成的视频背景层次极具纵深空间感与高端画册感，解决背景单一单薄的问题。
 
模块二：动态微操注入与高端运镜 (Micro-Dynamics & Premium Camera Motion)
- 摄像机运镜：电影感高端慢速运镜，展现时尚大片电影质感。包含：极其缓慢推近镜头 (Ultra-slow Dolly In)、平滑移近、视差缓慢横移 (Parallax slow panning)、极其平滑的轨道环绕镜头 (Slow 360-degree camera orbit) 或微调焦距变焦，镜头转动必须舒缓、高档且富有呼吸感。
- 人物与动作幅度控制：模特采取「高端时尚大片微动态 (High-fashion micro-movements)」姿态，人物动作幅度必须微小且极其缓慢优雅（例如轻微侧身、头部微倾、视线微转、眼部微阖、自然呼吸），避免任何过快或大范围肢体摆动，以求极高的画面清晰度和大片高冷质感。
- 环境与光影美学：微风徐徐轻吹发丝与衣角、精细的侧逆光和环境光影随镜头微动产生高级变化、自然细腻的光感流转，雕琢Vogue杂志大片般的明暗质感。
- 人物与面料力学：自然的呼吸胸口微动、身体微转时呈现流线型高级垂坠感 (Fluid drape)、面料随微小动作产生真实的微观物理褶皱与动态张力。
 
你的任务是：输出中文的一整段视频提示词描述。
请严格按照以下格式生成一整段话，不要换行，不要输出 JSON，不要包含任何 Markdown 标记，并且必须显式引用图的序号：
格式范例：
${is15s ? `15秒快节奏连贯 5 幕叙事，引用 图1 作为服装和模特的严格一致性参考，并以 图2（16:9分镜合集参考图）作为全局构图及姿态参考。第一幕：对应 图2 中的最左侧第一格，摄像机极其缓慢向前推进，模特从画外极其从容慢速迈步走入镜头中央站定，呈现大片气场，背景为 [这里具体详细描绘多层空间构筑、墙面与地面材质细节、独特的丁达尔折射光与高档装饰软装物件]，风吹衣摆产生轻微物理力学运动。镜头切换（Cut to）第二幕：对应 图2 中的第二格特写镜头，微焦段拉近极慢移镜头，聚焦在领口剪裁与微观面料材质，背景展现 [精细的大片光影变化与高级材质纹理]。镜头切换（Cut to）第三幕：对应 图2 中的第三格中景，平滑轨道环绕镜头，模特极缓侧身，服装呈现流线型高端垂坠质感，背景的 [这里详细写入微水泥弧形几何墙体与光线投射交错细节] 随镜头平稳运动。镜头切换（Cut to）第四幕：对应 图2 中的第四格侧面，镜头极其缓慢地推移，模特极其徐缓地微倾肩部，展现服装优雅流畅的物理折叠与自然的微小褶皱。镜头切换（Cut to）第五幕：对应 图2 中的最右侧第五格全景，镜头缓缓拉远，模特高冷微调头姿态并优雅定格，在 [这里详细描述带有纵深空间感的极简侘寂艺术软装与漫反射光影背景] 背景下定格展现完美比例。原生音效：高级环境底噪 + 衣服摩擦与高跟鞋脚步拟音 Foley + 舒缓音乐 BGM。` : `12秒快节奏连贯 3 幕叙事，引用 图1 作为服装和模特的严格一致性参考，并以 图2（16:9分镜合集参考图）作为全局构图及姿态参考。第一幕：对应 图2 中的最左侧第一格，展现全身版型，背景场景为 [这里详细描述带有空间透视和材质的丰富场景背景]。镜头切换（Cut to）第二幕：对应 图2 中的第二格半身中景，聚焦上身设计，背景为 [材质与柔和氛围光影细节]。镜头切换（Cut to）第三幕：对应 图2 中的最右侧第三格细节特写，展示面料纹理。原生音效：高级环境底噪 + 衣服摩擦脚步声 + 舒缓音乐 BGM。`}
 
注意：请将范例中的说明替换为具体的中文描述词，输出的结果必须是连续的一整段文字，段落之间不要换行。不要输出任何其他前缀或后缀。`;
    } else {
      const bgIndex = validBase64Storyboards.length + 2;
      const isKling15s = model === 'kling-v3-omni' && videoDuration === '15s' && storyboardMode !== 'individual';
      promptText = isKling15s ? `你是一个专业的电商时尚视频编导。请根据上传的[模特穿搭主图]（作为输入的第一张图像，即图1）和提供的场景及搭配参数，结合我们生成并作为后续输入（依次为图2、图3、图4、图5、图6）的每一幕分镜参考图，${base64Background ? `以及最后作为图7传入的[背景场景模板图]（即图7，干净的场景空图），` : ''}调用以下视频提示词智能编排规约，生成分镜视频生成提示词。
 
【输入参数】：
- 穿搭图配饰/鞋子搭配建议：${matchingItemDesc} ${shoesDesc} ${accessoriesDesc}
- 目标环境场景空间与材质细节：${sceneDetail}
- 重点推广与展示部位：${focus === 'top' ? '重点推广上装 (Topwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘上衣/外套的设计细节、肩线与胸口裁剪、衣领、袖口和上身材质，把上装作为视觉焦点。' : focus === 'bottom' ? '重点推广下装 (Bottomwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注 and 描绘下装/裤子/裙子的垂坠物理特性、裤腿/裙摆摆动细节、腰线设计与下身材质，把下装作为视觉焦点。' : '重点推广整体搭配与服饰协调度 (Overall)。保持全身或中景构图，合理兼顾展示整套衣服的搭配协调度。'}
${slowMotionInstruction}
 
【技能规约核心框架】：
模块一：视觉资产解耦与锚定 (Asset Decoupling & Anchoring)
- 主体锚点（引用 图1）：锁定主体细节。整个视频生成过程中，必须严格锁定图1中的人物五官、身材比例、服装款式、色彩及面料细节，确保 100% 一致性。
- 时空锚点（依次对应引用 图2、图3、图4、图5、图6）：用作分镜中五幕视频生成的初始姿态与背景参考。
${base64Background ? `- 场景背景锚点（引用 图7）：整个生成过程中，每一幕视频生成的背景必须以图7（目标场景模板图）为核心基准，结合每幕分镜图的具体构图，详细描绘图7中的背景质感、布局细节、光影分布，锁定生成视频的背景场景。` : ''}
- 场景空间深度与背景细节：绝对不允许描述成单调的‘在影棚’或‘在街头’。你必须结合给定的“- 目标环境场景空间与材质细节”，在每一幕中详细拓展和描绘“多层空间透视、精细的墙面地面物理材质（如微水泥质感、湿沥青地面反射、镜面大理石纹理）、独特的氛围光线（如几何丁达尔斜射光、温暖的橱窗折射、柔焦焦外光斑）以及极简的高档软装摆件（如弧形门廊、洞石器皿、花瓶干树枝、设计师单椅）”，使得生成的视频背景层次极具纵深空间感与高端画册感，解决背景单一单薄的问题。
 
模块二：动态微操注入与高端运镜 (Micro-Dynamics & Premium Camera Motion)
- 摄像机运镜：电影感高端慢速运镜，展现高端时尚商业大片电影质感。包含：极其缓慢推近镜头 (Ultra-slow Dolly In)、缓缓拉远 (Slow Dolly Out)、视差缓慢横移 (Parallax slow panning)、极平滑轨道环绕镜头 (Slow 360-degree camera orbit)、微小变焦 (Subtle camera zoom)，镜头转动必须舒缓、平滑且富有呼吸感。
- 人物与动作幅度控制：模特采取「高端时尚大片微动态 (High-fashion micro-movements)」姿态，动作幅度要小且极其徐缓优雅（例如轻微侧身、头部微倾、视线转动、肩膀微调、自然徐缓的呼吸），绝对避免任何动作幅度大、速度快的肢体动作以确保画面稳定和大片的高冷质感。
- 环境与光影美学：微风徐徐轻拂发梢与裙角、精致的侧逆光光影随镜头极缓变化、自然细腻的光折射与质感流转，呈现Vogue杂志版的光影雕刻感。
- 人物与面料力学：自然的呼吸感、身体极缓微动时呈现流线型高级垂坠感 (Fluid drape)、面料随微动产生真实而富有张力的微小物理褶皱。
 
模块三：五幕时间轴激活 (Timeline Activation)
- 配合传入的 图2 ~ 图6 分镜图，推演连贯动作。特别约束指令：第一幕中，首帧画面（参考图2）中模特即处于画面最外侧的画外边缘位置，动作必须是从屏幕外最侧边（通过侧边空旷地面或侧边道路画外）优雅向前慢速迈步走入镜头中央并站定，动作要缓慢且稳重，绝对不要使用“起初为空镜头”等与首帧画面相冲突的描述。严禁让模特从背景中的墙面、石柱、柱体、门缝、家具或树木等实体结构中“凭空浮现”或“穿透穿墙而出”。人物的行走路径必须完全位于空旷地带，确保行走过程与背景物体在空间上完全剥离、互不重合。其他各幕的动作均设计为极其高雅的微动态慢镜头，如缓缓转身、视线微倾、肩部微沉，保持大片的高冷与质感，绝对不要描述具体的肢体操作性动作，如调整衣服、整理袖口等，以防视频生成出现严重的形变和穿模。
 
模块四：原生音画同构 (Audio-Visual Syncing)
- 音频 Tag 组合公式：原生音效：[环境底音] + [动作/材质拟音 Foley] + [情绪 BGM]
 
你的任务是：输出中文的一整段视频提示词描述。
请严格按照以下格式生成一整段话，不要换行，不要输出 JSON，不要包含任何 Markdown 标记，并且必须显式引用图的序号：
最终生成的提示词应该严格类似以下格式和语气（用具体的细节替换括号中的内容）：
15秒快节奏连贯 5 幕叙事，引用 图1 作为服装和模特的严格一致性参考。第一幕：引用 图2，极其缓慢向前推进的特写与中景，首帧模特处于画外最外侧边缘，随后模特顺着侧边空旷的道路（极其从容慢速走入镜头中央站定，行走路径与石柱实体背景完全分离开），背景场景为 [这里详细写入具有纵深感的背景，包含多层空间、微水泥墙面、反射地面、落地玻璃与精致几何光影]，在风吹衣角的微动态下站定展示高级气场。镜头切换（Cut to）第二幕：引用 图3 做为特写，极慢变焦镜头，镜头聚焦在 [第二幕特写细节如拉链头/配饰/面料卖点描述]，背景展示出 [光线在物理墙面和面料材质上投射出的精细质感与明暗交错]，清晰展现 [面料在逆光下高端微观材质与质感]。镜头切换（Cut to）第三幕：引用 图4 中景，轨道慢移环绕运镜，模特以极其缓慢优美的微侧身动作展示 [第三幕微幅动作描写]，背景中的 [详细描绘微水泥弧形柱体、几何造型构筑与自然斜射光影] 伴随镜头平滑运转，展现流线型高端垂坠感。镜头切换（Cut to）第四幕：引用 图5 侧面中景，极其平缓推移的镜头，模特极其徐缓地微微倾身或转动眼神，背景的 [这里详细描绘温暖的光影明暗对比与极简高级软装摆件] 展示出优美的层次感，展示自然面料物理力学微小褶皱。镜头切换（Cut to）第五幕：引用 图6 全景，镜头缓缓拉远，模特眼神微抬高冷定格，在 [这里详细描述带有大片空间感的极简侘寂艺术画廊内景，几何留白空间与温暖柔焦光斑] 背景下展现整体穿搭的商业时尚大片完美比例，画面在精致光影中定格。原生音效：[音效同构音频 Tag 组合中文描述]
 
注意：
1. 必须包含对“图1”到“图6”的硬编码文字引用（例如“引用 图1”、“引用 图2”等）。
2. 将括号里的 [模块/解析结果描述] 替换为具体的中文场景 and 材质属性描述词，不要保留中括号。
3. 输出的结果必须是连续的一整段文字，段落之间不要换行，不要输出换行符。不要输出任何其他前缀（如“这里是为您生成的提示词：”）或后缀。` : `你是一个专业的电商时尚视频编导。请根据上传的[模特穿搭主图]（包含模特穿着特定款式的服装）和提供的场景及搭配参数，结合我们生成并传入给大模型作为输入的每一幕分镜参考图，${base64Background ? `以及最后传入给大模型作为输入的[背景场景模板图]（即图${bgIndex}，干净的场景空图），` : ''}调用以下视频提示词智能编排规约，生成分镜视频生成提示词。
 
【输入参数】：
- 穿搭图配饰/鞋子搭配建议：${matchingItemDesc} ${shoesDesc} ${accessoriesDesc}
- 目标环境场景空间与材质细节：${sceneDetail}
- 重点推广与展示部位：${focus === 'top' ? '重点推广上装 (Topwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘上衣/外套的设计细节、肩线与胸口裁剪、衣领、袖口和上身材质，把上装作为视觉焦点。' : focus === 'bottom' ? '重点推广下装 (Bottomwear)。每一幕分镜描述（尤其是第二幕、第四幕和第五幕）必须主要关注和描绘下装/裤子/裙子的垂坠物理特性、裤腿/裙摆摆动细节、腰线设计与下身材质，把下装作为视觉焦点。' : '重点推广整体搭配与服饰协调度 (Overall)。保持全身或中景构图，合理兼顾展示整套衣服的搭配协调度。'}
${slowMotionInstruction}
 
【技能规约核心框架】：
- 严格图像序号命名规约：生成内容中引用的任何图像，必须且只能命名为「图1」、「图2」、「图3」、「图4」、「图5」、「图6」或「图7」格式。严禁在输出的提示词中出现任何诸如「@image_0.png」、「@image_1.png」、「image_0.png」、「@input_file_0.png」等临时变量名或具体图像文件名，必须将其映射为中文序号。
模块一：视觉资产解耦与锚定 (Asset Decoupling & Anchoring)
- 主体锚点（[@模特穿搭主图]）：解耦服装款式面料与特定模特的脸部发型，强制 AI 在整个 ${is15s ? '15' : '12'} 秒内，严格锁定该图中的人物五官、身材比例、服装款式、色彩及面料细节，确保 100% 一致性。
- 时空锚点（[@分镜图_幕1] ~ [@分镜图_幕${validBase64Storyboards.length}]）：用作各幕视频生成的首帧画面参考。强制 AI 读取每一幕对应的构图比例（特写/中景/全景）、环境背景、光影分布以及模特的初始姿态。
${base64Background ? `- 场景背景锚点（[@背景场景模板图] / 图${bgIndex}）：强力约束视频中生成的所有背景，必须严格匹配图${bgIndex}中的物理格局、道具陈设、色彩风格和光照特点。` : ''}
- 场景空间深度与背景细节：绝对不允许描述成单调的‘在影棚’或‘在街头’。你必须结合给定的“- 目标环境场景空间与材质细节”，在每一幕中详细拓展和描绘“多层空间透视、精细的墙面地面物理材质（如微水泥质感、湿沥青地面反射、镜面大理石纹理）、独特的氛围光线（如几何丁达尔斜射光、温暖的橱窗折射、柔焦焦外光斑）以及极简的高档软装摆件（如弧形门廊、洞石器皿、花瓶干树枝、设计师单椅）”，使得生成的视频背景层次极具纵深空间感与高端画册感，解决背景单一单薄的问题。
 
模块二：动态微操注入与高端运镜 (Micro-Dynamics & Premium Camera Motion)
- 摄像机运镜：电影感高端慢速运镜，展现高端时尚商业大片电影质感。包含：极其缓慢推近镜头 (Ultra-slow Dolly In)、缓缓拉远 (Slow Dolly Out)、视差缓慢横移 (Parallax slow panning)、极平滑轨道环绕镜头 (Slow 360-degree camera orbit)、微小变焦 (Subtle camera zoom)，镜头转动必须舒缓、平滑且富有呼吸感。
- 人物与动作幅度控制：模特采取「高端时尚大片微动态 (High-fashion micro-movements)」姿态，动作幅度要小且极其徐缓优雅（例如轻微侧身、头部微倾、视线转动、肩膀微调、自然徐缓的呼吸），绝对避免任何动作幅度大、速度快的肢体动作以确保画面稳定和大片的高冷质感。
- 环境与光影美学：微风徐徐轻拂发梢与裙角、精致的侧逆光光影随镜头极缓变化、自然细腻的光折射与质感流转，呈现Vogue杂志版的光影雕刻感。
- 人物与面料力学：自然的呼吸感、身体极缓微动时呈现流线型高级垂坠感 (Fluid drape)、面料随微动产生真实而富有张力的微小物理褶皱。
 
模块三：${is15s ? '五幕' : '三幕'}时间轴激活 (Timeline Activation)
- 配合传入的 ${validBase64Storyboards.length} 张分镜图，推演连贯动作。特别约束指令：第一幕中，首帧画面（分镜图_幕1）中模特即处于画面最外侧的画外边缘位置，动作必须是从屏幕外最侧边（通过侧边空旷地面或侧边道路画外）优雅向前慢速迈步走入镜头中央并站定，动作要缓慢且稳重，绝对不要使用“起初为空镜头”等与首帧画面相冲突的描述。严禁让模特从背景中的墙面、石柱、柱体、门缝、家具或树木等实体背景中“凭空浮现”或“穿墙而出”。人物的行走路径必须完全位于空旷地带，确保行走过程与背景物体在空间上完全剥离、互不重合。其他各幕的动作均设计为极其高雅的微动态慢镜头，如缓缓转身、视线微倾、肩部微沉，保持大片的高冷与质感，绝对不要描述具体的肢体操作性动作，如调整衣服、整理袖口等，以防视频生成出现严重的形变和穿模。
 
模块四：原生音画同构 (Audio-Visual Syncing)
- 音频 Tag 组合公式：原生音效：[环境底音] + [动作/材质拟音 Foley] + [情绪 BGM]
 
你的任务是：输出中文的一整段视频提示词描述。
请严格按照以下格式生成一整段话，不要换行，不要输出 JSON，不要包含任何 Markdown 标记：
${is15s ? `最终生成的提示词应该类似：
15秒快节奏连贯 5 幕叙事，引用参考图作为服装 and 模特的严格一致性参考。
场景设定： [详细描绘的高端大片场景背景物理格局与材质，包含多层空间深度的微水泥/反射地面/大理石板材，以及大落地窗斜射光影和侘寂风洞石器皿摆设]
第一幕： 极其缓慢推进的镜头，首帧模特处于画外最外侧边缘，随后从画外地面优雅慢速向镜头中央迈步（确保行走路径与背景实体结构物理分离，不产生空间重叠），背景展现出 [这里详细描写包含多层空间透视与光影的精美背景场景]，自然呼吸且确立大片气场。
镜头切换（Cut to）第二幕： 特写微距极慢移动镜头，聚焦在 [第二幕设计锚点]，背景是 [细节的微水泥墙体与高档光影投影]，清晰展现 [第二幕高端面料质感与光影反射]。
镜头切换（Cut to）第三幕： 中景慢速轨道环绕镜头，模特极其平缓地优雅微侧身，背景的 [这里详细描绘几何弧面、大理石物理地面与斜射丁达尔光线反射] 随镜头平稳运动，完美展示 [第三幕版型与面料流线型垂坠感]。
镜头切换（Cut to）第四幕： 极其平缓推移的镜头，模特极其徐缓地微倾肩部或微微转身，背景是 [此处写入艺术阴影对比与极简高级花瓶、软装摆件]，产生自然面料物理褶皱与大片氛围。
镜头切换（Cut to）第五幕： 全景镜头极慢拉远，模特眼神微抬高冷定格，在 [这里详细描绘带有极致纵深与柔和焦外光斑的极简侘寂艺术画廊空旷内景] 背景下展现整体穿搭的商业时尚大片完美比例，画面在精致光影中定格。
原生音效： [音效同构音频 Tag 组合描述]` : `最终生成的提示词应该类似：
12秒快节奏连贯 3 幕叙事，引用参考图作为服装和模特的严格一致性参考。
场景设定： [详细描绘的高端大片场景背景物理格局与材质，包含多层空间深度的微水泥/反射地面/大理石板材，以及大落地窗斜射光影和侘寂风洞石器皿摆设]
第一幕： 全景镜头极慢推移，模特在画面中央从容微调姿态，背景为 [这里详细描述包含空间透视、材质与光影的丰富场景背景]，展现全身版型与高端大片光影，[高端环境风力及面料垂坠力学]。
镜头切换（Cut to）第二幕： 半身中景极慢轨道横移，模特侧身极缓摆动，背景为 [具有细节纹理的微水泥墙面与几何长投影光影]，聚焦上衣细节与高端贴合感。
镜头切换（Cut to） third幕： 细节特写微距极慢推进，对焦服装微观纹理、接缝与高级扣子，后景 [带有柔焦光斑与高质感空间几何留白]，光感流转细腻。
原生音效： [音效同构音频 Tag 组合描述]`}
 
注意：请将括号里的 [模块/解析结果] 替换为具体的中文描述词，输出的结果必须是连续的一整段文字，段落之间不要换行。不要输出任何其他前缀或后缀。`;
    }

    const messagesContent = [
      { type: 'text', text: promptText },
      { type: 'image_url', image_url: { url: base64Outfit } }
    ];

    validBase64Storyboards.forEach((b64) => {
      messagesContent.push({ type: 'image_url', image_url: { url: b64 } });
    });

    if (base64Background) {
      messagesContent.push({ type: 'image_url', image_url: { url: base64Background } });
    }

    const requestBody = {
      model: 'gemini-3.1-flash-image',
      messages: [{ role: 'user', content: messagesContent }],
      max_tokens: 1536,
      stream: false
    };

    const gatewayUrl = process.env.AIGATEWAY_URL;
    const gatewayToken = process.env.AIGATEWAY_TOKEN;
    const requestUrl = gatewayUrl.endsWith('/') ? `${gatewayUrl}chat/completions` : `${gatewayUrl}/chat/completions`;

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) throw new Error(`AI prompt generator failed (${response.status})`);

    const responseData = await response.json();
    const choiceContent = responseData.choices?.[0]?.message?.content;
    if (!choiceContent) throw new Error('No message content returned from AI prompt generator');

    let cleanContent = choiceContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    cleanContent = cleanContent.replace(/@?(?:image|input_file)_(\d+)(?:\.png)?/gi, (_match, p1) => {
      const idx = parseInt(p1, 10);
      return `图${idx + 1}`;
    });

    res.status(200).json({ prompts: cleanContent });
  } catch (err) {
    console.error('Skill prompts generation failed:', err);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// 7. Video Generation Task Creator
app.post('/api/video/task', async (req, res) => {
  try {
    const { model, prompt, imageSrc, modelOutfitImgUrl, storyboardImgUrls, sceneImgUrl, seconds = 4, size = '720p', aspectRatio } = req.body;

    // Use sandbase.ai's Kling 3.0 Omni Pro Video model
    const sandbaseVideoModel = "kwaivgi/kling-video/3.0/omni/pro/image-to-video";
    // Map seconds (4 or other value) to duration integer
    const duration = Math.round(seconds) || 3;

    const sandbasePayload = {
      model: sandbaseVideoModel,
      image: imageSrc,
      prompt: prompt,
      duration: duration
    };

    console.log(`\n[Sandbase API] >>> Submitting Video Task`);
    console.log(`[Sandbase API] Model: "${sandbaseVideoModel}"`);
    console.log(`[Sandbase API] Input Image URL: ${imageSrc}`);
    console.log(`[Sandbase API] Prompt: "${prompt}"`);
    console.log(`[Sandbase API] Duration: ${duration}s`);

    const taskId = await submitSandbaseTask(sandbasePayload);

    res.status(200).json({ id: taskId });
  } catch (err) {
    console.error('Video task creation failed:', err);
    res.status(500).json({ error: err.message || 'Video task creation failed' });
  }
});

// 8. Video Generation Status Poller
app.get('/api/video/poll/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const apiKey = process.env.SANDBASE_API_KEY || process.env.AIGATEWAY_TOKEN;

    const response = await fetch(`https://api.sandbase.ai/v1/run/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Polling status failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log(`[Sandbase API] Polling Video Task ID: ${taskId} | Status: ${data.status}`);

    res.status(200).json({
      status: data.status,
      error: data.error || null
    });
  } catch (err) {
    console.error('Video status polling failed:', err);
    res.status(500).json({ error: err.message || 'Polling failed' });
  }
});

// 9. Video Content Relayer
app.get('/api/video/content/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const apiKey = process.env.SANDBASE_API_KEY || process.env.AIGATEWAY_TOKEN;

    // 1. Get task status to find the output URL
    const statusResponse = await fetch(`https://api.sandbase.ai/v1/run/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Failed to check video task status (${statusResponse.status}): ${errorText}`);
    }

    const data = await statusResponse.json();
    if (data.status !== 'completed') {
      throw new Error(`Video task is not completed yet (current status: ${data.status})`);
    }

    let videoUrl = '';
    if (data.outputs && data.outputs.length > 0 && data.outputs[0].url) {
      videoUrl = data.outputs[0].url;
    } else if (data.result && data.result.videos && data.result.videos.length > 0) {
      videoUrl = data.result.videos[0];
    } else if (data.result && data.result.images && data.result.images.length > 0) {
      videoUrl = data.result.images[0]; // fallback
    }

    if (!videoUrl) {
      throw new Error('No video URL returned in sandbase task outputs');
    }

    console.log(`[Sandbase API] Fetching video binary from URL: ${videoUrl}`);

    // 2. Fetch the actual video binary
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) {
      throw new Error(`Failed to fetch video binary from ${videoUrl} (${videoResponse.status})`);
    }

    res.setHeader('Content-Type', videoResponse.headers.get('content-type') || 'video/mp4');
    const contentLength = videoResponse.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    const buffer = await videoResponse.arrayBuffer();
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    console.error('Failed to retrieve video content:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch video content' });
  }
});

app.listen(port, () => {
  console.log(`KeyVideo backend microservice running on http://localhost:${port}`);
});
