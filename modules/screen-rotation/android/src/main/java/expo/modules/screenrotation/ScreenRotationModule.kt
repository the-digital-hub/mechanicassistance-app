package expo.modules.screenrotation

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android turns the screen when the orientation lock changes: nothing more to do here.
class ScreenRotationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScreenRotation")

    AsyncFunction("force") { _: Boolean ->
      false
    }
  }
}
