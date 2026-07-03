import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerCommand,
  unregisterCommand,
  filterCommands,
  __resetCommands
} from './commands.svelte';

describe('commands.svelte', () => {
  beforeEach(() => {
    __resetCommands();
  });

  it('registers and unregisters commands', () => {
    const cmd = { id: 'test-1', label: 'Test', enabled: () => true, action: () => {} };
    registerCommand(cmd);

    expect(filterCommands('')).toHaveLength(1);

    unregisterCommand('test-1');
    expect(filterCommands('')).toHaveLength(0);
  });

  it('overwrites existing command on register', () => {
    const cmd1 = { id: 'test-1', label: 'Test 1', enabled: () => true, action: () => {} };
    registerCommand(cmd1);

    const cmd2 = { id: 'test-1', label: 'Test 2', enabled: () => true, action: () => {} };
    registerCommand(cmd2); // same ID

    const cmds = filterCommands('');
    expect(cmds).toHaveLength(1);
    expect(cmds[0].label).toBe('Test 2');
  });

  it('ignores unregistering non-existent command', () => {
    unregisterCommand('does-not-exist');
    expect(filterCommands('')).toHaveLength(0);
  });
});
