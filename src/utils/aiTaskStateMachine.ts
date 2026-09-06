export type AiTaskPhase =
  | 'idle'
  | 'submitting'
  | 'queued'
  | 'processing'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export interface AiTaskSnapshot {
  taskId: string;
  phase: AiTaskPhase;
  progress: number;
  attempt: number;
  transientErrors: number;
  error?: string;
  updatedAt: number;
}

export interface PollResult<TResult> {
  status: string;
  result?: TResult;
  error?: string;
}

export class AiTaskCancelledError extends Error {
  constructor() {
    super('AI task was cancelled');
    this.name = 'AiTaskCancelledError';
  }
}

export class AiTaskTimeoutError extends Error {
  constructor(taskId: string) {
    super(`AI task ${taskId} timed out`);
    this.name = 'AiTaskTimeoutError';
  }
}

export class AiTaskFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiTaskFailedError';
  }
}

const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new AiTaskCancelledError());
    return;
  }
  const handleAbort = () => {
    window.clearTimeout(timeout);
    reject(new AiTaskCancelledError());
  };
  const timeout = window.setTimeout(() => {
    signal?.removeEventListener('abort', handleAbort);
    resolve();
  }, milliseconds);
  signal?.addEventListener('abort', handleAbort, { once: true });
});

export const runPollingTask = async <TResult>(options: {
  taskId: string;
  poll: () => Promise<PollResult<TResult>>;
  intervalMs: number;
  maxAttempts: number;
  estimatedAttempts?: number;
  initialPhase?: 'queued' | 'processing' | 'recovering';
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  maxTransientErrors?: number;
  onTransition?: (snapshot: AiTaskSnapshot) => void;
}): Promise<PollResult<TResult>> => {
  const {
    taskId,
    poll,
    intervalMs,
    maxAttempts,
    estimatedAttempts = maxAttempts,
    initialPhase = 'processing',
    signal,
    isCancelled,
    maxTransientErrors = 10,
    onTransition
  } = options;

  let transientErrors = 0;
  const emit = (phase: AiTaskPhase, attempt: number, error?: string) => {
    const progress = phase === 'completed'
      ? 100
      : phase === 'failed' || phase === 'cancelled' || phase === 'timed_out'
        ? 0
        : Math.min(95, 5 + Math.floor((attempt / Math.max(1, estimatedAttempts)) * 85));
    onTransition?.({ taskId, phase, progress, attempt, transientErrors, error, updatedAt: Date.now() });
  };

  emit(initialPhase, 0);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (signal?.aborted || isCancelled?.()) {
      emit('cancelled', attempt - 1);
      throw new AiTaskCancelledError();
    }

    await wait(intervalMs, signal);

    if (isCancelled?.()) {
      emit('cancelled', attempt - 1);
      throw new AiTaskCancelledError();
    }

    try {
      const result = await poll();
      transientErrors = 0;
      if (result.status === 'completed') {
        emit('completed', attempt);
        return result;
      }
      if (result.status === 'failed') {
        const message = result.error || 'AI task failed';
        emit('failed', attempt, message);
        throw new AiTaskFailedError(message);
      }
      emit('processing', attempt);
    } catch (error) {
      if (error instanceof AiTaskFailedError || error instanceof AiTaskCancelledError) throw error;
      transientErrors += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (transientErrors >= maxTransientErrors) {
        emit('failed', attempt, message);
        throw new AiTaskFailedError(`Lost connection while polling AI task: ${message}`);
      }
      emit('processing', attempt, message);
    }
  }

  emit('timed_out', maxAttempts);
  throw new AiTaskTimeoutError(taskId);
};
