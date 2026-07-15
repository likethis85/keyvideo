import { fetchImageAsBase64, getGatewayRequestConfig } from './helpers';

export interface OutfitSuggestParams {
  topUrl?: string;
  bottomUrl?: string;
  gatewayUrl: string;
  gatewayToken: string;
}

export const generateOutfitSuggestion = async (params: OutfitSuggestParams): Promise<{
  matchingItem: string;
  shoes: string;
  accessories: string;
}> => {
  const { topUrl, bottomUrl, gatewayUrl, gatewayToken } = params;

  if (!gatewayUrl) {
    throw new Error('AI Gateway URL is required.');
  }
  if (!gatewayToken) {
    throw new Error('AI Gateway API Token is required.');
  }

  // 1. Fetch images as base64
  const contentArray: any[] = [
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
    contentArray.push({
      type: 'image_url',
      image_url: { url: base64Top }
    });
  }
  if (bottomUrl) {
    const base64Bottom = await fetchImageAsBase64(bottomUrl);
    contentArray.push({
      type: 'image_url',
      image_url: { url: base64Bottom }
    });
  }

  const requestBody = {
    model: 'gemini-3.1-flash-image',
    messages: [
      {
        role: 'user',
        content: contentArray
      }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1024,
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
    throw new Error(`AI Stylist failed (${response.status})`);
  }

  const responseData = await response.json();
  const choices = responseData.choices;
  if (!choices || choices.length === 0) {
    throw new Error('No content returned from AI Stylist');
  }

  const choiceContent = choices[0]?.message?.content;
  if (!choiceContent) {
    throw new Error('No message content returned from AI Stylist');
  }

  // Helper function to extract a string field using regex as a robust fallback
  const extractField = (text: string, fieldName: string, fallbackValue: string): string => {
    try {
      // Matches "fieldName": "value" (supporting escaped quotes and newlines)
      const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, 'i');
      const match = text.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (e) {
      console.warn(`Regex extraction failed for field: ${fieldName}`, e);
    }
    return fallbackValue;
  };

  try {
    const cleanJsonStr = choiceContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 1. Extract JSON object from first '{' to last '}' to strip surrounding LLM markdown / conversational text
    let jsonToParse = cleanJsonStr;
    const firstBraceIdx = cleanJsonStr.indexOf('{');
    const lastBraceIdx = cleanJsonStr.lastIndexOf('}');
    if (firstBraceIdx !== -1 && lastBraceIdx !== -1 && lastBraceIdx > firstBraceIdx) {
      jsonToParse = cleanJsonStr.substring(firstBraceIdx, lastBraceIdx + 1);
    }

    // 2. Sanitize control characters (raw newlines, carriage returns, and tabs) inside double quotes
    const sanitizedJsonStr = jsonToParse.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (_match: string, p1: string) => {
      const escaped = p1
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
      return `"${escaped}"`;
    });

    const parsed = JSON.parse(sanitizedJsonStr);
    return {
      matchingItem: parsed.matchingItem || '',
      shoes: parsed.shoes || '',
      accessories: parsed.accessories || ''
    };
  } catch (e) {
    console.warn('Failed to parse json, falling back to regex', e);
    return {
      matchingItem: extractField(choiceContent, 'matchingItem', ''),
      shoes: extractField(choiceContent, 'shoes', ''),
      accessories: extractField(choiceContent, 'accessories', '')
    };
  }
};
