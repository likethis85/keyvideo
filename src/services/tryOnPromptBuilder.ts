interface TryOnPromptOptions {
  modelIndex: number;
  poseIndex: number;
  clothingRef: string;
  matchingItem: string;
  shoes: string;
  accessories: string;
  editPrompt: string;
  poseImageUrl: string | null;
  usePoseCameraFraming: boolean;
  includeFlatlayDetails?: boolean;
}

export function buildTryOnPrompt({
  modelIndex,
  poseIndex,
  clothingRef,
  matchingItem,
  shoes,
  accessories,
  editPrompt,
  poseImageUrl,
  usePoseCameraFraming,
  includeFlatlayDetails = false
}: TryOnPromptOptions): string {
  let stylingInfo = '';
  if (matchingItem.trim()) stylingInfo += ` Outfit styling match: ${matchingItem.trim()}.`;
  if (shoes.trim()) stylingInfo += ` Footwear styling: ${shoes.trim()}.`;
  if (accessories.trim()) stylingInfo += ` Accessories/bags: ${accessories.trim()}.`;

  const modificationText = editPrompt.trim()
    ? `\nModification: Apply this request: Please apply the following modification request: ${editPrompt.trim()}.`
    : '';
  const cameraFramingRule = usePoseCameraFraming
    ? `CAMERA FRAMING & SHOT DISTANCE (CRITICAL STRICT): Strictly follow and mirror the pose, posture, gesture, camera framing, shot distance, crop level, zoom, and composition of the model in the pose reference image (图${poseIndex}). For example, if 图${poseIndex} is a close-up (特写), headshot/bust shot, half-body / medium shot (半身), 3/4 shot, or full-body (全身), the generated image MUST strictly adopt the exact same shot framing and crop level as 图${poseIndex}. Do NOT force outpainting or full-body framing if 图${poseIndex} is a close-up or half-body shot.`
    : `CAMERA FRAMING & SHOT DISTANCE: Only extract and transfer the body pose, posture, gesture, and body angle of the model in the pose reference image (图${poseIndex}). Do NOT copy or follow the camera framing, zoom level, crop, or background layout of 图${poseIndex}. Keep the camera framing and composition consistent with 图${modelIndex}.`;
  const posePromptText = poseImageUrl
    ? `\nPose Reference (Strict): ${cameraFramingRule}\nCRITICAL MODEL FACE RULE: Only extract the body pose from 图${poseIndex}. Strictly do NOT copy, transfer, or retain any face, head, hair, facial features, or identity from the pose reference model in 图${poseIndex}. The face and facial identity of the generated model MUST be 100% strictly copied from 图${modelIndex}.\nHANDBAG & ACCESSORY ADAPTATION: If the model originally carried a handbag or accessory, dynamically adapt its placement according to the new pose in 图${poseIndex}. If holding a bag is unnatural or incompatible with the new posture in 图${poseIndex}, automatically omit the bag completely from the image.`
    : '';
  const flatlayDetail = includeFlatlayDetails
    ? '\nNote:  The provided clothing images also include clean flatlay garment images (top and/or bottom). You must strictly reference these clean flatlay garment images to capture the exact details, fabric textures, colors, logos, and patterns of the clothing, while using the model outfit reference image for styling/layering/drape reference. This is crucial because the clothing in the model outfit reference image might be partially blocked, folded, or shaded.'
    : '';
  const poseOnlyRegeneration = !!poseImageUrl && !editPrompt.trim();
  const taskPrompt = poseOnlyRegeneration
    ? `Task: Generate a premium fashion catalog photo by retaining the exact model and exact outfit from 图${modelIndex}, while strictly matching ${usePoseCameraFraming ? 'both the pose and exact camera framing / shot distance (close-up/half-body/full-body)' : 'only the pose'} of the pose reference image (图${poseIndex}).${posePromptText}`
    : `Task: Generate a premium fashion catalog photo by transferring the exact outfit from ${clothingRef} onto the model from 图${modelIndex}.${modificationText}${posePromptText}`;
  const outfitPrompt = poseOnlyRegeneration
    ? `Outfit (Strict): 100% exact, identical clothing, fabric, color, texture, and fit from 图${modelIndex} (and ${clothingRef}). Keep the outfit completely unchanged and identical to 图${modelIndex}.${flatlayDetail}`
    : usePoseCameraFraming && poseImageUrl
      ? `Outfit (Strict): Identical clothing from ${clothingRef} (fabric, drapery, and fit). Match the exact shot crop level of 图${poseIndex}.${flatlayDetail}`
      : `Outfit (Strict): Identical clothing from ${clothingRef} (fabric, drapery, and fit). Automatically outpaint missing lower body parts (bottoms/footwear) for a cohesive full-body look.${flatlayDetail}`;

  return `${taskPrompt}
Model (Strict): 100% exact face, facial features, head, hair, skin tone, and body of 图${modelIndex}. Do NOT retain any facial features from ${clothingRef}${poseImageUrl ? ` or the pose reference image (图${poseIndex})` : ''}.
${outfitPrompt}
Style & Setting: High-resolution, detailed skin, professional studio lighting, solid light grey/white background.${stylingInfo}
Negative constraints: Clean image, strictly NO text, logos, watermarks, tags, or signatures.`;
}
