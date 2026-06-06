export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

export const toastState = $state({
  toasts: [] as ToastMessage[]
});

export function addToast(message: string, type: ToastType = 'info', durationMs: number = 4000) {
  const id = crypto.randomUUID();
  toastState.toasts.push({ id, type, message });

  setTimeout(() => {
    removeToast(id);
  }, durationMs);
}

export function removeToast(id: string) {
  const idx = toastState.toasts.findIndex((t) => t.id === id);
  if (idx !== -1) {
    toastState.toasts.splice(idx, 1);
  }
}
