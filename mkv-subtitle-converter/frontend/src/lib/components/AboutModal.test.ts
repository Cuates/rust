import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AboutModal from './AboutModal.svelte';
import { appState } from '$lib/stores/config.svelte';
import * as opener from '@tauri-apps/plugin-opener';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn()
}));

vi.mock('$lib/stores/config.svelte', () => {
  const state = {
    ffmpegVersion: '6.0.0',
    ffprobeVersion: '6.0.0'
  };
  return {
    appState: new Proxy(state, {
      get: (target, prop) => target[prop as keyof typeof target],
      set: (target, prop, value) => {
        target[prop as keyof typeof target] = value;
        return true;
      }
    })
  };
});

describe('AboutModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appState.ffmpegVersion = '6.0.0';
    appState.ffprobeVersion = '6.0.0';
  });

  it('renders modal details correctly', () => {
    const onClose = vi.fn();
    render(AboutModal, {
      props: {
        onClose
      }
    });

    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('MKV Subtitle Extractor Converter')).toBeInTheDocument();
    expect(screen.getByText('Application Details')).toBeInTheDocument();
    expect(screen.getByText('Technology Stack')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(AboutModal, {
      props: {
        onClose
      }
    });

    const closeBtn = screen.getByLabelText('Close');
    await fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(AboutModal, {
      props: {
        onClose
      }
    });

    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) {
      await fireEvent.click(backdrop);
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal card is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(AboutModal, {
      props: {
        onClose
      }
    });

    const card = container.querySelector('.modal-card');
    if (card) {
      await fireEvent.click(card);
    }
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = vi.fn();
    render(AboutModal, {
      props: {
        onClose
      }
    });

    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens external URLs when links are clicked', async () => {
    const onClose = vi.fn();
    render(AboutModal, {
      props: {
        onClose
      }
    });

    const githubLink = screen.getByText('GitHub Repository');
    await fireEvent.click(githubLink);
    expect(opener.openUrl).toHaveBeenCalledWith(
      'https://github.com/Cuates/rust/tree/main/mkv-subtitle-converter'
    );

    const changelogLink = screen.getByText('Changelog');
    await fireEvent.click(changelogLink);
    expect(opener.openUrl).toHaveBeenCalledWith(
      'https://github.com/Cuates/rust/blob/main/mkv-subtitle-converter/CHANGELOG.md'
    );

    const licenseLink = screen.getByText('MIT License');
    await fireEvent.click(licenseLink);
    expect(opener.openUrl).toHaveBeenCalledWith(
      'https://github.com/Cuates/rust/blob/main/mkv-subtitle-converter/LICENSE'
    );
  });

  it('handles Tab key for focus trapping', async () => {
    const onClose = vi.fn();
    render(AboutModal, {
      props: {
        onClose
      }
    });

    const closeBtn = screen.getByLabelText('Close') as HTMLButtonElement;
    const firstFocusable = closeBtn;

    const changelogLink = screen.getByText('Changelog');

    // Simulate Shift+Tab on the first element
    firstFocusable.focus();
    await fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });

    // Simulate Tab on the last element
    changelogLink.focus();
    await fireEvent.keyDown(window, { key: 'Tab' });
  });
});
