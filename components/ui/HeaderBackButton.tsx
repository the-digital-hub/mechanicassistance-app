import { ChevronLeft } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';

/**
 * The one back arrow every screen header uses: same icon, size, colour and position,
 * so going back looks and feels identical in the whole app.
 */
export function HeaderBackButton({ onPress, testID }: { onPress: () => void; testID?: string }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{ marginLeft: 16 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID={testID}
        >
            <ChevronLeft size={24} color="#0047AB" />
        </TouchableOpacity>
    );
}
