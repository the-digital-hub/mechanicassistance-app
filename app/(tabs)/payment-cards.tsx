import { CardField, StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { CreditCard, Info, Lock, Plus, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { WalletSection } from '@/components/payments/WalletSection';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ApiError } from '@/lib/api/types';
import type { PaymentCard } from '@/lib/dao/interfaces';
import { paymentMethodDAO } from '@/lib/dao/PaymentMethodDAO';
import { brandName, isExpired } from '@/lib/payments/cardLabel';
import { RETURN_TO_BACK } from '@/lib/payments/cardRequired';

/** Matches `scheme` in app.json: Stripe returns here after a 3-D Secure check. */
const STRIPE_URL_SCHEME = 'mechanic';

const CARD_SHADOW = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 8,
  elevation: 6,
};

/**
 * "Wallet & payments" for the customer: the prepaid wallet (balance, add funds,
 * movements), then the cards billing has on file and a form to add one.
 *
 * The form is our own view around Stripe's CardField: the number goes from that
 * field straight to Stripe, which confirms the setup intent billing opened (and
 * runs 3-D Secure when the bank asks). Billing then reads the card back from
 * Stripe — the app never sends card details to our backend.
 */
export default function PaymentCardsScreen() {
  const { t } = useTranslation();
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  useEffect(() => {
    (async () => {
      try {
        const { publishableKey: key } = await paymentMethodDAO.getConfig();
        setPublishableKey(key);
        setState(key ? 'ready' : 'unavailable');
      } catch {
        setState('unavailable');
      }
    })();
  }, []);

  if (state === 'loading') {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: '#F6F8FC' }}>
        <ActivityIndicator color="#0047AB" />
      </View>
    );
  }

  if (state === 'unavailable' || !publishableKey) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: '#F6F8FC' }}>
        <Text className="text-gray-500 font-outfit-regular text-base text-center">
          {t('paymentCards.unavailable')}
        </Text>
      </View>
    );
  }

  return (
    <StripeProvider publishableKey={publishableKey} urlScheme={STRIPE_URL_SCHEME}>
      <PaymentCardsContent />
    </StripeProvider>
  );
}

function PaymentCardsContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const { confirmSetupIntent } = useStripe();
  // Set when the request-assistance flow sent the customer here to add a card;
  // saving one takes them back to their request.
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const resumesRequest =
    returnTo === RETURN_TO_BACK || (typeof returnTo === 'string' && returnTo.startsWith('/request-assistance'));

  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PaymentCard | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setCards(await paymentMethodDAO.list());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => {
    setFormOpen(false);
    setCardComplete(false);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!cardComplete || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const intent = await paymentMethodDAO.createSetupIntent();
      const { setupIntent, error } = await confirmSetupIntent(intent.clientSecret, {
        paymentMethodType: 'Card',
      });
      if (error) {
        // Stripe's own message says what is wrong with the card (declined,
        // incomplete, failed 3-D Secure); a cancelled check is not an error.
        if (error.code !== 'Canceled') setFormError(error.localizedMessage ?? error.message);
        return;
      }
      await paymentMethodDAO.confirmCard(setupIntent?.id ?? intent.setupIntentId);
      closeForm();
      if (resumesRequest && returnTo) {
        // This tab screen stays mounted: clear the param so a later visit from
        // the profile menu does not bounce back into the request.
        router.setParams({ returnTo: undefined });
        if (returnTo === RETURN_TO_BACK) router.back();
        else router.replace(returnTo as never);
        return;
      }
      await load();
    } catch {
      setFormError(t('paymentCards.addError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (card: PaymentCard) => {
    setActionError(null);
    setBusyId(card.id);
    try {
      await paymentMethodDAO.setDefault(card.id);
      await load();
    } catch {
      setActionError(t('paymentCards.setDefaultError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async () => {
    const target = pendingRemoval;
    setPendingRemoval(null);
    if (!target) return;

    setActionError(null);
    setBusyId(target.id);
    try {
      await paymentMethodDAO.remove(target.id);
      await load();
    } catch (err) {
      setActionError(
        err instanceof ApiError && err.statusCode === 409
          ? t('paymentCards.deleteInUse')
          : t('paymentCards.deleteError'),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <ConfirmationModal
        visible={pendingRemoval !== null}
        title={t('paymentCards.deleteTitle')}
        message={t('paymentCards.deleteMessage', { last4: pendingRemoval?.last4 ?? '' })}
        icon={Trash2}
        confirmText={t('paymentCards.delete')}
        cancelText={t('paymentCards.cancel')}
        confirmButtonColor="#EF4444"
        onConfirm={handleRemove}
        onClose={() => setPendingRemoval(null)}
      />

      <ScrollView
        style={{ backgroundColor: '#F6F8FC' }}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section Badge */}
        <View
          className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}
        >
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
            {t('paymentCards.badge')}
          </Text>
        </View>

        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          {t('paymentCards.title')}
        </Text>

        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
          {t('paymentCards.subtitle')}
        </Text>

        {resumesRequest && (
          <View
            className="flex-row items-start gap-2 rounded-xl p-4 mb-6"
            style={{ backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}
          >
            <Info size={18} color="#0047AB" style={{ marginTop: 1 }} />
            <Text className="flex-1 text-gray-900 font-outfit-regular text-sm">
              {t('paymentCards.returnBanner')}
            </Text>
          </View>
        )}

        {!resumesRequest && <WalletSection cards={cards} />}

        <Text className="text-gray-900 font-outfit-semibold text-lg mb-3">
          {t('paymentCards.cardsHeading')}
        </Text>

        {loading ? (
          <ActivityIndicator color="#0047AB" />
        ) : loadError ? (
          <View className="items-center">
            <Text className="text-gray-500 font-outfit-regular text-base mb-4">
              {t('paymentCards.loadError')}
            </Text>
            <TouchableOpacity onPress={load} className="px-5 py-3 rounded-lg border border-gray-300">
              <Text className="text-gray-900 font-outfit-semibold">{t('paymentCards.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {cards.length === 0 && !formOpen && (
              <View className="items-center mb-6">
                <CreditCard size={36} color="#9CA3AF" />
                <Text className="text-gray-900 font-outfit-medium text-lg mt-3">
                  {t('paymentCards.emptyTitle')}
                </Text>
                <Text className="text-gray-500 font-outfit-regular text-sm text-center mt-1">
                  {t('paymentCards.emptySubtitle')}
                </Text>
              </View>
            )}

            {cards.map((card) => (
              <View key={card.id} className="bg-white rounded-2xl p-4 mb-3" style={CARD_SHADOW}>
                <View className="flex-row items-center">
                  <View
                    className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                    style={{ backgroundColor: '#F4F8FF' }}
                  >
                    <CreditCard size={22} color="#0047AB" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-outfit-semibold text-base">
                      {brandName(card.brand)} •••• {card.last4}
                    </Text>
                    {card.expMonth && card.expYear ? (
                      <Text
                        className="font-outfit-regular text-sm"
                        style={{ color: isExpired(card) ? '#EF4444' : '#6B7280' }}
                      >
                        {t(isExpired(card) ? 'paymentCards.expired' : 'paymentCards.expires', {
                          date: `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`,
                        })}
                      </Text>
                    ) : null}
                  </View>
                  {card.isDefault && (
                    <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: '#E9F1FF' }}>
                      <Text className="font-outfit-bold text-[10px] tracking-widest" style={{ color: '#0047AB' }}>
                        {t('paymentCards.defaultBadge')}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row justify-end gap-4 mt-3 pt-3" style={{ borderTopWidth: 1, borderTopColor: '#E1EAFB' }}>
                  {busyId === card.id ? (
                    <ActivityIndicator color="#0047AB" />
                  ) : (
                    <>
                      {!card.isDefault && (
                        <TouchableOpacity onPress={() => handleSetDefault(card)} disabled={busyId !== null}>
                          <Text className="text-blue-600 font-outfit-semibold text-sm">
                            {t('paymentCards.makeDefault')}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => setPendingRemoval(card)} disabled={busyId !== null}>
                        <Text className="font-outfit-semibold text-sm" style={{ color: '#EF4444' }}>
                          {t('paymentCards.delete')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))}

            {actionError && (
              <Text className="font-outfit-regular text-sm mb-3" style={{ color: '#EF4444' }}>
                {actionError}
              </Text>
            )}

            {formOpen ? (
              <View className="bg-white rounded-2xl p-4 mt-2" style={CARD_SHADOW}>
                <Text className="text-gray-900 font-outfit-semibold text-base mb-1">
                  {t('paymentCards.formTitle')}
                </Text>
                <Text className="text-gray-500 font-outfit-regular text-sm mb-3">
                  {t('paymentCards.formHint')}
                </Text>

                <CardField
                  postalCodeEnabled
                  countryCode="US"
                  onCardChange={(details) => setCardComplete(details.complete)}
                  cardStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#D1D5DB',
                    borderWidth: 1,
                    borderRadius: 16,
                    textColor: '#111827',
                    placeholderColor: '#9CA3AF',
                    textErrorColor: '#EF4444',
                    fontSize: 17,
                  }}
                  style={{ height: 52, width: '100%' }}
                />

                {formError && (
                  <Text className="font-outfit-regular text-sm mt-2" style={{ color: '#EF4444' }}>
                    {formError}
                  </Text>
                )}

                <View className="flex-row gap-3 mt-4">
                  <TouchableOpacity
                    onPress={closeForm}
                    disabled={saving}
                    activeOpacity={0.8}
                    style={{ flex: 0.3 }}
                    className="py-4 rounded-lg border border-gray-300 items-center"
                  >
                    <Text className="text-gray-900 font-outfit-semibold text-base">{t('paymentCards.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={!cardComplete || saving}
                    activeOpacity={0.8}
                    style={{ flex: 0.7, opacity: !cardComplete || saving ? 0.6 : 1 }}
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
                      {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text className="text-white font-outfit-bold text-center">{t('paymentCards.saveCard')}</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setFormOpen(true)} activeOpacity={0.8} className="mt-2">
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
                    gap: 8,
                  }}
                >
                  <Plus size={18} color="#FFFFFF" />
                  <Text className="text-white font-outfit-bold text-center">{t('paymentCards.addCard')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <View className="flex-row items-start gap-2 mt-6 px-1">
              <Lock size={14} color="#9CA3AF" style={{ marginTop: 2 }} />
              <Text className="flex-1 text-gray-400 font-outfit-regular text-xs">
                {t('paymentCards.securityNote')}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
