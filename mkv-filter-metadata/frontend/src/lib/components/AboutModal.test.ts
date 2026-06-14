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
    render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    expect(screen.getByText('About MKV Filter Metadata')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
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

  it('toggles theme correctly', async () => {
    render(AboutModal, { props: { show: true, onClose: vi.fn() } });

    appState.isDarkMode = true;
    const themeBtn = screen.getByRole('button', { name: /toggle color display theme/i });
    expect(themeBtn.textContent).toContain('☀️');

    await fireEvent.click(themeBtn);
    expect(appState.isDarkMode).toBe(false);
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

  it('formats timeAgo for 1 day', () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000 + 1000;
    vi.stubGlobal('__BUILD_DATE__', new Date(Date.now() - ONE_DAY_MS).toISOString());
    render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    expect(screen.getByText(/1 day ago/)).toBeInTheDocument();
  });

  it('formats timeAgo for multiple days', () => {
    const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000 + 1000;
    vi.stubGlobal('__BUILD_DATE__', new Date(Date.now() - FIVE_DAYS_MS).toISOString());
    render(AboutModal, { props: { show: true, onClose: vi.fn() } });
    expect(screen.getByText(/5 days ago/)).toBeInTheDocument();
  });
});
