import { Heart, MapPin, Star } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export default function PromotionsScreen() {
    const promoCode = 'Code:MA08-124578-28-06062025';

    return (
        <ScrollView style={{ backgroundColor: '#F6F8FC' }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                PROMOTIONS
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
              Promotions
            </Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Get access to exclusive discounts and special offers
            </Text>

            {/* Promotion Card */}
            <View className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-6">
                {/* Header */}
                <View className="flex-row items-center mb-4">
                    <View className="w-12 h-12 bg-cyan-50 rounded-full justify-center items-center mr-3 border border-cyan-100">
                        <Text className="text-cyan-500 text-center font-outfit-bold text-xs leading-3">10%{'\n'}Off</Text>
                    </View>
                    <View className="flex-1">
                        <Text className="text-blue-900 font-outfit-bold text-base">ASE Certification exam</Text>
                        <View className="flex-row items-center">
                            <Text className="text-cyan-500 text-xs font-outfit-medium mr-2">recommended</Text>
                            {[...Array(5)].map((_, i) => (
                                <Star key={i} size={10} color="#06b6d4" fill="#06b6d4" style={{ marginRight: 1 }} />
                            ))}
                        </View>
                    </View>
                    <Heart size={20} color="#06b6d4" fill="#06b6d4" />
                </View>

                {/* Map Placeholder */}
                <View className="w-full h-24 bg-gray-100 rounded-lg mb-3 justify-center items-center overflow-hidden">
                    {/* Placeholder for Map Image - Using a simple pattern or icon */}
                    <MapPin size={24} color="#9CA3AF" />
                    <Text className="text-gray-400 text-xs mt-1">Map View</Text>
                </View>

                <Text className="text-gray-800 text-xs font-outfit-medium">Address: 778 Locust View Drive Oakland, CA</Text>
                <Text className="text-gray-500 text-xs font-outfit-regular mb-1">7:00 am - 6:30 pm</Text>
                <View className="flex-row items-center">
                    <View className="w-2 h-2 rounded-full bg-gray-300 mr-1" />
                    <Text className="text-gray-400 text-[10px] font-outfit-regular">Distance: 2.5 km</Text>
                </View>
            </View>

            <Text className="text-lg font-outfit-bold text-gray-900 mb-2">Special Offer for ASE Members</Text>
            <Text className="text-gray-600 font-outfit-regular mb-4 leading-5">
                Enjoy a 10% discount on all our services exclusively for ASE-certified professionals.{'\n\n'}
                Boost your visibility, grow your business, and access premium features at a reduced rate.
            </Text>
            <Text className="text-gray-900 font-outfit-bold mb-6">Promo valid through: 06/06/2026</Text>

            <View className="bg-blue-50/50 p-4 rounded-xl items-center mb-4 border border-blue-100">
                <Text className="text-blue-900 font-outfit-bold text-lg mb-1">Ask for your benefit</Text>
                <Text className="text-cyan-500 font-outfit-medium text-xs text-center">{promoCode}</Text>
            </View>

            <View className="items-center justify-center p-4 bg-blue-900 rounded-2xl mb-10">
                <View className="bg-white p-2 rounded-xl">
                    <QRCode
                        value={promoCode}
                        size={200}
                        color="black"
                        backgroundColor="white"
                    />
                </View>
            </View>
        </ScrollView>
    );
}
