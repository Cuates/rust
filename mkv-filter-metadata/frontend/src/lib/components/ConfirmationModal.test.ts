import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import ConfirmationModal from './ConfirmationModal.svelte';

describe('ConfirmationModal.svelte', () => {
  it('does not render when show is false', () => {
    const { container } = render(ConfirmationModal, {
      props: {
        show: false,
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(container.querySelector('.modal-backdrop')).toBeNull();
  });

  it('renders correctly when show is true', () => {
    render(ConfirmationModal, {
      props: {
        show: true,
        title: 'Delete Item',
        message: 'Do you really want to delete this?',
        confirmText: 'Yes, Delete',
        cancelText: 'No, Keep',
        onConfirm: vi.fn(),
        onCancel: vi.fn()
      }
    });
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Do you really want to delete this?')).toBeInTheDocument();
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('No, Keep')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(ConfirmationModal, {
      props: {
        show: true,
        onConfirm: vi.fn(),
        onCancel
      }
    });

    const cancelBtn = screen.getByText('Cancel');
    await fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(ConfirmationModal, {
      props: {
        show: true,
        onConfirm,
        onCancel: vi.fn()
      }
    });

    const confirmBtn = screen.getByRole('button', { name: 'Confirm' });
    await fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when backdrop is clicked', async () => {
    const onCancel = vi.fn();
    const { container } = render(ConfirmationModal, {
      props: {
        show: true,
        onConfirm: vi.fn(),
        onCancel
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    expect(backdrop).not.toBeNull();
    if (backdrop) {
      await fireEvent.click(backdrop);
      expect(onCancel).toHaveBeenCalledTimes(1);
    }
  });

  it('does not call onCancel when modal card is clicked', async () => {
    const onCancel = vi.fn();
    const { container } = render(ConfirmationModal, {
      props: {
        show: true,
        onConfirm: vi.fn(),
        onCancel
      }
    });

    const card = container.querySelector('.modal-card');
    expect(card).not.toBeNull();
    if (card) {
      await fireEvent.click(card);
      expect(onCancel).not.toHaveBeenCalled();
    }
  });
});
