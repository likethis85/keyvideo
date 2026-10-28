export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  duration?: number;
  action?: ToastAction;
  onClick?: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
  onClick?: () => void;
}

type ToastListener = (toast: ToastItem) => void;
export const toastListeners: ToastListener[] = [];

export const toast = {
  show: (message: string, type: ToastType = 'info', optionsOrDuration?: number | ToastOptions) => {
    const opts: ToastOptions = typeof optionsOrDuration === 'number'
      ? { duration: optionsOrDuration }
      : (optionsOrDuration || {});
    const item: ToastItem = {
      id: crypto.randomUUID(),
      type,
      message,
      duration: opts.duration ?? (type === 'error' ? 4500 : 3500),
      action: opts.action,
      onClick: opts.onClick
    };
    toastListeners.forEach(listener => listener(item));
  },
  success: (message: string, optionsOrDuration?: number | ToastOptions) => toast.show(message, 'success', optionsOrDuration),
  error: (message: string, optionsOrDuration?: number | ToastOptions) => toast.show(message, 'error', optionsOrDuration),
  info: (message: string, optionsOrDuration?: number | ToastOptions) => toast.show(message, 'info', optionsOrDuration),
  warning: (message: string, optionsOrDuration?: number | ToastOptions) => toast.show(message, 'warning', optionsOrDuration)
};
