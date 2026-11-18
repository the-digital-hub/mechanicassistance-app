package expo.modules.cameratorch

import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Best effort: Android often refuses the torch while the app's own camera session (the video call) is
// open. The call then answers `false` and the screen simply hides the flashlight button.
class CameraTorchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CameraTorch")

    Function("isAvailable") {
      appContext.reactContext?.packageManager?.hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH) ?: false
    }

    AsyncFunction("setTorch") { on: Boolean ->
      val manager = appContext.reactContext?.getSystemService(Context.CAMERA_SERVICE) as? CameraManager
      val id = manager?.cameraIdList?.firstOrNull { cameraId ->
        val characteristics = manager.getCameraCharacteristics(cameraId)
        characteristics.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true &&
          characteristics.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
      }
      var done = false
      if (id != null) {
        try {
          manager?.setTorchMode(id, on)
          done = true
        } catch (e: Exception) {
          done = false
        }
      }
      done
    }
  }
}
