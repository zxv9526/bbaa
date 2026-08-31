/**
 * Haptic feedback utility for mobile/touch devices
 */
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): void {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
      switch (type) {
        case 'light':
          navigator.vibrate(12);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(45);
          break;
        case 'success':
          navigator.vibrate([20, 60, 40]);
          break;
        case 'warning':
          navigator.vibrate([40, 80, 40]);
          break;
        case 'error':
          navigator.vibrate([60, 100, 60, 100, 60]);
          break;
      }
    }
  } catch {
    // Ignore unsupported environments
  }
}
