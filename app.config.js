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
module.exports = ({ config }) => {
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
