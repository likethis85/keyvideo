export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toast: ToastItem) => void;
export const toastListeners: ToastListener[] = [];

export const toast = {
  show: (message: string, type: ToastType = 'info', duration = 3500) => {
    const item: ToastItem = { id: crypto.randomUUID(), type, message, duration };
    toastListeners.forEach(listener => listener(item));
  },
  success: (message: string, duration = 3500) => toast.show(message, 'success', duration),
  error: (message: string, duration = 4500) => toast.show(message, 'error', duration),
  info: (message: string, duration = 3500) => toast.show(message, 'info', duration),
  warning: (message: string, duration = 4000) => toast.show(message, 'warning', duration)
};
