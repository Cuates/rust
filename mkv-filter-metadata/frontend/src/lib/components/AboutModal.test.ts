import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import AboutModal from './AboutModal.svelte';
import { appState } from '$lib/stores/config.svelte';
import { openUrl } from '@tauri-apps/plugin-opener';

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn()
}));

// mock vite defines just in case
vi.stubGlobal('__BUILD_DATE__', new Date().toISOString());
vi.stubGlobal('__APP_VERSION__', '1.0.0');
vi.stubGlobal('__COMMIT_HASH__', 'abcdef');
vi.stubGlobal('__TAURI_VERSION__', '2.0.0');
vi.stubGlobal('__SVELTE_VERSION__', '5.0.0');
vi.stubGlobal('__NODE_VERSION__', 'v20.0.0');

describe('AboutModal.svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when show is false', () => {
    const { container } = render(AboutModal, { props: { show: false, onClose: vi.fn() } });
    expect(container.querySelector('.modal-backdrop')).toBeNull();
  });

  it('renders correctly when show is true', () => {
    appState.ffmpegVersion = '';
    appState.ffprobeVersion = '';
    appState.mkvmergeVersion = '';

    render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    expect(screen.getByText('About MKV Filter Metadata')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();

    // Check loading state
    const loadingElements = screen.getAllByText('Loading...');
    expect(loadingElements.length).toBe(3);
  });

  it('renders loaded versions correctly', () => {
    appState.ffmpegVersion = 'v7.0.1';
    appState.ffprobeVersion = 'v7.0.1';
    appState.mkvmergeVersion = 'v86.0';

    render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    const v701Elements = screen.getAllByText('v7.0.1', { exact: false });
    expect(v701Elements.length).toBeGreaterThan(0);
    expect(screen.getByText('v86.0', { exact: false })).toBeInTheDocument();
  });

  it('calls onClose when backdrop or close button is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(AboutModal, { props: { show: true, onClose } });

    const closeBtn = screen.getByText('Close');
    await fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) {
      await fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(2);
    }
  });

  it('prevents event propagation when clicking modal card', async () => {
    const onClose = vi.fn();
    const { container } = render(AboutModal, { props: { show: true, onClose } });
    const card = container.querySelector('.modal-card');
    if (card) {
      await fireEvent.click(card);
      expect(onClose).not.toHaveBeenCalled();
    }
  });

  it('opens external links and handles errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(AboutModal, { props: { show: true, onClose: vi.fn() } });

    const githubLink = screen.getByText('GitHub Repository');
    await fireEvent.click(githubLink);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('Cuates/rust'));

    const changelogLink = screen.getByText('Changelog');
    await fireEvent.click(changelogLink);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('CHANGELOG.md'));

    const licenseLink = screen.getByText('MIT License');
    await fireEvent.click(licenseLink);
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('LICENSE'));

    vi.mocked(openUrl).mockRejectedValueOnce(new Error('Browser failed'));
    await fireEvent.click(githubLink);
    expect(consoleError).toHaveBeenCalledWith('Failed to open external URL:', expect.any(Error));

    consoleError.mockRestore();
  });

  it('hides logo on error', async () => {
    const { container } = render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    const img = container.querySelector('.app-logo') as HTMLImageElement;
    expect(img).not.toBeNull();
    await fireEvent.error(img);
    expect(img.style.display).toBe('none');
  });

  it('closes modal on Escape key', async () => {
    const onClose = vi.fn();
    const { container } = render(AboutModal, { props: { show: true, onClose } });
    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) {
      await fireEvent.keyDown(backdrop, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('traps focus on Tab key', async () => {
    const { container } = render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    const backdrop = container.querySelector('.modal-backdrop');
    const focusableElements = backdrop?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    if (backdrop && focusableElements && focusableElements.length > 0) {
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Simulate focus on the last element and press Tab
      lastElement.focus();
      expect(document.activeElement).toBe(lastElement);

      const preventDefault = vi.fn();
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: false, preventDefault });

      expect(document.activeElement).toBe(firstElement);
    }
  });

  it('traps focus on Shift+Tab key', async () => {
    const { container } = render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    const backdrop = container.querySelector('.modal-backdrop');
    const focusableElements = backdrop?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    if (backdrop && focusableElements && focusableElements.length > 0) {
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Simulate focus on the first element and press Shift+Tab
      firstElement.focus();
      expect(document.activeElement).toBe(firstElement);

      const preventDefault = vi.fn();
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: true, preventDefault });

      expect(document.activeElement).toBe(lastElement);
    }
  });

  it('ignores irrelevant key presses during focus trap', async () => {
    const onClose = vi.fn();
    const { container } = render(AboutModal, { props: { show: true, onClose } });
    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) {
      const preventDefault = vi.fn();
      await fireEvent.keyDown(backdrop, { key: 'A', preventDefault });
      expect(onClose).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });

  it('automatically focuses the close button after a tick', async () => {
    vi.useFakeTimers();
    render(AboutModal, { props: { show: true, onClose: vi.fn() } });

    vi.runAllTimers();
    vi.useRealTimers();

    const closeBtn = screen.getByText('Close');
    expect(document.activeElement).toBe(closeBtn);
  });

  it('returns early from focus trap if no focusable elements exist', async () => {
    const { container } = render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    const backdrop = container.querySelector('.modal-backdrop');
    if (backdrop) {
      // Mock querySelectorAll to return an empty array
      const originalQuerySelectorAll = backdrop.querySelectorAll.bind(backdrop);
      backdrop.querySelectorAll = vi.fn().mockReturnValue({ length: 0 });

      const preventDefault = vi.fn();
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: false, preventDefault });

      expect(preventDefault).not.toHaveBeenCalled();

      // Restore
      backdrop.querySelectorAll = originalQuerySelectorAll;
    }
  });

  it('does not prevent default on Tab when active element is not the last element', async () => {
    const { container } = render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    const backdrop = container.querySelector('.modal-backdrop');
    const focusableElements = backdrop?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    if (backdrop && focusableElements && focusableElements.length > 1) {
      const firstElement = focusableElements[0];

      // Simulate focus on the first element and press Tab (not the last element)
      firstElement.focus();
      expect(document.activeElement).toBe(firstElement);

      const preventDefault = vi.fn();
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: false, preventDefault });

      expect(preventDefault).not.toHaveBeenCalled();
    }
  });

  it('does not prevent default on Shift+Tab when active element is not the first element', async () => {
    const { container } = render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    const backdrop = container.querySelector('.modal-backdrop');
    const focusableElements = backdrop?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );

    if (backdrop && focusableElements && focusableElements.length > 1) {
      const lastElement = focusableElements[focusableElements.length - 1];

      // Simulate focus on the last element and press Shift+Tab (not the first element)
      lastElement.focus();
      expect(document.activeElement).toBe(lastElement);

      const preventDefault = vi.fn();
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: true, preventDefault });

      expect(preventDefault).not.toHaveBeenCalled();
    }
  });
});
