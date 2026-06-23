import { describe, it, expect, vi } from 'vitest';
import { matchesShortcut, registerShortcut, handleKeydown, isConflict } from './shortcuts.svelte';

describe('shortcuts.svelte.ts', () => {
  it('matchesShortcut parses and matches keyboard events', () => {
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      altKey: true,
      ctrlKey: false,
      shiftKey: false
    });

    expect(matchesShortcut(event, 'Alt+ArrowUp')).toBe(true);
    expect(matchesShortcut(event, 'Ctrl+ArrowUp')).toBe(false);
    expect(matchesShortcut(event, 'Alt+ArrowDown')).toBe(false);
  });

  it('registers, triggers, and unregisters shortcuts via handleKeydown', () => {
    const actionMock = vi.fn();
    const unregister = registerShortcut({
      id: 'testAction',
      pattern: 'Ctrl+Shift+o',
      action: actionMock
    });

    // Valid trigger
    const event1 = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      shiftKey: true
    });
    // Need to mock target to bypass input check
    Object.defineProperty(event1, 'target', { value: document.createElement('div') });
    handleKeydown(event1);

    expect(actionMock).toHaveBeenCalledTimes(1);

    // Unregister and try again
    unregister();

    const event2 = new KeyboardEvent('keydown', {
      key: 'o',
      ctrlKey: true,
      shiftKey: true
    });
    Object.defineProperty(event2, 'target', { value: document.createElement('div') });
    handleKeydown(event2);

    expect(actionMock).toHaveBeenCalledTimes(1); // Still 1
  });

  it('skips handleKeydown inside inputs unless id is shortcut-capture-input', () => {
    const actionMock = vi.fn();
    registerShortcut({
      id: 'testInput',
      pattern: 'Ctrl+s',
      action: actionMock
    });

    const event = new KeyboardEvent('keydown', {
      key: 's',
      ctrlKey: true
    });

    // Target is an input
    const inputEl = document.createElement('input');
    Object.defineProperty(event, 'target', { value: inputEl });

    handleKeydown(event);
    expect(actionMock).not.toHaveBeenCalled();

    // Target is shortcut-capture-input
    inputEl.id = 'shortcut-capture-input';
    handleKeydown(event);
    expect(actionMock).toHaveBeenCalledTimes(1);
  });

  it('identifies shortcut conflicts', () => {
    registerShortcut({
      id: 'existingAction',
      pattern: 'Alt+k',
      action: vi.fn()
    });

    expect(isConflict('Alt+k')).toBe(true);
    expect(isConflict('Alt+K')).toBe(true); // case insensitive match
    expect(isConflict('Alt+k', 'existingAction')).toBe(false); // ignores itself
    expect(isConflict('Ctrl+k')).toBe(false);
  });
});
