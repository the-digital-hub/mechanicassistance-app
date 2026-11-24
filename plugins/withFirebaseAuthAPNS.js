const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo config plugin that wires Firebase Auth into iOS APNs events so phone
 * auth uses silent push instead of reCAPTCHA on real devices.
 *
 * Adds to AppDelegate.swift:
 *   - import FirebaseAuth
 *   - didRegisterForRemoteNotificationsWithDeviceToken  → Auth.setAPNSToken
 *   - didReceiveRemoteNotification                      → Auth.canHandleNotification
 *
 * Adds to Info.plist:
 *   - UIBackgroundModes: ["remote-notification"]  (required for silent push)
 */

const APNS_METHODS = `
  // Firebase Auth APNs forwarding — required for phone auth silent push (no reCAPTCHA)
  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()
    print("[FirebaseAuth] ✅ APNs token received: \\(tokenString.prefix(20))...")
    #if DEBUG
    print("[FirebaseAuth] Setting APNs token type: sandbox")
    Auth.auth().setAPNSToken(deviceToken, type: .sandbox)
    #else
    print("[FirebaseAuth] Setting APNs token type: prod")
    Auth.auth().setAPNSToken(deviceToken, type: .prod)
    #endif
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  public override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    print("[FirebaseAuth] ❌ Failed to register for APNs: \\(error.localizedDescription)")
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  public override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    print("[FirebaseAuth] 📬 Remote notification received")
    if Auth.auth().canHandleNotification(userInfo) {
      print("[FirebaseAuth] ✅ Firebase handled the notification")
      completionHandler(.noData)
      return
    }
    print("[FirebaseAuth] ℹ️ Notification not for Firebase, forwarding to super")
    super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
  }

`;

const withFirebaseAuthAppDelegate = (config) => {
  return withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    // 1. Add FirebaseAuth import
    if (!contents.includes('import FirebaseAuth')) {
      contents = contents.replace(
        'import FirebaseCore',
        'import FirebaseCore\nimport FirebaseAuth'
      );
    }

    // 1b. Expo SDK 58 removed `factory.startReactNative(` from AppDelegate (the
    // scene delegate starts React now), which is the anchor @react-native-firebase/app
    // <= 26 looks for. Without it FirebaseApp.configure() is silently skipped, so add
    // it ourselves right before the super call. Idempotent: skipped if already there.
    if (!contents.includes('FirebaseApp.configure()')) {
      const superCall =
        /^([ \t]*)return\s+super\.application\(\s*application\s*,\s*didFinishLaunchingWithOptions:\s*launchOptions\s*\)/m;
      if (superCall.test(contents)) {
        contents = contents.replace(superCall, '$1FirebaseApp.configure()\n$&');
      } else {
        throw new Error(
          '[withFirebaseAuthAPNS] Could not find the didFinishLaunchingWithOptions super call to insert FirebaseApp.configure().'
        );
      }
    }

    // 2. Inject APNs methods inside AppDelegate class, before its closing brace
    if (!contents.includes('didRegisterForRemoteNotificationsWithDeviceToken')) {
      contents = contents.replace(
        /\n}\n\nclass ReactNativeDelegate:/,
        APNS_METHODS + '}\n\nclass ReactNativeDelegate:'
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

const withFirebaseAuthBackgroundModes = (config) => {
  return withInfoPlist(config, (config) => {
    const plist = config.modResults;
    const existing = plist.UIBackgroundModes || [];
    if (!existing.includes('remote-notification')) {
      plist.UIBackgroundModes = [...existing, 'remote-notification'];
    }
    return config;
  });
};

module.exports = (config) => {
  config = withFirebaseAuthAppDelegate(config);
  config = withFirebaseAuthBackgroundModes(config);
  return config;
};
