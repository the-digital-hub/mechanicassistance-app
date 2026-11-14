import { Input } from '@/components/ui/Input';
import type { AddressNameType } from '@/lib/dao/interfaces';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

/** Same limit as `user_addresses.label` (VARCHAR(40)). */
const LABEL_MAX_LENGTH = 40;

export interface AddressNameValue {
    type: AddressNameType | null;
    label: string;
}

interface AddressNameFieldProps {
    value: AddressNameValue;
    onChange: (value: AddressNameValue) => void;
}

const OPTIONS: (AddressNameType | null)[] = [null, 'home', 'work', 'other'];

/**
 * Optional name for an address: a dropdown with No name / Home / Office / Other.
 * Picking Other shows a text field for the user's own name.
 */
export function AddressNameField({ value, onChange }: AddressNameFieldProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const optionLabel = (type: AddressNameType | null) =>
        t(type ? `addresses.name.${type}` : 'addresses.name.none');

    return (
        <View>
            <Text className="font-outfit-medium mb-2 text-gray-900">
                {t('addresses.name.label')}{' '}
                <Text className="text-gray-400 font-outfit-regular">{t('addresses.name.optional')}</Text>
            </Text>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                activeOpacity={0.8}
                className="bg-white border border-gray-300 rounded-2xl h-[52px] px-4 flex-row items-center justify-between"
            >
                <Text className={`font-outfit-medium text-[17px] ${value.type ? 'text-gray-900' : 'text-gray-400'}`}>
                    {optionLabel(value.type)}
                </Text>
                <ChevronDown size={18} color="#6B7280" />
            </TouchableOpacity>

            {value.type === 'other' && (
                <Input
                    value={value.label}
                    onChangeText={(text) => onChange({ type: 'other', label: text })}
                    containerClassName="bg-white border border-gray-300 rounded-2xl mt-3"
                    placeholder={t('addresses.name.customPlaceholder')}
                    maxLength={LABEL_MAX_LENGTH}
                />
            )}

            <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setOpen(false)}>
                    <Pressable className="bg-white rounded-t-3xl pb-8">
                        <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
                            <Text className="text-xl font-outfit-bold text-gray-900">{t('addresses.name.pickTitle')}</Text>
                            <TouchableOpacity onPress={() => setOpen(false)}>
                                <Text className="text-blue-600 font-outfit-bold">{t('addresses.name.done')}</Text>
                            </TouchableOpacity>
                        </View>
                        {OPTIONS.map((type) => {
                            const selected = value.type === type;
                            return (
                                <TouchableOpacity
                                    key={type ?? 'none'}
                                    className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between"
                                    onPress={() => {
                                        onChange({ type, label: type === 'other' ? value.label : '' });
                                        setOpen(false);
                                    }}
                                >
                                    <Text className={`font-outfit-medium ${selected ? 'text-blue-600' : 'text-gray-900'}`}>
                                        {optionLabel(type)}
                                    </Text>
                                    {selected && <View className="w-5 h-5 rounded-full bg-blue-600" />}
                                </TouchableOpacity>
                            );
                        })}
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

/** The `type`/`label` pair to send to the API. Other with an empty name is sent as Other with no label. */
export function addressNamePayload(value: AddressNameValue): { type: AddressNameType | null; label: string | null } {
    return {
        type: value.type,
        label: value.type === 'other' ? value.label.trim() || null : null,
    };
}
