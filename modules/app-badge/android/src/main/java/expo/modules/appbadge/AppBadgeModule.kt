package expo.modules.appbadge

import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppBadgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppBadge")

    // Android has no badge number of its own: launchers count the
    // notifications in the tray (or use the push's notification_count while
    // it is there). Emptying the tray clears the icon.
    AsyncFunction("clear") {
      val context = appContext.reactContext ?: return@AsyncFunction
      NotificationManagerCompat.from(context).cancelAll()
    }
  }
}
