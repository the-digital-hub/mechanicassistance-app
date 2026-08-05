import { PROVIDER_GOOGLE } from 'react-native-maps';

/**
 * Map provider used by every <MapView> in the app.
 *
 * Google Maps on both platforms: on iOS this overrides the Apple Maps default
 * (requires the `react-native-maps` config plugin with `iosGoogleMapsApiKey`
 * in app.json + a native rebuild); on Android it is already the default.
 */
export const MAP_PROVIDER = PROVIDER_GOOGLE;
