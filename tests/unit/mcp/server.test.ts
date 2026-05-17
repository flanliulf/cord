import { afterEach, describe, expect, it, vi } from 'vitest';
import { installShutdownHandlers } from '../../../src/mcp/server.js';

interface FakeProcessLike {
  on(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): FakeProcessLike;
  off(event: NodeJS.Signals, listener: (signal: NodeJS.Signals) => void): FakeProcessLike;
  exit(code?: number): never;
  emit(event: NodeJS.Signals): void;
  listenerCount(event: NodeJS.Signals): number;
}

function createFakeProcess(): FakeProcessLike {
  const listeners = new Map<NodeJS.Signals, Array<(signal: NodeJS.Signals) => void>>();

  return {
    on(event, listener) {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      return this;
    },
    off(event, listener) {
      listeners.set(event, (listeners.get(event) ?? []).filter((item) => item !== listener));
      return this;
    },
    exit(): never {
      throw new Error('exit should not be called directly in tests');
    },
    emit(event) {
      for (const listener of listeners.get(event) ?? []) {
        listener(event);
      }
    },
    listenerCount(event) {
      return (listeners.get(event) ?? []).length;
    },
  };
}

describe('installShutdownHandlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('gracefully shuts down and exits with code 0 when SIGTERM is received', async () => {
    const fakeProcess = createFakeProcess();
    const shutdown = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const removeHandlers = installShutdownHandlers({
      shutdown,
      processApi: fakeProcess,
      onExit,
    });

    fakeProcess.emit('SIGTERM');
    await Promise.resolve();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(0);
    expect(consoleError).toHaveBeenCalledWith('[cord-mcp] Received SIGTERM, shutting down...');
    removeHandlers();
    expect(fakeProcess.listenerCount('SIGTERM')).toBe(0);
    expect(fakeProcess.listenerCount('SIGINT')).toBe(0);
  });

  it('forces exit with code 1 when graceful shutdown exceeds the timeout', async () => {
    vi.useFakeTimers();

    const fakeProcess = createFakeProcess();
    const shutdown = vi.fn().mockImplementation(() => new Promise<void>(() => {}));
    const onExit = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    installShutdownHandlers({
      shutdown,
      processApi: fakeProcess,
      onExit,
      timeoutMs: 2000,
    });

    fakeProcess.emit('SIGTERM');
    await vi.advanceTimersByTimeAsync(2000);

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(1);
  });
});
