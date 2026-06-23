/**
 * Keyboard shortcut definitions and event routing.
 * Shortcuts are registered in +layout.svelte and removed on destroy.
 */

export interface Shortcut {
  id: string; // Action ID (e.g., 'addFolder')
  pattern: string; // The user-defined string like "Ctrl+O" or "Escape"
  action: () => void | Promise<void>;
}

const registry: Shortcut[] = [];

// Helper to parse "Ctrl+Shift+X"
function parseShortcutPattern(pattern: string) {
  const parts = pattern.toLowerCase().split('+');
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts[parts.length - 1]
  };
}

export function matchesShortcut(event: KeyboardEvent, pattern: string): boolean {
  const parsed = parseShortcutPattern(pattern);
  const keyMatch =
    event.key.toLowerCase() === parsed.key || event.code.toLowerCase() === parsed.key;
  const ctrlMatch = parsed.ctrl === event.ctrlKey;
  const shiftMatch = parsed.shift === event.shiftKey;
  const altMatch = parsed.alt === event.altKey;
  return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

export function registerShortcut(shortcut: Shortcut): () => void {
  registry.push(shortcut);
  return () => {
    const idx = registry.indexOf(shortcut);
    if (idx !== -1) registry.splice(idx, 1);
  };
}

export function handleKeydown(event: KeyboardEvent): void {
  // Skip when focus is inside an input, textarea, or select.
  const target = event.target as HTMLElement;
  if (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) &&
    target.id !== 'shortcut-capture-input'
  )
    return;

  for (const shortcut of registry) {
    if (matchesShortcut(event, shortcut.pattern)) {
      event.preventDefault();
      void shortcut.action();
      return;
    }
  }
}

export function isConflict(newPattern: string, ignoreId?: string): boolean {
  // Check against our registry based on the parsed version to normalize text.
  const n = parseShortcutPattern(newPattern);
  for (const shortcut of registry) {
    if (shortcut.id === ignoreId) continue;
    const e = parseShortcutPattern(shortcut.pattern);
    if (e.key === n.key && e.ctrl === n.ctrl && e.shift === n.shift && e.alt === n.alt) {
      return true;
    }
  }
  return false;
}
