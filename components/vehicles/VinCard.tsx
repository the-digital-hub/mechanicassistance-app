import { AV, AVIcon, MONO_FONT } from '@/components/vehicles/vehicleFormDesign';
import { TYPE } from '@/lib/ui/type';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
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
    /** Opens the camera to read the VIN barcode (door jamb, windshield). A quiet extra: typing stays the main way. */
    onScan?: () => void;
}

/**
 * The blue "Start with your VIN" card that opens the vehicle form: the VIN is
 * the one required field, and decoding it (NHTSA) fills most of the rest.
 */
export function VinCard({ value, onChange, onDecode, decoding, decoded, error, locked, onScan }: VinCardProps) {
    const { t } = useTranslation();
    const ready = value.replace(/\s/g, '').length === VIN_LENGTH;
    const canDecode = ready && !decoding;
    // Ready: the app's green for an important action, never white. Not ready: a translucent tile, like a disabled control.
    const buttonInk = '#FFFFFF';

    return (
        <LinearGradient
            colors={[AV.blue, AV.blueDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
                borderRadius: 20,
                paddingHorizontal: 20,
                paddingVertical: 22,
                shadowColor: AV.blue,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.35,
                shadowRadius: 12,
                elevation: 6,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.question, color: '#fff' }}>
                    {t('vehicles.form.design.vinTitle')}
                    <Text style={{ opacity: 0.8 }}>*</Text>
                </Text>
            </View>
            <Text
                className="font-outfit-regular"
                style={{ ...TYPE.helper, color: 'rgba(255,255,255,0.88)', marginTop: 8 }}
            >
                {t('vehicles.form.design.vinDescription')}
            </Text>

            {/* The field takes the whole row and Decode sits under it: side by side the 17 characters had no room. */}
            <View style={{ gap: 12, marginTop: 18 }}>
                <View style={{ justifyContent: 'center' }}>
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
                        height: 52,
                        borderRadius: 14,
                        paddingLeft: 16,
                        paddingRight: !locked && onScan ? 50 : 16,
                        backgroundColor: locked ? 'rgba(255,255,255,0.85)' : '#fff',
                        borderWidth: 1,
                        borderColor: error ? '#FCA5A5' : 'transparent',
                        fontFamily: MONO_FONT,
                        fontSize: 16,
                        letterSpacing: 0.5,
                        color: AV.text,
                    }}
                />
                    {!locked && onScan ? (
                        <TouchableOpacity
                            onPress={onScan}
                            hitSlop={6}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel={t('vehicles.form.design.scanVin')}
                            testID="vin-scan-icon"
                            style={{ position: 'absolute', right: 6, top: 6, width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: AV.blueSoft }}
                        >
                            <Ionicons name="barcode-outline" size={22} color={AV.blue} />
                        </TouchableOpacity>
                    ) : null}
                </View>
                {locked ? null : (
                <TouchableOpacity
                    onPress={onDecode}
                    disabled={!canDecode}
                    activeOpacity={0.8}
                    accessibilityLabel={t('vehicles.form.decodeVin')}
                    style={{
                        height: 52,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: ready ? '#10B981' : 'rgba(255,255,255,0.22)',
                        opacity: ready ? 1 : 0.85,
                    }}
                >
                    <AVIcon name="search" color={buttonInk} />
                    <Text className="font-outfit-bold" style={{ ...TYPE.body, color: buttonInk }}>
                        {decoding ? t('vehicles.form.design.decoding') : t('vehicles.form.design.decode')}
                    </Text>
                </TouchableOpacity>
                )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 14 }}>
                <Text
                    className="font-outfit-regular"
                    style={{ flex: 1, ...TYPE.helper, color: error ? '#FECACA' : 'rgba(255,255,255,0.85)' }}
                >
                    {error ??
                        (locked
                            ? t('vehicles.form.design.identityLocked')
                            : decoded
                              ? t('vehicles.form.design.vinFound')
                              : t('vehicles.form.design.vinManual'))}
                </Text>
                <Text className="font-outfit-medium" style={{ ...TYPE.helper, color: 'rgba(255,255,255,0.85)', fontVariant: ['tabular-nums'] }}>
                    {value.length}/{VIN_LENGTH}
                </Text>
            </View>
        </LinearGradient>
    );
}
