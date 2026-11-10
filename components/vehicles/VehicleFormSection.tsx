import { AV, AVIcon, AVIconName } from '@/components/vehicles/vehicleFormDesign';
import { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

interface VehicleFormSectionProps {
    icon: AVIconName;
    title: string;
    /** One line under the title, e.g. why the section matters. */
    subtitle?: string;
    /** Shows the "Optional · Recommended" pill next to the title. */
    optionalLabel?: string;
    /** Swaps the icon for a green check (filled from the VIN, collapsed). */
    done?: boolean;
    open: boolean;
    onToggle: () => void;
    /** Marks the card when a field inside fails validation. */
    hasError?: boolean;
    children: ReactNode;
}

/** A collapsible card grouping the fields of one part of the vehicle form. */
export function VehicleFormSection({
    icon,
    title,
    subtitle,
    optionalLabel,
    done,
    open,
    onToggle,
    hasError,
    children,
}: VehicleFormSectionProps) {
    return (
        <View
            style={{
                borderRadius: 18,
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: hasError ? '#FCA5A5' : AV.borderSoft,
                shadowColor: '#0E2F8A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 14,
                elevation: 2,
            }}
        >
            <TouchableOpacity
                onPress={onToggle}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
            >
                <View
                    style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: done ? AV.greenSoft : AV.blueSoft,
                    }}
                >
                    {done ? <AVIcon name="check" color={AV.greenText} /> : <AVIcon name={icon} color={AV.blue} />}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text className="font-outfit-bold" style={{ fontSize: 15, color: AV.text, letterSpacing: -0.2 }}>
                            {title}
                        </Text>
                        {optionalLabel ? (
                            <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100, backgroundColor: AV.blueSoft }}>
                                <Text className="font-outfit-bold" style={{ fontSize: 10.5, color: AV.blue }}>
                                    {optionalLabel}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    {subtitle ? (
                        <Text className="font-outfit-regular" style={{ fontSize: 12, color: AV.muted, marginTop: 2, lineHeight: 16 }}>
                            {subtitle}
                        </Text>
                    ) : null}
                </View>
                <AVIcon name="chevron" color={AV.muted} open={open} />
            </TouchableOpacity>
            {open ? (
                <View
                    style={{
                        borderTopWidth: 1,
                        borderTopColor: AV.borderSoft,
                        paddingHorizontal: 14,
                        paddingTop: 16,
                        paddingBottom: 16,
                        gap: 12,
                    }}
                >
                    {children}
                </View>
            ) : null}
        </View>
    );
}
