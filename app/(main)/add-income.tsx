import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Modal,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import api from '../../utils/api';

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

export default function AddIncomeScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { showToast } = useToast();

    const [amount, setAmount] = useState('');
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [incomeDate, setIncomeDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcDisplay, setCalcDisplay] = useState('0');
    const [currencySymbol, setCurrencySymbol] = useState('₹');

    // Reset form when screen is focused
    useFocusEffect(
        useCallback(() => {
            setAmount('');
            setSelectedSource(null);
            setDescription('');
            setIncomeDate(new Date());
            setCalcDisplay('0');
        }, [])
    );

    useEffect(() => {
        loadUserCurrency();
    }, []);

    const loadUserCurrency = async () => {
        try {
            const userData = await AsyncStorage.getItem('@user');
            if (userData) {
                setCurrencySymbol(JSON.parse(userData).currencySymbol || '₹');
            }
        } catch (error) {
            console.error('Failed to load user currency');
        }
    };

    const openCalculator = () => {
        if (amount && parseFloat(amount) > 0) {
            setCalcDisplay(amount);
        } else {
            setCalcDisplay('0');
        }
        setShowCalculator(true);
    };

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            showToast({ message: 'Please enter an amount', type: 'warning' });
            return;
        }
        if (!selectedSource) {
            showToast({ message: 'Please select a source', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) {
                router.replace('/(auth)/welcome');
                return;
            }

            const incomeData = {
                amount: parseFloat(amount),
                source: selectedSource,
                description: description.trim() || undefined,
                date: incomeDate.toISOString(),
            };

            const response: any = await api.createIncome(token, incomeData);

            if (response.success) {
                showToast({ message: 'Income added successfully', type: 'success' });
                router.back();
            } else {
                showToast({ message: response.message || 'Failed to save income', type: 'error' });
            }
        } catch (error: any) {
            console.error('Failed to add income:', error);
            showToast({ message: 'Failed to save income. Please try again.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Calculator functions
    const handleCalcPress = (btn: string) => {
        if (btn === 'C') {
            setCalcDisplay('0');
        } else if (btn === 'DEL') {
            setCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else if (btn === '=') {
            try {
                const result = Function('"use strict"; return (' + calcDisplay + ')')();
                if (typeof result === 'number' && isFinite(result)) {
                    setCalcDisplay(String(parseFloat(result.toFixed(2))));
                }
            } catch {
                setCalcDisplay('Error');
            }
        } else {
            setCalcDisplay(prev => prev === '0' || prev === 'Error' ? btn : prev + btn);
        }
    };

    const applyCalcResult = () => {
        const num = parseFloat(calcDisplay);
        if (!isNaN(num) && num > 0) {
            setAmount(String(num));
        }
        setShowCalculator(false);
        setCalcDisplay('0');
    };

    // Date/Time handlers
    const onDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setIncomeDate(selectedDate);
        }
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
        if (selectedDate) {
            setIncomeDate(selectedDate);
        }
    };

    const formatDate = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const selectedSrc = INCOME_SOURCES.find(s => s.name === selectedSource);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                        <MaterialIcons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add Income</Text>
                    <TouchableOpacity onPress={openCalculator} style={styles.headerBtn}>
                        <MaterialIcons name="calculate" size={24} color={theme.colors.primary} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Amount */}
                    <View style={styles.amountContainer}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Amount</Text>
                        <View style={styles.amountRow}>
                            <Text style={[styles.currency, { color: '#10B981' }]}>{currencySymbol}</Text>
                            <TextInput
                                style={[styles.amountInput, { color: '#10B981' }]}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0"
                                placeholderTextColor={theme.colors.textTertiary}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                        </View>
                        <View style={[styles.incomeLabel, { backgroundColor: '#10B98120' }]}>
                            <MaterialIcons name="arrow-downward" size={16} color="#10B981" />
                            <Text style={[styles.incomeLabelText, { color: '#10B981' }]}>Income</Text>
                        </View>
                    </View>

                    {/* Date & Time Row */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Date & Time</Text>
                    <View style={styles.dateTimeRow}>
                        <TouchableOpacity
                            style={[styles.dateTimeBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <MaterialIcons name="calendar-today" size={20} color="#10B981" />
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatDate(incomeDate)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.dateTimeBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <MaterialIcons name="access-time" size={20} color="#10B981" />
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatTime(incomeDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Source Selector */}
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
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Note (optional)</Text>
                    <TextInput
                        style={[styles.noteInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="What was this income for?"
                        placeholderTextColor={theme.colors.textTertiary}
                        multiline
                    />
                </ScrollView>

                {/* Save Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: '#10B981' }]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <MaterialIcons name="arrow-downward" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.saveBtnText}>{loading ? 'Saving...' : `Add Income ${amount ? currencySymbol + amount : ''}`}</Text>
                    </TouchableOpacity>
                </View>

                {/* Native Date Picker */}
                {showDatePicker && (
                    <DateTimePicker
                        value={incomeDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        maximumDate={new Date()}
                    />
                )}

                {/* Native Time Picker */}
                {showTimePicker && (
                    <DateTimePicker
                        value={incomeDate}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onTimeChange}
                    />
                )}

                {/* Source Picker Modal */}
                <Modal visible={showSourcePicker} transparent animationType="fade" onRequestClose={() => setShowSourcePicker(false)}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSourcePicker(false)}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Income Source</Text>
                                <TouchableOpacity onPress={() => setShowSourcePicker(false)}>
                                    <MaterialIcons name="close" size={24} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {INCOME_SOURCES.map((source) => (
                                    <TouchableOpacity
                                        key={source.name}
                                        style={[styles.modalItem, { borderBottomColor: theme.colors.border }]}
                                        onPress={() => {
                                            setSelectedSource(source.name);
                                            setShowSourcePicker(false);
                                        }}
                                    >
                                        <View style={[styles.iconBox, { backgroundColor: source.color + '20' }]}>
                                            <MaterialIcons name={source.icon as any} size={22} color={source.color} />
                                        </View>
                                        <Text style={[styles.modalItemText, { color: theme.colors.text }]}>{source.name}</Text>
                                        {selectedSource === source.name && <MaterialIcons name="check" size={22} color="#10B981" />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Calculator Modal */}
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
                                <Text style={[styles.calcDisplayText, { color: '#10B981' }]} numberOfLines={1}>
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
                                                        { backgroundColor: isOperator ? '#10B981' : isSpecial ? theme.colors.error + '20' : theme.colors.surface },
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
                                style={[styles.calcApplyBtn, { backgroundColor: '#10B981' }]}
                                onPress={applyCalcResult}
                            >
                                <Text style={styles.calcApplyText}>Use this amount</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    content: { flex: 1, paddingHorizontal: 20 },
    amountContainer: { alignItems: 'center', paddingVertical: 24 },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 16 },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    currency: { fontSize: 32, fontWeight: '300', marginRight: 4 },
    amountInput: { fontSize: 44, fontWeight: '700', minWidth: 80, textAlign: 'center' },
    incomeLabel: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginTop: 12, gap: 4 },
    incomeLabelText: { fontSize: 14, fontWeight: '600' },
    dateTimeRow: { flexDirection: 'row', gap: 12 },
    dateTimeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 10 },
    dateTimeText: { fontSize: 15, fontWeight: '500' },
    selector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: 12 },
    selectedItem: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    selectorText: { fontSize: 16 },
    noteInput: { padding: 14, borderRadius: 12, fontSize: 16, minHeight: 70, textAlignVertical: 'top' },
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
    calcDisplayText: { fontSize: 40, fontWeight: '600' },
    calcGrid: { paddingHorizontal: 20 },
    calcRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    calcBtn: { width: '22%', aspectRatio: 1.3, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    calcBtnText: { fontSize: 24, fontWeight: '500' },
    calcApplyBtn: { marginHorizontal: 20, marginTop: 8, padding: 16, borderRadius: 14, alignItems: 'center' },
    calcApplyText: { color: '#FFF', fontSize: 17, fontWeight: '600' },
});
