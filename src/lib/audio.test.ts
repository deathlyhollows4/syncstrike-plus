import { describe, it, expect, vi } from 'vitest';
import { playBeep } from './audio';

describe('playBeep', () => {
  it('creates audio nodes and schedules start/stop', () => {
    const orig = (globalThis as any).AudioContext;
    const origWindow = (globalThis as any).window;
    class MockAudioContext {
      currentTime = 1; // deterministic timestamp for assertions
      destination = {};
      static lastInstance: any = null;
      _osc: any;
      _gain: any;
      constructor() { (MockAudioContext as any).lastInstance = this; }
      createOscillator() {
        const osc = {
          type: '',
          frequency: { value: 0 },
          connect: vi.fn().mockReturnThis(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
        this._osc = osc;
        return osc;
      }
      createGain() {
        const gain = {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn().mockReturnThis(),
        };
        this._gain = gain;
        return gain;
      }
      close = vi.fn();
    }

    // Ensure `window` exists so playBeep doesn't early-return in node environment
    (globalThis as any).window = (globalThis as any).window ?? (globalThis as any);
    (globalThis as any).AudioContext = MockAudioContext as any;

    // call the function under test
    playBeep(880, 220);

    const ctx = (MockAudioContext as any).lastInstance;
    expect(ctx).toBeTruthy();
    expect(ctx._osc.start).toHaveBeenCalled();
    expect(ctx._osc.stop).toHaveBeenCalled();

    const stopArg = ctx._osc.stop.mock.calls[0][0];
    // expected: currentTime + durationMs/1000 + 0.05  => 1 + 0.22 + 0.05 = 1.27
    expect(stopArg).toBeCloseTo(1.27, 3);

    expect(ctx._gain.gain.setValueAtTime).toHaveBeenCalledWith(0.001, ctx.currentTime);

    // restore
    (globalThis as any).AudioContext = orig;
    (globalThis as any).window = origWindow;
  });
});
