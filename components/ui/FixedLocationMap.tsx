import { approximateArea } from '@/lib/maps/approximateLocation';
import { MAP_PROVIDER } from '@/lib/maps/provider';
import { useMemo } from 'react';
import { View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

interface FixedLocationMapProps {
    latitude: number;
    longitude: number;
    /**
     * true for a mechanic looking at an owner's request: no pin, a shifted
     * centre and a zone circle instead (see lib/maps/approximateLocation).
     * false for the owner looking at their own location: the real pin.
     */
    approximate: boolean;
    /** Stable per job (the request id) so the shifted centre never moves between views. */
    seed: string;
    height?: number;
}

/** Approximate: neighbourhood level, ~3 km across — the area, not the block. */
const APPROXIMATE_DELTA = 0.03;
/** Exact: street level, for the owner's own location. */
const EXACT_DELTA = 0.01;

/**
 * Frozen map: every gesture is off and the map receives no touches at all
 * (`pointerEvents="none"`), so it cannot be panned, zoomed or tapped open —
 * whatever is underneath gets the tap. On Android `liteMode` renders it as a
 * static bitmap.
 */
export function FixedLocationMap({ latitude, longitude, approximate, seed, height = 120 }: FixedLocationMapProps) {
    const area = useMemo(
        () => (approximate ? approximateArea(latitude, longitude, seed) : null),
        [approximate, latitude, longitude, seed],
    );
    const region = useMemo(() => {
        const delta = area ? APPROXIMATE_DELTA : EXACT_DELTA;
        return {
            latitude: area ? area.latitude : latitude,
            longitude: area ? area.longitude : longitude,
            latitudeDelta: delta,
            longitudeDelta: delta,
        };
    }, [area, latitude, longitude]);
    const center = { latitude: region.latitude, longitude: region.longitude };

    return (
        <View pointerEvents="none" style={{ height, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#EEF2FA' }}>
            <MapView
                provider={MAP_PROVIDER}
                style={{ flex: 1 }}
                initialRegion={region}
                region={region}
                liteMode
                scrollEnabled={false}
                zoomEnabled={false}
                zoomTapEnabled={false}
                zoomControlEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
                showsPointsOfInterests={false}
                showsBuildings={false}
                showsCompass={false}
                showsMyLocationButton={false}
                showsUserLocation={false}
            >
                {area ? (
                    <Circle
                        center={center}
                        radius={area.radiusMeters}
                        strokeColor="rgba(30,86,227,0.55)"
                        fillColor="rgba(30,86,227,0.16)"
                        strokeWidth={2}
                    />
                ) : (
                    <Marker coordinate={center} pinColor="#E5394E" />
                )}
            </MapView>
        </View>
    );
}
