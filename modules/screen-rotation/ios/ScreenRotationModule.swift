import ExpoModulesCore
import UIKit

/// Rotates the interface right now. Setting the allowed orientations is not enough when the phone is
/// held sideways: iOS 16+ only turns the screen when asked to (`requestGeometryUpdate`).
public class ScreenRotationModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScreenRotation")

    AsyncFunction("force") { (landscape: Bool, promise: Promise) in
      DispatchQueue.main.async {
        guard #available(iOS 16.0, *) else {
          promise.resolve(false)
          return
        }
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let scene = scenes.first(where: { $0.activationState == .foregroundActive }) ?? scenes.first else {
          promise.resolve(false)
          return
        }
        scene.keyWindow?.rootViewController?.setNeedsUpdateOfSupportedInterfaceOrientations()
        let mask: UIInterfaceOrientationMask = landscape ? .landscape : .portrait
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: mask)) { _ in }
        promise.resolve(true)
      }
    }
  }
}
