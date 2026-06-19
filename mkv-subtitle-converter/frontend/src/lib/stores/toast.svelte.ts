export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms; 0 = sticky
}

function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const toastState = $state<{ toasts: Toast[] }>({ toasts: [] });

function addToast(message: string, type: ToastType = 'info', duration = 5000): string {
  const id = generateId();
  toastState.toasts = [...toastState.toasts, { id, type, message, duration }];

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }

  return id;
}

export function removeToast(id: string): void {
  toastState.toasts = toastState.toasts.filter((t) => t.id !== id);
}

export function clearToasts(): void {
  toastState.toasts = [];
}

// Convenience helpers
export const toast = {
  success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
  error: (msg: string, dur?: number) => addToast(msg, 'error', dur ?? 0), // errors are sticky by default
  warning: (msg: string, dur?: number) => addToast(msg, 'warning', dur),
  info: (msg: string, dur?: number) => addToast(msg, 'info', dur)
};
