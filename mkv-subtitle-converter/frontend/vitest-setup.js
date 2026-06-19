import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { vi, afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.animate = function () {
    const animation = {
      finished: Promise.resolve(),
      cancel: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      onfinish: null,
      oncancel: null,
      currentTime: 0,
      effect: { getComputedTiming: () => ({ progress: 1 }) }
    };
    setTimeout(() => {
      if (typeof animation.onfinish === 'function') {
        animation.onfinish({ currentTime: 100, timelineTime: 100 });
      }
    }, 0);
    return animation;
  };

  if (!window.PointerEvent) {
    class PointerEvent extends MouseEvent {
      constructor(type, params = {}) {
        super(type, params);
        this.pointerId = params.pointerId || 0;
      }
    }
    window.PointerEvent = PointerEvent;
  }
}
