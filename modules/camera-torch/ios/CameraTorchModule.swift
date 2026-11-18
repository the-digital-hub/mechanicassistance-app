import ExpoModulesCore
import AVFoundation

/// The flashlight of the rear camera. The video call owns the camera (a capture session started by
/// the video library), but the torch is a property of the device, so it can be switched on here
/// while the call keeps running.
public class CameraTorchModule: Module {
  private static func rearCamera() -> AVCaptureDevice? {
    return AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
  }

  public func definition() -> ModuleDefinition {
    Name("CameraTorch")

    Function("isAvailable") { () -> Bool in
      return CameraTorchModule.rearCamera()?.hasTorch ?? false
    }

    AsyncFunction("setTorch") { (on: Bool, promise: Promise) in
      guard let device = CameraTorchModule.rearCamera(), device.hasTorch else {
        promise.resolve(false)
        return
      }
      do {
        try device.lockForConfiguration()
        if on {
          try device.setTorchModeOn(level: 1.0)
        } else {
          device.torchMode = .off
        }
        device.unlockForConfiguration()
        promise.resolve(true)
      } catch {
        promise.resolve(false)
      }
    }
  }
}
