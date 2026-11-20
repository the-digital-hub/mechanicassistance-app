import ExpoModulesCore
import UIKit
import Vision

/// Reads the text in a photo, on the device. The VIN printed on the door label and etched on the windshield is plain text:
/// the barcode reader cannot help with the windshield (it has no barcode) and often misses the door's long, thin code.
public class VinTextModule: Module {
  public func definition() -> ModuleDefinition {
    Name("VinText")

    // The lines of text found in the image at `uri` (a file:// or a plain path), best guess first. Empty when there is none.
    AsyncFunction("recognize") { (uri: String, promise: Promise) in
      let path = uri.hasPrefix("file://") ? (URL(string: uri)?.path ?? uri) : uri
      guard let image = UIImage(contentsOfFile: path), let cgImage = image.cgImage else {
        promise.reject("ERR_VIN_TEXT_IMAGE", "Could not open the photo")
        return
      }

      DispatchQueue.global(qos: .userInitiated).async {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        // A VIN is not a word: do not let the language model "fix" it.
        request.usesLanguageCorrection = false

        let handler = VNImageRequestHandler(
          cgImage: cgImage,
          orientation: VinTextModule.orientation(of: image),
          options: [:]
        )
        do {
          try handler.perform([request])
          var lines: [String] = []
          for observation in request.results ?? [] {
            // The top few guesses per line: one of them is often the right reading of a hard character.
            for candidate in observation.topCandidates(3) where !candidate.string.isEmpty {
              lines.append(candidate.string)
            }
          }
          promise.resolve(lines)
        } catch {
          promise.reject("ERR_VIN_TEXT_RECOGNIZE", error.localizedDescription)
        }
      }
    }
  }

  private static func orientation(of image: UIImage) -> CGImagePropertyOrientation {
    switch image.imageOrientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
