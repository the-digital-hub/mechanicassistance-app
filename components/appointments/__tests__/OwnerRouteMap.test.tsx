import { render } from '@testing-library/react-native';

import { OwnerRouteMap } from '../owner/OwnerRouteMap.native';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: () => null, Marker: () => null, Polyline: () => null }));
jest.mock('@/lib/maps/provider', () => ({ MAP_PROVIDER: undefined }));

const dest = { latitude: 25.7, longitude: -80.3 };
const mech = { latitude: 25.8, longitude: -80.2 };

describe('OwnerRouteMap hook order', () => {
    it('survives destination appearing, the mechanic moving and the route arriving', () => {
        const { rerender } = render(<OwnerRouteMap destination={null} mechanic={null} polyline={null} />);
        rerender(<OwnerRouteMap destination={dest} mechanic={null} polyline={null} />);
        rerender(<OwnerRouteMap destination={dest} mechanic={mech} polyline={null} />);
        rerender(<OwnerRouteMap destination={dest} mechanic={mech} polyline="_p~iF~ps|U_ulLnnqC_mqNvxq`@" />);
        rerender(<OwnerRouteMap destination={null} mechanic={mech} polyline={null} />);
    });
});
