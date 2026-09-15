/**
 * Persistent per-browser device identifier.
 *
 * Originally part of the Netlify Blobs sync layer, which has been removed in
 * favour of authenticated Supabase sync. The ID is kept because Settings
 * displays it, and because it remains a useful handle for support.
 */

const DEVICE_ID_KEY = 'workout_device_id';

/** Get the device ID for this browser, creating one on first call. */
export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}
