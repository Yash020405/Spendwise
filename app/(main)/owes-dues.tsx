import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Alert,
    Linking,
    LayoutAnimation,
    UIManager,
    Platform,
    Modal,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import api from '../../utils/api';
import { getMergedExpenses, cacheExpenses, updateCachedExpense, savePendingUpdate, updateRecentParticipant } from '../../utils/offlineSync';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

type FilterType = 'all' | 'pending';

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
    totalOwes: number;
    totalPaid: number;
    totalIOwe: number;
    balance: number;
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
    const [userName, setUserName] = useState('');
    const [userUpiId, setUserUpiId] = useState('');
    const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    
    // Edit participant modal state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingPerson, setEditingPerson] = useState<PersonBalance | null>(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');

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
                setUserName(user.name || 'User');
                setUserUpiId(user.upiId || '');
            }

            try {
                const response: any = await api.getExpenses(token);
                if (response.success && Array.isArray(response.data)) {
                    await cacheExpenses(response.data);
                }
            } catch (_error) {
                // Network error - use cached
            }

            const expenses = await getMergedExpenses();
            const splits = expenses.filter((e: any) => e.isSplit && e.participants?.length > 0);
            setSplitExpenses(splits);
        } catch (_error) {
            showToast({ message: 'Failed to load data', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        setRefreshing(false);
    };

    // Calculate balances - include ALL people (even settled)
    const personBalances: PersonBalance[] = useMemo(() => {
        const balanceMap = new Map<string, PersonBalance>();

        splitExpenses.forEach(expense => {
            const payerName = expense.payerName || 'You';
            const isPayerMe = payerName === 'You' || !expense.payer || expense.payer === 'me';

            if (isPayerMe) {
                expense.participants?.forEach(participant => {
                    const key = participant.name.toLowerCase();
                    const existing = balanceMap.get(key) || {
                        name: participant.name,
                        phone: participant.phone,
                        totalOwes: 0, totalPaid: 0, totalIOwe: 0, balance: 0, expenses: [],
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
                const key = payerName.toLowerCase();
                const existing = balanceMap.get(key) || {
                    name: payerName,
                    phone: undefined,
                    totalOwes: 0, totalPaid: 0, totalIOwe: 0, balance: 0, expenses: [],
                };

                const userHasPaid = (expense as any).userHasPaidShare === true;
                if (!userHasPaid) {
                    existing.totalIOwe += expense.userShare;
                }

                existing.expenses.push({
                    expenseId: expense._id,
                    description: expense.description || expense.category,
                    amount: expense.userShare,
                    isPaid: userHasPaid,
                    date: expense.date,
                    type: 'i_owe'
                });

                balanceMap.set(key, existing);
            }
        });

        return Array.from(balanceMap.values())
            .map(p => ({ ...p, balance: (p.totalOwes - p.totalPaid) - p.totalIOwe }))
            .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    }, [splitExpenses]);

    const totalOwedToMe = personBalances.reduce((sum, p) => sum + Math.max(0, p.balance), 0);
    const totalIOwe = personBalances.reduce((sum, p) => sum + Math.max(0, -p.balance), 0);

    // Filtered balances based on active filter
    const filteredBalances = useMemo(() => {
        if (activeFilter === 'pending') {
            return personBalances.filter(p => p.balance !== 0);
        }
        return personBalances;
    }, [personBalances, activeFilter]);

    // Open edit modal for a person
    const openEditModal = (person: PersonBalance) => {
        setEditingPerson(person);
        setEditName(person.name);
        setEditPhone(person.phone || '');
        setShowEditModal(true);
    };

    // Save edited participant details
    const saveParticipantEdit = async () => {
        if (!editingPerson || !editName.trim()) {
            showToast({ message: 'Name is required', type: 'warning' });
            return;
        }

        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            // Update all expenses that have this participant
            const oldName = editingPerson.name.toLowerCase();
            const updatedExpenses: string[] = [];

            for (const expense of splitExpenses) {
                const hasParticipant = expense.participants.some(
                    p => p.name.toLowerCase() === oldName
                );

                if (hasParticipant) {
                    const updatedParticipants = expense.participants.map(p =>
                        p.name.toLowerCase() === oldName
                            ? { ...p, name: editName.trim(), phone: editPhone.trim() || undefined }
                            : p
                    );

                    const updateData = {
                        isSplit: expense.isSplit,
                        splitType: expense.splitType || 'equal',
                        participants: updatedParticipants,
                        userShare: expense.userShare,
                        payer: expense.payer,
                        payerName: expense.payerName,
                        userHasPaidShare: expense.userHasPaidShare,
                    };

                    try {
                        await api.updateExpense(token, expense._id, updateData);
                        await updateCachedExpense(expense._id, updateData);
                        updatedExpenses.push(expense._id);
                    } catch (_error) {
                        await savePendingUpdate(expense._id, updateData);
                        await updateCachedExpense(expense._id, updateData);
                        updatedExpenses.push(expense._id);
                    }
                }
            }

            if (updatedExpenses.length > 0) {
                // Also update the independent recent participants storage
                await updateRecentParticipant(editingPerson.name, editName.trim(), editPhone.trim() || undefined);
                
                showToast({ message: `Updated ${updatedExpenses.length} expense(s)`, type: 'success' });
                fetchData();
            }

            setShowEditModal(false);
            setEditingPerson(null);
        } catch (_error) {
            showToast({ message: 'Failed to update', type: 'error' });
        }
    };

    const handleMarkPaid = async (personName: string, expenseId: string, revert = false) => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const expense = splitExpenses.find(e => e._id === expenseId);
            if (!expense) return;

            const updatedParticipants = expense.participants.map(p =>
                p.name.toLowerCase() === personName.toLowerCase()
                    ? { ...p, isPaid: !revert, paidDate: !revert ? new Date().toISOString() : undefined, paidAmount: !revert ? p.shareAmount : undefined }
                    : p
            );

            const updateData = {
                isSplit: expense.isSplit,
                splitType: expense.splitType || 'equal',
                participants: updatedParticipants,
                userShare: expense.userShare,
                payer: expense.payer,
                payerName: expense.payerName,
                userHasPaidShare: expense.userHasPaidShare,
            };

            try {
                const result: any = await api.updateExpense(token, expenseId, updateData);
                if (result.success) {
                    await updateCachedExpense(expenseId, updateData);
                    showToast({ message: revert ? 'Marked as unpaid' : 'Marked as paid', type: 'success' });
                    fetchData();
                }
            } catch (_error) {
                await savePendingUpdate(expenseId, updateData);
                await updateCachedExpense(expenseId, updateData);
                setSplitExpenses(prev => prev.map(exp =>
                    exp._id === expenseId ? { ...exp, participants: updatedParticipants } : exp
                ));
                showToast({ message: revert ? 'Marked unpaid (offline)' : 'Marked paid (offline)', type: 'success' });
            }
        } catch (_error) {
            showToast({ message: 'Failed to update', type: 'error' });
        }
    };

    const handleMarkMySharePaid = async (personName: string, expenseId: string, revert = false) => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const updateData = { userHasPaidShare: !revert };

            try {
                const result: any = await api.updateExpense(token, expenseId, updateData);
                if (result.success) {
                    await updateCachedExpense(expenseId, updateData);
                    setSplitExpenses(prev => prev.map(exp =>
                        exp._id === expenseId ? { ...exp, userHasPaidShare: !revert } : exp
                    ));
                    showToast({ message: revert ? 'Marked as unpaid' : 'Marked as paid', type: 'success' });
                    fetchData();
                }
            } catch (_error) {
                await savePendingUpdate(expenseId, updateData);
                await updateCachedExpense(expenseId, updateData);
                setSplitExpenses(prev => prev.map(exp =>
                    exp._id === expenseId ? { ...exp, userHasPaidShare: !revert } : exp
                ));
                showToast({ message: revert ? 'Marked unpaid (offline)' : 'Marked paid (offline)', type: 'success' });
            }
        } catch (_error) {
            showToast({ message: 'Failed to update', type: 'error' });
        }
    };

    const sendWhatsAppReminder = (person: PersonBalance) => {
        if (!userUpiId) {
            Alert.alert('UPI ID Required', 'Set your UPI ID in profile first.', [
                { text: 'Cancel' },
                { text: 'Go to Profile', onPress: () => router.push('/(main)/profile') },
            ]);
            return;
        }

        if (!person.phone) {
            Alert.alert('Phone Required', `No phone number for ${person.name}.`);
            return;
        }

        const amount = Math.abs(person.balance);
        const message = `Hi ${person.name},

This is a reminder about our shared expenses.

Amount Due: ${currencySymbol}${amount.toLocaleString()}

Payment Details:
UPI ID: ${userUpiId}
Amount: ₹${amount.toFixed(2)}

You can pay via any UPI app to the ID above.

Thanks,
${userName}`;

        let phoneNumber = person.phone.replace(/\s+/g, '').replace(/-/g, '');
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = phoneNumber.startsWith('91') ? `+${phoneNumber}` : `+91${phoneNumber}`;
        }

        const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
        Linking.openURL(whatsappUrl).catch(() => {
            Linking.openURL(`https://wa.me/${phoneNumber.replace('+', '')}?text=${encodeURIComponent(message)}`);
        });
    };

    // LEFT swipe = Remind (green)
    const renderLeftActions = (person: PersonBalance) => {
        if (person.balance <= 0) return null;
        return (
            <TouchableOpacity
                style={[styles.swipeAction, styles.leftAction]}
                onPress={() => sendWhatsAppReminder(person)}
            >
                <MaterialIcons name="message" size={22} color="#FFF" />
            </TouchableOpacity>
        );
    };

    // RIGHT swipe = Mark Paid (blue/orange)
    const renderRightActions = (person: PersonBalance) => {
        if (person.balance === 0) return null;
        return (
            <TouchableOpacity
                style={[styles.swipeAction, styles.rightAction, { backgroundColor: person.balance > 0 ? theme.colors.primary : '#F59E0B' }]}
                onPress={() => {
                    if (person.balance > 0) {
                        const exp = person.expenses.find(e => !e.isPaid && e.type === 'owes_me');
                        if (exp) handleMarkPaid(person.name, exp.expenseId);
                    } else {
                        const exp = person.expenses.find(e => !e.isPaid && e.type === 'i_owe');
                        if (exp) handleMarkMySharePaid(person.name, exp.expenseId);
                    }
                }}
            >
                <MaterialIcons name="check" size={22} color="#FFF" />
            </TouchableOpacity>
        );
    };

    const toggleExpand = (name: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedPerson(expandedPerson === name ? null : name);
    };

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const getStatusColor = (balance: number) => balance > 0 ? '#EF4444' : balance < 0 ? '#F59E0B' : '#10B981';
    const getStatusBg = (balance: number) => balance > 0 ? '#EF4444' + '15' : balance < 0 ? '#F59E0B' + '15' : '#10B981' + '15';


    // Disable swipe actions when modal is open or when a card is expanded
    const swipeableDisabled = showEditModal || expandedPerson !== null;

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()}>
                        <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Balances</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Summary */}
                <View style={styles.summary}>
                    <View style={[styles.summaryItem, { backgroundColor: '#10B981' + '12', minHeight: 90, justifyContent: 'center', alignItems: 'center', flex: 1 }]}> 
                        <MaterialIcons name="arrow-downward" size={28} color="#10B981" style={{ marginBottom: 2 }} />
                        <Text style={[styles.summaryAmt, { color: '#10B981', fontSize: 28, marginTop: 2 }]}>{currencySymbol}{totalOwedToMe.toLocaleString()}</Text>
                        <Text style={[styles.summaryLbl, { color: theme.colors.textSecondary, fontSize: 15, marginTop: 2 }]}>to get</Text>
                    </View>
                    <View style={[styles.summaryItem, { backgroundColor: '#F59E0B' + '12', minHeight: 90, justifyContent: 'center', alignItems: 'center', flex: 1 }]}> 
                        <MaterialIcons name="arrow-upward" size={28} color="#F59E0B" style={{ marginBottom: 2 }} />
                        <Text style={[styles.summaryAmt, { color: '#F59E0B', fontSize: 28, marginTop: 2 }]}>{currencySymbol}{totalIOwe.toLocaleString()}</Text>
                        <Text style={[styles.summaryLbl, { color: theme.colors.textSecondary, fontSize: 15, marginTop: 2 }]}>to pay</Text>
                    </View>
                </View>

                {/* Filter Tabs */}
                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[
                            styles.filterTab,
                            { backgroundColor: activeFilter === 'all' ? theme.colors.primary : theme.colors.surface }
                        ]}
                        onPress={() => setActiveFilter('all')}
                    >
                        <Text style={[
                            styles.filterTabText,
                            { color: activeFilter === 'all' ? '#FFF' : theme.colors.text }
                        ]}>
                            All ({personBalances.length})
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.filterTab,
                            { backgroundColor: activeFilter === 'pending' ? theme.colors.primary : theme.colors.surface }
                        ]}
                        onPress={() => setActiveFilter('pending')}
                    >
                        <Text style={[
                            styles.filterTabText,
                            { color: activeFilter === 'pending' ? '#FFF' : theme.colors.text }
                        ]}>
                            Pending ({personBalances.filter(p => p.balance !== 0).length})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Slide-to-mark-pay hint */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 2 }}>
                    <MaterialIcons name="swipe" size={18} color={theme.colors.primary} style={{ marginRight: 4 }} />
                    <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>Slide a card to mark as paid</Text>
                </View>

                {/* List */}
                <Animated.ScrollView
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
                >
                    {filteredBalances.length === 0 ? (
                        <View style={styles.empty}>
                            <MaterialIcons name="groups" size={48} color={theme.colors.textTertiary} />
                            <Text style={[styles.emptyTxt, { color: theme.colors.textSecondary }]}> 
                                {activeFilter === 'all' ? 'No split expenses yet' : 'No pending balances'}
                            </Text>
                        </View>
                    ) : (
                        filteredBalances.map((person) => {
                            const isExpanded = expandedPerson === person.name;
                            const cardSwipeDisabled = swipeableDisabled || isExpanded;
                            return (
                                <Swipeable
                                    key={person.name}
                                    renderLeftActions={() => cardSwipeDisabled ? null : renderLeftActions(person)}
                                    renderRightActions={() => cardSwipeDisabled ? null : renderRightActions(person)}
                                    overshootLeft={false}
                                    overshootRight={false}
                                    enabled={!cardSwipeDisabled}
                                >
                                    <View style={{ backgroundColor: theme.colors.background }}>
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            onPress={() => toggleExpand(person.name)}
                                            style={[
                                                styles.card, 
                                                { 
                                                    backgroundColor: theme.colors.surface,
                                                    borderBottomLeftRadius: isExpanded ? 0 : 12,
                                                    borderBottomRightRadius: isExpanded ? 0 : 12,
                                                    elevation: 2,
                                                    shadowColor: '#000',
                                                    shadowOpacity: 0.06,
                                                    shadowRadius: 4,
                                                    shadowOffset: { width: 0, height: 2 },
                                                }
                                            ]}
                                        >
                                            <View style={[styles.avatar, { backgroundColor: getStatusBg(person.balance) }]}> 
                                                <MaterialIcons
                                                    name={person.balance > 0 ? 'person' : person.balance < 0 ? 'person-outline' : 'emoji-emotions'}
                                                    size={22}
                                                    color={getStatusColor(person.balance)}
                                                />
                                            </View>
                                            <View style={styles.cardInfo}>
                                                <Text style={[styles.cardName, { color: theme.colors.text }]}>{person.name}</Text>
                                                <Text style={[styles.cardSub, { color: getStatusColor(person.balance) }]}> 
                                                    {person.balance > 0 ? `owes ${currencySymbol}${person.balance.toLocaleString()}` :
                                                        person.balance < 0 ? `you owe ${currencySymbol}${Math.abs(person.balance).toLocaleString()}` :
                                                            'settled ✓'}
                                                </Text>
                                            </View>
                                            <MaterialIcons
                                                name={isExpanded ? 'expand-less' : 'expand-more'}
                                                size={24}
                                                color={theme.colors.textSecondary}
                                            />
                                        </TouchableOpacity>

                                        {/* Expanded Details - Connected to card */}
                                        {isExpanded && (
                                            <View style={[styles.details, { backgroundColor: theme.colors.surface }]}> 
                                                {/* Edit Button */}
                                                <TouchableOpacity
                                                    style={[styles.editBtn, { backgroundColor: theme.colors.background }]}
                                                    onPress={() => openEditModal(person)}
                                                >
                                                    <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                                                    <Text style={[styles.editBtnTxt, { color: theme.colors.primary }]}>Edit Details</Text>
                                                </TouchableOpacity>

                                                {person.expenses.map((exp, i) => (
                                                    <View key={i} style={styles.expRow}>
                                                        <View style={styles.expInfo}>
                                                            <Text style={[styles.expDesc, { color: theme.colors.text }]}>{exp.description}</Text>
                                                            <Text style={[styles.expDate, { color: theme.colors.textSecondary }]}>{formatDate(exp.date)}</Text>
                                                        </View>
                                                        <View style={styles.expRight}>
                                                            <Text style={[styles.expAmt, { color: theme.colors.text }]}>{currencySymbol}{exp.amount.toLocaleString()}</Text>
                                                            <TouchableOpacity
                                                                onPress={() => {
                                                                    if (exp.type === 'owes_me') {
                                                                        handleMarkPaid(person.name, exp.expenseId, exp.isPaid);
                                                                    } else {
                                                                        handleMarkMySharePaid(person.name, exp.expenseId, exp.isPaid);
                                                                    }
                                                                }}
                                                                style={[styles.statusBtn, { backgroundColor: exp.isPaid ? '#10B981' + '20' : '#F59E0B' + '20' }]}
                                                            >
                                                                <Text style={{ color: exp.isPaid ? '#10B981' : '#F59E0B', fontSize: 11, fontWeight: '600' }}>
                                                                    {exp.isPaid ? 'Paid ✓' : 'Pending'}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                ))}

                                                {/* Quick Actions */}
                                                {person.balance !== 0 && (
                                                    <View style={styles.quickActions}>
                                                        {person.balance > 0 && (
                                                            <TouchableOpacity
                                                                style={[styles.quickBtn, { backgroundColor: '#25D366' }]}
                                                                onPress={() => sendWhatsAppReminder(person)}
                                                            >
                                                                <MaterialIcons name="message" size={16} color="#FFF" />
                                                                <Text style={styles.quickBtnTxt}>Remind</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                        <TouchableOpacity
                                                            style={[styles.quickBtn, { backgroundColor: person.balance > 0 ? theme.colors.primary : '#F59E0B' }]}
                                                            onPress={() => {
                                                                if (person.balance > 0) {
                                                                    const exp = person.expenses.find(e => !e.isPaid && e.type === 'owes_me');
                                                                    if (exp) handleMarkPaid(person.name, exp.expenseId);
                                                                } else {
                                                                    const exp = person.expenses.find(e => !e.isPaid && e.type === 'i_owe');
                                                                    if (exp) handleMarkMySharePaid(person.name, exp.expenseId);
                                                                }
                                                            }}
                                                        >
                                                            <MaterialIcons name="check" size={16} color="#FFF" />
                                                            <Text style={styles.quickBtnTxt}>Mark Paid</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </Swipeable>
                            );
                        })
                    )}
                </Animated.ScrollView>

                {/* Edit Participant Modal */}
                <Modal
                    visible={showEditModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowEditModal(false)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowEditModal(false)}
                    >
                        <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}> 
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Edit Participant</Text>
                                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                                    <MaterialIcons name="close" size={24} color={theme.colors.text} />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Name</Text>
                            <TextInput
                                style={[styles.modalInput, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Enter name"
                                placeholderTextColor={theme.colors.textTertiary}
                            />

                            <Text style={[styles.modalLabel, { color: theme.colors.textSecondary }]}>Phone Number</Text>
                            <TextInput
                                style={[styles.modalInput, { color: theme.colors.text, backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
                                value={editPhone}
                                onChangeText={setEditPhone}
                                placeholder="For WhatsApp reminders"
                                placeholderTextColor={theme.colors.textTertiary}
                                keyboardType="phone-pad"
                            />

                            <Text style={[styles.modalHint, { color: theme.colors.textSecondary }]}> 
                                This will update all expenses with this participant.
                            </Text>

                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: theme.colors.primary }]}
                                onPress={saveParticipantEdit}
                            >
                                <Text style={styles.modalBtnTxt}>Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </SafeAreaView>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
    headerTitle: { fontSize: 18, fontWeight: '600' },

    summary: { flexDirection: 'row', paddingHorizontal: 16, gap: 12 },
    summaryItem: { flex: 1, paddingVertical: 18, paddingHorizontal: 16, borderRadius: 16, minHeight: 90, justifyContent: 'center', alignItems: 'center' },
    summaryAmt: { fontSize: 28, fontWeight: '700', marginTop: 2 },
    summaryLbl: { fontSize: 15, marginTop: 2 },

    filterRow: { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, marginBottom: 4, gap: 10 },
    filterTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    filterTabText: { fontSize: 14, fontWeight: '600' },

    empty: { alignItems: 'center', paddingVertical: 60 },
    emptyTxt: { fontSize: 14, marginTop: 12 },

    card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, padding: 14, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    avatarTxt: { fontSize: 16, fontWeight: '600' },
    cardInfo: { flex: 1, marginLeft: 12 },
    cardName: { fontSize: 15, fontWeight: '600' },
    cardSub: { fontSize: 13, marginTop: 2 },

    swipeAction: { justifyContent: 'center', alignItems: 'center', width: 60, marginTop: 8, borderRadius: 12 },
    leftAction: { backgroundColor: '#25D366', marginLeft: 16 },
    rightAction: { marginRight: 16 },

    details: { marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
    editBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4, marginBottom: 8 },
    editBtnTxt: { fontSize: 12, fontWeight: '600' },
    expRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    expInfo: { flex: 1 },
    expDesc: { fontSize: 14, fontWeight: '500' },
    expDate: { fontSize: 11, marginTop: 2 },
    expRight: { alignItems: 'flex-end' },
    expAmt: { fontSize: 14, fontWeight: '600' },
    statusBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 4 },

    quickActions: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
    quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
    quickBtnTxt: { color: '#FFF', fontSize: 13, fontWeight: '600' },

    // Edit Modal styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', maxWidth: 400, borderRadius: 20, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    modalLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6, marginTop: 12 },
    modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    modalHint: { fontSize: 12, marginTop: 16, fontStyle: 'italic' },
    modalBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
    modalBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
