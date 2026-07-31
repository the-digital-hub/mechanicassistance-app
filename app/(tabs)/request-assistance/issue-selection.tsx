import { Button } from '@/components/ui/Button';
import { pricingDAO } from '@/lib/dao/PricingDAO';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Battery, ChevronLeft, ChevronRight, HelpCircle, Wrench, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

type IssueOption = { id: string; label: string };

// Fallback used only if the pricing catalog can't be fetched. These ids are NOT
// real VehicleIssue UUIDs, so pricing will fall back to "TBD" when this is used.
const FALLBACK_ISSUES: IssueOption[] = [
    { id: 'battery', label: 'Battery / Starting issue' },
    { id: 'electrical', label: 'Electrical system' },
    { id: 'starter', label: 'Starter motor' },
    { id: 'warning', label: 'Warning light' },
    { id: 'other', label: 'Other' },
];

// Pick an icon from the issue name so backend-fetched issues still render nicely.
const iconForIssue = (label: string) => {
    const n = label.toLowerCase();
    if (n.includes('batter')) return Battery;
    if (n.includes('electric')) return Zap;
    if (n.includes('start')) return Wrench;
    if (n.includes('warning') || n.includes('light')) return AlertTriangle;
    if (n.includes('other')) return HelpCircle;
    return Wrench;
};

export default function IssueSelectionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { type, vehicleId, vehicleName } = params;

    const [description, setDescription] = useState('');
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
    const [issueOptions, setIssueOptions] = useState<IssueOption[]>(FALLBACK_ISSUES);
    const [loadingIssues, setLoadingIssues] = useState(true);

    // Load the real vehicle-issue catalog so selected ids ARE the UUIDs the
    // pricing service needs. Falls back to the static list if the fetch fails.
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await pricingDAO.getVehicleIssues();
                if (mounted && Array.isArray(data) && data.length > 0) {
                    setIssueOptions(data.map(i => ({ id: i.id, label: i.name })));
                }
            } catch (err) {
                console.warn('Could not load vehicle issues; using fallback list', err);
            } finally {
                if (mounted) setLoadingIssues(false);
            }
        })();
        return () => { mounted = false; };
    }, []);

    const getTitle = () => {
        switch (type) {
            case 'immediate': return 'Immediate Assistance';
            case 'scheduled': return 'Scheduled Assistance';
            case 'videocall': return 'Video Call Assistance';
            case 'witness': return 'Accident Assistance';
            default: return 'Assistance';
        }
    };

    const getBadgeText = () => {
        switch (type) {
            case 'immediate': return 'IMMEDIATE ASSISTANCE';
            case 'scheduled': return 'SCHEDULED ASSISTANCE';
            case 'videocall': return 'VIDEO CALL ASSISTANCE';
            case 'witness': return 'ACCIDENT ASSISTANCE';
            default: return 'ASSISTANCE';
        }
    };

    const toggleIssue = (id: string) => {
        if (selectedIssues.includes(id)) {
            setSelectedIssues(selectedIssues.filter(item => item !== id));
        } else {
            setSelectedIssues([...selectedIssues, id]);
        }
    };

    const handleContinue = () => {
        router.push({
            pathname: '/request-assistance/add-details',
            params: {
                type,
                vehicleId,
                vehicleName,
                description,
                issues: selectedIssues.join(','),
            }
        });
    };

    return (
        <View className="flex-1 bg-white">
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {getBadgeText()}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-4">Indicate the issue</Text>

                <Text className="text-gray-500 font-outfit-regular text-base mb-2">
                    Describe the problem or select a common issue
                </Text>

                <View className="mb-6">
                    <TextInput
                        multiline
                        numberOfLines={4}
                        placeholder="Describe what's happening with your vehicle"
                        placeholderTextColor="#D1D5DB"
                        value={description}
                        onChangeText={setDescription}
                        className="bg-white border border-gray-300 rounded-2xl p-4 font-outfit-regular text-[#0F172A] text-base h-32"
                        style={{ textAlignVertical: 'top' }}
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-gray-900 font-outfit-medium text-lg mb-2" style={{ fontSize: 18 }}>Possible issues detected</Text>
                    <View className="rounded-xl border border-gray-100 overflow-hidden">
                        {loadingIssues ? (
                            <View className="p-6 items-center">
                                <ActivityIndicator size="small" color="#0047AB" />
                            </View>
                        ) : (
                            issueOptions.map((issue) => {
                                const isSelected = selectedIssues.includes(issue.id);
                                const Icon = iconForIssue(issue.label);
                                return (
                                    <TouchableOpacity
                                        key={issue.id}
                                        onPress={() => toggleIssue(issue.id)}
                                        className={`flex-row items-center p-4 border-b border-gray-100 ${isSelected ? 'bg-blue-600' : 'bg-white'}`}
                                    >
                                        <Icon size={20} color={isSelected ? 'white' : '#0047AB'} />
                                        <Text className={`ml-3 flex-1 font-outfit-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                            {issue.label}
                                        </Text>
                                        {isSelected && <View className="w-2 h-2 bg-white rounded-full" />}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={selectedIssues.length === 0}
                    activeOpacity={0.8}
                >
                    {selectedIssues.length === 0 ? (
                        <View className="bg-slate-200 rounded-lg p-4 mb-8 items-center justify-center flex-row">
                            <Text className="text-gray-500 font-outfit-bold text-center mr-2">Continue</Text>
                            <ChevronRight size={20} color="#9CA3AF" />
                        </View>
                    ) : (
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 10,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                marginBottom: 32,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Text className="text-white font-outfit-bold text-center mr-2">Continue</Text>
                            <ChevronRight size={20} color="white" />
                        </LinearGradient>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
