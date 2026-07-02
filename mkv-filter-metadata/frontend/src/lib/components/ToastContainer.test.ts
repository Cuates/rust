import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ToastContainer from './ToastContainer.svelte';
import { toastState, addToast } from '$lib/stores/toast.svelte';

describe('ToastContainer.svelte', () => {
  beforeEach(() => {
    toastState.toasts = [];
  });

  it('renders no toasts initially', () => {
    const { container } = render(ToastContainer);
    expect(container.querySelectorAll('.toast').length).toBe(0);
  });

  it('renders toasts from store', async () => {
    addToast('Test Message 1', 'success');
    addToast('Test Message 2', 'error');
    addToast('Test Message 3', 'warning');

    const { container } = render(ToastContainer);

    expect(screen.getByText('Test Message 1')).toBeInTheDocument();
    expect(screen.getByText('Test Message 2')).toBeInTheDocument();
    expect(screen.getByText('Test Message 3')).toBeInTheDocument();
    expect(container.querySelectorAll('.toast').length).toBe(3);
    expect(container.querySelectorAll('.toast-success').length).toBe(1);
    expect(container.querySelectorAll('.toast-error').length).toBe(1);
    expect(container.querySelectorAll('.toast-warning').length).toBe(1);
  });

  it('removes toast when close button is clicked', async () => {
    addToast('Test Message To Close', 'info');

    render(ToastContainer);

    expect(screen.getByText('Test Message To Close')).toBeInTheDocument();
    const closeBtns = screen.getAllByRole('button', { name: /close notification/i });

    await fireEvent.click(closeBtns[0]);

    expect(toastState.toasts.length).toBe(0);
  });
});
