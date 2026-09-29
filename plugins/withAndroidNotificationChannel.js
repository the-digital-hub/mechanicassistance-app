const { AndroidConfig, withMainApplication } = require('@expo/config-plugins');

/**
 * Expo config plugin that creates the Android notification channel push
 * notifications are posted to.
 *
 * notifications-service sends every push with `android.notification.channel_id
 * = "default"`, and firebase.json names the same channel as FCM's default. On
 * Android 8+ a push aimed at a channel that does not exist falls back to FCM's
 * "Miscellaneous" channel, which does not pop up over the screen — the wrong
 * behaviour for "your mechanic has arrived". So the channel is created here, at
 * HIGH importance (heads-up + sound), on every app start. Creating an existing
 * channel is a no-op, and the user can still change it in system settings.
 *
 * Adds to MainApplication.kt, in onCreate(), after super.onCreate():
 *   NotificationChannel("default", CHANNEL_NAME, IMPORTANCE_HIGH)
 *
 * Adds to AndroidManifest.xml:
 *   POST_NOTIFICATIONS — Android 13+ shows nothing without it, and the runtime
 *   prompt (lib/notifications/push.ts) cannot ask for an undeclared permission.
 *   Added through the plugin rather than app.json `android.permissions`, which
 *   would replace Expo's default list instead of adding to it.
 */

const CHANNEL_ID = 'default';
// Shown in Android's notification settings for the app.
const CHANNEL_NAME = 'Avisos de asistencia';
const MARKER = '// [withAndroidNotificationChannel]';

const CHANNEL_CODE = `
    ${MARKER} push notifications from notifications-service land here
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      val channel = android.app.NotificationChannel(
        "${CHANNEL_ID}",
        "${CHANNEL_NAME}",
        android.app.NotificationManager.IMPORTANCE_HIGH
      )
      val manager = getSystemService(android.content.Context.NOTIFICATION_SERVICE)
        as android.app.NotificationManager
      manager.createNotificationChannel(channel)
    }`;

const withChannel = (config) =>
  withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    if (config.modResults.language !== 'kt') {
      throw new Error(
        '[withAndroidNotificationChannel] expected a Kotlin MainApplication',
      );
    }
    if (!contents.includes(MARKER)) {
      const anchor = /super\.onCreate\(\)/;
      if (!anchor.test(contents)) {
        throw new Error(
          '[withAndroidNotificationChannel] could not find super.onCreate() in MainApplication.kt',
        );
      }
      contents = contents.replace(anchor, (m) => m + CHANNEL_CODE);
    }
    config.modResults.contents = contents;
    return config;
  });

module.exports = (config) => {
  config = withChannel(config);
  config = AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.POST_NOTIFICATIONS',
  ]);
  return config;
};
