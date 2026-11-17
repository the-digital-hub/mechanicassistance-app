import React from 'react';
import { useTranslation } from 'react-i18next';

import { OnSiteDialog } from '@/components/on-site/ui';

type Tone = 'orange' | 'red' | 'blue';
interface Message {
    title: string;
    body: string;
    tone: Tone;
}

/**
 * A message in the app's own look (OnSiteDialog), in place of the system `Alert.alert`.
 * `notify` resolves when the person dismisses it, so a screen that is about to navigate away
 * can wait for it. Render `dialog` once in the screen.
 */
export function useMessageDialog() {
    const { t } = useTranslation();
    const [message, setMessage] = React.useState<Message | null>(null);
    const [visible, setVisible] = React.useState(false);
    const resolver = React.useRef<(() => void) | null>(null);

    const notify = React.useCallback((title: string, body: string, tone: Tone = 'orange') => {
        setMessage({ title, body, tone });
        setVisible(true);
        return new Promise<void>((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    const close = () => {
        setVisible(false);
        resolver.current?.();
        resolver.current = null;
    };

    const dialog = (
        <OnSiteDialog
            visible={visible}
            tone={message?.tone ?? 'orange'}
            icon={message?.tone === 'blue' ? 'information-circle-outline' : 'alert-circle-outline'}
            title={message?.title ?? ''}
            body={message?.body ?? ''}
            primaryLabel={t('common.ok')}
            onPrimary={close}
            testID="message-dialog"
        />
    );

    return { notify, dialog };
}
