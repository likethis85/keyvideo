export interface BatchRequestKeyShot {
  id: string;
  prompt: string;
  imageSrc: string;
  seconds?: number;
}

export interface BatchRequestKeyParams {
  projectId: string;
  model?: string;
  seconds?: number;
  shots: BatchRequestKeyShot[];
  retryToken?: string;
}

/**
 * Stable idempotency key for a batch submission.
 *
 * The key covers every paid input (prompt, reference image, duration, model),
 * so changing any of them produces a new request. `retryToken` is appended for
 * explicit retries so a previously failed submission can be resubmitted without
 * replaying the cached failure. Omitting it keeps duplicate clicks from
 * submitting the same batch twice.
 */
export const buildBatchRequestKey = (params: BatchRequestKeyParams): string => {
  const signature = JSON.stringify({
    projectId: params.projectId,
    model: params.model || '',
    seconds: params.seconds ?? null,
    shots: params.shots.map(shot => ({
      id: shot.id,
      prompt: shot.prompt,
      imageSrc: shot.imageSrc,
      seconds: shot.seconds ?? null
    }))
  });
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const retrySuffix = params.retryToken ? `:retry-${params.retryToken}` : '';
  return `batch:${params.projectId}:${(hash >>> 0).toString(16)}${retrySuffix}`;
};
