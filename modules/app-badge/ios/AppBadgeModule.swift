import ExpoModulesCore
import UserNotifications

public class AppBadgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppBadge")

    AsyncFunction("clear") { (promise: Promise) in
      if #available(iOS 16.0, *) {
        UNUserNotificationCenter.current().setBadgeCount(0) { error in
          if let error = error {
            promise.reject("ERR_BADGE", error.localizedDescription)
          } else {
            promise.resolve(nil)
          }
        }
      } else {
        DispatchQueue.main.async {
          UIApplication.shared.applicationIconBadgeNumber = 0
          promise.resolve(nil)
        }
      }
    }
  }
}
