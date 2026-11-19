import { useUser } from '@/context/UserContext';
import { formatCountdown, useCountdown } from '@/hooks/useCountdown';
import { describeAuthError } from '@/lib/auth/describe';
import { toAuthError } from '@/lib/auth/errors';
import { confirmEmailChange, requestEmailChange } from '@/lib/auth/emailChange';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MODAL_ORIENTATIONS } from '@/lib/ui/modalOrientations';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const CODE_LENGTH = 6;
/** The backend has no resend cooldown for emails (max 5 requests/hour); this only avoids double taps. */
const RESEND_AFTER_SECONDS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Adds a sign-in email to the account, or replaces the one it has.
 *
 * Same shape as the phone change: the address, then the code emailed to it.
 * Confirming swaps the session for the one the backend returns (it signs out
 * every other device) and puts the address into the user.
 */
export default function EmailChangeScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { user, updateUser } = useUser();
    const hasEmail = !!user?.email;

    const [step, setStep] = useState<'email' | 'code'>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [isResending, setIsResending] = useState(false);

    // What the code was sent to: confirm must send exactly this address.
    const [sentTo, setSentTo] = useState('');
    const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
    const [resendAtMs, setResendAtMs] = useState<number | null>(null);
    const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
    const expiresIn = useCountdown(expiresAtMs);
    const resendIn = useCountdown(resendAtMs);

    const emailInputRef = useRef<TextInput>(null);
    const codeInputRef = useRef<TextInput>(null);
    const inFlightRef = useRef(false);

    const [modal, setModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        isSuccess?: boolean;
        onClose?: () => void;
    }>({ visible: false, title: '', message: '' });

    const showModal = (title: string, message: string, opts?: { isSuccess?: boolean; onClose?: () => void }) =>
        setModal({ visible: true, title, message, ...opts });
    const closeModal = () => {
        const onClose = modal.onClose;
        setModal((prev) => ({ ...prev, visible: false, onClose: undefined }));
        onClose?.();
    };

    useEffect(() => {
        const ref = step === 'email' ? emailInputRef : codeInputRef;
        const timer = setTimeout(() => ref.current?.focus(), 150);
        return () => clearTimeout(timer);
    }, [step]);

    const normalized = email.trim().toLowerCase();
    const emailValid = EMAIL_PATTERN.test(normalized);

    const startChallenge = (challenge: { expiresIn: number }) => {
        setExpiresAtMs(Date.now() + challenge.expiresIn * 1000);
        setResendAtMs(Date.now() + RESEND_AFTER_SECONDS * 1000);
        setAttemptsLeft(null);
        setCode('');
    };

    const handleSendCode = async () => {
        Keyboard.dismiss();
        if (inFlightRef.current) return;
        if (!emailValid) {
            showModal(t('emailChange.errorTitle'), t('emailChange.invalidEmail'));
            return;
        }
        inFlightRef.current = true;
        setIsBusy(true);
        try {
            const challenge = await requestEmailChange(normalized);
            setSentTo(normalized);
            startChallenge(challenge);
            setStep('code');
        } catch (error: unknown) {
            showModal(t('emailChange.errorTitle'), describeAuthError(error, t));
        } finally {
            inFlightRef.current = false;
            setIsBusy(false);
        }
    };

    const handleConfirm = async (value: string = code) => {
        if (value.length < CODE_LENGTH || !sentTo || inFlightRef.current) return;
        inFlightRef.current = true;
        setIsBusy(true);
        try {
            await confirmEmailChange(sentTo, value);
            // Local only: the backend already saved it, and users-service refuses an email in a profile PATCH.
            await updateUser({ email: sentTo }, false);
            showModal(
                t('emailChange.successTitle'),
                t('emailChange.successMessage', { email: sentTo }),
                { isSuccess: true, onClose: () => router.back() },
            );
        } catch (error: unknown) {
            const authError = toAuthError(error);
            setCode('');
            if (authError.code === 'already_registered') {
                // 409: the address went to another account. A new code would not help.
                showModal(t('emailChange.takenTitle'), t('emailChange.takenMessage'), {
                    onClose: () => setStep('email'),
                });
                return;
            }
            setAttemptsLeft(authError.attemptsRemaining ?? null);
            showModal(t('emailChange.invalidCodeTitle'), describeAuthError(error, t));
        } finally {
            inFlightRef.current = false;
            setIsBusy(false);
        }
    };

    const handleResend = async () => {
        if (!sentTo || resendIn > 0) return;
        setIsResending(true);
        try {
            startChallenge(await requestEmailChange(sentTo));
            showModal(t('emailChange.codeSentTitle'), t('emailChange.codeSentMessage'), { isSuccess: true });
        } catch (error: unknown) {
            showModal(t('emailChange.errorTitle'), describeAuthError(error, t));
        } finally {
            setIsResending(false);
        }
    };

    const primaryButton = (label: string, onPress: () => void, enabled: boolean) => (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={!enabled || isBusy} className="mb-6">
            <LinearGradient
                colors={enabled ? ['#2B66F8', '#081E72'] : ['#B0C4FF', '#B0C4FF']}
                start={{ x: 0, y: 1 }}
                end={{ x: 1, y: 0 }}
                style={{
                    borderRadius: 10,
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {isBusy ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <>
                        <Text className="text-white font-outfit-bold text-center mr-2">{label}</Text>
                        <ChevronRight size={20} color="white" />
                    </>
                )}
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <KeyboardAvoidingView
            className="flex-1"
            style={{ backgroundColor: '#F6F8FC' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView className="flex-1 px-6 pt-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{t('emailChange.badge')}</Text>
                </View>

                {step === 'email' ? (
                    <>
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                            {hasEmail ? t('emailChange.changeTitle') : t('emailChange.addTitle')}
                        </Text>
                        <Text className="text-gray-500 font-outfit-regular text-base mb-2">{t('emailChange.subtitle')}</Text>
                        {hasEmail && (
                            <Text className="text-gray-400 font-outfit-regular text-base mb-6">
                                {t('emailChange.current', { email: user?.email ?? '' })}
                            </Text>
                        )}

                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => emailInputRef.current?.focus()}
                            className="mt-6 mb-8 border-b-2 border-slate-200 pb-2"
                        >
                            <TextInput
                                ref={emailInputRef}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                textContentType="emailAddress"
                                autoCapitalize="none"
                                autoCorrect={false}
                                placeholder={t('emailChange.placeholder')}
                                placeholderTextColor="#CBD5E1"
                                className="text-2xl font-outfit-regular text-gray-700"
                                style={{ paddingVertical: 0 }}
                                returnKeyType="done"
                                onSubmitEditing={handleSendCode}
                                testID="email-change-address"
                            />
                        </TouchableOpacity>

                        {primaryButton(t('emailChange.sendCode'), handleSendCode, emailValid)}
                    </>
                ) : (
                    <>
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('emailChange.codeTitle')}</Text>
                        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                            {t('emailChange.codeSubtitle', { email: sentTo })}
                        </Text>

                        {/* Code boxes over a hidden input, so OS autofill still works. */}
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => codeInputRef.current?.focus()}
                            className="flex-row justify-between mb-10 px-4 relative"
                        >
                            {Array.from({ length: CODE_LENGTH }, (_, index) => (
                                <View
                                    key={index}
                                    className={`w-10 border-b-2 items-center pb-2 ${code.length === index ? 'border-[#0047AB]' : 'border-slate-300'}`}
                                >
                                    <Text className="text-3xl font-outfit-bold text-[#0F172A]">{code[index] || ''}</Text>
                                </View>
                            ))}
                            <TextInput
                                ref={codeInputRef}
                                value={code}
                                onChangeText={(text) => {
                                    const next = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
                                    setCode(next);
                                    if (next.length === CODE_LENGTH) {
                                        Keyboard.dismiss();
                                        handleConfirm(next);
                                    }
                                }}
                                keyboardType="number-pad"
                                textContentType="oneTimeCode"
                                maxLength={CODE_LENGTH}
                                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
                                caretHidden
                                testID="email-change-code"
                            />
                        </TouchableOpacity>

                        {primaryButton(t('emailChange.confirm'), () => handleConfirm(), code.length === CODE_LENGTH)}

                        <View className="mb-4 min-h-[20px]">
                            {attemptsLeft !== null && attemptsLeft > 0 ? (
                                <Text className="text-center font-outfit-medium text-red-600">
                                    {t('setup.otp.attemptsRemaining', { count: attemptsLeft })}
                                </Text>
                            ) : expiresIn > 0 ? (
                                <Text className="text-center font-outfit-medium text-slate-500">
                                    {t('setup.otp.codeExpiresIn', { time: formatCountdown(expiresIn) })}
                                </Text>
                            ) : (
                                <Text className="text-center font-outfit-medium text-red-600">{t('setup.otp.codeExpired')}</Text>
                            )}
                        </View>

                        <TouchableOpacity className="mb-4" onPress={handleResend} disabled={isResending || resendIn > 0}>
                            <Text className={`text-center font-outfit-medium ${resendIn > 0 ? 'text-slate-400' : 'text-[#0047AB]'}`}>
                                {isResending
                                    ? t('setup.otp.sending')
                                    : resendIn > 0
                                      ? t('setup.otp.resendIn', { seconds: resendIn })
                                      : t('setup.otp.resendCode')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity className="mb-6" onPress={() => { setCode(''); setStep('email'); }}>
                            <Text className="text-center font-outfit-semibold text-[#0047AB]">{t('emailChange.changeEmail')}</Text>
                        </TouchableOpacity>

                        {/* Always shown: the answer is identical whether or not the address is taken. */}
                        <Text className="text-center font-outfit-regular text-base text-slate-500 border-t border-slate-200 pt-5">
                            {t('emailChange.noCodeHint')}
                        </Text>
                    </>
                )}
            </ScrollView>

            <Modal supportedOrientations={MODAL_ORIENTATIONS} visible={modal.visible} transparent animationType="fade" onRequestClose={closeModal}>
                <View className="flex-1 bg-black/40 justify-center items-center px-6">
                    <View className="bg-white rounded-3xl w-full p-8 items-center shadow-xl">
                        <View className={`w-16 h-16 rounded-full justify-center items-center mb-6 ${modal.isSuccess ? 'bg-green-50' : 'bg-red-50'}`}>
                            <Ionicons
                                name={modal.isSuccess ? 'checkmark-circle' : 'alert-circle'}
                                size={32}
                                color={modal.isSuccess ? '#10B981' : '#EF4444'}
                            />
                        </View>
                        <Text className="text-xl font-outfit-bold text-[#0F172A] mb-2 text-center">{modal.title}</Text>
                        <Text className="text-base font-outfit-regular text-slate-500 text-center mb-8">{modal.message}</Text>
                        <TouchableOpacity className="bg-blue-700 w-full py-4 rounded-xl shadow-sm" onPress={closeModal}>
                            <Text className="text-white text-center font-outfit-bold text-lg">{t('emailChange.gotIt')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
