import { describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ToastContainer from './ToastContainer.svelte';
import { toast, clearToasts } from '$lib/stores/toast.svelte';

describe('ToastContainer Component', () => {
  beforeEach(() => {
    clearToasts();
  });

  it('renders without any toasts initially', () => {
    const { container } = render(ToastContainer);
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('renders a toast when added', async () => {
    render(ToastContainer);

    toast.info('Hello world', 0); // 0 duration to prevent auto-removal during test

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
  });

  it('can close a toast by clicking the close button', async () => {
    render(ToastContainer);

    toast.error('An error occurred', 0);

    await waitFor(() => {
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });

    const closeBtn = screen.getByLabelText('Dismiss notification');
    await fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('An error occurred')).not.toBeInTheDocument();
    });
  });

  it('renders different types of toasts with correct classes', async () => {
    render(ToastContainer);

    toast.success('Success message', 0);
    toast.warning('Warning message', 0);

    await waitFor(() => {
      const successToast = screen.getByText('Success message').closest('.toast');
      expect(successToast?.classList.contains('toast-success')).toBe(true);

      const warningToast = screen.getByText('Warning message').closest('.toast');
      expect(warningToast?.classList.contains('toast-warning')).toBe(true);
    });
  });

  it('automatically removes a toast after duration', async () => {
    render(ToastContainer);

    // A duration of 50ms
    toast.info('Auto dismiss me', 50);

    await waitFor(() => {
      expect(screen.getByText('Auto dismiss me')).toBeInTheDocument();
    });

    await waitFor(
      () => {
        expect(screen.queryByText('Auto dismiss me')).not.toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
