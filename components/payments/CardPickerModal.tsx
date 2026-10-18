import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AO } from '@/components/offer/OfferSections';
import type { PaymentCard } from '@/lib/dao/interfaces';
import { cardLabel, isExpired } from '@/lib/payments/cardLabel';
import { RETURN_TO_BACK } from '@/lib/payments/cardRequired';

type Props = {
  visible: boolean;
  cards: PaymentCard[];
  selectedId: string | null;
  onSelect: (card: PaymentCard) => void;
  onClose: () => void;
};

/**
 * Bottom sheet to pick which saved card pays for a request. Expired cards are
 * listed but cannot be picked; "Manage cards" opens "Mis tarjetas" to add one.
 */
export function CardPickerModal({ visible, cards, selectedId, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const manage = () => {
    onClose();
    router.push({ pathname: '/payment-cards', params: { returnTo: RETURN_TO_BACK } });
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <View
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 34,
          maxHeight: '70%',
        }}
      >
        <Text className="font-outfit-bold" style={{ fontSize: 17, color: AO.text, marginBottom: 12 }}>
          {t('paymentCards.picker.title')}
        </Text>
        <ScrollView>
          {cards.map((card) => {
            const expired = isExpired(card);
            const selected = card.id === selectedId;
            return (
              <TouchableOpacity
                key={card.id}
                disabled={expired}
                onPress={() => onSelect(card)}
                className="flex-row items-center"
                style={{
                  gap: 12,
                  padding: 14,
                  marginBottom: 8,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: selected ? AO.blue : AO.border,
                  backgroundColor: selected ? AO.blueSofter : '#fff',
                  opacity: expired ? 0.5 : 1,
                }}
              >
                <Ionicons name="card-outline" size={20} color={AO.blue} />
                <View style={{ flex: 1 }}>
                  <Text className="font-outfit-semibold" style={{ fontSize: 14.5, color: AO.text }}>
                    {cardLabel(card)}
                  </Text>
                  {(expired || card.isDefault) && (
                    <Text className="font-outfit-regular" style={{ fontSize: 12, color: expired ? AO.red : AO.muted }}>
                      {expired ? t('paymentCards.picker.expired') : t('paymentCards.picker.default')}
                    </Text>
                  )}
                </View>
                {selected && <Ionicons name="checkmark-circle" size={22} color={AO.blue} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={manage} className="flex-row items-center justify-center" style={{ gap: 6, paddingVertical: 12 }}>
          <Ionicons name="add-circle-outline" size={18} color={AO.blue} />
          <Text className="font-outfit-bold" style={{ color: AO.blue, fontSize: 14 }}>
            {t('paymentCards.picker.manage')}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
