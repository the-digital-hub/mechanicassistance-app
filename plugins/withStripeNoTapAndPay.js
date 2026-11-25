const { withProjectBuildGradle } = require('@expo/config-plugins');

/**
 * Expo config plugin that keeps Google's private TapAndPay SDK out of the
 * Android build.
 *
 * @stripe/stripe-react-native declares
 *   compileOnly "com.stripe:stripe-android-issuing-push-provisioning:1.3.0"
 * and that artifact's POM depends on
 *   com.google.android.gms:play-services-tapandpay
 * which Google publishes only to approved issuers, never to google() or Maven
 * Central. Gradle fails resolving it (first seen in
 * :stripe_stripe-react-native:lintVitalAnalyzeRelease) and the release build dies.
 *
 * Excluding it is safe: Stripe reaches TapAndPay only through reflection
 * (TapAndPayProxy, Class.forName), and this app does not use Issuing push
 * provisioning ("Add to Google Wallet" for Stripe-issued cards).
 *
 * Adds to android/build.gradle:
 *   allprojects { configurations.configureEach { exclude ... } }
 */

const MARKER = '// [withStripeNoTapAndPay]';

const SNIPPET = `
${MARKER}
allprojects {
  configurations.configureEach {
    exclude group: "com.google.android.gms", module: "play-services-tapandpay"
  }
}
`;

function addExclusion(contents) {
  if (contents.includes(MARKER)) return contents;
  return `${contents.trimEnd()}\n${SNIPPET}`;
}

const withStripeNoTapAndPay = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withStripeNoTapAndPay: android/build.gradle must be Groovy');
    }
    cfg.modResults.contents = addExclusion(cfg.modResults.contents);
    return cfg;
  });

module.exports = withStripeNoTapAndPay;
module.exports.addExclusion = addExclusion;
