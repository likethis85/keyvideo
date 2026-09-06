import type { Layer } from '../components/VideoCanvas';

export const MAX_HISTORY_DEPTH = 30;

export interface HistorySnapshot {
  layers: Layer[];
  actionDesc: string;
  timestamp: number;
}

export interface HistoryState {
  stack: HistorySnapshot[];
  index: number;
}

/**
 * Deep clone layers to ensure immutable history snapshots
 */
export function cloneLayers(layers: Layer[]): Layer[] {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(layers);
    }
  } catch {
    // structuredClone might fail on DOM or complex circular refs
  }
  return JSON.parse(JSON.stringify(layers));
}

/**
 * Create initial history state
 */
export function createInitialHistory(layers: Layer[], initialDesc = '初始工程状态'): HistoryState {
  return {
    stack: [{
      layers: cloneLayers(layers),
      actionDesc: initialDesc,
      timestamp: Date.now()
    }],
    index: 0
  };
}

/**
 * Push a new snapshot to history with 30-step sliding window protection
 */
export function pushHistorySnapshot(
  state: HistoryState,
  newLayers: Layer[],
  actionDesc: string
): HistoryState {
  // Truncate any redo forward history
  const activeStack = state.stack.slice(0, state.index + 1);

  // Avoid duplicate commit if identical to the current snapshot
  const currentSnapshot = activeStack[activeStack.length - 1];
  if (currentSnapshot && JSON.stringify(currentSnapshot.layers) === JSON.stringify(newLayers)) {
    return state;
  }

  const newSnapshot: HistorySnapshot = {
    layers: cloneLayers(newLayers),
    actionDesc,
    timestamp: Date.now()
  };

  const nextStack = [...activeStack, newSnapshot];

  // Sliding window: keep only the last MAX_HISTORY_DEPTH snapshots
  if (nextStack.length > MAX_HISTORY_DEPTH) {
    const trimmedStack = nextStack.slice(nextStack.length - MAX_HISTORY_DEPTH);
    return {
      stack: trimmedStack,
      index: trimmedStack.length - 1
    };
  }

  return {
    stack: nextStack,
    index: nextStack.length - 1
  };
}

/**
 * Perform Undo step
 */
export function undoHistory(state: HistoryState): {
  state: HistoryState;
  restoredLayers: Layer[];
  actionDesc: string;
} | null {
  if (state.index <= 0) return null;

  const targetIndex = state.index - 1;
  const targetSnapshot = state.stack[targetIndex];
  const undoneSnapshot = state.stack[state.index];

  return {
    state: {
      ...state,
      index: targetIndex
    },
    restoredLayers: cloneLayers(targetSnapshot.layers),
    actionDesc: undoneSnapshot.actionDesc
  };
}

/**
 * Perform Redo step
 */
export function redoHistory(state: HistoryState): {
  state: HistoryState;
  restoredLayers: Layer[];
  actionDesc: string;
} | null {
  if (state.index >= state.stack.length - 1) return null;

  const targetIndex = state.index + 1;
  const targetSnapshot = state.stack[targetIndex];

  return {
    state: {
      ...state,
      index: targetIndex
    },
    restoredLayers: cloneLayers(targetSnapshot.layers),
    actionDesc: targetSnapshot.actionDesc
  };
}
