import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import api from '../../utils/api';
import { getMergedExpenses, cacheExpenses, updateCachedExpense, savePendingUpdate } from '../../utils/offlineSync';

interface Participant {
    _id?: string;
    id?: string;
    name: string;
    phone?: string;
    shareAmount: number;
    isPaid: boolean;
    paidDate?: string;
    paidAmount?: number;
}

interface SplitExpense {
    _id: string;
    amount: number;
    category: string;
    description?: string;
    date: string;
    participants: Participant[];
    userShare: number;
    isSplit: boolean;
    splitType?: string;
    payer?: string;
    payerName?: string;
    userHasPaidShare?: boolean;
}

interface PersonBalance {
    name: string;
    phone?: string;
    totalOwes: number; // They owe me
    totalPaid: number; // They paid me back
    totalIOwe: number; // I owe them
    balance: number;   // (Owes - Paid) - IOwe
    expenses: {
        expenseId: string;
        description: string;
        amount: number;
        isPaid: boolean;
        date: string;
        type: 'owes_me' | 'i_owe';
    }[];
}

export default function OwesDuesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { showToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);
    const [, setLoading] = useState(true);
    const [splitExpenses, setSplitExpenses] = useState<SplitExpense[]>([]);
    const [currencySymbol, setCurrencySymbol] = useState('₹');
    const [activeTab, setActiveTab] = useState<'owes' | 'all'>('owes');

    const fetchData = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('@auth_token');
            const userData = await AsyncStorage.getItem('@user');

            if (!token) {
                router.replace('/(auth)/welcome');
                return;
            }

            if (userData) {
                const user = JSON.parse(userData);
                setCurrencySymbol(user.currencySymbol || '₹');
            }

            // Fetch expenses
            try {
                const response: any = await api.getExpenses(token);
                if (response.success && Array.isArray(response.data)) {
                    await cacheExpenses(response.data);
                }
            } catch (_error) {
                // Silent: Network error - will use cached data
            }

            const expenses = await getMergedExpenses();
            // Filter only split expenses
            const splits = expenses.filter((e: any) => e.isSplit && e.participants?.length > 0);
            setSplitExpenses(splits);
        } catch (_error) {
            // Toast shown - no logging needed
            showToast({ message: 'Failed to load data', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    // Calculate balances per person
    const personBalances: PersonBalance[] = useMemo(() => {
        const balanceMap = new Map<string, PersonBalance>();

        splitExpenses.forEach(expense => {
            // Determine if I paid
            // payer can be 'me', or my ID, or null (default to me)
            // But checking 'me' string or ID match needs user ID context. 
            // In fetchData we parsed user. For now assuming 'me' or default.
            // Wait, we need the stored User ID to compare strictly if it's an ID string.
            // Let's rely on 'payer' field: if it's 'me' or undefined -> I Paid.
            // If it's a specific ID -> Check if it matches my ID (need to store myId in state? 
            // or just assume if it is NOT 'me' and has a name, it's someone else).

            // To be robust: If expense.payerName is 'You', I paid.
            const payerName = expense.payerName || 'You';
            const isPayerMe = payerName === 'You' || !expense.payer || expense.payer === 'me';

            if (isPayerMe) {
                // I Paid -> Participants owe me
                expense.participants?.forEach(participant => {
                    const key = participant.name.toLowerCase();
                    const existing = balanceMap.get(key) || {
                        name: participant.name,
                        phone: participant.phone,
                        totalOwes: 0,
                        totalPaid: 0,
                        totalIOwe: 0,
                        balance: 0,
                        expenses: [],
                    };

                    existing.totalOwes += participant.shareAmount;
                    if (participant.isPaid) {
                        existing.totalPaid += participant.paidAmount || participant.shareAmount;
                    }

                    existing.expenses.push({
                        expenseId: expense._id,
                        description: expense.description || expense.category,
                        amount: participant.shareAmount,
                        isPaid: participant.isPaid,
                        date: expense.date,
                        type: 'owes_me'
                    });

                    balanceMap.set(key, existing);
                });
            } else {
                // Someone else paid -> I owe them (expense.userShare)
                // Use payerName as the key person
                const key = payerName.toLowerCase();
                const existing = balanceMap.get(key) || {
                    name: payerName,
                    phone: undefined, // Might not have phone for payer unless linked
                    totalOwes: 0,
                    totalPaid: 0,
                    totalIOwe: 0,
                    balance: 0,
                    expenses: [],
                };

                // Only add to IOwe if user hasn't paid their share yet
                const userHasPaid = (expense as any).userHasPaidShare === true;
                if (!userHasPaid) {
                    existing.totalIOwe += expense.userShare;
                }

                existing.expenses.push({
                    expenseId: expense._id,
                    description: expense.description || expense.category,
                    amount: expense.userShare,
                    isPaid: userHasPaid, // Use the userHasPaidShare field
                    date: expense.date,
                    type: 'i_owe'
                });

                balanceMap.set(key, existing);
            }
        });

        // Calculate final balances
        return Array.from(balanceMap.values()).map(p => ({
            ...p,
            balance: (p.totalOwes - p.totalPaid) - p.totalIOwe
        })).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    }, [splitExpenses]);

    // Filter based on active tab
    const displayBalances = useMemo(() => {
        if (activeTab === 'owes') {
            // Show people with unpaid balances (either they owe me or I owe them)
            return personBalances.filter(p => p.balance !== 0);
        }
        return personBalances;
    }, [personBalances, activeTab]);

    const totalOwedToMe = personBalances.reduce((sum, p) => sum + Math.max(0, p.balance), 0);
    const totalIOwe = personBalances.reduce((sum, p) => sum + p.totalIOwe, 0);
    const _totalPaidBack = personBalances.reduce((sum, p) => sum + p.totalPaid, 0);

    const handleMarkPaid = async (personName: string, expenseId: string) => {
        Alert.alert(
            'Mark as Paid',
            `Mark ${personName}'s share as paid?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark Paid',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('@auth_token');
                            if (!token) return;

                            // Find the expense and update participant
                            const expense = splitExpenses.find(e => e._id === expenseId);
                            if (!expense) return;

                            const updatedParticipants = expense.participants.map(p =>
                                p.name.toLowerCase() === personName.toLowerCase()
                                    ? { ...p, isPaid: true, paidDate: new Date().toISOString(), paidAmount: p.shareAmount }
                                    : p
                            );

                            // Prepare update data - preserve ALL existing fields to prevent data loss
                            const updateData = {
                                isSplit: expense.isSplit,
                                splitType: expense.splitType || 'equal',
                                participants: updatedParticipants,
                                userShare: expense.userShare,
                                payer: expense.payer, // Preserve payer!
                                payerName: expense.payerName, // Preserve payerName!
                                userHasPaidShare: expense.userHasPaidShare, // Preserve user's paid status
                            };

                            try {
                                // Try to update on server first
                                const result: any = await api.updateExpense(token, expenseId, updateData);

                                if (result.success) {
                                    // Update cache with server response
                                    await updateCachedExpense(expenseId, updateData);
                                    showToast({ message: 'Marked as paid!', type: 'success' });
                                    fetchData();
                                } else {
                                    showToast({ message: result.message || 'Failed to update', type: 'error' });
                                }
                            } catch (_networkError) {
                                // Offline mode - save to pending updates and update cache
                                console.log('Network error, saving offline update');
                                await savePendingUpdate(expenseId, updateData);
                                await updateCachedExpense(expenseId, updateData);
                                
                                // Update local state for immediate feedback
                                setSplitExpenses(prev => prev.map(exp => 
                                    exp._id === expenseId 
                                        ? { ...exp, participants: updatedParticipants }
                                        : exp
                                ));
                                
                                showToast({ message: 'Marked as paid! (will sync when online)', type: 'success' });
                            }
                        } catch (_error) {
                            // Toast shown - no logging needed
                            showToast({ message: 'Failed to update', type: 'error' });
                        }
                    },
                },
            ]
        );
    };

    // Mark my own share as paid (when someone else paid the bill)
    const handleMarkMySharePaid = async (personName: string, expenseId: string) => {
        Alert.alert(
            'Mark Your Share as Paid',
            `Mark that you've paid ${personName} your share?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, I Paid',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('@auth_token');
                            if (!token) return;

                            console.log('Marking share as paid for expense:', expenseId);
                            const updateData = { userHasPaidShare: true };

                            try {
                                // Try to update on server first
                                const result: any = await api.updateExpense(token, expenseId, updateData);

                                console.log('Server response:', JSON.stringify(result, null, 2));

                                if (result.success) {
                                    // Update the cache immediately
                                    await updateCachedExpense(expenseId, updateData);
                                    console.log('Cache updated for expense:', expenseId);
                                    
                                    // Also update local state immediately for better UX
                                    setSplitExpenses(prev => prev.map(exp => 
                                        exp._id === expenseId 
                                            ? { ...exp, userHasPaidShare: true }
                                            : exp
                                    ));
                                    showToast({ message: 'Marked as paid!', type: 'success' });
                                    // Still fetch to ensure sync
                                    fetchData();
                                } else {
                                    showToast({ message: result.message || 'Failed to update', type: 'error' });
                                }
                            } catch (_networkError) {
                                // Offline mode - save to pending updates and update cache
                                console.log('Network error, saving offline update for userHasPaidShare');
                                await savePendingUpdate(expenseId, updateData);
                                await updateCachedExpense(expenseId, updateData);
                                
                                // Update local state for immediate feedback
                                setSplitExpenses(prev => prev.map(exp => 
                                    exp._id === expenseId 
                                        ? { ...exp, userHasPaidShare: true }
                                        : exp
                                ));
                                
                                showToast({ message: 'Marked as paid! (will sync when online)', type: 'success' });
                            }
                        } catch (error) {
                            console.log('Error marking paid:', error);
                            showToast({ message: 'Failed to update', type: 'error' });
                        }
                    },
                },
            ]
        );
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Owes & Dues</Text>
                <View style={styles.headerBtn} />
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Summary Cards */}
                <View style={styles.summaryRow}>
                    <View style={[styles.summaryCard, { backgroundColor: '#10B981' + '15' }]}>
                        <MaterialIcons name="arrow-downward" size={24} color="#10B981" />
                        <Text style={[styles.summaryAmount, { color: '#10B981' }]}>
                            {currencySymbol}{totalOwedToMe.toLocaleString()}
                        </Text>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                            Owed to you
                        </Text>
                    </View>
                    <View style={[styles.summaryCard, { backgroundColor: '#F59E0B' + '15' }]}>
                        <MaterialIcons name="arrow-upward" size={24} color="#F59E0B" />
                        <Text style={[styles.summaryAmount, { color: '#F59E0B' }]}>
                            {currencySymbol}{totalIOwe.toLocaleString()}
                        </Text>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>
                            You owe
                        </Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={[styles.tabs, { backgroundColor: theme.colors.surface }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'owes' && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setActiveTab('owes')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'owes' ? '#FFF' : theme.colors.textSecondary }]}>
                            Pending ({personBalances.filter(p => p.balance !== 0).length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'all' && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Text style={[styles.tabText, { color: activeTab === 'all' ? '#FFF' : theme.colors.textSecondary }]}>
                            All ({personBalances.length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Person List */}
                {displayBalances.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="groups" size={64} color={theme.colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                            {activeTab === 'owes' ? 'No pending payments' : 'No split expenses yet'}
                        </Text>
                        <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
                            Split expenses will appear here
                        </Text>
                    </View>
                ) : (
                    displayBalances.map((person, index) => (
                        <View
                            key={person.name + index}
                            style={[styles.personCard, { backgroundColor: theme.colors.surface }]}
                        >
                            <View style={styles.personHeader}>
                                <View style={[styles.avatar, {
                                    backgroundColor: person.balance > 0 ? '#EF4444' + '20' :
                                        person.balance < 0 ? '#F59E0B' + '20' : '#10B981' + '20'
                                }]}>
                                    <Text style={[styles.avatarText, {
                                        color: person.balance > 0 ? '#EF4444' :
                                            person.balance < 0 ? '#F59E0B' : '#10B981'
                                    }]}>
                                        {person.name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.personInfo}>
                                    <Text style={[styles.personName, { color: theme.colors.text }]}>{person.name}</Text>
                                    {person.phone && (
                                        <Text style={[styles.personPhone, { color: theme.colors.textSecondary }]}>{person.phone}</Text>
                                    )}
                                </View>
                                <View style={styles.balanceContainer}>
                                    {person.balance > 0 ? (
                                        <>
                                            <Text style={[styles.balanceLabel, { color: '#EF4444' }]}>Owes you</Text>
                                            <Text style={[styles.balanceAmount, { color: '#EF4444' }]}>
                                                {currencySymbol}{person.balance.toLocaleString()}
                                            </Text>
                                        </>
                                    ) : person.balance < 0 ? (
                                        <>
                                            <Text style={[styles.balanceLabel, { color: '#F59E0B' }]}>You owe</Text>
                                            <Text style={[styles.balanceAmount, { color: '#F59E0B' }]}>
                                                {currencySymbol}{Math.abs(person.balance).toLocaleString()}
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={[styles.balanceLabel, { color: '#10B981' }]}>Settled</Text>
                                            <MaterialIcons name="check-circle" size={20} color="#10B981" />
                                        </>
                                    )}
                                </View>
                            </View>

                            {/* Expense breakdown */}
                            <View style={styles.expensesList}>
                                {person.expenses.map((exp, expIndex) => (
                                    <View
                                        key={exp.expenseId + expIndex}
                                        style={[styles.expenseItem, { borderTopColor: theme.colors.border }]}
                                    >
                                        <View style={styles.expenseInfo}>
                                            <Text style={[styles.expenseDesc, { color: theme.colors.text }]}>
                                                {exp.description}
                                            </Text>
                                            <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
                                                {formatDate(exp.date)}
                                            </Text>
                                        </View>
                                        <View style={styles.expenseRight}>
                                            <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
                                                {currencySymbol}{exp.amount.toLocaleString()}
                                            </Text>
                                            {exp.isPaid ? (
                                                <View style={[styles.paidBadge, { backgroundColor: '#10B981' + '20' }]}>
                                                    <Text style={[styles.paidText, { color: '#10B981' }]}>Paid</Text>
                                                </View>
                                            ) : exp.type === 'i_owe' ? (
                                                <TouchableOpacity
                                                    style={[styles.markPaidBtn, { backgroundColor: '#F59E0B' }]}
                                                    onPress={() => handleMarkMySharePaid(person.name, exp.expenseId)}
                                                >
                                                    <Text style={styles.markPaidText}>Pay Now</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    style={[styles.markPaidBtn, { backgroundColor: theme.colors.primary }]}
                                                    onPress={() => handleMarkPaid(person.name, exp.expenseId)}
                                                >
                                                    <Text style={styles.markPaidText}>Mark Paid</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600' },

    summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: 8 },
    summaryCard: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
    summaryAmount: { fontSize: 24, fontWeight: '700', marginTop: 8 },
    summaryLabel: { fontSize: 13, marginTop: 4 },

    tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 20, borderRadius: 12, padding: 4 },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    tabText: { fontSize: 14, fontWeight: '600' },

    emptyState: { alignItems: 'center', paddingVertical: 60 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
    emptySubtitle: { fontSize: 14, marginTop: 8 },

    personCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden' },
    personHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18, fontWeight: '600' },
    personInfo: { flex: 1, marginLeft: 12 },
    personName: { fontSize: 16, fontWeight: '600' },
    personPhone: { fontSize: 13, marginTop: 2 },
    balanceContainer: { alignItems: 'flex-end' },
    balanceLabel: { fontSize: 12, fontWeight: '500' },
    balanceAmount: { fontSize: 18, fontWeight: '700', marginTop: 2 },

    expensesList: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    expenseItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
    expenseInfo: { flex: 1 },
    expenseDesc: { fontSize: 14, fontWeight: '500' },
    expenseDate: { fontSize: 12, marginTop: 2 },
    expenseRight: { alignItems: 'flex-end' },
    expenseAmount: { fontSize: 14, fontWeight: '600' },
    paidBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 4 },
    paidText: { fontSize: 11, fontWeight: '600' },
    markPaidBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 4 },
    markPaidText: { fontSize: 11, fontWeight: '600', color: '#FFF' },
});
