/**
 * sendPushNotification
 *
 * Sends one or more push notifications via the Expo Push API.
 * No server needed — works client-side for this small app.
 *
 * Usage:
 *   sendPushNotification(token, 'כותרת', 'גוף ההודעה', { screen: 'Messages' });
 *   sendPushNotificationToMany([token1, token2], 'title', 'body');
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send a notification to a single push token.
 * @param {string} token   - Expo push token (ExponentPushToken[...])
 * @param {string} title   - Notification title
 * @param {string} body    - Notification body
 * @param {object} data    - Extra data payload (optional)
 */
export async function sendPushNotification(token, title, body, data = {}) {
  if (!token || !token.startsWith('ExponentPushToken')) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: token, title, body, data, sound: 'default' }),
    });
  } catch (err) {
    console.warn('sendPushNotification error:', err.message);
  }
}

/**
 * Send the same notification to multiple push tokens.
 * @param {string[]} tokens - Array of Expo push tokens
 * @param {string}   title
 * @param {string}   body
 * @param {object}   data
 */
export async function sendPushNotificationToMany(tokens, title, body, data = {}) {
  const valid = (tokens || []).filter(
    (t) => t && typeof t === 'string' && t.startsWith('ExponentPushToken')
  );
  if (valid.length === 0) return;
  try {
    const messages = valid.map((to) => ({ to, title, body, data, sound: 'default' }));
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.warn('sendPushNotificationToMany error:', err.message);
  }
}
