package expo.modules.appbadge

import android.Manifest
import androidx.core.app.NotificationManagerCompat
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppBadgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppBadge")

    // Android has no badge number of its own: launchers count the
    // notifications in the tray (or use the push's notification_count while
    // it is there). Emptying the tray clears the icon.
    AsyncFunction("clear") {
      // No bare `return@AsyncFunction`: Kotlin 2.1 infers the lambda's return
      // as Any? and rejects an early Unit return ("Return type mismatch").
      appContext.reactContext?.let { context ->
        NotificationManagerCompat.from(context).cancelAll()
      }
    }

    // POST_NOTIFICATIONS (Android 13+) asked through Expo's permission queue,
    // the same one expo-location, expo-image-picker and expo-camera use.
    // React Native's PermissionsAndroid has its own listener: when its request
    // overlapped an Expo one, the activity kept only one of the two callbacks
    // and Expo's queue stayed busy forever — every later Expo request (the
    // camera included) then never answered. Resolves
    // { status, granted, canAskAgain, expires }.
    AsyncFunction("requestPostNotificationsAsync") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(
        appContext.permissions,
        promise,
        Manifest.permission.POST_NOTIFICATIONS
      )
    }
  }
}
