import { NumericKeypad } from '@/components/ui/Keypad';
import { getIdToken, sendOTP, verifyOTP } from '@/lib/firebase/auth';
import { userDAO } from '@/lib/dao/UserDAO';
import { getSetupProgress, saveSetupProgress } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { ActivityIndicator, Keyboard, Modal, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function OTPScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const [code, setCode] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [showKeypad, setShowKeypad] = useState(true);
    const otpInputRef = useRef<TextInput>(null);

    const [errorModal, setErrorModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        actionLabel?: string;
        onAction?: () => void;
        isSuccess?: boolean;
    }>({ visible: false, title: '', message: '' });

    const showError = (title: string, message: string, action?: { label: string; onPress: () => void }, isSuccess?: boolean) => {
        setErrorModal({ visible: true, title, message, actionLabel: action?.label, onAction: action?.onPress, isSuccess });
    };
    const hideError = () => setErrorModal(prev => ({ ...prev, visible: false }));

    useEffect(() => {
        setTimeout(() => otpInputRef.current?.focus(), 100);
    }, []);

    useEffect(() => {
        loadPhoneNumber();
    }, []);

    const loadPhoneNumber = async () => {
        const progress = await getSetupProgress();
        if (progress.phone?.phoneNumber) {
            const raw = progress.phone.phoneNumber;
            const digits = raw.replace(/\D/g, '').slice(-10);
            setPhoneNumber(`+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
        }
    };

    const handleKeyPress = (key: string) => {
        if (code.length < 6) {
            setCode(prev => prev + key);
        }
    };

    const handleDelete = () => {
        setCode(prev => prev.slice(0, -1));
    };

    const handleSubmit = async (codeToVerify?: string) => {
        const currentCode = typeof codeToVerify === 'string' ? codeToVerify : code;
        if (currentCode.length < 6) return;

        setIsVerifying(true);
        try {
            const firebaseUser = await verifyOTP(currentCode);
            // Store Firebase UID in setup progress so registration can link Firebase ↔ SQLite
            await saveSetupProgress('otp', { verified: true, firebaseUid: firebaseUser.uid });

            // The rest of the setup flow uploads a profile picture and an identity
            // document before the account exists, and the gateway requires a Bearer
            // token on those routes. Trade the verified OTP for a scoped token now.
            try {
                const idToken = await getIdToken();
                if (idToken) {
                    const progress = await getSetupProgress();
                    await userDAO.fetchSignupToken(idToken, progress.phone?.phoneNumber);
                }
            } catch (tokenErr) {
                // Don't strand the user on the OTP screen — the OTP itself succeeded.
                // The uploads surface their own error if the token is missing.
                console.error('Failed to obtain signup token:', tokenErr);
            }

            router.push('/setup/role-selection');
        } catch (err: any) {
            const rawMessage = err.message || '';
            const displayMessage = rawMessage.includes('auth/too-many-requests')
                ? t('setup.otp.tooManyAttempts')
                : rawMessage || t('setup.otp.invalidCodeMessage');

            showError(t('setup.otp.invalidCodeTitle'), displayMessage);
            setCode('');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        const progress = await getSetupProgress();
        const phone = progress.phone?.phoneNumber;
        if (!phone) return;

        setIsResending(true);
        try {
            await sendOTP(phone);
            setCode('');
            showError(t('setup.otp.codeSentTitle'), t('setup.otp.codeSentMessage'), undefined, true);
        } catch (err: any) {
            const rawMessage = err.message || '';
            const displayMessage = rawMessage.includes('auth/too-many-requests')
                ? t('setup.otp.waitBeforeResend')
                : rawMessage || t('setup.otp.resendFailed');

            showError(t('setup.otp.errorTitle'), displayMessage);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <>
            <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setShowKeypad(false); }} accessible={false}>
                <View className="flex-1 justify-between" style={{ backgroundColor: '#F6F8FC' }}>
                    <View className="px-6 pt-6 flex-1">
                        {/* Section Badge */}
                        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                                {t('setup.otp.badge')}
                            </Text>
                        </View>

                        {/* Title */}
                        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                            {t('setup.otp.title')}
                        </Text>

                        {/* Subtitle */}
                        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                            {t('setup.otp.subtitle', { phone: phoneNumber || t('setup.otp.yourPhone') })}
                        </Text>

                        {/* 6-Digit Input Display with Native Autofill support */}
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => { setShowKeypad(true); otpInputRef.current?.focus(); }}
                            className="flex-row justify-between mb-12 px-4 relative"
                        >
                            {[0, 1, 2, 3, 4, 5].map((index) => (
                                <View
                                    key={index}
                                    className={`w-10 border-b-2 items-center pb-2 ${code.length === index ? 'border-[#0047AB]' : 'border-slate-300'}`}
                                >
                                    <Text className="text-3xl font-outfit-bold text-[#0F172A]">
                                        {code[index] || ''}
                                    </Text>
                                </View>
                            ))}

                            <TextInput
                                ref={otpInputRef}
                                value={code}
                                onChangeText={(text) => {
                                    const digits = text.replace(/\D/g, '').slice(0, 6);
                                    setCode(digits);
                                    if (digits.length === 6) {
                                        Keyboard.dismiss();
                                        handleSubmit(digits);
                                    }
                                }}
                                keyboardType="number-pad"
                                textContentType="oneTimeCode"
                                autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                                maxLength={6}
                                style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }}
                                caretHidden={true}
                            />
                        </TouchableOpacity>

                        <View className="mb-4">
                            <TouchableOpacity
                                onPress={() => { Keyboard.dismiss(); handleSubmit(); }}
                                activeOpacity={0.8}
                                disabled={isVerifying}
                                className="mb-6"
                            >
                                <LinearGradient
                                    colors={['#2B66F8', '#081E72']}
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
                                    {isVerifying ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-outfit-bold text-center mr-2">{t('setup.otp.verify')}</Text>
                                            <ChevronRight size={20} color="white" />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                            <TouchableOpacity className="mb-6" onPress={handleResend} disabled={isResending}>
                                <Text className="text-[#0047AB] text-center font-outfit-medium">
                                    {isResending ? t('setup.otp.sending') : t('setup.otp.resendCode')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {showKeypad && (
                        <NumericKeypad
                            onKeyPress={handleKeyPress}
                            onDelete={handleDelete}
                        />
                    )}
                </View>
            </TouchableWithoutFeedback>

            {/* Error Modal */}
            <Modal
                visible={errorModal.visible}
                transparent
                animationType="fade"
                onRequestClose={hideError}
            >
                <View className="flex-1 bg-black/40 justify-center items-center px-6">
                    <View className="bg-white rounded-3xl w-full p-8 items-center shadow-xl">
                        <View className="w-16 h-16 bg-red-50 rounded-full justify-center items-center mb-6">
                            <Ionicons name="alert-circle" size={32} color={errorModal.isSuccess ? '#10B981' : '#EF4444'} />
                        </View>

                        <Text className="text-xl font-outfit-bold text-[#0F172A] mb-2 text-center">
                            {errorModal.title}
                        </Text>

                        <Text className="text-base font-outfit-regular text-slate-500 text-center mb-8">
                            {errorModal.message}
                        </Text>

                        {errorModal.onAction && (
                            <TouchableOpacity
                                className="bg-blue-700 w-full py-4 rounded-xl shadow-sm active:opacity-90 mb-3"
                                onPress={() => {
                                    hideError();
                                    errorModal.onAction?.();
                                }}
                            >
                                <Text className="text-white text-center font-outfit-bold text-lg">
                                    {errorModal.actionLabel}
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            className="bg-slate-100 w-full py-4 rounded-xl active:opacity-90"
                            onPress={hideError}
                        >
                            <Text className="text-slate-700 text-center font-outfit-bold text-lg">
                                {errorModal.onAction ? t('setup.otp.cancel') : t('setup.otp.gotIt')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </>
    );
}
