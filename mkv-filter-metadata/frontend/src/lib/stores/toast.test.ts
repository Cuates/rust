import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { toastState, addToast, removeToast } from './toast.svelte';

describe('toast.svelte', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    toastState.toasts = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('addToast should add a toast and automatically remove it after duration', () => {
    // We need crypto.randomUUID to be available in jsdom, which it is in recent node versions via vitest
    // Let's add a spy or mock if needed, but vitest usually handles it natively if we use happy-dom or jsdom >= 20.

    addToast('Test Message', 'success', 1000);
    expect(toastState.toasts.length).toBe(1);
    expect(toastState.toasts[0].message).toBe('Test Message');
    expect(toastState.toasts[0].type).toBe('success');

    const id = toastState.toasts[0].id;
    expect(id).toBeDefined();

    // Fast forward 999ms, toast should still be there
    vi.advanceTimersByTime(999);
    expect(toastState.toasts.length).toBe(1);

    // Fast forward 1ms more, toast should be removed
    vi.advanceTimersByTime(1);
    expect(toastState.toasts.length).toBe(0);
  });

  it('removeToast should manually remove a toast by id', () => {
    addToast('Message 1', 'info', 5000);
    addToast('Message 2', 'error', 5000);

    expect(toastState.toasts.length).toBe(2);

    const idToRemove = toastState.toasts[0].id;
    removeToast(idToRemove);

    expect(toastState.toasts.length).toBe(1);
    expect(toastState.toasts[0].message).toBe('Message 2');

    // Removing an invalid id should do nothing
    removeToast('invalid-id');
    expect(toastState.toasts.length).toBe(1);
  });
});
