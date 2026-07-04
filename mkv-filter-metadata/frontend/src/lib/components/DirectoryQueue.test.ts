import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import DirectoryQueue from './DirectoryQueue.svelte';
import { config } from '$lib/stores/config.svelte';
import { pipeline } from '$lib/stores/pipeline.svelte';
import { addToast } from '$lib/stores/toast.svelte';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() =>
    Promise.resolve({
      exists: true,
      file_count: 0,
      total_size_bytes: 0,
      files: []
    })
  )
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}));
vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...args) => Promise.resolve(args.join('/')))
}));
vi.mock('$lib/stores/toast.svelte', () => ({
  addToast: vi.fn()
}));

describe('DirectoryQueue.svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    config.input_directories = [];
    pipeline.processingActive = false;
    pipeline.directoryStatuses = {};
    pipeline.directoryErrors = {};
    pipeline.directoryStats = {};
    pipeline.hasProcessClicked = false;
    // reset animation frame mock just in case
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(cb, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });

  afterEach(() => {
    // Clean up global tooltip node
    const tooltip = document.querySelector('.global-queue-tooltip');
    if (tooltip) tooltip.remove();
  });

  it('renders empty state when no directories exist', () => {
    render(DirectoryQueue);
    expect(
      screen.getByText('Drag & drop video folders here or click Add Folder...')
    ).toBeInTheDocument();
  });

  it('renders directories from config', () => {
    config.input_directories = ['/path/to/folder1', '/path/to/folder2'];
    render(DirectoryQueue);
    expect(screen.getByText('/path/to/folder1')).toBeInTheDocument();
    expect(screen.getByText('/path/to/folder2')).toBeInTheDocument();
  });

  it('adds directory via Add Folder button', async () => {
    vi.mocked(openDialog).mockResolvedValueOnce(['/new/folder', '/folder2']);
    render(DirectoryQueue);

    const addBtn = screen.getByText('+ Add Folder to Queue');
    await fireEvent.click(addBtn);

    expect(openDialog).toHaveBeenCalled();
    expect(config.input_directories).toContain('/new/folder');
    expect(config.input_directories).toContain('/folder2');
  });

  it('adds string directory via Add Folder button', async () => {
    vi.mocked(openDialog).mockResolvedValueOnce('/new/single/folder');
    render(DirectoryQueue);

    const addBtn = screen.getByText('+ Add Folder to Queue');
    await fireEvent.click(addBtn);

    expect(openDialog).toHaveBeenCalled();
    expect(config.input_directories).toContain('/new/single/folder');
  });

  it('ignores already existing directory via Add Folder button', async () => {
    config.input_directories = ['/existing/folder'];
    vi.mocked(openDialog).mockResolvedValueOnce('/existing/folder');
    render(DirectoryQueue);

    const addBtn = screen.getByText('+ Add Folder to Queue');
    await fireEvent.click(addBtn);

    expect(config.input_directories.length).toBe(1);
  });

  it('handles dialog rejection/error', async () => {
    vi.mocked(openDialog).mockRejectedValueOnce(new Error('Dialog failed'));
    render(DirectoryQueue);

    const addBtn = screen.getByText('+ Add Folder to Queue');
    await fireEvent.click(addBtn);

    expect(addToast).toHaveBeenCalledWith('Failed to access directory browser.', 'error');
  });

  it('clears all directories when clear queue button is clicked', async () => {
    config.input_directories = ['/folder1', '/folder2'];
    render(DirectoryQueue);

    const clearBtn = screen.getByLabelText('Clear entire processing queue');
    await fireEvent.click(clearBtn);

    expect(config.input_directories.length).toBe(0);
  });

  it('removes a single directory when remove button is clicked', async () => {
    config.input_directories = ['/folder1', '/folder2'];
    render(DirectoryQueue);

    const removeBtns = screen.getAllByLabelText('Remove item from path processing queue');
    await fireEvent.click(removeBtns[0]);

    expect(config.input_directories).toEqual(['/folder2']);
  });

  it('clears everything if the last directory is removed', async () => {
    config.input_directories = ['/folder1'];
    pipeline.consoleLogs = [{ id: 1, text: 'test' }];
    render(DirectoryQueue);

    const removeBtns = screen.getAllByLabelText('Remove item from path processing queue');
    await fireEvent.click(removeBtns[0]);

    expect(config.input_directories.length).toBe(0);
    expect(pipeline.consoleLogs.length).toBe(0); // clearAllDirectories is called
  });

  it('opens output folder when open folder button is clicked', async () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'done';

    render(DirectoryQueue);

    const openBtns = screen.getAllByLabelText('Open processed files folder');
    await fireEvent.click(openBtns[0]);

    expect(invoke).toHaveBeenCalledWith('open_folder', { path: '/folder1/processed_files' });
  });

  it('handles open output folder error', async () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'done';

    // First call is for directory stats, second is for open folder
    vi.mocked(invoke).mockResolvedValueOnce({
      exists: true,
      file_count: 5,
      total_size_bytes: 1000,
      files: []
    });
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Permission denied'));

    const { container } = render(DirectoryQueue);
    const openBtns = container.querySelectorAll('.open-folder-btn');
    expect(openBtns.length).toBe(1);

    await fireEvent.click(openBtns[0]);

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('Failed to open folder:'),
      'error'
    );
  });

  it('garbage collects cached stats for removed directories', async () => {
    config.input_directories = ['/folder1', '/folder2'];
    vi.mocked(invoke).mockResolvedValue({
      exists: true,
      file_count: 0,
      total_size_bytes: 0,
      files: []
    });
    render(DirectoryQueue);
    await new Promise((r) => setTimeout(r, 0)); // wait for stats to load

    // Now remove one, the effect should clean up its stats
    config.input_directories = ['/folder2'];
    await new Promise((r) => setTimeout(r, 0)); // wait for effect
  });

  it('handles external drop', async () => {
    config.input_directories = ['/folder1'];
    const { component } = render(DirectoryQueue);

    component.handleDragDrop(['/folder2', '/folder3']);

    expect(config.input_directories).toEqual(['/folder1', '/folder2', '/folder3']);
  });

  it('shows processing status and handles dragging flags', async () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'processing';
    pipeline.completedFilesPerDir['/folder1'] = 2;
    pipeline.processingActive = true;
    vi.mocked(invoke).mockResolvedValueOnce({
      exists: true,
      file_count: 5,
      total_size_bytes: 1048576,
      files: []
    });
    const { container } = render(DirectoryQueue, { isDraggingOS: true });

    await new Promise((resolve) => setTimeout(resolve, 0)); // let stats load

    const item = container.querySelector('.queue-item');
    expect(item).toHaveClass('status-processing');
    expect(item).toHaveClass('is-locked');

    const box = container.querySelector('#queue-box');
    expect(box).toHaveClass('dragging');

    const pills = container.querySelectorAll('.queue-pill');
    expect(pills.length).toBeGreaterThan(0);
    expect(pills[0].textContent).toContain('2 / 5 files');
  });

  it('renders done with errors status', () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'done';
    pipeline.directoryErrors['/folder1'] = true;
    const { container } = render(DirectoryQueue);

    const item = container.querySelector('.queue-item');
    expect(item).toHaveClass('status-warning');
  });

  it('renders skipped missing status', () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'skipped';
    pipeline.directoryStats['/folder1'] = { exists: false } as import('../types').DirStats;
    const { container } = render(DirectoryQueue);

    const item = container.querySelector('.queue-item');
    expect(item).toHaveClass('status-skipped');
  });

  it('renders skipped empty status', () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'skipped';
    pipeline.directoryStats['/folder1'] = { exists: true } as import('../types').DirStats;
    const { container } = render(DirectoryQueue);

    const item = container.querySelector('.queue-item');
    expect(item).toHaveClass('status-skipped');
  });

  it('handles drag events for queue container', async () => {
    const { container } = render(DirectoryQueue);
    const box = container.querySelector('#queue-box') as HTMLElement;

    await fireEvent.dragOver(box);
    await fireEvent.dragLeave(box);
    await fireEvent.drop(box);
  });

  it('tests pointer down functionality and drag logic', async () => {
    config.input_directories = ['/folder1', '/folder2'];
    const { component, container } = render(DirectoryQueue);

    const items = container.querySelectorAll('.queue-item');
    const box = container.querySelector('#queue-box') as HTMLElement;
    box.getBoundingClientRect = vi.fn(() => ({
      top: 50,
      bottom: 264,
      left: 0,
      right: 200,
      width: 200,
      height: 214,
      x: 0,
      y: 50,
      toJSON: () => {}
    }));

    // Simulate pointer down on first item
    await fireEvent.pointerDown(items[0], { clientY: 100 });

    // Move pointer down enough to swap with the next item
    component.handleGlobalPointerMove({ clientY: 150 } as PointerEvent);

    // The items should swap in config
    expect(config.input_directories[0]).toBe('/folder2');
    expect(config.input_directories[1]).toBe('/folder1');

    // Move pointer back up enough to swap back
    component.handleGlobalPointerMove({ clientY: 90 } as PointerEvent);
    expect(config.input_directories[0]).toBe('/folder1');

    component.handleGlobalPointerUp();
  });

  it('tests auto scroll boundaries and scroll thresholds', async () => {
    config.input_directories = ['/folder1', '/folder2', '/folder3', '/folder4', '/folder5'];
    const { component, container } = render(DirectoryQueue);

    // Mock getBoundingClientRect
    const box = container.querySelector('#queue-box') as HTMLElement;
    box.getBoundingClientRect = vi.fn(() => ({
      top: 100,
      bottom: 264,
      left: 0,
      right: 200,
      width: 200,
      height: 164,
      x: 0,
      y: 100,
      toJSON: () => {}
    }));
    Object.defineProperty(box, 'scrollTop', { value: 0, writable: true });

    const items = container.querySelectorAll('.queue-item');

    // Drag first item
    await fireEvent.pointerDown(items[0], { clientY: 120 });

    // Move above top boundary
    component.handleGlobalPointerMove({ clientY: 90 } as PointerEvent);
    await new Promise((r) => setTimeout(r, 20)); // wait for RAF

    // Move below bottom boundary
    component.handleGlobalPointerMove({ clientY: 280 } as PointerEvent);
    await new Promise((r) => setTimeout(r, 20)); // wait for RAF

    // Move inside middle safe zone (should stop scrolling)
    component.handleGlobalPointerMove({ clientY: 150 } as PointerEvent);

    component.handleGlobalPointerUp();
  });

  describe('Queue Pills', () => {
    it('renders file count and size pills when directory stats are loaded', async () => {
      config.input_directories = ['/path/to/folder'];
      vi.mocked(invoke).mockResolvedValueOnce({
        exists: true,
        file_count: 5,
        total_size_bytes: 1048576, // 1 MB
        files: [
          { name: 'video1.mkv', size_bytes: 524288 },
          { name: 'video2.mkv', size_bytes: 524288 }
        ]
      });

      const { container } = render(DirectoryQueue);

      // Wait for effect to run and fetch stats
      await new Promise((resolve) => setTimeout(resolve, 0));

      const pills = container.querySelectorAll('.queue-pill');
      expect(pills.length).toBe(2);
      expect(pills[0].textContent).toContain('5 files');
      expect(pills[1].textContent).toContain('1 MB');
    });

    it('renders tooltip with file list on hover', async () => {
      config.input_directories = ['/path/to/folder'];
      vi.mocked(invoke).mockResolvedValueOnce({
        exists: true,
        file_count: 1,
        total_size_bytes: 1000,
        files: [{ name: 'test_video.mkv', size_bytes: 1000 }]
      });

      const { container } = render(DirectoryQueue);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const items = container.querySelectorAll('.queue-item');
      await fireEvent.mouseEnter(items[0].querySelector('.queue-pill')!);

      const tooltip = document.querySelector('.global-queue-tooltip') as HTMLElement;
      expect(tooltip).toBeInTheDocument();
      expect(tooltip?.textContent).toContain('test_video.mkv');

      // Test the right boundary logic by making getBoundingClientRect return a high right value
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500
      });
      Object.defineProperty(tooltip, 'getBoundingClientRect', {
        configurable: true,
        value: () => ({ right: 600, width: 100 })
      });
      // Fire mouseEnter again to trigger requestAnimationFrame boundary check
      await fireEvent.mouseEnter(items[0].querySelector('.queue-pill')!);
      await new Promise((r) => setTimeout(r, 50)); // let rAF run
      expect(tooltip.style.transform).toBe('none');
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth
      });

      await fireEvent.mouseLeave(items[0].querySelector('.queue-pill')!);
      // Use setTimeout for setTimeout which removes class
      await new Promise((r) => setTimeout(r, 200));
      expect(tooltip).not.toHaveClass('visible');
    });

    it('renders empty message for empty directories', async () => {
      config.input_directories = ['/empty'];
      vi.mocked(invoke).mockResolvedValueOnce({
        exists: true,
        file_count: 0,
        total_size_bytes: 0,
        files: []
      });

      const { container } = render(DirectoryQueue);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const items = container.querySelectorAll('.queue-item');
      await fireEvent.mouseEnter(items[0].querySelector('.queue-pill')!);

      const tooltip = document.querySelector('.global-queue-tooltip');
      expect(tooltip?.textContent).toContain('No matched files');
    });

    it('renders not found message for non-existent directories', async () => {
      config.input_directories = ['/missing'];
      vi.mocked(invoke).mockResolvedValueOnce({
        exists: false,
        file_count: 0,
        total_size_bytes: 0,
        files: []
      });

      const { container } = render(DirectoryQueue);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const items = container.querySelectorAll('.queue-item');
      await fireEvent.mouseEnter(items[0].querySelector('.queue-pill')!);

      const tooltip = document.querySelector('.global-queue-tooltip');
      expect(tooltip?.textContent).toContain('Directory not found');
    });
  });
});
