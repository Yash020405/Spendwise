import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    SectionList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Modal,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../utils/ThemeContext';
import api from '../../utils/api';
import { cacheExpenses, getMergedExpenses } from '../../utils/offlineSync';

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
    Food: { color: '#F59E0B', icon: 'restaurant' },
    Transport: { color: '#3B82F6', icon: 'directions-car' },
    Shopping: { color: '#EC4899', icon: 'shopping-bag' },
    Entertainment: { color: '#8B5CF6', icon: 'movie' },
    Bills: { color: '#EF4444', icon: 'receipt' },
    Health: { color: '#10B981', icon: 'local-hospital' },
    Education: { color: '#06B6D4', icon: 'school' },
    Other: { color: '#6B7280', icon: 'more-horiz' },
};

const PAYMENT_CONFIG: Record<string, { icon: string; color: string }> = {
    'Cash': { icon: 'payments', color: '#10B981' },
    'Card': { icon: 'credit-card', color: '#3B82F6' },
    'UPI': { icon: 'phone-android', color: '#8B5CF6' },
    'Bank Transfer': { icon: 'account-balance', color: '#F59E0B' },
};

const VIEW_MODES = ['Daily', 'Weekly', 'Monthly'] as const;

interface Expense {
    _id: string;
    amount: number;
    category: string;
    description?: string;
    date: string;
    paymentMethod: string;
}

interface Income {
    _id: string;
    amount: number;
    source: string;
    description?: string;
    date: string;
}

type Transaction = (Expense & { type: 'expense' }) | (Income & { type: 'income' });

interface Section {
    title: string;
    data: Transaction[];
}

type TransactionType = 'all' | 'expense' | 'income';

export default function ExpensesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    const getInitialViewMode = () => {
        const p = params.viewMode as string;
        if (p === 'daily') return 'Daily';
        if (p === 'weekly') return 'Weekly';
        return 'Monthly';
    };

    const [viewMode, setViewMode] = useState<typeof VIEW_MODES[number]>(getInitialViewMode());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedWeekStart, setSelectedWeekStart] = useState(getWeekStart(new Date()));
    const [selectedMonth, setSelectedMonth] = useState(new Date());

    const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [transactionType, setTransactionType] = useState<TransactionType>('all');
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [currencySymbol, setCurrencySymbol] = useState('₹');

    // Update category filter when navigating from insights
    // Update category filter when navigating from insights or clear when from See All
    React.useEffect(() => {
        const cat = params.category as string;
        if (cat === '') {
            // Clear filter when coming from "See All"
            setSelectedCategory(null);
        } else if (cat && Object.keys(CATEGORY_CONFIG).includes(cat)) {
            setSelectedCategory(cat);
        }
    }, [params.category]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [incomeList, setIncomeList] = useState<Income[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('@auth_token');
            const userData = await AsyncStorage.getItem('@user');

            if (!token) {
                console.error('No auth token found');
                return;
            }

            if (userData) {
                const user = JSON.parse(userData);
                setCurrencySymbol(user.currencySymbol || '₹');
            }

            try {
                const response: any = await api.getExpenses(token);

                if (response.success && Array.isArray(response.data)) {
                    // Cache server data
                    await cacheExpenses(response.data);
                }

                // Fetch income as well
                const incomeRes: any = await api.getIncome(token);
                // Handle both 'data' and 'income' keys for compatibility
                const incomeData = incomeRes.data || incomeRes.income;
                if (incomeRes.success && Array.isArray(incomeData)) {
                    console.log('✅ Income loaded:', incomeData.length, 'entries');
                    setIncomeList(incomeData);
                } else {
                    console.log('⚠️ Income fetch - no data:', incomeRes);
                }
            } catch (error: any) {
                // Network error - will use cached + offline data
                console.log('Network error, using cached data:', error.message);
            }

            // Always get merged data (cached server + offline pending)
            const merged = await getMergedExpenses();
            setExpenses(merged);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchExpenses();
            const p = params.viewMode as string;
            if (p === 'daily') setViewMode('Daily');
            else if (p === 'weekly') setViewMode('Weekly');
            else if (p === 'monthly') setViewMode('Monthly');
        }, [params.viewMode])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchExpenses();
        setRefreshing(false);
    };

    // Combine expenses and income into transactions
    const allTransactions: Transaction[] = useMemo(() => {
        const expenseTxns: Transaction[] = expenses.map(e => ({ ...e, type: 'expense' as const }));
        const incomeTxns: Transaction[] = incomeList.map(i => ({ ...i, type: 'income' as const }));
        return [...expenseTxns, ...incomeTxns];
    }, [expenses, incomeList]);

    const filteredTransactions = useMemo(() => {
        let filtered = [...allTransactions];

        // Filter by type
        if (transactionType === 'expense') {
            filtered = filtered.filter(t => t.type === 'expense');
        } else if (transactionType === 'income') {
            filtered = filtered.filter(t => t.type === 'income');
        }

        // Filter by date range
        if (viewMode === 'Daily') {
            const dayStart = new Date(selectedDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(selectedDate);
            dayEnd.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => {
                const d = new Date(t.date);
                return d >= dayStart && d <= dayEnd;
            });
        } else if (viewMode === 'Weekly') {
            const weekEnd = new Date(selectedWeekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => {
                const d = new Date(t.date);
                return d >= selectedWeekStart && d <= weekEnd;
            });
        } else {
            const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
            const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
            monthEnd.setHours(23, 59, 59, 999);
            filtered = filtered.filter(t => {
                const d = new Date(t.date);
                return d >= monthStart && d <= monthEnd;
            });
        }

        // Filter by payment method (expenses only)
        if (selectedPayment) {
            filtered = filtered.filter(t => t.type === 'expense' && (t as Expense).paymentMethod === selectedPayment);
        }
        // Filter by category (expenses only)
        if (selectedCategory) {
            filtered = filtered.filter(t => t.type === 'expense' && (t as Expense).category === selectedCategory);
        }

        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allTransactions, transactionType, viewMode, selectedDate, selectedWeekStart, selectedMonth, selectedPayment, selectedCategory]);

    // Group by date for SectionList
    const sections: Section[] = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        filteredTransactions.forEach(txn => {
            const dateKey = new Date(txn.date).toDateString();
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(txn);
        });
        return Object.entries(groups).map(([dateStr, data]) => ({
            title: formatSectionDate(dateStr),
            data,
        }));
    }, [filteredTransactions]);

    // Calculate net total (income positive, expense negative)
    const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const netTotal = totalIncome - totalExpense;

    const navigateDate = (dir: 1 | -1) => {
        if (viewMode === 'Daily') {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() + dir);
            setSelectedDate(d);
        } else if (viewMode === 'Weekly') {
            const d = new Date(selectedWeekStart);
            d.setDate(d.getDate() + 7 * dir);
            setSelectedWeekStart(d);
        } else {
            const d = new Date(selectedMonth);
            d.setMonth(d.getMonth() + dir);
            setSelectedMonth(d);
        }
    };

    const getDateLabel = () => {
        if (viewMode === 'Daily') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const sel = new Date(selectedDate);
            sel.setHours(0, 0, 0, 0);
            if (sel.getTime() === today.getTime()) return 'Today';
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (sel.getTime() === yesterday.getTime()) return 'Yesterday';
            return selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } else if (viewMode === 'Weekly') {
            const weekEnd = new Date(selectedWeekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            return `${selectedWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        }
        return selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const handleTransactionPress = (txn: Transaction) => {
        if (txn.type === 'expense') {
            router.push({ pathname: '/(main)/edit-expense', params: { id: txn._id } });
        }
        // Income editing can be added later
    };

    const renderSectionHeader = ({ section }: { section: Section }) => (
        <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{section.title}</Text>
        </View>
    );

    const INCOME_CONFIG = { color: '#10B981', icon: 'trending-up' };

    const renderTransaction = ({ item }: { item: Transaction }) => {
        const isIncome = item.type === 'income';
        const config = isIncome
            ? INCOME_CONFIG
            : (CATEGORY_CONFIG[(item as Expense).category] || CATEGORY_CONFIG.Other);

        return (
            <TouchableOpacity
                style={[styles.expenseItem, { backgroundColor: theme.colors.surface }]}
                onPress={() => handleTransactionPress(item)}
                activeOpacity={0.7}
            >
                <View style={[styles.expenseIcon, { backgroundColor: config.color + '20' }]}>
                    <MaterialIcons name={config.icon as any} size={22} color={config.color} />
                </View>
                <View style={styles.expenseDetails}>
                    <Text style={[styles.expenseTitle, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.description || (isIncome ? (item as Income).source : (item as Expense).category)}
                    </Text>
                    <Text style={[styles.expenseSubtitle, { color: theme.colors.textSecondary }]}>
                        {isIncome ? 'Income' : (item as Expense).paymentMethod}
                    </Text>
                </View>
                <Text style={[styles.expenseAmount, { color: isIncome ? '#10B981' : theme.colors.text }]}>
                    {isIncome ? '+' : '-'}{currencySymbol}{item.amount.toLocaleString()}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.text }]}>Transactions</Text>
            </View>
            {/* View Mode Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: theme.colors.surface }]}>
                {VIEW_MODES.map(mode => (
                    <TouchableOpacity
                        key={mode}
                        style={[styles.tab, viewMode === mode && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setViewMode(mode)}
                    >
                        <Text style={[styles.tabText, { color: viewMode === mode ? '#FFF' : theme.colors.textSecondary }]}>
                            {mode}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Date Navigation */}
            <View style={styles.dateNav}>
                <TouchableOpacity onPress={() => navigateDate(-1)} style={styles.navBtn}>
                    <MaterialIcons name="chevron-left" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.dateInfo}>
                    <Text style={[styles.dateLabel, { color: theme.colors.text }]}>{getDateLabel()}</Text>
                </View>
                <TouchableOpacity onPress={() => navigateDate(1)} style={styles.navBtn}>
                    <MaterialIcons name="chevron-right" size={28} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {/* Quick Stats Summary */}
            <View style={[styles.statsSummary, { backgroundColor: theme.colors.surface }]}>
                <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                    <Text style={[styles.statsValue, { color: '#10B981' }]}>+{currencySymbol}{totalIncome.toLocaleString()}</Text>
                </View>
                <View style={[styles.statsDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                    <Text style={[styles.statsValue, { color: '#EF4444' }]}>-{currencySymbol}{totalExpense.toLocaleString()}</Text>
                </View>
                <View style={[styles.statsDivider, { backgroundColor: theme.colors.border }]} />
                <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: theme.colors.textSecondary }]}>Net</Text>
                    <Text style={[styles.statsValue, { color: netTotal >= 0 ? '#10B981' : '#EF4444' }]}>
                        {netTotal >= 0 ? '+' : ''}{currencySymbol}{netTotal.toLocaleString()}
                    </Text>
                </View>
            </View>

            {/* Transaction Type Filter */}
            <View style={styles.typeFilter}>
                {(['all', 'expense', 'income'] as const).map((type) => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.typeBtn,
                            { backgroundColor: transactionType === type ? theme.colors.primary : theme.colors.surface }
                        ]}
                        onPress={() => setTransactionType(type)}
                    >
                        <Text style={[
                            styles.typeBtnText,
                            { color: transactionType === type ? '#FFF' : theme.colors.textSecondary }
                        ]}>
                            {type === 'all' ? 'All' : type === 'expense' ? 'Expenses' : 'Income'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Filters */}
            <View style={styles.filters}>
                <TouchableOpacity
                    style={[
                        styles.filterBtn,
                        {
                            backgroundColor: selectedCategory ? (CATEGORY_CONFIG[selectedCategory]?.color || theme.colors.primary) : theme.colors.surface,
                            borderColor: theme.colors.border,
                            opacity: transactionType === 'income' ? 0.6 : 1, // Visually indicate it might not apply as expected but keep for now if needed, or better:
                        },
                    ]}
                    onPress={() => transactionType !== 'income' && setShowCategoryModal(true)}
                    disabled={transactionType === 'income'}
                >
                    <MaterialIcons
                        name={transactionType === 'income' ? 'account-balance-wallet' : (selectedCategory ? (CATEGORY_CONFIG[selectedCategory]?.icon as any) : 'category')}
                        size={18}
                        color={selectedCategory ? '#FFF' : theme.colors.textSecondary}
                    />
                    <Text style={[styles.filterText, { color: selectedCategory ? '#FFF' : theme.colors.textSecondary }]}>
                        {transactionType === 'income' ? 'Total Income' : (selectedCategory || 'Category')}
                    </Text>
                    {transactionType !== 'income' && <MaterialIcons name="arrow-drop-down" size={18} color={selectedCategory ? '#FFF' : theme.colors.textSecondary} />}
                </TouchableOpacity>

                {transactionType !== 'income' && (
                    <TouchableOpacity
                        style={[
                            styles.filterBtn,
                            {
                                backgroundColor: selectedPayment ? theme.colors.primary : theme.colors.surface,
                                borderColor: theme.colors.border,
                            },
                        ]}
                        onPress={() => setShowPaymentModal(true)}
                    >
                        <MaterialIcons name="payments" size={18} color={selectedPayment ? '#FFF' : theme.colors.textSecondary} />
                        <Text style={[styles.filterText, { color: selectedPayment ? '#FFF' : theme.colors.textSecondary }]}>
                            {selectedPayment || 'Payment'}
                        </Text>
                        <MaterialIcons name="arrow-drop-down" size={18} color={selectedPayment ? '#FFF' : theme.colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Expense List with Date Sections */}
            {sections.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="receipt-long" size={56} color={theme.colors.textTertiary} />
                    <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No transactions</Text>
                    <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                        No transactions for this period
                    </Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item._id}
                    renderItem={renderTransaction}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled={true}
                />
            )}

            {/* Category Modal */}
            <Modal visible={showCategoryModal} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowCategoryModal(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Category</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <TouchableOpacity
                                style={[styles.modalOption, selectedCategory === null && { backgroundColor: theme.colors.primaryLight + '30' }]}
                                onPress={() => { setSelectedCategory(null); setShowCategoryModal(false); }}
                            >
                                <MaterialIcons name="apps" size={22} color={theme.colors.primary} />
                                <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>All Categories</Text>
                                {selectedCategory === null && <MaterialIcons name="check" size={20} color={theme.colors.primary} />}
                            </TouchableOpacity>
                            {Object.entries(CATEGORY_CONFIG).map(([cat, config]) => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.modalOption, selectedCategory === cat && { backgroundColor: config.color + '20' }]}
                                    onPress={() => { setSelectedCategory(cat); setShowCategoryModal(false); }}
                                >
                                    <MaterialIcons name={config.icon as any} size={22} color={config.color} />
                                    <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>{cat}</Text>
                                    {selectedCategory === cat && <MaterialIcons name="check" size={20} color={config.color} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Payment Modal */}
            <Modal visible={showPaymentModal} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowPaymentModal(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Select Payment Method</Text>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <TouchableOpacity
                                style={[styles.modalOption, selectedPayment === null && { backgroundColor: theme.colors.primaryLight + '30' }]}
                                onPress={() => { setSelectedPayment(null); setShowPaymentModal(false); }}
                            >
                                <MaterialIcons name="payments" size={22} color={theme.colors.primary} />
                                <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>All Payment Methods</Text>
                                {selectedPayment === null && <MaterialIcons name="check" size={20} color={theme.colors.primary} />}
                            </TouchableOpacity>
                            {Object.entries(PAYMENT_CONFIG).map(([pm, config]) => (
                                <TouchableOpacity
                                    key={pm}
                                    style={[styles.modalOption, selectedPayment === pm && { backgroundColor: config.color + '20' }]}
                                    onPress={() => { setSelectedPayment(pm); setShowPaymentModal(false); }}
                                >
                                    <MaterialIcons name={config.icon as any} size={22} color={config.color} />
                                    <Text style={[styles.modalOptionText, { color: theme.colors.text }]}>{pm}</Text>
                                    {selectedPayment === pm && <MaterialIcons name="check" size={20} color={config.color} />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatSectionDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: 24, fontWeight: '700' },

    tabContainer: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 12,
        padding: 4,
    },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    tabText: { fontSize: 14, fontWeight: '600' },

    dateNav: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 16,
    },
    navBtn: { padding: 4 },
    dateInfo: { alignItems: 'center' },
    dateLabel: { fontSize: 18, fontWeight: '600' },
    totalAmount: { fontSize: 24, fontWeight: '700', marginTop: 4 },

    filters: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 12 },
    filterBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        gap: 6,
    },
    filterText: { fontSize: 13, fontWeight: '500' },

    listContent: { paddingHorizontal: 16, paddingBottom: 100 },

    sectionHeader: { paddingVertical: 8, paddingTop: 16 },
    sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

    expenseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        padding: 14,
        borderRadius: 12,
    },
    expenseIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    expenseDetails: { flex: 1, marginLeft: 12 },
    expenseTitle: { fontSize: 15, fontWeight: '600' },
    expenseSubtitle: { fontSize: 13, marginTop: 2 },
    expenseAmount: { fontSize: 16, fontWeight: '700' },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
    emptySubtitle: { fontSize: 14, marginTop: 4 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', borderRadius: 16, padding: 16, maxHeight: '70%' },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
    modalOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        marginBottom: 6,
        gap: 12,
    },
    modalOptionText: { flex: 1, fontSize: 15, fontWeight: '500' },
    // Type filter styles
    typeFilter: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
    typeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    typeBtnText: { fontSize: 12, fontWeight: '600' },
    statsSummary: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 16,
        borderRadius: 16,
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    statsItem: {
        flex: 1,
        alignItems: 'center',
    },
    statsLabel: {
        fontSize: 10,
        fontWeight: '500',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    statsValue: {
        fontSize: 14,
        fontWeight: '700',
    },
    statsDivider: {
        width: 1,
        height: 20,
    },
});
