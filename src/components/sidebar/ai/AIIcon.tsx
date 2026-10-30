import type { ReactNode } from 'react';

export type AIIconName =
  | 'spark' | 'infinite' | 'camera' | 'film' | 'play' | 'queue' | 'upload'
  | 'model' | 'scene' | 'clothes' | 'reference' | 'settings' | 'status'
  | 'wand' | 'light' | 'motion' | 'palette' | 'library' | 'check' | 'back'
  | 'plus' | 'stop' | 'download' | 'eye' | 'trash' | 'close' | 'timeline'
  | 'arrow' | 'edit';

interface Props {
  name: AIIconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function AIIcon({ name, size = 18, strokeWidth = 1.9, className }: Props) {
  let content: ReactNode;
  switch (name) {
    case 'spark': content = <><path d="m12 3 1.35 6.65L20 12l-6.65 1.35L12 20l-1.35-6.65L4 12l6.65-2.35L12 3Z" /><path d="m19 3 .45 2.1L21.5 6l-2.05.45L19 8.5l-.45-2.05L16.5 6l2.05-.9L19 3Z" /></>; break;
    case 'infinite': content = <><path d="M6.3 8.1c-2.2 0-3.8 1.5-3.8 3.9s1.6 3.9 3.8 3.9c3.1 0 5.2-7.8 8.3-7.8 2.2 0 3.8 1.5 3.8 3.9s-1.6 3.9-3.8 3.9c-3.1 0-5.2-7.8-8.3-7.8Z" /></>; break;
    case 'camera': content = <><path d="M4 7.5h3l1.4-2h7.2l1.4 2h3A1.5 1.5 0 0 1 21.5 9v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" /><circle cx="12" cy="13.5" r="3.4" /></>; break;
    case 'film': content = <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4" /></>; break;
    case 'play': content = <><circle cx="12" cy="12" r="9" /><path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z" fill="currentColor" stroke="none" /></>; break;
    case 'queue': content = <><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="18" cy="18" r="3" /><path d="M18 16.5v1.7l1.1.7" /></>; break;
    case 'upload': content = <><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></>; break;
    case 'model': content = <><circle cx="12" cy="7" r="3" /><path d="M5 20c.4-4.2 2.7-6.4 7-6.4s6.6 2.2 7 6.4" /><path d="M8.5 17h7" /></>; break;
    case 'scene': content = <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4.5 17 4.5-4 3 2.5 2.2-2 5.3 4.5" /></>; break;
    case 'clothes': content = <><path d="m9 5 3 2 3-2 5 3.5-2.2 4.2-2.3-1.2V20H8v-8.5l-2.3 1.2L3.5 8.5 9 5Z" /></>; break;
    case 'reference': content = <><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 3.5v3h6v-3M9 11h6M9 15h4" /></>; break;
    case 'settings': content = <><path d="M12 3.5 14 5l2.4-.3 1 2.2 2.1 1.2-.5 2.4 1.3 2-1.3 2 .5 2.4-2.1 1.2-1 2.2-2.4-.3-2 1.5-2-1.5-2.4.3-1-2.2-2.1-1.2.5-2.4-1.3-2 1.3-2-.5-2.4 2.1-1.2 1-2.2 2.4.3 2-1.5Z" /><circle cx="12" cy="12" r="3" /></>; break;
    case 'status': content = <><circle cx="12" cy="12" r="8.5" /><path d="m8 12 2.6 2.6L16.5 9" /></>; break;
    case 'wand': content = <><path d="m4 20 11.7-11.7" /><path d="m14.5 5.5 4 4" /><path d="m16.5 3 .5 2 .5-2 2-.5-2-.5-.5-2-.5 2-2 .5 2 .5Z" /><path d="m5 9 .5 2 .5-2 2-.5-2-.5-.5-2-.5 2-2 .5 2 .5Z" /></>; break;
    case 'light': content = <><path d="M9 18h6M9.5 21h5" /><path d="M8.2 14.5A6 6 0 1 1 15.8 14c-.8.8-1.4 1.5-1.6 2.5H9.8c-.2-1-.8-1.7-1.6-2.5Z" /></>; break;
    case 'motion': content = <><path d="M4 6h9M4 12h6M4 18h9" /><path d="m16 8 4 4-4 4" /><path d="M13 12h7" /></>; break;
    case 'palette': content = <><path d="M12 3a9 9 0 0 0 0 18h1.3a1.7 1.7 0 0 0 1.2-2.9c-1-1-.3-2.6 1.1-2.6H18a3 3 0 0 0 3-3A9.5 9.5 0 0 0 12 3Z" /><circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="10" cy="6.8" r="1" fill="currentColor" stroke="none" /><circle cx="14" cy="6.8" r="1" fill="currentColor" stroke="none" /></>; break;
    case 'library': content = <><path d="M4 5.5h4v13H4zM10 5.5h4v13h-4zM16 5.5h4v13h-4z" /><path d="M3 20h18" /></>; break;
    case 'check': content = <path d="m5 12 4.2 4.2L19 6.5" />; break;
    case 'back': content = <><path d="m14.5 5-7 7 7 7" /><path d="M8 12h12" /></>; break;
    case 'plus': content = <><path d="M12 5v14M5 12h14" /></>; break;
    case 'stop': content = <rect x="5" y="5" width="14" height="14" rx="2" />; break;
    case 'download': content = <><path d="M12 4v11" /><path d="m8 11 4 4 4-4" /><path d="M5 20h14" /></>; break;
    case 'eye': content = <><path d="M2.5 12s3.5-5.2 9.5-5.2 9.5 5.2 9.5 5.2-3.5 5.2-9.5 5.2-9.5-5.2-9.5-5.2Z" /><circle cx="12" cy="12" r="2.2" /></>; break;
    case 'trash': content = <><path d="M4 7h16M10 4h4l1 3H9l1-3ZM7 7l1 13h8l1-13M10 11v5M14 11v5" /></>; break;
    case 'close': content = <><path d="m6 6 12 12M18 6 6 18" /></>; break;
    case 'timeline': content = <><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 4v4M14 10v4M18 16v4" /><circle cx="8" cy="6" r="1.3" fill="currentColor" stroke="none" /><circle cx="14" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="18" r="1.3" fill="currentColor" stroke="none" /></>; break;
    case 'arrow': content = <path d="M5 12h13M14 7l5 5-5 5" />; break;
    case 'edit': content = <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5a2.5 2.5 0 0 0-3.5-3.5L4 16.5Z" /><path d="m13.5 6.5 4 4" /></>; break;
    default: content = null;
  }
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content}</svg>;
}
