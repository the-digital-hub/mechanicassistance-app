const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Expo config plugin that lets expo-image-picker find the camera app on Android 11+.
 *
 * Before opening the camera, expo-image-picker checks
 * `Intent(MediaStore.ACTION_VIDEO_CAPTURE / ACTION_IMAGE_CAPTURE).resolveActivity(...)`
 * and rejects with `MissingActivityToHandleIntent` when it gets null. Since API 30
 * (package visibility) that lookup only sees apps declared under `<queries>`.
 * The library's own manifest declares `android.media.action.ACTION_VIDEO_CAPTURE`,
 * which is not a real action (the constant's value is `android.media.action.VIDEO_CAPTURE`),
 * so recording a video from the camera always failed — the owner's "Add video → Camera"
 * in the request wizard did nothing.
 *
 * Adds to AndroidManifest.xml, inside <queries>:
 *   <intent><action android:name="android.media.action.VIDEO_CAPTURE"/></intent>
 *   <intent><action android:name="android.media.action.IMAGE_CAPTURE"/></intent>
 *
 * Android only: iOS is untouched. Idempotent: an action already declared is not added twice.
 */

const ACTIONS = ['android.media.action.VIDEO_CAPTURE', 'android.media.action.IMAGE_CAPTURE'];

const withCameraIntentQueries = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];
    queries.intent = queries.intent ?? [];

    const declared = new Set(
      queries.intent.flatMap((intent) => (intent.action ?? []).map((a) => a.$?.['android:name'])),
    );
    for (const action of ACTIONS) {
      if (!declared.has(action)) {
        queries.intent.push({ action: [{ $: { 'android:name': action } }] });
      }
    }
    return config;
  });

module.exports = withCameraIntentQueries;
