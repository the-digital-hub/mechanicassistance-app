import { ChevronLeft } from 'lucide-react-native';
import { TouchableOpacity, View } from 'react-native';

/**
 * The one back arrow every screen header uses: a white circle with the arrow inside, same
 * size, colour and shadow as the wizard headers (e.g. "Select your vehicle"), so going back
 * looks and feels identical in the whole app. `marginLeft` is 16 for native headers; screens
 * that draw their own padded header pass 0.
 */
export function HeaderBackButton({ onPress, testID, marginLeft = 16 }: { onPress: () => void; testID?: string; marginLeft?: number }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={{ marginLeft }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            testID={testID}
        >
            <View
                className="w-10 h-10 rounded-full justify-center items-center"
                style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
            >
                <ChevronLeft size={20} color="#0047AB" />
            </View>
        </TouchableOpacity>
    );
}
