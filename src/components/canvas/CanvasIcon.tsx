import type { ReactNode } from 'react';

export type CanvasIconName =
  | 'select' | 'pan' | 'grid' | 'connect' | 'draw' | 'frame'
  | 'add' | 'users' | 'play' | 'layers' | 'import' | 'layout' | 'edit' | 'timeline'
  | 'undo' | 'redo' | 'zoomOut' | 'zoomIn' | 'fit' | 'trash' | 'map'
  | 'chevronDown' | 'chevronUp';

interface Props {
  name: CanvasIconName;
  size?: number;
  strokeWidth?: number;
}

export function CanvasIcon({ name, size = 18, strokeWidth = 1.9 }: Props) {
  let content: ReactNode;
  switch (name) {
    case 'select':
      content = <><path d="M5 3l14 10-6.2 1.1L10 20 8.1 19l2.8-5.8L5 3Z" /><path d="M12.5 13.5 16 17" /></>;
      break;
    case 'pan':
      content = <><path d="M8 11V5.7a1.5 1.5 0 0 1 3 0V10" /><path d="M11 9V4.7a1.5 1.5 0 0 1 3 0V10" /><path d="M14 9V6a1.5 1.5 0 0 1 3 0v5" /><path d="M17 11V9a1.5 1.5 0 0 1 3 0v5.2c0 4.1-2.6 6.8-6.6 6.8h-.8c-2.4 0-3.7-1.1-5-3L5.2 15a1.5 1.5 0 0 1 2.5-1.7L10 16" /></>;
      break;
    case 'grid':
      content = <><rect x="4" y="4" width="16" height="16" rx="1.5" /><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16" /></>;
      break;
    case 'connect':
      content = <><circle cx="6" cy="6" r="2.4" /><circle cx="18" cy="18" r="2.4" /><path d="M8 7.7c3.1 1.2 3.5 6.8 7.2 8.5" /><path d="m14.5 15.2 2.2 1.1-1.1 2.2" /></>;
      break;
    case 'draw':
      content = <><path d="m4 20 4.2-1 9.9-9.9a2.3 2.3 0 0 0-3.2-3.2L5 15.8 4 20Z" /><path d="m13.8 7.2 3 3M4 20l3.6-2.3" /></>;
      break;
    case 'edit':
      content = <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5a2.5 2.5 0 0 0-3.5-3.5L4 16.5Z" /><path d="m13.5 6.5 4 4" /></>;
      break;
    case 'timeline':
      content = <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 4v4M14 10v4M18 16v4" /><circle cx="8" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="14" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="18" r="1.3" fill="currentColor" stroke="none" /></>;
      break;
    case 'frame':
      content = <><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" /><rect x="8" y="8" width="8" height="8" rx="1" /></>;
      break;
    case 'add':
      content = <><path d="M12 5v14M5 12h14" /></>;
      break;
    case 'users':
      content = <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.4-3.2 2.2-5 5.5-5s5.1 1.8 5.5 5" /><path d="M15 6.2a3 3 0 0 1 0 5.7M17.2 14.4c2.2.8 3.3 2.2 3.5 4.6" /></>;
      break;
    case 'play':
      content = <><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="m10 8 5.5 4-5.5 4V8Z" fill="currentColor" stroke="none" /></>;
      break;
    case 'layers':
      content = <><path d="m12 4 8 4-8 4-8-4 8-4Z" /><path d="m4 12 8 4 8-4M4 16l8 4 8-4" /></>;
      break;
    case 'import':
      content = <><path d="M12 4v10M8 10l4 4 4-4" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></>;
      break;
    case 'layout':
      content = <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="9" y="14" width="6" height="6" rx="1" /><path d="M7 10v2h10v-2M12 12v2" /></>;
      break;
    case 'undo':
      content = <><path d="M9 7 4 12l5 5" /><path d="M5 12h9a6 6 0 0 1 6 6" /></>;
      break;
    case 'redo':
      content = <><path d="m15 7 5 5-5 5" /><path d="M19 12h-9a6 6 0 0 0-6 6" /></>;
      break;
    case 'zoomOut':
      content = <><circle cx="10.5" cy="10.5" r="6" /><path d="M6 10.5h9M15 15l5 5" /></>;
      break;
    case 'zoomIn':
      content = <><circle cx="10.5" cy="10.5" r="6" /><path d="M6 10.5h9M10.5 6v9M15 15l5 5" /></>;
      break;
    case 'fit':
      content = <><path d="M8 4H5a1 1 0 0 0-1 1v3M16 4h3a1 1 0 0 1 1 1v3M8 20H5a1 1 0 0 1-1-1v-3M16 20h3a1 1 0 0 0 1-1v-3" /><path d="M9 9h6v6H9z" /></>;
      break;
    case 'trash':
      content = <><path d="M4 7h16M10 4h4l1 3H9l1-3ZM7 7l1 13h8l1-13M10 10v7M14 10v7" /></>;
      break;
    case 'map':
      content = <><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" /><path d="M9 4v14M15 6v14" /></>;
      break;
    case 'chevronUp':
      content = <path d="m6 14 6-6 6 6" />;
      break;
    case 'chevronDown':
      content = <path d="m6 10 6 6 6-6" />;
      break;
    default:
      content = null;
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {content}
    </svg>
  );
}
