import { AV, AVIcon, MONO_FONT } from '@/components/vehicles/vehicleFormDesign';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

export const VIN_LENGTH = 17;

interface VinCardProps {
    value: string;
    onChange: (vin: string) => void;
    onDecode: () => void;
    decoding: boolean;
    /** The last decode filled the form; cleared when the VIN changes. */
    decoded: boolean;
    error?: string | null;
    /** Editing a saved car: the VIN is shown but cannot be changed or decoded again. */
    locked?: boolean;
}

/**
 * The blue "Start with your VIN" card that opens the vehicle form: the VIN is
 * the one required field, and decoding it (NHTSA) fills most of the rest.
 */
export function VinCard({ value, onChange, onDecode, decoding, decoded, error, locked }: VinCardProps) {
    const { t } = useTranslation();
    const ready = value.replace(/\s/g, '').length === VIN_LENGTH;
    const canDecode = ready && !decoding;
    const buttonInk = ready ? AV.blue : 'rgba(255,255,255,0.8)';

    return (
        <LinearGradient
            colors={[AV.blue, AV.blueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
                borderRadius: 18,
                padding: 16,
                shadowColor: AV.blue,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AVIcon name="sparkle" color="#fff" />
                <Text className="font-outfit-bold" style={{ color: '#fff', fontSize: 15 }}>
                    {t('vehicles.form.design.vinTitle')}
                    <Text style={{ opacity: 0.8 }}>*</Text>
                </Text>
            </View>
            <Text
                className="font-outfit-regular"
                style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 18 }}
            >
                {t('vehicles.form.design.vinDescription')}
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TextInput
                    value={value}
                    onChangeText={v => onChange(v.toUpperCase())}
                    editable={!locked}
                    maxLength={VIN_LENGTH}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    placeholder={t('vehicles.form.design.vinPlaceholder')}
                    placeholderTextColor={AV.mutedLight}
                    style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        paddingHorizontal: 14,
                        backgroundColor: locked ? 'rgba(255,255,255,0.85)' : '#fff',
                        borderWidth: 1,
                        borderColor: error ? '#FCA5A5' : 'transparent',
                        fontFamily: MONO_FONT,
                        fontSize: 14,
                        letterSpacing: 0.5,
                        color: AV.text,
                    }}
                />
                {locked ? null : (
                <TouchableOpacity
                    onPress={onDecode}
                    disabled={!canDecode}
                    activeOpacity={0.8}
                    accessibilityLabel={t('vehicles.form.decodeVin')}
                    style={{
                        height: 48,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: ready ? '#fff' : 'rgba(255,255,255,0.25)',
                    }}
                >
                    <AVIcon name="search" color={buttonInk} />
                    <Text className="font-outfit-bold" style={{ fontSize: 14, color: buttonInk }}>
                        {decoding ? t('vehicles.form.design.decoding') : t('vehicles.form.design.decode')}
                    </Text>
                </TouchableOpacity>
                )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
                <Text
                    className="font-outfit-regular"
                    style={{ flex: 1, fontSize: 13, color: error ? '#FECACA' : 'rgba(255,255,255,0.8)' }}
                >
                    {error ??
                        (locked
                            ? t('vehicles.form.design.identityLocked')
                            : decoded
                              ? t('vehicles.form.design.vinFound')
                              : t('vehicles.form.design.vinManual'))}
                </Text>
                <Text className="font-outfit-regular" style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontVariant: ['tabular-nums'] }}>
                    {value.length}/{VIN_LENGTH}
                </Text>
            </View>
        </LinearGradient>
    );
}
