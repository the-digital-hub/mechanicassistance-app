import { Button } from '@/components/ui/Button';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, Battery, ChevronLeft, HelpCircle, Wrench, Zap } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

const COMMON_ISSUES = [
    { id: 'battery', label: 'Battery / Starting issue', icon: Battery },
    { id: 'electrical', label: 'Electrical system', icon: Zap },
    { id: 'starter', label: 'Starter motor', icon: Wrench },
    { id: 'warning', label: 'Warning light', icon: AlertTriangle },
    { id: 'other', label: 'Other', icon: HelpCircle },
];

export default function IssueSelectionScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { type, vehicleId, vehicleName } = params;

    const [description, setDescription] = useState('');
    const [selectedIssues, setSelectedIssues] = useState<string[]>([]);

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
                        value={description}
                        onChangeText={setDescription}
                        className="bg-white border border-gray-200 rounded-xl p-4 font-outfit-regular text-[#0F172A] text-base h-32"
                        style={{ textAlignVertical: 'top' }}
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-gray-900 font-outfit-medium text-lg mb-2" style={{ fontSize: 18 }}>Possible issues detected</Text>
                    <View className="rounded-xl border border-gray-100 overflow-hidden">
                        {COMMON_ISSUES.map((issue, index) => {
                            const isSelected = selectedIssues.includes(issue.id);
                            return (
                                <TouchableOpacity
                                    key={issue.id}
                                    onPress={() => toggleIssue(issue.id)}
                                    className={`flex-row items-center p-4 border-b border-gray-100 ${isSelected ? 'bg-blue-600' : 'bg-white'}`}
                                >
                                    <issue.icon size={20} color={isSelected ? 'white' : '#0047AB'} />
                                    <Text className={`ml-3 flex-1 font-outfit-medium ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                                        {issue.label}
                                    </Text>
                                    {isSelected && <View className="w-2 h-2 bg-white rounded-full" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                <Button
                    onPress={handleContinue}
                    className={`rounded-xl mb-8 ${selectedIssues.length === 0 ? 'bg-slate-200' : 'bg-blue-700'}`}
                    disabled={selectedIssues.length === 0}
                >
                    Continue
                </Button>
            </ScrollView>
        </View>
    );
}
