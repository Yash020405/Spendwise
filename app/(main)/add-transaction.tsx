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
import { saveOfflineExpense, saveOfflineIncome, saveOfflineRecurring } from '../../utils/offlineSync';
import { checkBudgetAfterExpense, getBudgetWarning } from '../../utils/budgetNotification';
import SplitModal from '../../components/SplitModal';

const CATEGORIES = [
    { name: 'Food', icon: 'restaurant', color: '#F59E0B' },
    { name: 'Transport', icon: 'directions-car', color: '#3B82F6' },
    { name: 'Shopping', icon: 'shopping-bag', color: '#EC4899' },
    { name: 'Entertainment', icon: 'movie', color: '#8B5CF6' },
    { name: 'Bills', icon: 'receipt', color: '#EF4444' },
    { name: 'Health', icon: 'local-hospital', color: '#10B981' },
    { name: 'Education', icon: 'school', color: '#06B6D4' },
    { name: 'Other', icon: 'more-horiz', color: '#6B7280' },
];

const INCOME_SOURCES = [
    { name: 'Salary', icon: 'payments', color: '#10B981' },
    { name: 'Freelance', icon: 'laptop', color: '#3B82F6' },
    { name: 'Investment', icon: 'trending-up', color: '#8B5CF6' },
    { name: 'Gift', icon: 'card-giftcard', color: '#EC4899' },
    { name: 'Refund', icon: 'replay', color: '#F59E0B' },
    { name: 'Other', icon: 'attach-money', color: '#6B7280' },
];

const PAYMENT_METHODS = [
    { id: 'Cash', icon: 'payments', color: '#10B981' },
    { id: 'Card', icon: 'credit-card', color: '#3B82F6' },
    { id: 'UPI', icon: 'phone-android', color: '#8B5CF6' },
    { id: 'Bank Transfer', icon: 'account-balance', color: '#F59E0B' },
];

const RECURRING_FREQUENCIES = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'yearly', label: 'Yearly' },
];

const CALC_BUTTONS = [
    ['C', '(', ')', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', 'DEL', '='],
];

export default function AddTransactionScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { showToast } = useToast();

    // Type toggle: expense (default) or income
    const [isIncome, setIsIncome] = useState(false);

    const [amount, setAmount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [description, setDescription] = useState('');
    const [transactionDate, setTransactionDate] = useState(new Date());
    const [loading, setLoading] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showPaymentPicker, setShowPaymentPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcDisplay, setCalcDisplay] = useState('0');
    const [currencySymbol, setCurrencySymbol] = useState('₹');

    // Split expense state (only for expenses)
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [isSplit, setIsSplit] = useState(false);
    const [splitType, setSplitType] = useState<'equal' | 'custom' | 'percentage'>('equal');
    const [participants, setParticipants] = useState<any[]>([]);
    const [userShare, setUserShare] = useState(0);

    // Recurring transaction state
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

    useFocusEffect(
        useCallback(() => {
            setAmount('');
            setSelectedCategory(null);
            setSelectedSource(null);
            setPaymentMethod('Cash');
            setDescription('');
            setTransactionDate(new Date());
            setCalcDisplay('0');
            setIsIncome(false);
            // Reset split state
            setIsSplit(false);
            setParticipants([]);
            setUserShare(0);
            // Reset recurring state
            setIsRecurring(false);
            setRecurringFrequency('monthly');
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

    // Handle split expense save
    const handleSplitSave = (splitParticipants: any[], type: 'equal' | 'custom' | 'percentage', share: number) => {
        setParticipants(splitParticipants);
        setSplitType(type);
        setUserShare(share);
        setIsSplit(splitParticipants.length > 0);
    };

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            showToast({ message: 'Please enter an amount', type: 'warning' });
            return;
        }
        if (isIncome && !selectedSource) {
            showToast({ message: 'Please select a source', type: 'warning' });
            return;
        }
        if (!isIncome && !selectedCategory) {
            showToast({ message: 'Please select a category', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) {
                router.replace('/(auth)/welcome');
                return;
            }

            if (isIncome) {
                // Create income
                const incomeData = {
                    amount: parseFloat(amount),
                    source: selectedSource!,
                    description: description.trim() || undefined,
                    date: transactionDate.toISOString(),
                };
                try {
                    const response: any = await api.createIncome(token, incomeData);
                    if (response.success) {
                        // If recurring is enabled for income
                        if (isRecurring) {
                            try {
                                await api.createRecurring(token, {
                                    type: 'income',
                                    amount: parseFloat(amount),
                                    source: selectedSource!,
                                    description: description.trim() || undefined,
                                    frequency: recurringFrequency,
                                    dayOfMonth: recurringFrequency === 'monthly' ? transactionDate.getDate() : undefined,
                                });
                                showToast({ message: 'Income added + recurring set up!', type: 'success' });
                            } catch {
                                // Save recurring offline if network fails
                                await saveOfflineRecurring({
                                    type: 'income',
                                    amount: parseFloat(amount),
                                    source: selectedSource!,
                                    description: description.trim() || undefined,
                                    frequency: recurringFrequency,
                                    dayOfMonth: recurringFrequency === 'monthly' ? transactionDate.getDate() : undefined,
                                });
                                showToast({ message: 'Income added, recurring saved offline', type: 'success' });
                            }
                        } else {
                            showToast({ message: 'Income added successfully', type: 'success' });
                        }
                        router.back();
                    } else {
                        showToast({ message: response.message || 'Failed to save income', type: 'error' });
                    }
                } catch (error: any) {
                    // Network error - save offline
                    if (error.message?.includes('Network')) {
                        await saveOfflineIncome(incomeData);
                        showToast({ message: 'Income saved offline', type: 'success' });
                        router.back();
                    } else {
                        showToast({ message: 'Failed to save income', type: 'error' });
                    }
                }
            } else {
                // Create expense with split data
                const expenseData: any = {
                    amount: parseFloat(amount),
                    category: selectedCategory!,
                    paymentMethod,
                    description: description.trim() || undefined,
                    date: transactionDate.toISOString(),
                    // Split expense data
                    isSplit,
                    splitType: isSplit ? splitType : undefined,
                    participants: isSplit ? participants : undefined,
                    userShare: isSplit ? userShare : undefined,
                };

                try {
                    const response: any = await api.createExpense(token, expenseData);
                    if (response.success) {
                        // If recurring is enabled
                        if (isRecurring) {
                            try {
                                await api.createRecurring(token, {
                                    type: 'expense',
                                    amount: parseFloat(amount),
                                    category: selectedCategory!,
                                    paymentMethod,
                                    description: description.trim() || undefined,
                                    frequency: recurringFrequency,
                                    dayOfMonth: recurringFrequency === 'monthly' ? transactionDate.getDate() : undefined,
                                });
                                showToast({ message: 'Expense added + recurring set up!', type: 'success' });
                            } catch {
                                // Save recurring offline if API fails
                                await saveOfflineRecurring({
                                    type: 'expense',
                                    amount: parseFloat(amount),
                                    category: selectedCategory!,
                                    paymentMethod,
                                    description: description.trim() || undefined,
                                    frequency: recurringFrequency,
                                    dayOfMonth: recurringFrequency === 'monthly' ? transactionDate.getDate() : undefined,
                                });
                                showToast({ message: 'Expense added, recurring saved offline', type: 'success' });
                            }
                        } else {
                            showToast({ message: isSplit ? `Split expense added with ${participants.length} people` : 'Expense added successfully', type: 'success' });
                        }
                        router.back();
                    } else {
                        showToast({ message: response.message || 'Failed to save expense', type: 'error' });
                    }
                } catch (error: any) {
                    if (error.message?.includes('Network')) {
                        await saveOfflineExpense({ ...expenseData, category: selectedCategory! });
                        showToast({ message: 'Saved offline', type: 'success' });
                        router.back();
                    } else {
                        showToast({ message: 'Failed to save expense', type: 'error' });
                    }
                }
            }
        } catch (error: any) {
            console.error('Failed to add transaction:', error);
            showToast({ message: 'Failed to save', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

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

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selectedDate) setTransactionDate(selectedDate);
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (selectedDate) setTransactionDate(selectedDate);
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

    const selectedCat = CATEGORIES.find(c => c.name === selectedCategory);
    const selectedSrc = INCOME_SOURCES.find(s => s.name === selectedSource);
    const selectedPay = PAYMENT_METHODS.find(p => p.id === paymentMethod);
    const accentColor = isIncome ? '#10B981' : '#EF4444';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                        <MaterialIcons name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Add Transaction</Text>
                    <TouchableOpacity onPress={openCalculator} style={styles.headerBtn}>
                        <MaterialIcons name="calculate" size={24} color={accentColor} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Type Toggle */}
                    <View style={[styles.typeToggle, { backgroundColor: theme.colors.surface }]}>
                        <TouchableOpacity
                            style={[styles.typeBtn, !isIncome && { backgroundColor: '#EF4444' }]}
                            onPress={() => setIsIncome(false)}
                        >
                            <MaterialIcons name="arrow-upward" size={20} color={!isIncome ? '#FFF' : theme.colors.textSecondary} />
                            <Text style={[styles.typeText, { color: !isIncome ? '#FFF' : theme.colors.textSecondary }]}>Expense</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeBtn, isIncome && { backgroundColor: '#10B981' }]}
                            onPress={() => setIsIncome(true)}
                        >
                            <MaterialIcons name="arrow-downward" size={20} color={isIncome ? '#FFF' : theme.colors.textSecondary} />
                            <Text style={[styles.typeText, { color: isIncome ? '#FFF' : theme.colors.textSecondary }]}>Income</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Amount */}
                    <View style={styles.amountContainer}>
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Amount</Text>
                        <View style={styles.amountRow}>
                            <Text style={[styles.currency, { color: accentColor }]}>{currencySymbol}</Text>
                            <TextInput
                                style={[styles.amountInput, { color: accentColor }]}
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="0"
                                placeholderTextColor={theme.colors.textTertiary}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                        </View>
                    </View>

                    {/* Date & Time */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Date & Time</Text>
                    <View style={styles.dateTimeRow}>
                        <TouchableOpacity
                            style={[styles.dateTimeBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <MaterialIcons name="calendar-today" size={20} color={accentColor} />
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatDate(transactionDate)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.dateTimeBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <MaterialIcons name="access-time" size={20} color={accentColor} />
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatTime(transactionDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Category (Expense) or Source (Income) */}
                    {isIncome ? (
                        <>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Source</Text>
                            <TouchableOpacity
                                style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setShowSourcePicker(true)}
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
                        </>
                    ) : (
                        <>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Category</Text>
                            <TouchableOpacity
                                style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setShowCategoryPicker(true)}
                            >
                                {selectedCat ? (
                                    <View style={styles.selectedItem}>
                                        <View style={[styles.iconBox, { backgroundColor: selectedCat.color + '20' }]}>
                                            <MaterialIcons name={selectedCat.icon as any} size={20} color={selectedCat.color} />
                                        </View>
                                        <Text style={[styles.selectorText, { color: theme.colors.text }]}>{selectedCat.name}</Text>
                                    </View>
                                ) : (
                                    <Text style={[styles.selectorText, { color: theme.colors.textTertiary }]}>Select category</Text>
                                )}
                                <MaterialIcons name="keyboard-arrow-down" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>

                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Payment Method</Text>
                            <TouchableOpacity
                                style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setShowPaymentPicker(true)}
                            >
                                <View style={styles.selectedItem}>
                                    <View style={[styles.iconBox, { backgroundColor: selectedPay?.color + '20' }]}>
                                        <MaterialIcons name={selectedPay?.icon as any} size={20} color={selectedPay?.color} />
                                    </View>
                                    <Text style={[styles.selectorText, { color: theme.colors.text }]}>{paymentMethod}</Text>
                                </View>
                                <MaterialIcons name="keyboard-arrow-down" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Split Expense (only for expenses) */}
                    {!isIncome && (
                        <>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Split Expense</Text>
                            <TouchableOpacity
                                style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setShowSplitModal(true)}
                            >
                                <View style={styles.selectedItem}>
                                    <View style={[styles.iconBox, { backgroundColor: '#8B5CF6' + '20' }]}>
                                        <MaterialIcons name="group" size={20} color="#8B5CF6" />
                                    </View>
                                    <Text style={[styles.selectorText, { color: isSplit ? theme.colors.text : theme.colors.textTertiary }]}>
                                        {isSplit ? `Split with ${participants.length} ${participants.length === 1 ? 'person' : 'people'}` : 'Not splitting'}
                                    </Text>
                                </View>
                                <MaterialIcons name="keyboard-arrow-right" size={24} color={theme.colors.textSecondary} />
                            </TouchableOpacity>

                            {/* Show split summary */}
                            {isSplit && participants.length > 0 && (
                                <View style={[styles.splitSummary, { backgroundColor: '#8B5CF6' + '10' }]}>
                                    <Text style={[styles.splitSummaryText, { color: theme.colors.text }]}>
                                        Your share: {currencySymbol}{userShare.toLocaleString()}
                                    </Text>
                                    <Text style={[styles.splitSummaryText, { color: theme.colors.textSecondary }]}>
                                        Others owe: {currencySymbol}{(parseFloat(amount || '0') - userShare).toLocaleString()}
                                    </Text>
                                </View>
                            )}
                        </>
                    )}

                    {/* Recurring Toggle */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Recurring</Text>
                    <TouchableOpacity
                        style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                        onPress={() => setIsRecurring(!isRecurring)}
                    >
                        <View style={styles.selectedItem}>
                            <View style={[styles.iconBox, { backgroundColor: isRecurring ? '#10B981' + '20' : '#6B7280' + '20' }]}>
                                <MaterialIcons name="repeat" size={20} color={isRecurring ? '#10B981' : '#6B7280'} />
                            </View>
                            <Text style={[styles.selectorText, { color: isRecurring ? theme.colors.text : theme.colors.textTertiary }]}>
                                {isRecurring ? `Repeats ${recurringFrequency}` : 'One-time transaction'}
                            </Text>
                        </View>
                        <MaterialIcons name={isRecurring ? 'toggle-on' : 'toggle-off'} size={32} color={isRecurring ? '#10B981' : theme.colors.textTertiary} />
                    </TouchableOpacity>

                    {/* Recurring Frequency */}
                    {isRecurring && (
                        <View style={styles.frequencyRow}>
                            {RECURRING_FREQUENCIES.map((freq) => (
                                <TouchableOpacity
                                    key={freq.id}
                                    style={[
                                        styles.frequencyBtn,
                                        { backgroundColor: theme.colors.surface },
                                        recurringFrequency === freq.id && { backgroundColor: accentColor }
                                    ]}
                                    onPress={() => setRecurringFrequency(freq.id as any)}
                                >
                                    <Text style={[
                                        styles.frequencyText,
                                        { color: recurringFrequency === freq.id ? '#FFF' : theme.colors.textSecondary }
                                    ]}>
                                        {freq.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Note */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Note (optional)</Text>
                    <TextInput
                        style={[styles.noteInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder={isIncome ? "What was this income for?" : "What was this for?"}
                        placeholderTextColor={theme.colors.textTertiary}
                        multiline
                    />
                </ScrollView>

                {/* Save Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: accentColor }]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        <MaterialIcons name={isIncome ? 'arrow-downward' : 'arrow-upward'} size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.saveBtnText}>
                            {loading ? 'Saving...' : `Add ${isIncome ? 'Income' : 'Expense'} ${amount ? currencySymbol + amount : ''}`}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Split Modal */}
                <SplitModal
                    visible={showSplitModal}
                    onClose={() => setShowSplitModal(false)}
                    totalAmount={parseFloat(amount) || 0}
                    currencySymbol={currencySymbol}
                    onSave={handleSplitSave}
                />

                {/* Date Picker */}
                {showDatePicker && (
                    <DateTimePicker
                        value={transactionDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        maximumDate={new Date()}
                    />
                )}

                {/* Time Picker */}
                {showTimePicker && (
                    <DateTimePicker
                        value={transactionDate}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onTimeChange}
                    />
                )}

                {/* Category Picker Modal */}
                <Modal visible={showCategoryPicker} transparent animationType="fade" onRequestClose={() => setShowCategoryPicker(false)}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Category</Text>
                                <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                                    <MaterialIcons name="close" size={24} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {CATEGORIES.map((cat) => (
                                    <TouchableOpacity
                                        key={cat.name}
                                        style={[styles.modalItem, { borderBottomColor: theme.colors.border }]}
                                        onPress={() => { setSelectedCategory(cat.name); setShowCategoryPicker(false); }}
                                    >
                                        <View style={[styles.iconBox, { backgroundColor: cat.color + '20' }]}>
                                            <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                                        </View>
                                        <Text style={[styles.modalItemText, { color: theme.colors.text }]}>{cat.name}</Text>
                                        {selectedCategory === cat.name && <MaterialIcons name="check" size={22} color={theme.colors.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

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
                                        {selectedSource === src.name && <MaterialIcons name="check" size={22} color="#10B981" />}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </Modal>

                {/* Payment Picker Modal */}
                <Modal visible={showPaymentPicker} transparent animationType="fade" onRequestClose={() => setShowPaymentPicker(false)}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPaymentPicker(false)}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Payment Method</Text>
                                <TouchableOpacity onPress={() => setShowPaymentPicker(false)}>
                                    <MaterialIcons name="close" size={24} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {PAYMENT_METHODS.map((pay) => (
                                    <TouchableOpacity
                                        key={pay.id}
                                        style={[styles.modalItem, { borderBottomColor: theme.colors.border }]}
                                        onPress={() => { setPaymentMethod(pay.id); setShowPaymentPicker(false); }}
                                    >
                                        <View style={[styles.iconBox, { backgroundColor: pay.color + '20' }]}>
                                            <MaterialIcons name={pay.icon as any} size={22} color={pay.color} />
                                        </View>
                                        <Text style={[styles.modalItemText, { color: theme.colors.text }]}>{pay.id}</Text>
                                        {paymentMethod === pay.id && <MaterialIcons name="check" size={22} color={theme.colors.primary} />}
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
                                <Text style={[styles.calcDisplayText, { color: accentColor }]} numberOfLines={1}>
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
                                                        { backgroundColor: isOperator ? accentColor : isSpecial ? theme.colors.error + '20' : theme.colors.surface },
                                                    ]}
                                                    onPress={() => handleCalcPress(btn)}
                                                >
                                                    <Text style={[styles.calcBtnText, { color: isOperator ? '#FFF' : isSpecial ? theme.colors.error : theme.colors.text }]}>
                                                        {btn}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ))}
                            </View>
                            <TouchableOpacity style={[styles.calcApplyBtn, { backgroundColor: accentColor }]} onPress={applyCalcResult}>
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
    typeToggle: { flexDirection: 'row', padding: 4, borderRadius: 16, marginBottom: 20 },
    typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
    typeText: { fontSize: 16, fontWeight: '600' },
    amountContainer: { alignItems: 'center', paddingVertical: 16 },
    label: { fontSize: 14, fontWeight: '500', marginBottom: 8, marginTop: 16 },
    amountRow: { flexDirection: 'row', alignItems: 'center' },
    currency: { fontSize: 32, fontWeight: '300', marginRight: 4 },
    amountInput: { fontSize: 44, fontWeight: '700', minWidth: 80, textAlign: 'center' },
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
    calcDisplay: { marginHorizontal: 20, marginBottom: 16, padding: 20, borderRadius: 16, alignItems: 'flex-end' as const },
    calcDisplayText: { fontSize: 40, fontWeight: '600' as const },
    calcGrid: { paddingHorizontal: 20 },
    calcRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
    calcBtn: { width: '22%' as any, aspectRatio: 1.3, borderRadius: 16, alignItems: 'center' as const, justifyContent: 'center' as const },
    calcBtnText: { fontSize: 24, fontWeight: '500' as const },
    calcApplyBtn: { marginHorizontal: 20, marginTop: 8, padding: 16, borderRadius: 14, alignItems: 'center' as const },
    calcApplyText: { color: '#FFF', fontSize: 17, fontWeight: '600' as const },

    // Split expense styles
    splitSummary: { marginTop: 8, padding: 12, borderRadius: 10, flexDirection: 'row' as const, justifyContent: 'space-between' as const },
    splitSummaryText: { fontSize: 14, fontWeight: '500' as const },

    // Recurring styles
    frequencyRow: { flexDirection: 'row' as const, gap: 8, marginTop: 8 },
    frequencyBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' as const },
    frequencyText: { fontSize: 13, fontWeight: '500' as const },
});
