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
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import api from '../../utils/api';

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

const PAYMENT_METHODS = [
    { id: 'Cash', icon: 'payments', color: '#10B981' },
    { id: 'Card', icon: 'credit-card', color: '#3B82F6' },
    { id: 'UPI', icon: 'phone-android', color: '#8B5CF6' },
    { id: 'Bank Transfer', icon: 'account-balance', color: '#F59E0B' },
];

const CALC_BUTTONS = [
    ['C', '(', ')', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', 'DEL', '='],
];

export default function EditExpenseScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { showToast } = useToast();
    const params = useLocalSearchParams();
    const expenseId = params.id as string;

    const [amount, setAmount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('Cash');
    const [description, setDescription] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showPaymentPicker, setShowPaymentPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [calcDisplay, setCalcDisplay] = useState('0');
    const [currencySymbol, setCurrencySymbol] = useState('₹');

    // Open calculator with current amount pre-populated
    const openCalculator = () => {
        if (amount && parseFloat(amount) > 0) {
            setCalcDisplay(amount);
        } else {
            setCalcDisplay('0');
        }
        setShowCalculator(true);
    };

    useEffect(() => {
        loadExpenseData();
    }, [expenseId]);

    const loadExpenseData = async () => {
        try {
            const userData = await AsyncStorage.getItem('@user');
            if (userData) setCurrencySymbol(JSON.parse(userData).currencySymbol || '₹');

            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) {
                router.replace('/(auth)/welcome');
                return;
            }

            const response: any = await api.getExpenses(token);
            if (response.success && Array.isArray(response.data)) {
                const expense = response.data.find((e: any) => e._id === expenseId);
                if (expense) {
                    setAmount(String(expense.amount));
                    setSelectedCategory(expense.category);
                    setPaymentMethod(expense.paymentMethod || 'Cash');
                    setDescription(expense.description || '');
                    setExpenseDate(new Date(expense.date));
                }
            }
        } catch (error) {
            console.error('Failed to load expense:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            showToast({ message: 'Please enter an amount', type: 'warning' });
            return;
        }

        setSaving(true);
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const response: any = await api.updateExpense(token, expenseId, {
                amount: parseFloat(amount),
                category: selectedCategory,
                paymentMethod,
                description: description.trim() || undefined,
                date: expenseDate.toISOString(),
            });

            if (response.success) {
                router.back();
            } else {
                showToast({ message: response.message || 'Failed to update', type: 'error' });
            }
        } catch (error: any) {
            showToast({ message: error.message || 'Failed to update', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete Expense?', 'This cannot be undone', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        const token = await AsyncStorage.getItem('@auth_token');
                        if (!token) return;
                        await api.deleteExpense(token, expenseId);
                        router.back();
                    } catch (error) {
                        showToast({ message: 'Failed to delete expense', type: 'error' });
                    }
                },
            },
        ]);
    };

    // Calculator
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
        if (!isNaN(num) && num > 0) setAmount(String(num));
        setShowCalculator(false);
        setCalcDisplay('0');
    };

    // Date/Time handlers
    const onDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setExpenseDate(selectedDate);
        }
    };

    const onTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
        if (selectedDate) {
            setExpenseDate(selectedDate);
        }
    };

    const formatDate = (date: Date) => {
        const today = new Date();
        if (date.toDateString() === today.toDateString()) return 'Today';
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const selectedCat = CATEGORIES.find(c => c.name === selectedCategory);
    const selectedPay = PAYMENT_METHODS.find(p => p.id === paymentMethod);

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
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Edit Expense</Text>
                    <TouchableOpacity onPress={handleDelete} style={styles.headerBtn}>
                        <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
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
                            <Text style={[styles.calcHintText, { color: theme.colors.textSecondary }]}>Need to split or calculate?</Text>
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
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatDate(expenseDate)}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.dateTimeBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowTimePicker(true)}
                        >
                            <MaterialIcons name="access-time" size={20} color={theme.colors.primary} />
                            <Text style={[styles.dateTimeText, { color: theme.colors.text }]}>{formatTime(expenseDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Category */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Category</Text>
                    <TouchableOpacity
                        style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                        onPress={() => setShowCategoryPicker(true)}
                        activeOpacity={0.7}
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

                    {/* Payment */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Payment Method</Text>
                    <TouchableOpacity
                        style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                        onPress={() => setShowPaymentPicker(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.selectedItem}>
                            <View style={[styles.iconBox, { backgroundColor: selectedPay?.color + '20' }]}>
                                <MaterialIcons name={selectedPay?.icon as any} size={20} color={selectedPay?.color} />
                            </View>
                            <Text style={[styles.selectorText, { color: theme.colors.text }]}>{paymentMethod}</Text>
                        </View>
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

                {/* Update Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: selectedCat?.color || theme.colors.primary }]}
                        onPress={handleUpdate}
                        disabled={saving}
                    >
                        <Text style={styles.saveBtnText}>{saving ? 'Updating...' : 'Update'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Native Date Picker */}
                {showDatePicker && (
                    <DateTimePicker
                        value={expenseDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange}
                        maximumDate={new Date()}
                    />
                )}

                {/* Native Time Picker */}
                {showTimePicker && (
                    <DateTimePicker
                        value={expenseDate}
                        mode="time"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onTimeChange}
                    />
                )}

                {/* Category Picker */}
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

                {/* Payment Picker */}
                <Modal visible={showPaymentPicker} transparent animationType="fade" onRequestClose={() => setShowPaymentPicker(false)}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPaymentPicker(false)}>
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]} onStartShouldSetResponder={() => true}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Payment Method</Text>
                                <TouchableOpacity onPress={() => setShowPaymentPicker(false)}>
                                    <MaterialIcons name="close" size={24} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>
                            {PAYMENT_METHODS.map((m) => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.modalItem, { borderBottomColor: theme.colors.border }]}
                                    onPress={() => { setPaymentMethod(m.id); setShowPaymentPicker(false); }}
                                >
                                    <View style={[styles.iconBox, { backgroundColor: m.color + '20' }]}>
                                        <MaterialIcons name={m.icon as any} size={22} color={m.color} />
                                    </View>
                                    <Text style={[styles.modalItemText, { color: theme.colors.text }]}>{m.id}</Text>
                                    {paymentMethod === m.id && <MaterialIcons name="check" size={22} color={theme.colors.primary} />}
                                </TouchableOpacity>
                            ))}
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
            </KeyboardAvoidingView>
        </SafeAreaView>
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
    saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
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
