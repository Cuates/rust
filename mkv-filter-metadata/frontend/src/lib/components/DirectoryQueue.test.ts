import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import DirectoryQueue from './DirectoryQueue.svelte';
import { config } from '$lib/stores/config.svelte';
import { pipeline } from '$lib/stores/pipeline.svelte';
import { addToast } from '$lib/stores/toast.svelte';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
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
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Cannot open folder'));

    render(DirectoryQueue);

    const openBtns = screen.getAllByLabelText('Open processed files folder');
    await fireEvent.click(openBtns[0]);

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('Failed to open folder:'),
      'error'
    );
  });

  it('handles external drop', () => {
    config.input_directories = ['/existing/folder'];
    const { component } = render(DirectoryQueue);

    component.handleDragDrop(['/dropped/folder', '/existing/folder']);
    expect(config.input_directories).toContain('/dropped/folder');
    expect(config.input_directories.length).toBe(2);
  });

  it('shows processing status and handles dragging flags', () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'processing';

    render(DirectoryQueue);
    expect(screen.getByTitle('Processing...')).toBeInTheDocument();
  });

  it('renders done with errors status', () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'done';
    pipeline.directoryErrors['/folder1'] = true;

    render(DirectoryQueue);
    expect(screen.getByTitle('Finished with warnings or errors')).toBeInTheDocument();
  });

  it('renders skipped missing status', () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'skipped';
    pipeline.directoryStats['/folder1'] = { exists: false } as import('../types').DirStats;
    pipeline.hasProcessClicked = true;

    render(DirectoryQueue);
    expect(screen.getByTitle('Skipped (Directory does not exist)')).toBeInTheDocument();
  });

  it('renders skipped empty status', () => {
    config.input_directories = ['/folder1'];
    pipeline.directoryStatuses['/folder1'] = 'skipped';
    pipeline.directoryStats['/folder1'] = { exists: true } as import('../types').DirStats;

    render(DirectoryQueue);
    expect(screen.getByTitle('Skipped (Directory is empty)')).toBeInTheDocument();
  });

  it('handles drag events for queue container', async () => {
    const { container } = render(DirectoryQueue);
    const box = container.querySelector('#queue-box') as HTMLElement;

    await fireEvent.dragOver(box);
    // Reactivity takes a moment, we can verify it doesn't crash.
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

    // Move pointer down enough to swap with the next item (ITEM_HEIGHT is 36)
    component.handleGlobalPointerMove({ clientY: 140 } as PointerEvent);

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

    // Start dragging
    await fireEvent.pointerDown(items[0], { clientY: 150 });

    // Pointer move below the top boundary threshold (auto scroll up)
    component.handleGlobalPointerMove({ clientY: 105 } as PointerEvent);

    // Pointer move above the bottom boundary threshold (auto scroll down)
    component.handleGlobalPointerMove({ clientY: 260 } as PointerEvent);

    // Pointer move beyond bounding box
    component.handleGlobalPointerMove({ clientY: 50 } as PointerEvent); // clamped to rect.top
    component.handleGlobalPointerMove({ clientY: 300 } as PointerEvent); // clamped to rect.bottom

    component.handleGlobalPointerUp();
  });

  it('renders non-issue tooltip for existing directory', () => {
    config.input_directories = ['/folder1'];
    pipeline.hasProcessClicked = true;
    pipeline.directoryStats['/folder1'] = {
      exists: true,
      file_count: 5,
      total_size_bytes: 500000,
      files: []
    } as import('../types').DirStats;

    const { container } = render(DirectoryQueue);

    // An info-circle without the "issue" class should be rendered
    const infoCircle = container.querySelector('.info-circle:not(.issue)');
    expect(infoCircle).toBeInTheDocument();
  });
});
