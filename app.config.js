// Dynamic Expo config: merges app.json (received as `config`) and injects
// secrets from the environment so they are never committed to the repo.
//
// GOOGLE_MAPS_IOS_API_KEY comes from `.env` locally (gitignored) or from an
// EAS secret in CI. Without it, iOS falls back to Apple Maps instead of
// failing the build.
//
// The same key is exposed through `extra.googlePlacesApiKey` so `lib/places.ts`
// can call the Places API from the client. Without it, address autocomplete
// degrades to its Photon fallback instead of breaking.
//
// aps-environment is what lets iOS hand the app a push token at all. Its value
// has to match the provisioning profile: 'development' for the dev-client
// profiles (and local `expo run:ios`), 'production' for TestFlight and the
// store. EAS sets EAS_BUILD_PROFILE during the build.
const DEV_PROFILES = ['development', 'development-simulator'];

function withPushEntitlement(config) {
  const profile = process.env.EAS_BUILD_PROFILE;
  const apsEnvironment =
    !profile || DEV_PROFILES.includes(profile) ? 'development' : 'production';
  return {
    ...config,
    ios: {
      ...(config.ios ?? {}),
      entitlements: {
        ...(config.ios?.entitlements ?? {}),
        'aps-environment': apsEnvironment,
      },
    },
  };
}

module.exports = ({ config: baseConfig }) => {
  const config = withPushEntitlement(baseConfig);
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_API_KEY;

  if (!iosGoogleMapsApiKey) {
    console.warn(
      '[app.config] GOOGLE_MAPS_IOS_API_KEY is not set — iOS will render Apple Maps ' +
        'and address autocomplete will fall back to Photon. ' +
        'Set it in .env or as an EAS secret to enable Google Maps and Google Places.'
    );
    return config;
  }

  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['react-native-maps', { iosGoogleMapsApiKey }]],
    extra: { ...(config.extra ?? {}), googlePlacesApiKey: iosGoogleMapsApiKey },
  };
};
