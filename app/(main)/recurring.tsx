import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import { Card } from '../../components/ui';
import api from '../../utils/api';
import { saveOfflineRecurring, getMergedRecurring, cacheRecurring } from '../../utils/offlineSync';

const FREQUENCIES = [
    { value: 'daily', label: 'Daily', icon: 'today' },
    { value: 'weekly', label: 'Weekly', icon: 'date-range' },
    { value: 'monthly', label: 'Monthly', icon: 'calendar-today' },
    { value: 'yearly', label: 'Yearly', icon: 'event' },
];

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

interface RecurringItem {
    _id: string;
    type: 'expense' | 'income';
    amount: number;
    category?: string;
    source?: string;
    description?: string;
    frequency: string;
    nextDueDate: string;
    isActive: boolean;
}

export default function RecurringScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [recurring, setRecurring] = useState<RecurringItem[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [currencySymbol, setCurrencySymbol] = useState('₹');

    // Form state
    const [formType, setFormType] = useState<'expense' | 'income'>('expense');
    const [formAmount, setFormAmount] = useState('');
    const [formCategory, setFormCategory] = useState('');
    const [formSource, setFormSource] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formFrequency, setFormFrequency] = useState('monthly');
    const [formDayOfMonth, setFormDayOfMonth] = useState('1');

    useFocusEffect(
        useCallback(() => {
            fetchRecurring();
            loadCurrency();
        }, [])
    );

    const loadCurrency = async () => {
        try {
            const userData = await AsyncStorage.getItem('@user');
            if (userData) {
                setCurrencySymbol(JSON.parse(userData).currencySymbol || '₹');
            }
        } catch (e) { }
    };

    const fetchRecurring = async () => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            try {
                const response: any = await api.getRecurring(token);
                if (response.success) {
                    // Cache the server data
                    await cacheRecurring(response.data);
                    // Display merged (server + offline)
                    const merged = await getMergedRecurring();
                    setRecurring(merged);
                }
            } catch (error: any) {
                // Network error - use cached/merged data
                const merged = await getMergedRecurring();
                setRecurring(merged);
            }
        } catch (error) {
            // Failed to fetch recurring
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleToggle = async (item: RecurringItem) => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const response: any = await api.toggleRecurring(token, item._id);
            if (response.success) {
                showToast({
                    message: response.message || (item.isActive ? 'Paused' : 'Resumed'),
                    type: 'success'
                });
                fetchRecurring();
            }
        } catch (error) {
            showToast({ message: 'Failed to toggle', type: 'error' });
        }
    };

    const handleGenerate = async (item: RecurringItem) => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const response: any = await api.generateRecurring(token, item._id);
            if (response.success) {
                showToast({ message: `${item.type} generated!`, type: 'success' });
                fetchRecurring();
            }
        } catch (error) {
            showToast({ message: 'Failed to generate', type: 'error' });
        }
    };

    const handleDelete = async (item: RecurringItem) => {
        Alert.alert(
            'Delete Recurring',
            'Are you sure you want to delete this recurring transaction?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('@auth_token');
                            if (!token) return;

                            const response: any = await api.deleteRecurring(token, item._id);
                            if (response.success) {
                                showToast({ message: 'Deleted', type: 'success' });
                                fetchRecurring();
                            }
                        } catch (error) {
                            showToast({ message: 'Failed to delete', type: 'error' });
                        }
                    },
                },
            ]
        );
    };

    const handleAdd = async () => {
        if (!formAmount || parseFloat(formAmount) <= 0) {
            showToast({ message: 'Please enter amount', type: 'warning' });
            return;
        }
        if (formType === 'expense' && !formCategory) {
            showToast({ message: 'Please select category', type: 'warning' });
            return;
        }
        if (formType === 'income' && !formSource) {
            showToast({ message: 'Please select source', type: 'warning' });
            return;
        }

        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const recurringData = {
                type: formType,
                amount: parseFloat(formAmount),
                category: formType === 'expense' ? formCategory : undefined,
                source: formType === 'income' ? formSource : undefined,
                description: formDescription || undefined,
                frequency: formFrequency as any,
                dayOfMonth: formFrequency === 'monthly' ? parseInt(formDayOfMonth) : undefined,
            };

            try {
                const response: any = await api.createRecurring(token, recurringData);
                if (response.success) {
                    showToast({ message: 'Recurring added!', type: 'success' });
                    setShowAddModal(false);
                    resetForm();
                    fetchRecurring();
                }
            } catch (error: any) {
                // Network error - save offline
                if (error.message?.includes('Network')) {
                    await saveOfflineRecurring(recurringData);
                    showToast({ message: 'Recurring saved offline', type: 'success' });
                    setShowAddModal(false);
                    resetForm();
                    fetchRecurring();
                } else {
                    showToast({ message: 'Failed to create recurring', type: 'error' });
                }
            }
        } catch (error) {
            showToast({ message: 'Failed to create', type: 'error' });
        }
    };

    const resetForm = () => {
        setFormType('expense');
        setFormAmount('');
        setFormCategory('');
        setFormSource('');
        setFormDescription('');
        setFormFrequency('monthly');
        setFormDayOfMonth('1');
    };

    const getItemConfig = (item: RecurringItem) => {
        if (item.type === 'expense') {
            return CATEGORIES.find(c => c.name === item.category) || CATEGORIES[7];
        }
        return INCOME_SOURCES.find(s => s.name === item.source) || INCOME_SOURCES[5];
    };

    const formatNextDue = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diff <= 0) return 'Due now';
        if (diff === 1) return 'Tomorrow';
        if (diff <= 7) return `In ${diff} days`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.loadingContainer}>
                    <MaterialIcons name="repeat" size={48} color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Recurring</Text>
                <TouchableOpacity onPress={() => setShowAddModal(true)} style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}>
                    <MaterialIcons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRecurring(); }} />}
                contentContainerStyle={styles.content}
            >
                {recurring.length === 0 ? (
                    <Card style={styles.emptyCard}>
                        <MaterialIcons name="repeat" size={48} color={theme.colors.textTertiary} />
                        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Recurring Transactions</Text>
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            Set up recurring expenses or income to auto-track regular payments
                        </Text>
                        <TouchableOpacity
                            style={[styles.emptyBtn, { backgroundColor: theme.colors.primary }]}
                            onPress={() => setShowAddModal(true)}
                        >
                            <MaterialIcons name="add" size={18} color="#FFF" />
                            <Text style={styles.emptyBtnText}>Add Recurring</Text>
                        </TouchableOpacity>
                    </Card>
                ) : (
                    recurring.map((item) => {
                        const config = getItemConfig(item);
                        return (
                            <Card key={item._id} style={[styles.itemCard, !item.isActive && { opacity: 0.6 }] as any}>
                                <View style={styles.itemRow}>
                                    <View style={[styles.iconBox, { backgroundColor: config.color + '20' }]}>
                                        <MaterialIcons name={config.icon as any} size={22} color={config.color} />
                                    </View>
                                    <View style={styles.itemInfo}>
                                        <Text style={[styles.itemName, { color: theme.colors.text }]}>
                                            {item.description || item.category || item.source}
                                        </Text>
                                        <View style={styles.itemMeta}>
                                            <Text style={[styles.itemFreq, { color: theme.colors.textSecondary }]}>
                                                {FREQUENCIES.find(f => f.value === item.frequency)?.label} • {formatNextDue(item.nextDueDate)}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={[
                                        styles.itemAmount,
                                        { color: item.type === 'income' ? '#10B981' : theme.colors.text }
                                    ]}>
                                        {item.type === 'income' ? '+' : '-'}{currencySymbol}{item.amount.toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.itemActions}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
                                        onPress={() => handleToggle(item)}
                                    >
                                        <MaterialIcons
                                            name={item.isActive ? 'pause' : 'play-arrow'}
                                            size={18}
                                            color={item.isActive ? theme.colors.warning : theme.colors.success}
                                        />
                                        <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>
                                            {item.isActive ? 'Pause' : 'Resume'}
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
                                        onPress={() => handleGenerate(item)}
                                    >
                                        <MaterialIcons name="add-circle-outline" size={18} color={theme.colors.primary} />
                                        <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>Generate</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: theme.colors.surface }]}
                                        onPress={() => handleDelete(item)}
                                    >
                                        <MaterialIcons name="delete-outline" size={18} color={theme.colors.error} />
                                    </TouchableOpacity>
                                </View>
                            </Card>
                        );
                    })
                )}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add Modal */}
            <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Add Recurring</Text>
                            <TouchableOpacity onPress={() => { setShowAddModal(false); resetForm(); }}>
                                <MaterialIcons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Type Toggle */}
                            <View style={styles.typeToggle}>
                                <TouchableOpacity
                                    style={[styles.typeBtn, formType === 'expense' && { backgroundColor: '#EF444420' }]}
                                    onPress={() => setFormType('expense')}
                                >
                                    <MaterialIcons name="arrow-upward" size={18} color={formType === 'expense' ? '#EF4444' : theme.colors.textSecondary} />
                                    <Text style={[styles.typeText, { color: formType === 'expense' ? '#EF4444' : theme.colors.textSecondary }]}>Expense</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.typeBtn, formType === 'income' && { backgroundColor: '#10B98120' }]}
                                    onPress={() => setFormType('income')}
                                >
                                    <MaterialIcons name="arrow-downward" size={18} color={formType === 'income' ? '#10B981' : theme.colors.textSecondary} />
                                    <Text style={[styles.typeText, { color: formType === 'income' ? '#10B981' : theme.colors.textSecondary }]}>Income</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Amount */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Amount</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                                value={formAmount}
                                onChangeText={setFormAmount}
                                placeholder="0"
                                placeholderTextColor={theme.colors.textTertiary}
                                keyboardType="decimal-pad"
                            />

                            {/* Category/Source */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                                {formType === 'expense' ? 'Category' : 'Source'}
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {(formType === 'expense' ? CATEGORIES : INCOME_SOURCES).map((item) => (
                                    <TouchableOpacity
                                        key={item.name}
                                        style={[
                                            styles.chip,
                                            { backgroundColor: theme.colors.surface },
                                            (formType === 'expense' ? formCategory : formSource) === item.name && { backgroundColor: item.color + '30', borderColor: item.color, borderWidth: 1 }
                                        ]}
                                        onPress={() => formType === 'expense' ? setFormCategory(item.name) : setFormSource(item.name)}
                                    >
                                        <MaterialIcons name={item.icon as any} size={16} color={item.color} />
                                        <Text style={[styles.chipText, { color: theme.colors.text }]}>{item.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Frequency */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Frequency</Text>
                            <View style={styles.freqRow}>
                                {FREQUENCIES.map((f) => (
                                    <TouchableOpacity
                                        key={f.value}
                                        style={[
                                            styles.freqBtn,
                                            { backgroundColor: theme.colors.surface },
                                            formFrequency === f.value && { backgroundColor: theme.colors.primary }
                                        ]}
                                        onPress={() => setFormFrequency(f.value)}
                                    >
                                        <Text style={[
                                            styles.freqText,
                                            { color: formFrequency === f.value ? '#FFF' : theme.colors.text }
                                        ]}>{f.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {formFrequency === 'monthly' && (
                                <>
                                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Day of Month</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                                        value={formDayOfMonth}
                                        onChangeText={setFormDayOfMonth}
                                        placeholder="1"
                                        placeholderTextColor={theme.colors.textTertiary}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                    />
                                </>
                            )}

                            {/* Description */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Description (optional)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                                value={formDescription}
                                onChangeText={setFormDescription}
                                placeholder="e.g., Netflix subscription"
                                placeholderTextColor={theme.colors.textTertiary}
                            />

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                                onPress={handleAdd}
                            >
                                <Text style={styles.saveBtnText}>Add Recurring</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { fontSize: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20 },
    emptyCard: { alignItems: 'center', padding: 32, marginTop: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    emptyText: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, gap: 6 },
    emptyBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    itemCard: { marginBottom: 12 },
    itemRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    itemMeta: { flexDirection: 'row', alignItems: 'center' },
    itemFreq: { fontSize: 12 },
    itemAmount: { fontSize: 16, fontWeight: '700' },
    itemActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, gap: 4 },
    actionText: { fontSize: 12, fontWeight: '500' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '85%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    typeToggle: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, gap: 12 },
    typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
    typeText: { fontSize: 14, fontWeight: '600' },
    label: { fontSize: 14, fontWeight: '500', marginTop: 16, marginBottom: 8, marginHorizontal: 20 },
    input: { marginHorizontal: 20, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 16 },
    chipScroll: { paddingHorizontal: 20 },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, marginRight: 8, gap: 6 },
    chipText: { fontSize: 13 },
    freqRow: { flexDirection: 'row', marginHorizontal: 20, gap: 8 },
    freqBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    freqText: { fontSize: 13, fontWeight: '500' },
    saveBtn: { marginHorizontal: 20, marginTop: 24, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
