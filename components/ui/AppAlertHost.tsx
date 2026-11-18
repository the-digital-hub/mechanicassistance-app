import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { OS, cardShadow } from '@/components/on-site/ui';
import { type AppAlertButton, type AppAlertRequest, dismissAppAlert, subscribeAppAlerts } from '@/lib/ui/appAlert';

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
    // Tap outside / back: the cancel button, or just closing when it is a plain message.
    const dismiss = () => {
        if (cancel) press(cancel);
        else if (buttons.length <= 1) press(buttons[0]);
    };

    return (
        <Modal visible={!!current} transparent animationType="fade" statusBarTranslucent onRequestClose={dismiss} onDismiss={() => pending.run?.()}>
            <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(11,21,48,0.55)' }} testID="app-alert">
                <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={dismiss} accessible={false} />
                <View className="w-full" style={[cardShadow, { maxWidth: 400, borderRadius: 24, padding: 20, maxHeight: '80%' }]}>
                    <View className="items-center justify-center self-center" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: tone.bg }}>
                        <Ionicons name={tone.icon} size={28} color={tone.color} />
                    </View>
                    {shown.title ? (
                        <Text className="font-outfit-bold text-center" style={{ fontSize: 20, lineHeight: 26, color: OS.text, marginTop: 14 }}>{shown.title}</Text>
                    ) : null}
                    {shown.message ? (
                        <ScrollView style={{ flexGrow: 0, marginTop: 8 }}>
                            <Text className="font-outfit-regular text-center" style={{ fontSize: 16, lineHeight: 23, color: OS.muted }}>{shown.message}</Text>
                        </ScrollView>
                    ) : null}

                    {(okOnly ? [{ text: t('common.ok') } as AppAlertButton] : actions).map((b, i) => (
                        <TouchableOpacity
                            key={`${b.text}-${i}`}
                            onPress={() => press(okOnly ? buttons[0] : b)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            className="items-center justify-center"
                            style={{ minHeight: 52, borderRadius: 14, marginTop: i === 0 ? 20 : 8, backgroundColor: b.style === 'destructive' ? OS.red : OS.blue }}
                            testID={i === 0 ? 'app-alert-primary' : undefined}
                        >
                            <Text className="font-outfit-bold text-white" style={{ fontSize: 17, lineHeight: 23 }}>{b.text}</Text>
                        </TouchableOpacity>
                    ))}
                    {cancel ? (
                        <TouchableOpacity
                            onPress={() => press(cancel)}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            className="items-center justify-center"
                            style={{ minHeight: 48, marginTop: actions.length ? 6 : 20 }}
                            testID="app-alert-cancel"
                        >
                            <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: OS.muted }}>{cancel.text ?? t('common.cancel')}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}
