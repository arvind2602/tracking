import axios from '@/lib/axios';

/**
 * FCM device-token registration for the VigTask WebView app.
 *
 * The Flutter wrapper exposes a JS bridge:
 *   - Android: window.FCMBridge.postMessage('GET_FCM_TOKEN')
 *   - iOS:     window.webkit.messageHandlers.FCMBridge.postMessage('GET_FCM_TOKEN')
 * The native side replies by calling window.onNativeFcmTokenReceived(token, platform).
 * Outside the app (plain browser) there is no bridge, so every call resolves
 * to a no-op — this module is safe to call anywhere, anytime.
 */

type NativePlatform = 'android' | 'ios';

interface BridgeWindow extends Window {
  isNativeApp?: boolean;
  nativePlatform?: string;
  FCMBridge?: { postMessage: (message: string) => void };
  webkit?: {
    messageHandlers?: { FCMBridge?: { postMessage: (message: string) => void } };
  };
  onNativeFcmTokenReceived?: (token: string, platform: string) => void;
}

interface FcmToken {
  token: string;
  platform: NativePlatform;
}

function bridgePost(message: string): boolean {
  const win = window as BridgeWindow;
  try {
    // Android WebView
    if (win.FCMBridge && typeof win.FCMBridge.postMessage === 'function') {
      win.FCMBridge.postMessage(message);
      return true;
    }
    // iOS WKWebView
    const ios = win.webkit?.messageHandlers?.FCMBridge;
    if (ios && typeof ios.postMessage === 'function') {
      ios.postMessage(message);
      return true;
    }
  } catch {
    /* bridge unavailable */
  }
  return false;
}

let inflightToken: Promise<FcmToken | null> | null = null;

/** Ask the native wrapper for the current FCM token (null outside the app). */
export function getFcmToken(timeoutMs = 6000): Promise<FcmToken | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (inflightToken) return inflightToken;

  inflightToken = new Promise<FcmToken | null>((resolve) => {
    const win = window as BridgeWindow;
    let settled = false;

    const finish = (value: FcmToken | null) => {
      if (settled) return;
      settled = true;
      win.onNativeFcmTokenReceived = undefined;
      inflightToken = null;
      resolve(value);
    };

    // Nothing to talk to (plain browser) — skip silently.
    const hasBridge =
      Boolean(win.FCMBridge?.postMessage) ||
      Boolean(win.webkit?.messageHandlers?.FCMBridge?.postMessage);
    if (!hasBridge) {
      finish(null);
      return;
    }

    win.onNativeFcmTokenReceived = (token: string, platform: string) => {
      if (!token) {
        finish(null);
        return;
      }
      finish({ token, platform: platform === 'ios' ? 'ios' : 'android' });
    };

    if (!bridgePost('GET_FCM_TOKEN')) {
      finish(null);
      return;
    }

    // Native side never answered (no FCM / old build) — don't hang callers.
    setTimeout(() => finish(null), timeoutMs);
  });

  return inflightToken;
}

/**
 * Register (or refresh) this device's token for the logged-in user.
 * Fire-and-forget: always resolves, never throws.
 */
export async function registerPushDevice(): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    if (!localStorage.getItem('token')) return false;

    const fcm = await getFcmToken();
    if (!fcm?.token) return false;

    // Re-check: user may have logged out while we waited for the bridge.
    if (!localStorage.getItem('token')) return false;

    await axios.post('/notifications/devices', {
      token: fcm.token,
      platform: fcm.platform,
      deviceName: fcm.platform === 'ios' ? 'iOS device' : 'Android device',
    });
    return true;
  } catch (err) {
    console.warn('Push device registration failed:', err);
    return false;
  }
}

/**
 * Deactivate this user's device token(s) on logout.
 * Must be called BEFORE the JWT is removed from localStorage.
 */
export async function unregisterPushDevice(): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('token')) return;
    await axios.delete('/notifications/devices', { data: {} });
  } catch (err) {
    console.warn('Push device unregistration failed:', err);
  }
}
