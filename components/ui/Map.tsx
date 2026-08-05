import { forwardRef } from 'react';
import RNMapView, { Marker, Region, type MapViewProps } from 'react-native-maps';
import { MAP_PROVIDER } from '@/lib/maps/provider';

/**
 * Native map. Defaults to Google Maps (see lib/maps/provider) so iOS does not
 * fall back to Apple Maps; callers can still override `provider`.
 * The web counterpart (Map.web.tsx) uses Leaflet and ignores this file.
 */
const MapView = forwardRef<RNMapView, MapViewProps>((props, ref) => (
    <RNMapView provider={MAP_PROVIDER} {...props} ref={ref} />
));

MapView.displayName = 'MapView';

export { Marker };
export type { Region };
export default MapView;
