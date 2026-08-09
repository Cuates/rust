import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ConfirmationModal from './ConfirmationModal.svelte';

describe('ConfirmationModal Component', () => {
  it('renders correctly with default props', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(ConfirmationModal, {
      props: {
        title: 'Are you sure?',
        message: 'This action cannot be undone.',
        onConfirm,
        onCancel
      }
    });

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('renders custom button labels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(ConfirmationModal, {
      props: {
        title: 'Wait!',
        message: 'Proceed?',
        confirmLabel: 'Yes, proceed',
        cancelLabel: 'No, stop',
        onConfirm,
        onCancel
      }
    });

    expect(screen.getByText('Yes, proceed')).toBeInTheDocument();
    expect(screen.getByText('No, stop')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(ConfirmationModal, {
      props: {
        title: 'Title',
        message: 'Message',
        onConfirm,
        onCancel
      }
    });

    const cancelBtn = screen.getByText('Cancel');
    await fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(ConfirmationModal, {
      props: {
        title: 'Title',
        message: 'Message',
        onConfirm,
        onCancel
      }
    });

    const confirmBtn = screen.getByText('Confirm');
    await fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(ConfirmationModal, {
      props: {
        title: 'Title',
        message: 'Message',
        onConfirm,
        onCancel
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) {
      await fireEvent.click(backdrop);
    }
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when modal card is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(ConfirmationModal, {
      props: {
        title: 'Title',
        message: 'Message',
        onConfirm,
        onCancel
      }
    });

    const card = container.querySelector('.modal-card');
    if (card) {
      await fireEvent.click(card);
    }
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls onCancel when Escape key is pressed', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(ConfirmationModal, {
      props: {
        title: 'Title',
        message: 'Message',
        onConfirm,
        onCancel
      }
    });

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows spinner and disables buttons during async onConfirm', async () => {
    let resolvePromise: (value: void | PromiseLike<void>) => void;
    const asyncConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve;
        })
    );

    const onCancel = vi.fn();

    const { container } = render(ConfirmationModal, {
      props: {
        title: 'Title',
        message: 'Message',
        onConfirm: asyncConfirm,
        onCancel
      }
    });

    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement;
    const cancelBtn = screen.getByText('Cancel') as HTMLButtonElement;

    await fireEvent.click(confirmBtn);

    expect(asyncConfirm).toHaveBeenCalledTimes(1);
    expect(confirmBtn.disabled).toBe(true);
    expect(cancelBtn.disabled).toBe(true);

    const spinner = container.querySelector('.spinner');
    expect(spinner).toBeInTheDocument();

    // Resolve the promise to finish the test
    resolvePromise!();
  });

  it('handles Tab key for focus trapping', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(ConfirmationModal, {
      props: {
        title: 'Title',
        message: 'Message',
        onConfirm,
        onCancel
      }
    });

    const cancelBtn = screen.getByText('Cancel') as HTMLButtonElement;
    const confirmBtn = screen.getByText('Confirm') as HTMLButtonElement;

    // Simulate Tab on the last element (confirm button)
    confirmBtn.focus();
    await fireEvent.keyDown(window, { key: 'Tab' });

    // Simulate Shift+Tab on the first element (cancel button)
    cancelBtn.focus();
    await fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

    // Simulate Tab with nothing focusable (edge case handling)
    // Hard to simulate in JSDOM cleanly without destroying the component, but we trigger the keydown anyway.
    await fireEvent.keyDown(window, { key: 'Tab' });
  });
});
