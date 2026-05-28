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
            {/* Header */}
            <View className="px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="mr-4">
                    <ChevronLeft size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text className="text-xl font-outfit-bold text-[#0F172A] flex-1 text-center">
                    Assistance
                </Text>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/assist')} className="ml-4">
                    <Text className="text-red-500 font-outfit-medium text-xs">Cancel</Text>
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                <Text className="text-blue-600 font-outfit-bold text-lg mb-4">Indicate the issue</Text>

                <View className="mb-6">
                    <Text className="font-outfit-bold text-[#0F172A] text-base mb-2">
                        Describe the problem or select a common issue
                    </Text>
                    <TextInput
                        multiline
                        numberOfLines={4}
                        placeholder="Describe what's happening with your vehicle"
                        value={description}
                        onChangeText={setDescription}
                        className="bg-white border border-gray-200 rounded-xl p-4 font-outfit-regular text-[#0F172A] text-base h-32"
                        style={{ textAlignVertical: 'top' }}
                    />
                    <View className="flex-row justify-end mt-2">
                        <View className="bg-blue-100 px-2 py-1 rounded flex-row items-center">
                            <Text className="text-xs text-blue-800 font-outfit-medium">AI assisted</Text>
                        </View>
                        <View className="bg-blue-600 px-2 py-1 rounded ml-2 flex-row items-center">
                            <Text className="text-xs text-white font-outfit-bold">AI</Text>
                        </View>
                    </View>
                </View>

                <View className="mb-8">
                    <Text className="text-blue-600 font-outfit-bold text-sm mb-3">Possible issues detected</Text>
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
