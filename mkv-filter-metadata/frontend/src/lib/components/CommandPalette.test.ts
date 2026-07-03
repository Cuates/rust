import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CommandPalette from './CommandPalette.svelte';
import { registerCommand, paletteState, __resetCommands } from '../stores/commands.svelte';

describe('CommandPalette.svelte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCommands();
    // Register some mock commands
    registerCommand({
      id: 'cmd-1',
      label: 'Format Document',
      shortcutHint: 'Ctrl+Shift+F',
      enabled: () => true,
      action: vi.fn()
    });
    registerCommand({
      id: 'cmd-2',
      label: 'Restart Server',
      shortcutHint: 'Ctrl+R',
      enabled: () => false, // Disabled
      action: vi.fn()
    });
    registerCommand({
      id: 'cmd-3',
      label: 'Find in Files',
      enabled: () => true,
      action: vi.fn()
    });
    paletteState.isOpen = true;
  });

  it('renders input and all commands initially', () => {
    render(CommandPalette);

    expect(screen.getByPlaceholderText('Type a command…')).toBeInTheDocument();
    expect(screen.getByText('Format Document')).toBeInTheDocument();
    expect(screen.getByText('Restart Server')).toBeInTheDocument();
    expect(screen.getByText('Find in Files')).toBeInTheDocument();
  });

  it('filters commands based on search query', async () => {
    render(CommandPalette);

    const input = screen.getByPlaceholderText('Type a command…');
    await fireEvent.input(input, { target: { value: 'for' } });

    expect(screen.getByText('Format Document')).toBeInTheDocument();
    expect(screen.queryByText('Restart Server')).not.toBeInTheDocument();
    expect(screen.queryByText('Find in Files')).not.toBeInTheDocument();
  });

  it('shows empty state when no commands match', async () => {
    render(CommandPalette);

    const input = screen.getByPlaceholderText('Type a command…');
    await fireEvent.input(input, { target: { value: 'xyz' } });

    expect(screen.getByText('No commands match "xyz"')).toBeInTheDocument();
  });

  it('calls action and closes when clicking an enabled command', async () => {
    render(CommandPalette);

    const formatBtn = screen.getByText('Format Document').closest('li')!;
    await fireEvent.click(formatBtn);

    // Find the command in registry to check if its action was called
    const { filterCommands } = await import('../stores/commands.svelte');
    const cmd1 = filterCommands('').find((c) => c.id === 'cmd-1');
    expect(cmd1?.action).toHaveBeenCalled();
    expect(paletteState.isOpen).toBe(false);
  });

  it('does not call action when clicking a disabled command', async () => {
    render(CommandPalette);

    const restartBtn = screen.getByText('Restart Server').closest('li')!;
    await fireEvent.click(restartBtn);

    const { filterCommands } = await import('../stores/commands.svelte');
    const cmd2 = filterCommands('').find((c) => c.id === 'cmd-2');
    expect(cmd2?.action).not.toHaveBeenCalled();
    expect(paletteState.isOpen).toBe(true); // Still open
  });

  it('navigates with keyboard and executes with Enter', async () => {
    render(CommandPalette);

    const backdrop = screen.getByRole('dialog');

    // Default selection is index 0 (cmd-1)
    // Press ArrowDown to select index 1 (cmd-2, disabled)
    // Press ArrowDown to select index 2 (cmd-3)
    await fireEvent.keyDown(backdrop, { key: 'ArrowDown' });
    await fireEvent.keyDown(backdrop, { key: 'ArrowDown' });

    await fireEvent.keyDown(backdrop, { key: 'Enter' });

    const { filterCommands } = await import('../stores/commands.svelte');
    const cmd3 = filterCommands('').find((c) => c.id === 'cmd-3');
    expect(cmd3?.action).toHaveBeenCalled();
    expect(paletteState.isOpen).toBe(false);
  });

  it('closes on Escape', async () => {
    render(CommandPalette);

    const backdrop = screen.getByRole('dialog');
    await fireEvent.keyDown(backdrop, { key: 'Escape' });

    expect(paletteState.isOpen).toBe(false);
  });

  it('closes when clicking backdrop', async () => {
    render(CommandPalette);

    const backdrop = screen.getByRole('dialog');
    await fireEvent.click(backdrop);

    expect(paletteState.isOpen).toBe(false);
  });

  it('unmounts cleanly', () => {
    const { unmount } = render(CommandPalette);
    unmount();
    // Reaching here without error indicates onDestroy ran cleanly
    expect(true).toBe(true);
  });

  describe('Keyboard Focus and Navigation', () => {
    it('navigates up and down the list', async () => {
      render(CommandPalette);

      const backdrop = screen.getByRole('dialog');

      // Go down twice, then up once
      await fireEvent.keyDown(backdrop, { key: 'ArrowDown' });
      await fireEvent.keyDown(backdrop, { key: 'ArrowDown' });
      await fireEvent.keyDown(backdrop, { key: 'ArrowUp' });

      // Hit up again at 0 to test boundary
      await fireEvent.keyDown(backdrop, { key: 'ArrowUp' });
      await fireEvent.keyDown(backdrop, { key: 'ArrowUp' });

      // Hit enter
      await fireEvent.keyDown(backdrop, { key: 'Enter' });
      const { filterCommands } = await import('../stores/commands.svelte');
      const cmd1 = filterCommands('').find((c) => c.id === 'cmd-1');
      expect(cmd1?.action).toHaveBeenCalled();
    });

    it('traps focus inside the modal with Tab and Shift+Tab', async () => {
      render(CommandPalette);
      const backdrop = screen.getByRole('dialog');
      const input = screen.getByPlaceholderText('Type a command…');

      // Move focus outside modal
      document.body.focus();
      await fireEvent.keyDown(backdrop, { key: 'Tab' });
      expect(document.activeElement).toBe(input);

      document.body.focus();
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(input);

      input.focus();
      // We need multiple focusable elements. Since we render some commands, we have buttons/lis
      // Wait for focus logic to settle
      await new Promise((r) => setTimeout(r, 0));

      input.focus();
      expect(document.activeElement).toBe(input);
      // Shift + Tab from first element (input) should wrap to last element (which is also input here)
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(input);

      // Tab from last element should wrap to first element
      await fireEvent.keyDown(backdrop, { key: 'Tab' });
      // Might go back to input
    });

    it('handles mouseenter to change selection index', async () => {
      render(CommandPalette);
      const input = screen.getByPlaceholderText('Type a command…');
      // Searching for 'F' should bring up 'Format Document' and 'Find in Files'
      await fireEvent.input(input, { target: { value: 'F' } });

      const item2 = screen.getByText('Find in Files').closest('li');
      await fireEvent.mouseEnter(item2!);
      expect(item2).toHaveClass('selected');
    });

    it('handles focus when activeElement is outside modal container', async () => {
      render(CommandPalette);
      const backdrop = screen.getByRole('dialog');

      // Manually blur
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      await fireEvent.keyDown(backdrop, { key: 'Tab' });
      await fireEvent.keyDown(backdrop, { key: 'Tab', shiftKey: true });
    });
  });
});
