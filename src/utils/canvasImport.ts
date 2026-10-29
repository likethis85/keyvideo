import type { CanvasConnection, CanvasNodeData, CanvasViewport } from '../types/canvas';

export const CANVAS_IMPORT_EVENT = 'keyvideo:canvas-import';

export interface ImportedCanvasState {
  nodes: CanvasNodeData[];
  connections: CanvasConnection[];
  viewport?: CanvasViewport;
}

export interface CanvasImportEventDetail extends ImportedCanvasState {
  projectId: string;
}

/**
 * Validates and normalizes an imported infinite-canvas payload. Imported
 * projects must update the mounted store, otherwise its debounced autosave can
 * overwrite the imported data with the previous in-memory canvas.
 */
export function normalizeCanvasState(value: unknown): ImportedCanvasState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as {
    nodes?: unknown;
    connections?: unknown;
    viewport?: unknown;
  };
  if (!Array.isArray(candidate.nodes)) return null;

  const viewport = candidate.viewport as CanvasViewport | undefined;
  const validViewport = viewport
    && Number.isFinite(viewport.x)
    && Number.isFinite(viewport.y)
    && Number.isFinite(viewport.scale)
    ? viewport
    : undefined;

  return {
    nodes: candidate.nodes as CanvasNodeData[],
    connections: Array.isArray(candidate.connections) ? candidate.connections as CanvasConnection[] : [],
    viewport: validViewport
  };
}

export function notifyCanvasImport(detail: CanvasImportEventDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CanvasImportEventDetail>(CANVAS_IMPORT_EVENT, { detail }));
}
