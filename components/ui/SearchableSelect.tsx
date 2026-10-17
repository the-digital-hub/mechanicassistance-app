import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

export interface SearchableSelectOption {
    value: string;
    label: string;
}

interface SearchableSelectProps<T extends SearchableSelectOption> {
    options: T[];
    value?: string | null;
    onChange: (option: T) => void;
    /** Field text when nothing is picked. */
    placeholder: string;
    /** Title of the sheet. */
    title: string;
    searchPlaceholder: string;
    emptyText: string;
    doneText: string;
    loading?: boolean;
    /** Shown instead of the list when set, with a retry button if `onRetry` is given. */
    errorText?: string;
    retryText?: string;
    onRetry?: () => void;
    /** Drawn left of the label, in the field and in each row (e.g. a color dot). */
    renderLeading?: (option: T) => ReactNode;
    /** Shown in the field when `value` is not among `options` (e.g. a retired entry). */
    fallbackLabel?: string;
}

const normalize = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * A field that opens a bottom sheet with a search box and a filtered list —
 * for catalogs too long for a row of buttons. Matching ignores case and accents.
 */
export function SearchableSelect<T extends SearchableSelectOption>({
    options,
    value,
    onChange,
    placeholder,
    title,
    searchPlaceholder,
    emptyText,
    doneText,
    loading,
    errorText,
    retryText,
    onRetry,
    renderLeading,
    fallbackLabel,
}: SearchableSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const selected = options.find(o => o.value === value);
    const filtered = useMemo(() => {
        const q = normalize(query.trim());
        return q ? options.filter(o => normalize(o.label).includes(q)) : options;
    }, [options, query]);

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    const fieldText = selected?.label ?? (value ? fallbackLabel : undefined);

    return (
        <>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                className="bg-white border border-gray-300 h-12 flex-row items-center justify-between px-4 rounded-[10px]"
            >
                <View className="flex-row items-center gap-3 flex-1">
                    {selected && renderLeading?.(selected)}
                    <Text
                        numberOfLines={1}
                        className={`font-outfit-regular flex-1 ${fieldText ? 'text-[#0F172A]' : 'text-gray-400'}`}
                    >
                        {fieldText ?? placeholder}
                    </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#0047AB" />
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    className="flex-1 bg-black/40 justify-end"
                >
                    <View className="bg-white rounded-t-3xl h-[75%] p-6">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-xl font-outfit-bold text-[#0F172A]">{title}</Text>
                            <TouchableOpacity onPress={close}>
                                <Text className="text-blue-600 font-outfit-bold">{doneText}</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row items-center bg-slate-50 border border-gray-200 rounded-[10px] px-3 h-11 mb-2">
                            <Ionicons name="search" size={18} color="#9CA3AF" />
                            <TextInput
                                value={query}
                                onChangeText={setQuery}
                                placeholder={searchPlaceholder}
                                placeholderTextColor="#9CA3AF"
                                autoCorrect={false}
                                autoCapitalize="none"
                                className="flex-1 ml-2 font-outfit-regular text-[#0F172A]"
                            />
                            {query ? (
                                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        {loading ? (
                            <ActivityIndicator className="mt-8" color="#0047AB" />
                        ) : errorText ? (
                            <View className="items-center mt-8 gap-3">
                                <Text className="text-slate-500 font-outfit-medium text-center">{errorText}</Text>
                                {onRetry && retryText ? (
                                    <TouchableOpacity onPress={onRetry}>
                                        <Text className="text-blue-600 font-outfit-bold">{retryText}</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>
                        ) : (
                            <FlatList
                                data={filtered}
                                keyExtractor={o => o.value}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={
                                    <Text className="text-slate-400 font-outfit-medium text-center mt-8">{emptyText}</Text>
                                }
                                renderItem={({ item }) => {
                                    const isSelected = item.value === value;
                                    return (
                                        <TouchableOpacity
                                            className="py-4 border-b border-slate-50 flex-row items-center gap-3"
                                            onPress={() => {
                                                onChange(item);
                                                close();
                                            }}
                                        >
                                            {renderLeading?.(item)}
                                            <Text
                                                className={`flex-1 text-lg font-outfit-medium ${isSelected ? 'text-blue-600' : 'text-[#0F172A]'}`}
                                            >
                                                {item.label}
                                            </Text>
                                            {isSelected && <Ionicons name="checkmark" size={20} color="#0047AB" />}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </>
    );
}
