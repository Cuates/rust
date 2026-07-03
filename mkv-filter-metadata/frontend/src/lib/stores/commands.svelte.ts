export interface AppCommand {
  /** Unique identifier used to look up the command at the page level. */
  id: string;
  /** Display label shown in the palette. */
  label: string;
  /** Optional hint shown on the right (e.g. "Shift+Enter"). */
  shortcutHint?: string;
  /**
   * Returns true when this command is currently available.
   * Disabled commands are shown greyed-out and cannot be selected.
   */
  enabled: () => boolean;
  /** Function to execute when this command is selected. */
  action: () => void;
}

/** Global state for the Command Palette UI */
export const paletteState = $state({ isOpen: false });

/**
 * Global command registry.
 * Components self-register commands here.
 */
const commandRegistry = $state<AppCommand[]>([]);

import { untrack } from 'svelte';

export function registerCommand(command: AppCommand): void {
  untrack(() => {
    const existing = commandRegistry.findIndex((c) => c.id === command.id);
    if (existing >= 0) {
      commandRegistry.splice(existing, 1, command);
    } else {
      commandRegistry.push(command);
    }
  });
}

export function unregisterCommand(id: string): void {
  untrack(() => {
    const index = commandRegistry.findIndex((c) => c.id === id);
    if (index >= 0) {
      commandRegistry.splice(index, 1);
    }
  });
}

/**
 * Returns commands whose label includes the query (case-insensitive substring match).
 * All commands are returned when query is empty.
 */
export function filterCommands(query: string): AppCommand[] {
  if (!query.trim()) return commandRegistry.slice();
  const q = query.trim().toLowerCase();
  return commandRegistry.filter((c) => c.label.toLowerCase().includes(q));
}

/** Testing utility */
export function __resetCommands(): void {
  commandRegistry.splice(0, commandRegistry.length);
}
