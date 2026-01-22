import React, { useState, useCallback } from 'react';
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
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import api from '../../utils/api';
import { savePendingDelete, savePendingUpdate, getCachedExpenses, cacheExpenses, getMergedExpenses, getRecentParticipants, saveRecentParticipants } from '../../utils/offlineSync';
import SplitModal, { RecentParticipant } from '../../components/SplitModal';

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
    const insets = useSafeAreaInsets();
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

    // Split expense state
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [isSplit, setIsSplit] = useState(false);
    const [splitType, setSplitType] = useState<'equal' | 'custom' | 'percentage'>('equal');
    const [participants, setParticipants] = useState<any[]>([]);
    const [userShare, setUserShare] = useState(0);
    const [payer, setPayer] = useState('me');
    const [userHasPaidShare, setUserHasPaidShare] = useState(true); // Track if user has paid their share

    // Recent participants for quick add
    const [recentParticipants, setRecentParticipants] = useState<RecentParticipant[]>([]);

    // Open calculator with current amount pre-populated
    const openCalculator = () => {
        if (amount && parseFloat(amount) > 0) {
            setCalcDisplay(amount);
        } else {
            setCalcDisplay('0');
        }
        setShowCalculator(true);
    };

    // Use useFocusEffect to reload data when screen comes into focus
    // This ensures we get the latest data after returning from Owes/Dues page
    useFocusEffect(
        useCallback(() => {
            loadExpenseData();
        }, [expenseId])
    );

    const loadExpenseData = async () => {
        try {
            const userData = await AsyncStorage.getItem('@user');
            if (userData) setCurrencySymbol(JSON.parse(userData).currencySymbol || '₹');

            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) {
                router.replace('/(auth)/welcome');
                return;
            }

            let expenses: any[] = [];

            try {
                // Try to fetch from API first
                const response: any = await api.getExpenses(token);
                if (response.success && Array.isArray(response.data)) {
                    await cacheExpenses(response.data);
                    expenses = response.data;
                    console.log('[edit-expense] Loaded expenses from API');
                }
            } catch (_error) {
                // Silent: Network error - use merged offline data
                console.log('[edit-expense] API failed, will use cached data');
            }

            // Always use merged expenses to include offline ones
            const mergedExpenses = await getMergedExpenses();

            // Combine: if online fetch succeeded, merge with any pending offline; otherwise use merged
            if (expenses.length === 0) {
                expenses = mergedExpenses;
                console.log('[edit-expense] Using merged cached expenses');
            }

            // Load recent participants from independent storage (survives expense deletion)
            const storedParticipants = await getRecentParticipants();
            setRecentParticipants(storedParticipants);

            // Find expense by _id (server) or by offline_id format
            const expense = expenses.find((e: any) =>
                e._id === expenseId ||
                e.id === expenseId
            );

            console.log('[edit-expense] Found expense:', expenseId, 'userHasPaidShare:', expense?.userHasPaidShare);

            if (expense) {
                setAmount(String(expense.amount));
                setSelectedCategory(expense.category);
                setPaymentMethod(expense.paymentMethod || 'Cash');
                setDescription(expense.description || '');
                setExpenseDate(new Date(expense.date));
                // Load split data if available
                if (expense.isSplit && expense.participants && expense.participants.length > 0) {
                    setIsSplit(true);
                    setSplitType(expense.splitType || 'equal');
                    // Normalize participant IDs - preserve original id if exists, otherwise use _id
                    const normalizedParticipants = expense.participants.map((p: any) => ({
                        ...p,
                        id: p.id || p._id?.toString() || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    }));
                    setParticipants(normalizedParticipants);
                    setUserShare(expense.userShare || expense.amount);
                    
                    // Determine the payer - check multiple matching strategies
                    let resolvedPayer = 'me';
                    if (expense.payer && expense.payer !== 'me') {
                        // Strategy 1: Direct match with normalized id
                        const directMatch = normalizedParticipants.find((p: any) => p.id === expense.payer);
                        if (directMatch) {
                            resolvedPayer = directMatch.id;
                        } else {
                            // Strategy 2: Match with _id
                            const idMatch = normalizedParticipants.find((p: any) => p._id?.toString() === expense.payer);
                            if (idMatch) {
                                resolvedPayer = idMatch.id;
                            } else {
                                // Strategy 3: Match by payerName
                                if (expense.payerName && expense.payerName !== 'You') {
                                    const nameMatch = normalizedParticipants.find((p: any) => 
                                        p.name.toLowerCase() === expense.payerName.toLowerCase()
                                    );
                                    if (nameMatch) {
                                        resolvedPayer = nameMatch.id;
                                    }
                                }
                            }
                        }
                    }
                    setPayer(resolvedPayer);
                    
                    // If payer is me, I've already paid; otherwise use the stored value or default to false
                    const isPayerMe = resolvedPayer === 'me';
                    const computedUserHasPaid = isPayerMe ? true : (expense.userHasPaidShare ?? false);
                    console.log('[edit-expense] Setting userHasPaidShare:', computedUserHasPaid, 'from expense.userHasPaidShare:', expense.userHasPaidShare, 'isPayerMe:', isPayerMe);
                    setUserHasPaidShare(computedUserHasPaid);
                } else {
                    // Reset split states for non-split expenses
                    setIsSplit(false);
                    setSplitType('equal');
                    setParticipants([]);
                    setUserShare(0);
                    setPayer('me');
                }
            } else {
                showToast({ message: 'Expense not found', type: 'error' });
                router.back();
            }
        } catch (_error) {
            // Toast already shown - no logging needed
            showToast({ message: 'Failed to load expense', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Handle split expense save
    const handleSplitSave = (splitParticipants: any[], type: 'equal' | 'custom' | 'percentage', share: number, whoPaid: string, userHasPaid: boolean) => {
        setParticipants(splitParticipants);
        setSplitType(type);
        setUserShare(share);
        // Consider it a split if there are participants OR if someone else paid
        setIsSplit(splitParticipants.length > 0 || whoPaid !== 'me');
        setPayer(whoPaid);
        setUserHasPaidShare(userHasPaid);
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

            const updateData: any = {
                amount: parseFloat(amount),
                category: selectedCategory,
                paymentMethod,
                description: description.trim() || undefined,
                date: expenseDate.toISOString(),
                // Include split data
                isSplit,
                splitType: isSplit ? splitType : undefined,
                participants: isSplit ? participants : undefined,
                userShare: isSplit ? userShare : undefined,
                payer: isSplit ? payer : undefined,
                payerName: isSplit ? (payer === 'me' ? 'You' : participants.find(p => p.id === payer)?.name) : undefined,
                userHasPaidShare: isSplit ? userHasPaidShare : undefined, // Track if user has settled when someone else paid
            };

            try {
                const response: any = await api.updateExpense(token, expenseId, updateData);

                if (response.success) {
                    // Update cache
                    const cached = await getCachedExpenses();
                    const updated = cached.map((e: any) =>
                        e._id === expenseId ? { ...e, ...updateData } : e
                    );
                    await cacheExpenses(updated);

                    // Save participants to independent storage (survives expense deletion)
                    if (isSplit && participants.length > 0) {
                        await saveRecentParticipants(participants.map(p => ({ name: p.name, phone: p.phone })));
                    }

                    showToast({ message: 'Expense updated', type: 'success' });
                    router.back();
                } else {
                    showToast({ message: response.message || 'Failed to update', type: 'error' });
                }
            } catch (error: any) {
                // Network error - save for offline sync
                if (error.message?.includes('Network') || error.message?.includes('fetch')) {
                    await savePendingUpdate(expenseId, updateData);

                    // Update cache immediately
                    const cached = await getCachedExpenses();
                    const updated = cached.map((e: any) =>
                        e._id === expenseId ? { ...e, ...updateData } : e
                    );
                    await cacheExpenses(updated);

                    // Save participants even when offline
                    if (isSplit && participants.length > 0) {
                        await saveRecentParticipants(participants.map(p => ({ name: p.name, phone: p.phone })));
                    }

                    showToast({ message: 'Updated offline. Will sync when online.', type: 'info' });
                    router.back();
                } else {
                    showToast({ message: error.message || 'Failed to update', type: 'error' });
                }
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

                        try {
                            // Try to delete from server
                            await api.deleteExpense(token, expenseId);

                            // Update cache immediately
                            const cached = await getCachedExpenses();
                            const updated = cached.filter((e: any) => e._id !== expenseId);
                            await cacheExpenses(updated);

                            showToast({ message: 'Expense deleted', type: 'success' });
                            router.back();
                        } catch (error: any) {
                            // Network error - save for offline sync
                            if (error.message?.includes('Network') || error.message?.includes('fetch')) {
                                await savePendingDelete(expenseId);

                                // Remove from cache immediately
                                const cached = await getCachedExpenses();
                                const updated = cached.filter((e: any) => e._id !== expenseId);
                                await cacheExpenses(updated);

                                showToast({ message: 'Deleted offline. Will sync when online.', type: 'info' });
                                router.back();
                            } else {
                                showToast({ message: 'Failed to delete expense', type: 'error' });
                            }
                        }
                    } catch (_error) {
                        showToast({ message: 'Failed to delete expense', type: 'error' });
                    }
                },
            },
        ]);
    };

    // Safe mathematical expression evaluator (no eval/Function)
    const safeEvaluate = (expr: string): number | null => {
        try {
            expr = expr.replace(/\s/g, '');
            if (!/^[\d+\-*/().]+$/.test(expr)) return null;
            const tokens: (number | string)[] = [];
            let numBuffer = '';
            for (let i = 0; i < expr.length; i++) {
                const char = expr[i];
                if (/[\d.]/.test(char)) {
                    numBuffer += char;
                } else {
                    if (numBuffer) { tokens.push(parseFloat(numBuffer)); numBuffer = ''; }
                    tokens.push(char);
                }
            }
            if (numBuffer) tokens.push(parseFloat(numBuffer));
            let pos = 0;
            const parseExpression = (): number => {
                let result = parseTerm();
                while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
                    const op = tokens[pos++]; const right = parseTerm();
                    result = op === '+' ? result + right : result - right;
                }
                return result;
            };
            const parseTerm = (): number => {
                let result = parseFactor();
                while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
                    const op = tokens[pos++]; const right = parseFactor();
                    result = op === '*' ? result * right : result / right;
                }
                return result;
            };
            const parseFactor = (): number => {
                if (tokens[pos] === '(') { pos++; const result = parseExpression(); pos++; return result; }
                return tokens[pos++] as number;
            };
            return parseExpression();
        } catch { return null; }
    };

    // Calculator
    const handleCalcPress = (btn: string) => {
        if (btn === 'C') {
            setCalcDisplay('0');
        } else if (btn === 'DEL') {
            setCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
        } else if (btn === '=') {
            const result = safeEvaluate(calcDisplay);
            if (result !== null && isFinite(result)) {
                setCalcDisplay(String(parseFloat(result.toFixed(2))));
            } else {
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

                    {/* Split Expense */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Split Expense</Text>
                    <TouchableOpacity
                        style={[styles.selector, { backgroundColor: theme.colors.surface }]}
                        onPress={() => setShowSplitModal(true)}
                    >
                        <View style={styles.selectedItem}>
                            <View style={[styles.iconBox, { backgroundColor: '#8B5CF6' + '20' }]}>
                                <MaterialIcons name="group" size={20} color="#8B5CF6" />
                            </View>
                            <Text style={[styles.selectorText, { color: isSplit && participants.length > 0 ? theme.colors.text : theme.colors.textTertiary }]}>
                                {isSplit && participants.length > 0 
                                    ? `Split with ${participants.length} ${participants.length === 1 ? 'person' : 'people'}` 
                                    : 'Split this expense'}
                            </Text>
                        </View>
                        <MaterialIcons name="keyboard-arrow-right" size={24} color={theme.colors.textSecondary} />
                    </TouchableOpacity>

                    {/* Show split summary only when actually split with participants */}
                    {isSplit && participants.length > 0 && (
                        <View style={[styles.splitSummary, { backgroundColor: '#8B5CF6' + '10' }]}>
                            {/* Different view based on who paid */}
                            {payer === 'me' ? (
                                <>
                                    {/* I paid - show what others owe me */}
                                    <Text style={[styles.splitSummaryText, { color: theme.colors.text }]}>
                                        Your share: {currencySymbol}{userShare.toLocaleString()}
                                    </Text>
                                    <Text style={[styles.splitSummaryText, { color: theme.colors.textSecondary }]}>
                                        Others owe you: {currencySymbol}{(parseFloat(amount || '0') - userShare).toLocaleString()}
                                    </Text>
                                    {/* Participant details - show all when I paid */}
                                    <View style={styles.participantList}>
                                        {participants.map((p, idx) => (
                                            <View key={p.id || idx} style={styles.participantRow}>
                                                <View style={styles.participantInfo}>
                                                    <MaterialIcons
                                                        name={p.isPaid ? "check-circle" : "radio-button-unchecked"}
                                                        size={18}
                                                        color={p.isPaid ? "#10B981" : theme.colors.textTertiary}
                                                    />
                                                    <Text style={[styles.participantName, { color: theme.colors.text }]}>
                                                        {p.name}
                                                    </Text>
                                                </View>
                                                <View style={styles.participantAmountRow}>
                                                    <Text style={[styles.participantAmount, { color: theme.colors.text }]}>
                                                        {currencySymbol}{(p.shareAmount || 0).toLocaleString()}
                                                    </Text>
                                                    <Text style={[styles.participantStatus, { color: p.isPaid ? "#10B981" : "#F59E0B" }]}>
                                                        {p.isPaid ? "Settled" : "Owes you"}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <>
                                    {/* Someone else paid - show my status */}
                                    {(() => {
                                        const payerParticipant = participants.find(p => (p.id || (p as any)._id) === payer);
                                        const payerName = payerParticipant?.name || 'Unknown';
                                        return (
                                            <>
                                                <View style={[styles.payerBadge, { backgroundColor: '#10B981' + '20' }]}>
                                                    <MaterialIcons name="account-balance-wallet" size={16} color="#10B981" />
                                                    <Text style={[styles.payerBadgeText, { color: '#10B981' }]}>
                                                        {payerName} paid the bill
                                                    </Text>
                                                </View>
                                                <View style={[styles.myStatusRow, { backgroundColor: userHasPaidShare ? '#10B981' + '10' : '#F59E0B' + '10', marginTop: 8 }]}>
                                                    <View style={styles.participantInfo}>
                                                        <MaterialIcons
                                                            name={userHasPaidShare ? "check-circle" : "schedule"}
                                                            size={20}
                                                            color={userHasPaidShare ? "#10B981" : "#F59E0B"}
                                                        />
                                                        <Text style={[styles.myStatusText, { color: theme.colors.text }]}>
                                                            My share
                                                        </Text>
                                                    </View>
                                                    <View style={styles.participantAmountRow}>
                                                        <Text style={[styles.participantAmount, { color: theme.colors.text, fontWeight: '600' }]}>
                                                            {currencySymbol}{userShare.toLocaleString()}
                                                        </Text>
                                                        <Text style={[styles.participantStatus, { color: userHasPaidShare ? "#10B981" : "#F59E0B" }]}>
                                                            {userHasPaidShare ? "Settled" : `Owe ${payerName}`}
                                                        </Text>
                                                    </View>
                                                </View>
                                            </>
                                        );
                                    })()}
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Update Button */}
                <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 10) + 20 }]}>
                    <TouchableOpacity
                        style={[styles.saveBtn, { backgroundColor: selectedCat?.color || theme.colors.primary }]}
                        onPress={handleUpdate}
                        disabled={saving}
                    >
                        <Text style={styles.saveBtnText}>{saving ? 'Updating...' : 'Update'}</Text>
                    </TouchableOpacity>
                </View>

                {/* Split Modal */}
                <SplitModal
                    visible={showSplitModal}
                    onClose={() => setShowSplitModal(false)}
                    totalAmount={parseFloat(amount) || 0}
                    currencySymbol={currencySymbol}
                    initialPayer={payer}
                    initialParticipants={participants}
                    initialSplitType={splitType}
                    initialUserHasPaid={userHasPaidShare}
                    recentParticipants={recentParticipants}
                    onSave={handleSplitSave}
                />

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
    saveBtn: { flexDirection: 'row', paddingVertical: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '600' },

    // Split expense styles
    splitSummary: { marginTop: 8, padding: 12, borderRadius: 10 },
    splitSummaryText: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
    participantList: { marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(139, 92, 246, 0.2)', paddingTop: 12 },
    participantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    participantInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    participantName: { fontSize: 14, fontWeight: '500' },
    participantAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    participantAmount: { fontSize: 14, fontWeight: '600' },
    participantStatus: { fontSize: 12, fontWeight: '500' },
    // Payer badge and my status styles (when someone else paid)
    payerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start' },
    payerBadgeText: { fontSize: 13, fontWeight: '600' },
    myStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12 },
    myStatusText: { fontSize: 15, fontWeight: '600' },

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
