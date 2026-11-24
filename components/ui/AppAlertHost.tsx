import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { OS, cardShadow } from '@/components/on-site/ui';
import { type AppAlertButton, type AppAlertRequest, dismissAppAlert, subscribeAppAlerts } from '@/lib/ui/appAlert';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';

/**
 * Where the alert is drawn. On iOS a Modal cannot open over another Modal that is already showing (a bottom sheet): the alert simply never
 * appeared. A window of its own above everything (`FullWindowOverlay`) does, so the app's designed dialog shows over sheets too.
 */
function AlertLayer({ visible, onRequestClose, onDismiss, children }: { visible: boolean; onRequestClose: () => void; onDismiss: () => void; children: React.ReactNode }) {
    if (Platform.OS === 'ios') {
        return visible ? (
            <FullWindowOverlay>
                <View style={{ position: 'absolute', width: '100%', height: '100%' }}>{children}</View>
            </FullWindowOverlay>
        ) : null;
    }
    return (
        <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onRequestClose} onDismiss={onDismiss}>
            {children}
        </Modal>
    );
}

/** Draws `appAlert` calls with the app's dialog design. Mount once, at the root. */
export function AppAlertHost() {
    const { t } = useTranslation();
    const pendingRef = React.useRef<{ run: (() => void) | null }>({ run: null });
    const [queue, setQueue] = React.useState<AppAlertRequest[]>([]);
    React.useEffect(() => subscribeAppAlerts(setQueue), []);

    const current = queue[0] ?? null;
    // Keeps the content while the fade-out runs.
    const [shown, setShown] = React.useState<AppAlertRequest | null>(null);
    React.useEffect(() => {
        if (current) setShown(current);
    }, [current]);
    if (!shown) return null;

    const buttons = shown.buttons;
    const cancel = buttons.find((b) => b.style === 'cancel');
    const actions = buttons.filter((b) => b !== cancel);
    const destructive = actions.some((b) => b.style === 'destructive');
    const TONES = {
        info: { color: OS.blue, bg: OS.blueSoft, icon: 'information-circle-outline' },
        success: { color: OS.greenDark, bg: OS.greenSoft, icon: 'checkmark-circle-outline' },
        warning: { color: OS.orangeText, bg: OS.orangeSoft, icon: 'alert-circle-outline' },
        danger: { color: OS.red, bg: OS.redSoft, icon: 'alert-circle-outline' },
    } as const;
    const base = TONES[destructive ? 'danger' : shown.options?.tone ?? 'info'];
    const tone = { ...base, icon: (shown.options?.icon ?? base.icon) as React.ComponentProps<typeof Ionicons>['name'] };
    // A lone message gets a plain "OK".
    const okOnly = buttons.length === 1 && !buttons[0].text;

    // The button's action runs once the dialog is gone: a native picker (photos, files, camera)
    // started while this modal is still fading out is silently refused by iOS.
    const pending = pendingRef.current;
    const press = (b: AppAlertButton | undefined) => {
        const action = () => {
            b?.onPress?.();
            if (!b) shown.options?.onDismiss?.();
        };
        let ran = false;
        const once = () => {
            if (ran) return;
            ran = true;
            pending.run = null;
            action();
        };
        pending.run = once;
        dismissAppAlert(shown.id);
        setTimeout(once, 450); // iOS also calls the Modal's onDismiss: whichever comes first.
    };
    // Tap outside / back: the cancel button, or just closing when it is a plain message (or one that says it can be dismissed: `cancelable`).
    const dismiss = () => {
        if (cancel) press(cancel);
        else if (buttons.length <= 1) press(buttons[0]);
        // Information with a way on (like "Learn more"): tapping outside just closes it, doing none of the buttons.
        else if (shown.options?.cancelable) press(undefined);
    };

    return (
        <AlertLayer visible={!!current} onRequestClose={dismiss} onDismiss={() => pending.run?.()}>
            <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(11,21,48,0.55)' }} testID="app-alert">
                <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={dismiss} accessible={false} />
                <View className="w-full" style={[cardShadow, { maxWidth: 400, borderRadius: 24, padding: 20, maxHeight: '80%' }]}>
                    <View className="items-center justify-center self-center" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tone.bg }}>
                        <Ionicons name={tone.icon} size={28} color={tone.color} />
                    </View>
                    {shown.title ? (
                        <Text className="font-outfit-bold text-center" style={{ fontSize: 20, lineHeight: 26, color: OS.text, marginTop: 14 }}>{shown.title}</Text>
                    ) : null}
                    {shown.options?.highlight ? (
                        <View className="flex-row items-center" style={{ marginTop: 14, gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: tone.bg }} testID="app-alert-highlight">
                            <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF' }}>
                                <Ionicons name={(shown.options.highlight.icon ?? 'calendar-outline') as React.ComponentProps<typeof Ionicons>['name']} size={24} color={tone.color} />
                            </View>
                            <View className="flex-1">
                                <Text className="font-outfit-semibold" style={{ fontSize: 13, lineHeight: 17, letterSpacing: 0.4, color: OS.muted, textTransform: 'uppercase' }}>{shown.options.highlight.label}</Text>
                                <Text className="font-outfit-bold" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: OS.text, marginTop: 2 }}>{shown.options.highlight.value}</Text>
                                {shown.options.highlight.sub ? (
                                    <Text className="font-outfit-bold" style={{ fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: tone.color }}>{shown.options.highlight.sub}</Text>
                                ) : null}
                            </View>
                        </View>
                    ) : null}
                    {shown.message ? (
                        <ScrollView style={{ flexGrow: 0, marginTop: 8 }}>
                            <Text className="font-outfit-regular text-center" style={{ fontSize: 16, lineHeight: 23, color: OS.muted }}>{shown.message}</Text>
                        </ScrollView>
                    ) : null}
                    {shown.options?.highlight?.ref ? (
                        <Text className="font-outfit-regular text-center" style={{ fontSize: 12, lineHeight: 16, color: '#9CA3AF', marginTop: 10 }} selectable testID="app-alert-ref">{shown.options.highlight.ref}</Text>
                    ) : null}

                    {(okOnly ? [{ text: t('common.ok') } as AppAlertButton] : actions).map((b, i) => {
                        const soft = b.style === 'secondary';
                        return (
                            <TouchableOpacity
                                key={`${b.text}-${i}`}
                                onPress={() => press(okOnly ? buttons[0] : b)}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                className="flex-row items-center"
                                // With an icon the row reads left to right (the squares line up in a column); without, the label is centred.
                                style={{ gap: 12, minHeight: 56, justifyContent: b.icon ? 'flex-start' : 'center', paddingHorizontal: b.icon ? 10 : 0, borderRadius: 14, marginTop: i === 0 ? 20 : 8, backgroundColor: soft ? '#E6EAF2' : b.style === 'destructive' ? OS.red : b.style === 'success' ? '#12B76A' : OS.blue }}
                                testID={i === 0 ? 'app-alert-primary' : undefined}
                            >
                                {b.icon ? (
                                    // The icon in its little rounded square, as everywhere else in the app.
                                    <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: soft ? '#FFFFFF' : 'rgba(255,255,255,0.2)' }}>
                                        <Ionicons name={b.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color={soft ? OS.blue : '#FFFFFF'} />
                                    </View>
                                ) : null}
                                <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: soft ? '#4A5470' : '#FFFFFF' }}>{b.text}</Text>
                            </TouchableOpacity>
                        );
                    })}
                    {cancel ? (
                        <TouchableOpacity
                            onPress={() => press(cancel)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            className="items-center justify-center"
                            // A choice among soft buttons ends in a plain red "Cancel" (the red of the app's ways out), not one more button.
                            style={actions.length > 0 && actions.every((b) => b.style === 'secondary')
                                ? { minHeight: 52, marginTop: 4 }
                                : { minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2', marginTop: actions.length ? 8 : 20 }}
                            testID="app-alert-cancel"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 18, lineHeight: 24, color: actions.length > 0 && actions.every((b) => b.style === 'secondary') ? OS.red : '#4A5470' }}>{cancel.text ?? t('common.cancel')}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </AlertLayer>
    );
}
