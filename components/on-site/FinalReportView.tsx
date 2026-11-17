import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import type { FinalReport } from '@/lib/onsite/finalReport';
import { Body, Card, OS } from './ui';

/** The final report as a page: one card per section. */
export function FinalReportView({ report }: { report: FinalReport }) {
    return (
        <Body>
            <View className="px-5 pt-4">
                <Text className="font-outfit-medium" style={{ fontSize: 14, lineHeight: 20, color: OS.muted }}>{report.reference} · {report.generatedAt}</Text>
            </View>
            {report.sections.map((s) => (
                <View key={s.key}>
                    <Text className="font-outfit-bold mx-5 mt-5" style={{ fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: OS.blue }}>{s.title}</Text>
                    <Card style={{ marginTop: 8 }}>
                        {s.rows.map((r, i) => (
                            <View key={r.label} className="px-4 py-3" style={{ borderBottomWidth: i < s.rows.length - 1 || s.lines?.length ? 1 : 0, borderBottomColor: OS.borderSoft }}>
                                <Text className="font-outfit-semibold" style={{ fontSize: 13, color: OS.muted }}>{r.label}</Text>
                                <Text className="font-outfit-bold mt-0.5" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{r.value}</Text>
                            </View>
                        ))}
                        {(s.lines ?? []).map((l, i, arr) => (
                            <View key={`${l.text}-${i}`} className="flex-row items-center px-4 py-3" style={{ gap: 10, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: OS.borderSoft }}>
                                {l.done === undefined ? null : (
                                    <Ionicons name={l.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={l.done ? OS.green : OS.mutedLight} />
                                )}
                                <Text className="flex-1 font-outfit-medium" style={{ fontSize: 16, lineHeight: 22, color: OS.text }}>{l.text}</Text>
                            </View>
                        ))}
                    </Card>
                </View>
            ))}
            <View style={{ height: 16 }} />
        </Body>
    );
}
