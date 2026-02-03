import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import api from '../../utils/api';
import { getMergedIncome, savePendingIncomeUpdate, savePendingIncomeDelete, shouldSaveOffline } from '../../utils/offlineSync';

const INCOME_SOURCES = [
    { name: 'Salary', icon: 'payments', color: '#10B981' },
    { name: 'Freelance', icon: 'laptop', color: '#3B82F6' },
    { name: 'Investment', icon: 'trending-up', color: '#8B5CF6' },
    { name: 'Gift', icon: 'card-giftcard', color: '#EC4899' },
    { name: 'Refund', icon: 'replay', color: '#F59E0B' },
    { name: 'Other', icon: 'attach-money', color: '#6B7280' },
];

const CALC_BUTTONS = [
    ['C', '(', ')', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', 'DEL', '='],
];

export default function EditIncomeScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { showToast } = useToast();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const incomeId = params.id as string;

    const [amount, setAmount] = useState('');
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Pickers
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcDisplay, setCalcDisplay] = useState('0');

    const [currencySymbol, setCurrencySymbol] = useState('₹');

    useEffect(() => {
        loadIncomeData();
    }, [incomeId]);

    const loadIncomeData = async () => {
        try {
            const userData = await AsyncStorage.getItem('@user');
            if (userData) setCurrencySymbol(JSON.parse(userData).currencySymbol || '₹');

            // Try to find in merged income (cached + offline)
            const incomeList = await getMergedIncome();
            const found = incomeList.find((i: any) => i._id === incomeId);

            if (found) {
                setAmount(found.amount.toString());
                setSelectedSource(found.source);
                setDescription(found.description || '');
                setTransactionDate(new Date(found.date));
                setLoading(false);
                return;
            }

            // Fallback fetch if not found locally
            const token = await AsyncStorage.getItem('@auth_token');
            if (token) {
                const response: any = await api.getIncome(token);
                const data = response.data || response.income;
                if (response.success && Array.isArray(data)) {
                    const freshFound = data.find((i: any) => i._id === incomeId);
                    if (freshFound) {
                        setAmount(freshFound.amount.toString());
                        setSelectedSource(freshFound.source);
                        setDescription(freshFound.description || '');
                        setTransactionDate(new Date(freshFound.date));
                        setLoading(false);
                        return;
                    }
                }
            }

            Alert.alert('Error', 'Income not found');
            router.back();

        } catch (error) {
            console.error('Error loading income:', error);
            Alert.alert('Error', 'Failed to load income details');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            showToast({ message: 'Please enter a valid amount', type: 'error' });
            return;
        }
        if (!selectedSource) {
            showToast({ message: 'Please select a source', type: 'error' });
            return;
        }

        try {
            setSaving(true);
            const token = await AsyncStorage.getItem('@auth_token');
            const updateData = {
                amount: parseFloat(amount),
                source: selectedSource,
                description,
                date: transactionDate.toISOString(),
            };

            if (token) {
                try {
                    const response: any = await api.updateIncome(token, incomeId, updateData);
                    if (response.success) {
                        showToast({ message: 'Income updated successfully', type: 'success' });
                        router.back();
                        return;
                    }
                    throw new Error(response.message || 'Update failed');
                } catch (networkError: any) {
                    if (networkError.message && (networkError.message.includes('Network') || networkError.message === 'Network request failed')) {
                        throw new Error('Network request failed');
                    }
                    throw networkError;
                }
            }
            throw new Error('No auth token');

        } catch (error: any) {
            console.log('Income update error (handled offline):', error);
            if (shouldSaveOffline(error)) {
                await savePendingIncomeUpdate(incomeId, {
                    amount: parseFloat(amount),
                    source: selectedSource,
                    description,
                    date: transactionDate.toISOString(),
                });
                showToast({ message: 'Income updated offline', type: 'info' });
                router.back();
            } else {
                showToast({ message: error.message || 'Failed to update income', type: 'error' });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Income',
            'Are you sure you want to delete this income?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const token = await AsyncStorage.getItem('@auth_token');

                            if (token) {
                                try {
                                    await api.deleteIncome(token, incomeId);
                                    showToast({ message: 'Income deleted successfully', type: 'success' });
                                    router.back();
                                    return;
                                } catch (networkError: any) {
                                    if (networkError.message && (networkError.message.includes('Network') || networkError.message === 'Network request failed')) {
                                        throw new Error('Network request failed');
                                    }
                                    throw networkError;
                                }
                            }
                            throw new Error('No auth token');
                        } catch (error: any) {
                            if (shouldSaveOffline(error)) {
                                await savePendingIncomeDelete(incomeId);
                                showToast({ message: 'Income deleted offline', type: 'info' });
                                router.back();
                            } else {
                                showToast({ message: 'Failed to delete income', type: 'error' });
                            }
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Calculator Logic
    const openCalculator = () => {
        setCalcDisplay(amount || '0');
        setShowCalculator(true);
    };

    const handleCalcPress = (btn: string) => {
        if (btn === 'C') {
            setCalcDisplay('0');
        } else if (btn === 'DEL') {
            setCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else if (btn === '=') {
            try {
                const result = Function('"use strict"; return (' + calcDisplay + ')')();
                setCalcDisplay(String(result));
            } catch (_e) {
                setCalcDisplay('Error');
            }
        } else {
            setCalcDisplay(prev => prev === '0' ? btn : prev + btn);
        }
    };

    const applyCalcResult = () => {
        if (calcDisplay !== 'Error') {
            setAmount(calcDisplay);
            setShowCalculator(false);
        }
    };

    // UI Helpers
    const formatDate = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) setTransactionDate(selectedDate);
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedDate) setTransactionDate(selectedDate);
    };

    const selectedSrc = selectedSource ? INCOME_SOURCES.find(s => s.name === selectedSource) : null;

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Income</Text>
                <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
                    <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    {/* Amount */}
                    <View style={styles.amountContainer}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Amount</Text>
                        <View style={styles.amountRow}>
                            <Text style={[styles.currency, { color: theme.colors.primary }]}>{currencySymbol}</Text>
                            <TextInput
                                style={[styles.amountInput, { color: theme.colors.text }]}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0"
                                placeholderTextColor={theme.colors.textTertiary}
                                keyboardType="decimal-pad"
                            />
                        </View>
                        {/* Calculator hint */}
                        <TouchableOpacity
                            style={[styles.calcHint, { backgroundColor: theme.colors.surface }]}
                            onPress={openCalculator}
                        >
                            <MaterialIcons name="calculate" size={16} color={theme.colors.primary} />
                            <Text style={[styles.calcHintText, { color: theme.colors.textSecondary }]}>Calculations?</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Date & Time Row */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Date & Time</Text>
                    <View style={styles.dateTimeRow}>
                        <TouchableOpacity
                            style={[styles.dateTimeBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <MaterialIcons name="calendar-today" size={20} color={theme.colors.primary} />
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatDate(transactionDate)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.dateTimeBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <MaterialIcons name="access-time" size={20} color={theme.colors.primary} />
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatTime(transactionDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Source */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Source</Text>
                    <TouchableOpacity
                        style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                        onPress={() => setShowSourcePicker(true)}
                        activeOpacity={0.7}
                    >
                        {selectedSrc ? (
                            <View style={styles.selectedItem}>
                                <View style={[styles.iconBox, { backgroundColor: selectedSrc.color + '20' }]}>
                                    <MaterialIcons name={selectedSrc.icon as any} size={20} color={selectedSrc.color} />
                                </View>
                                <Text style={[styles.selectorText, { color: theme.colors.text }]}>{selectedSrc.name}</Text>
                            </View>
                        ) : (
                            <Text style={[styles.selectorText, { color: theme.colors.textTertiary }]}>Select source</Text>
                        )}
                        <MaterialIcons name="keyboard-arrow-down" size={24} color={theme.colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Note */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Note</Text>
                    <TextInput
                        style={[styles.noteInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Add a note"
                        placeholderTextColor={theme.colors.textTertiary}
                        multiline
                    />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Update Button */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 0) + 30 }]}>
                <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: selectedSrc?.color || theme.colors.primary }]}
                    onPress={handleUpdate}
                    disabled={saving}
                >
                    <Text style={styles.saveBtnText}>{saving ? 'Updating...' : 'Update'}</Text>
                </TouchableOpacity>
            </View>

            {/* Native Date Pickers */}
            {showDatePicker && (
                <DateTimePicker
                    value={transactionDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    maximumDate={new Date()}
                />
            )}
            {showTimePicker && (
                <DateTimePicker
                    value={transactionDate}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimeChange}
                />
            )}

            {/* Source Picker */}
            <Modal visible={showSourcePicker} transparent animationType="fade" onRequestClose={() => setShowSourcePicker(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSourcePicker(false)}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Source</Text>
                            <TouchableOpacity onPress={() => setShowSourcePicker(false)}>
                                <MaterialIcons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView>
                            {INCOME_SOURCES.map((src) => (
                                <TouchableOpacity
                                    key={src.name}
                                    style={[styles.modalItem, { borderBottomColor: theme.colors.border }]}
                                    onPress={() => { setSelectedSource(src.name); setShowSourcePicker(false); }}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: src.color + '20' }]}>
                                        <MaterialIcons name={src.icon as any} size={22} color={src.color} />
                                    </View>
                                    <Text style={[styles.modalItemText, { color: theme.colors.text }]}>{src.name}</Text>
                                    {selectedSource === src.name && <MaterialIcons name="check" size={22} color={theme.colors.primary} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Calculator */}
            <Modal visible={showCalculator} transparent animationType="fade" onRequestClose={() => setShowCalculator(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCalculator(false)}>
                    <View style={[styles.calcModal, { backgroundColor: theme.colors.background }]} onStartShouldSetResponder={() => true}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Calculator</Text>
                            <TouchableOpacity onPress={() => setShowCalculator(false)}>
                                <MaterialIcons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.calcDisplay, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[styles.calcDisplayText, { color: theme.colors.text }]} numberOfLines={1}>
                                {currencySymbol}{calcDisplay}
                            </Text>
                        </View>

                        <View style={styles.calcGrid}>
                            {CALC_BUTTONS.map((row, rowIndex) => (
                                <View key={rowIndex} style={styles.calcRow}>
                                    {row.map((btn) => {
                                        const isOperator = ['/', '*', '-', '+', '='].includes(btn);
                                        const isSpecial = ['C', 'DEL'].includes(btn);
                                        return (
                                            <TouchableOpacity
                                                key={btn}
                                                style={[
                                                    styles.calcBtn,
                                                    { backgroundColor: isOperator ? theme.colors.primary : isSpecial ? theme.colors.error + '20' : theme.colors.surface },
                                                ]}
                                                onPress={() => handleCalcPress(btn)}
                                            >
                                                <Text style={[
                                                    styles.calcBtnText,
                                                    { color: isOperator ? '#FFF' : isSpecial ? theme.colors.error : theme.colors.text }
                                                ]}>
                                                    {btn}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.calcApplyBtn, { backgroundColor: theme.colors.primary }]}
                            onPress={applyCalcResult}
                        >
                            <Text style={styles.calcApplyText}>Use this amount</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    content: { flex: 1, paddingHorizontal: 20 },
    amountContainer: { alignItems: 'center', paddingVertical: 20 },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 14 },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    currency: { fontSize: 28, fontWeight: '300', marginRight: 4 },
    amountInput: { fontSize: 40, fontWeight: '700', minWidth: 70, textAlign: 'center' },
    dateTimeRow: { flexDirection: 'row', gap: 12 },
    dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 10 },
    dateTimeText: { fontSize: 15, fontWeight: '500' },
    selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12 },
    selectedItem: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    selectorText: { fontSize: 16 },
    noteInput: { padding: 14, borderRadius: 12, fontSize: 16, minHeight: 60, textAlignVertical: 'top' },
    footer: { padding: 20 },
    saveBtn: { flexDirection: 'row', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34, maxHeight: '70%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    modalItem: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 20, borderBottomWidth: 1, gap: 12 },
    modalItemText: { fontSize: 16, flex: 1 },
    calcModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34 },
    calcDisplay: { marginHorizontal: 20, marginBottom: 16, padding: 20, borderRadius: 16, alignItems: 'flex-end' },
    calcDisplayText: { fontSize: 36, fontWeight: '600' },
    calcGrid: { paddingHorizontal: 20 },
    calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    calcBtn: { width: '22%', aspectRatio: 1.3, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    calcBtnText: { fontSize: 24, fontWeight: '500' },
    calcApplyBtn: { marginHorizontal: 20, marginTop: 8, padding: 16, borderRadius: 14, alignItems: 'center' },
    calcApplyText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
    calcHint: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 14, borderRadius: 20, marginTop: 12, gap: 6 },
    calcHintText: { fontSize: 13, fontWeight: '500' },
});
