/**
 * Video models the backend actually maps to a provider payload.
 *
 * The backend currently submits every task to Kling 3.0 Omni. Offering other
 * names in the UI silently produced Kling results, so unsupported models are
 * rejected/normalized instead of being advertised.
 */
export const SUPPORTED_VIDEO_MODELS = [
  { id: 'kling-v3-omni', label: 'kling-v3-omni (快手可灵 v3.0)' }
] as const;

export const DEFAULT_VIDEO_MODEL = SUPPORTED_VIDEO_MODELS[0].id;

export function isSupportedVideoModel(model: string | null | undefined): boolean {
  return SUPPORTED_VIDEO_MODELS.some(item => item.id === model);
}

export function normalizeVideoModel(model: string | null | undefined): string {
  return isSupportedVideoModel(model) ? (model as string) : DEFAULT_VIDEO_MODEL;
}
