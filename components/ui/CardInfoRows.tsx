import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

const C = { blue: '#1E56E3', blueSoft: '#EAF1FF', text: '#0B1530', muted: '#6B7490', borderSoft: '#EEF2FA' };

/**
 * The data of a job card as one bordered box: a row per item (its icon tile, the label above and the value under it), the rows told
 * apart by a thin line. Shared by the Appointments card and the technician's Active job, so both read the same.
 */
export function InfoRows({ rows }: { rows: { icon: LucideIcon; label: string; value?: string; node?: ReactNode }[] }) {
    return (
        <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.borderSoft }}>
            {rows.map((r, i) => {
                const RowIcon = r.icon;
                return (
                    <View
                        key={r.label}
                        className="flex-row items-center"
                        style={{
                            gap: 12,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderBottomWidth: i < rows.length - 1 ? 1 : 0,
                            borderBottomColor: C.borderSoft,
                        }}
                    >
                        <View className="items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.blueSoft }}>
                            <RowIcon size={16} color={C.blue} />
                        </View>
                        {/* One column: the label above and the value (or the stars) under it, full width: nothing squeezes or cuts. */}
                        <View className="flex-1">
                            <Text className="font-outfit-medium text-[13px]" style={{ color: C.muted, lineHeight: 17 }}>{r.label}</Text>
                            {r.node ? (
                                <View className="flex-row items-center" style={{ marginTop: 2 }}>{r.node}</View>
                            ) : (
                                <Text className="font-outfit-bold" style={{ color: C.text, fontSize: 15, lineHeight: 20, marginTop: 1 }}>
                                    {r.value}
                                </Text>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}
