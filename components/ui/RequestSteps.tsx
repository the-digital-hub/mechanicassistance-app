import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

const BLUE = '#1E56E3';
const LINE = '#E2E7F1';
const DONE_LINE = '#BFE3D0';
const DONE_BG = '#DDF1E7';
const DONE_CHECK = '#2E9468';
const MUTED = '#8A93A6';

export type RequestStep = { key: string; label: string };

/** Steps of the immediate and the video-call request flows, in order. */
const IMMEDIATE = ['vehicle', 'issue', 'condition', 'photos', 'location', 'confirm'] as const;
const VIDEO = ['vehicle', 'issue', 'condition', 'scanner', 'when'] as const;

/**
 * Timeline of a request wizard: a dot per step joined by lines. Done steps are a blue check, the
 * current one a ringed dot, the rest an empty ring; the current step's name sits underneath.
 */
export function Timeline({ steps, current, flush = false }: { steps: RequestStep[]; current: number; /** Inside a scroll that already has its own side padding: no padding of its own. */ flush?: boolean }) {
    const { t } = useTranslation();
    const label = t('requestSteps.label', { n: current + 1, total: steps.length, name: steps[current]?.label ?? '' });
    return (
        <View style={flush ? { paddingBottom: 18, gap: 6 } : { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 0, gap: 6 }} accessibilityLabel={label}>
            <View className="flex-row items-center">
                {steps.map((s, i) => {
                    const done = i < current;
                    const active = i === current;
                    return (
                        <View key={s.key} className="flex-row items-center" style={{ flex: i === steps.length - 1 ? 0 : 1 }}>
                            <View
                                className="items-center justify-center"
                                style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 8,
                                    backgroundColor: done ? DONE_BG : active ? '#DCE6FB' : '#FFFFFF',
                                    borderWidth: done || active ? 0 : 1.5,
                                    borderColor: LINE,
                                }}
                            >
                                {done ? <Check size={10} color={DONE_CHECK} strokeWidth={3} /> : null}
                                {active ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: BLUE }} /> : null}
                            </View>
                            {i < steps.length - 1 ? (
                                <View style={{ flex: 1, height: 1.5, marginHorizontal: 5, borderRadius: 1, backgroundColor: done ? DONE_LINE : LINE }} />
                            ) : null}
                        </View>
                    );
                })}
            </View>
            <Text className="font-outfit-medium" style={{ fontSize: 13, color: MUTED }}>{label}</Text>
        </View>
    );
}

/** The timeline of the immediate / video-call flow for the screen that renders it. */
export function RequestSteps({ type, step, flush }: { type?: string | string[]; step: (typeof IMMEDIATE)[number] | (typeof VIDEO)[number]; flush?: boolean }) {
    const { t } = useTranslation();
    const keys: readonly string[] = type === 'videocall' ? VIDEO : IMMEDIATE;
    const index = keys.indexOf(step);
    if (index < 0) return null;
    return <Timeline steps={keys.map((key) => ({ key, label: t(`requestSteps.${key}`) }))} current={index} flush={flush} />;
}
