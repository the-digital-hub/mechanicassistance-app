import { Input } from '@/components/ui/Input';
import {
    getPlaceDetails,
    newSessionToken,
    searchPlaces,
    type ParsedAddress,
    type PlaceSuggestion,
} from '@/lib/places';
import { MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

interface AddressAutocompleteProps {
    /** The street field this input is bound to — the parent owns it. */
    value: string;
    onChangeText: (text: string) => void;
    /** Fired when a suggestion is picked. The parent decides what to persist. */
    onSelect: (address: ParsedAddress) => void;
    placeholder?: string;
    containerClassName?: string;
    autoFocus?: boolean;
    /** Don't hit the API until the query is at least this long. */
    minChars?: number;
}

const DEBOUNCE_MS = 300;

/**
 * Street input with Google Places suggestions.
 *
 * Searching is driven by `onChangeText` (real typing) rather than by an effect
 * on `value`, so a parent writing the selected street back into state does not
 * trigger another round of suggestions.
 *
 * Suggestions are advisory: every field stays editable afterwards, and a user
 * who ignores the list can still type the whole address by hand.
 */
export function AddressAutocomplete({
    value,
    onChangeText,
    onSelect,
    placeholder,
    containerClassName,
    autoFocus,
    minChars = 3,
}: AddressAutocompleteProps) {
    const { t } = useTranslation();
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Last query the user typed — used to drop out-of-order responses. */
    const latestQueryRef = useRef('');
    const sessionTokenRef = useRef(newSessionToken());

    useEffect(
        () => () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        },
        [],
    );

    const handleChangeText = useCallback(
        (text: string) => {
            onChangeText(text);
            setError(null);
            latestQueryRef.current = text;

            if (debounceRef.current) clearTimeout(debounceRef.current);

            if (text.trim().length < minChars) {
                setSuggestions([]);
                setIsSearching(false);
                return;
            }

            setIsSearching(true);
            debounceRef.current = setTimeout(async () => {
                const query = text;
                const results = await searchPlaces(query, sessionTokenRef.current);

                // A newer keystroke superseded this request — drop the result.
                if (latestQueryRef.current !== query) return;

                setSuggestions(results);
                setIsSearching(false);
            }, DEBOUNCE_MS);
        },
        [minChars, onChangeText],
    );

    const handleSelect = useCallback(
        async (suggestion: PlaceSuggestion) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setSuggestions([]);
            setIsSearching(false);
            // Stop any in-flight response from reopening the list.
            latestQueryRef.current = suggestion.mainText;

            try {
                const address = await getPlaceDetails(suggestion.placeId, sessionTokenRef.current);
                onSelect(address);
            } catch {
                setError(t('addressAutocomplete.detailsFailed'));
            } finally {
                // Google bills autocomplete + details as one request per token;
                // start a fresh session for the next address.
                sessionTokenRef.current = newSessionToken();
            }
        },
        [onSelect, t],
    );

    return (
        <View>
            <Input
                value={value}
                onChangeText={handleChangeText}
                placeholder={placeholder ?? t('addressAutocomplete.searchPlaceholder')}
                containerClassName={containerClassName}
                autoFocus={autoFocus}
                autoCorrect={false}
                autoCapitalize="words"
            />

            {isSearching && (
                <View className="py-3">
                    <ActivityIndicator color="#0047AB" />
                </View>
            )}

            {error && (
                <Text className="font-outfit-regular text-red-500 text-xs mt-2">{error}</Text>
            )}

            {suggestions.length > 0 && (
                <View className="mt-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {suggestions.map((suggestion, index) => (
                        <TouchableOpacity
                            key={suggestion.placeId}
                            onPress={() => handleSelect(suggestion)}
                            className={`flex-row items-center px-4 py-3 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                        >
                            <View className="w-10 h-10 bg-blue-50 rounded-full justify-center items-center mr-3">
                                <MapPin size={18} color="#0047AB" />
                            </View>
                            <View className="flex-1">
                                <Text
                                    className="font-outfit-medium text-gray-900"
                                    numberOfLines={1}
                                >
                                    {suggestion.mainText}
                                </Text>
                                {!!suggestion.secondaryText && (
                                    <Text
                                        className="font-outfit-regular text-gray-500 text-xs"
                                        numberOfLines={1}
                                    >
                                        {suggestion.secondaryText}
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}
