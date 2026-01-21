import React, { useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../utils/ThemeContext';
import api from '../../utils/api';
import { cacheExpenses, getMergedExpenses } from '../../utils/offlineSync';
import SmartInsightsCard from '../../components/SmartInsightsCard';
import { LoadingView } from '../../components/LoadingView';

const { width } = Dimensions.get('window');

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

// Unique colors for income sources
const INCOME_SOURCE_CONFIG: Record<string, { color: string; icon: string }> = {
    Salary: { color: '#10B981', icon: 'payments' },
    Freelance: { color: '#3B82F6', icon: 'laptop' },
    Investment: { color: '#8B5CF6', icon: 'trending-up' },
    Gift: { color: '#EC4899', icon: 'card-giftcard' },
    Refund: { color: '#F59E0B', icon: 'replay' },
    Bonus: { color: '#06B6D4', icon: 'stars' },
    Rental: { color: '#EF4444', icon: 'home' },
    Interest: { color: '#84CC16', icon: 'account-balance' },
    Other: { color: '#6B7280', icon: 'attach-money' },
};

interface Expense {
    _id: string;
    amount: number;
    category: string;
    date: string;
}

interface Income {
    _id: string;
    amount: number;
    source: string;
    description?: string;
    date: string;
}

interface CategoryData {
    name: string;
    total: number;
    count: number;
    percentage: number;
    color: string;
    icon: string;
}

type CompareMode = 'days' | 'months' | 'years';
type ViewMode = 'breakdown' | 'compare';

export default function InsightsScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [currencySymbol, setCurrencySymbol] = useState('₹');
    const [viewMode, setViewMode] = useState<ViewMode>('breakdown');
    const [compareMode, setCompareMode] = useState<CompareMode>('months');
    const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [incomeList, setIncomeList] = useState<Income[]>([]);
    const [comparePeriod1, setComparePeriod1] = useState<Date>(new Date());
    const [comparePeriod2, setComparePeriod2] = useState<Date>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d;
    });

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const token = await AsyncStorage.getItem('@auth_token');
            const userData = await AsyncStorage.getItem('@user');

            if (!token) {
                setLoading(false);
                return;
            }

            if (userData) {
                const user = JSON.parse(userData);
                setCurrencySymbol(user.currencySymbol || '₹');
            }

            try {
                const [expResponse, incResponse]: any = await Promise.all([
                    api.getExpenses(token),
                    api.getIncome(token)
                ]);

                if (expResponse.success && Array.isArray(expResponse.data)) {
                    await cacheExpenses(expResponse.data);
                }
                if (incResponse.success && Array.isArray(incResponse.data)) {
                    setIncomeList(incResponse.data);
                }
            } catch (_error: any) {
                // Error fetching data - will use cached
            }

            // Always use merged data (cached + offline) for expenses
            const merged = await getMergedExpenses();
            setExpenses(merged);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchExpenses(); }, []));

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchExpenses();
        setRefreshing(false);
    };

    const monthlyData = useMemo(() => {
        const year = selectedMonth.getFullYear();
        const month = selectedMonth.getMonth();
        const currentExpenses = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        const currentIncome = incomeList.filter(i => {
            const d = new Date(i.date);
            return d.getFullYear() === year && d.getMonth() === month;
        });
        return { expenses: currentExpenses, income: currentIncome };
    }, [expenses, incomeList, selectedMonth]);

    const activeData = transactionType === 'expense' ? monthlyData.expenses : monthlyData.income;

    const categoryData: CategoryData[] = useMemo(() => {
        const map = new Map<string, { total: number; count: number }>();
        let total = 0;
        activeData.forEach((item: any) => {
            const cat = transactionType === 'expense' ? (item.category || 'Other') : (item.source || 'Other');
            // Use userShare for split expenses, otherwise use full amount
            const effectiveAmount = transactionType === 'expense' && item.isSplit 
                ? (item.userShare || 0) 
                : item.amount;
            const existing = map.get(cat) || { total: 0, count: 0 };
            map.set(cat, { total: existing.total + effectiveAmount, count: existing.count + 1 });
            total += effectiveAmount;
        });
        return Array.from(map.entries())
            .map(([name, data]) => ({
                name,
                ...data,
                percentage: total > 0 ? (data.total / total) * 100 : 0,
                color: transactionType === 'expense' 
                    ? (CATEGORY_CONFIG[name]?.color || '#6B7280') 
                    : (INCOME_SOURCE_CONFIG[name]?.color || '#6B7280'),
                icon: transactionType === 'expense' 
                    ? (CATEGORY_CONFIG[name]?.icon || 'more-horiz') 
                    : (INCOME_SOURCE_CONFIG[name]?.icon || 'attach-money'),
            }))
            .sort((a, b) => b.total - a.total);
    }, [activeData, transactionType]);

    const totalInPeriod = categoryData.reduce((sum, c) => sum + c.total, 0);

    // Get historical data for trends
    const getHistoricalData = (mode: CompareMode) => {
        const periods: { label: string; total: number }[] = [];
        const now = new Date();

        // Helper to get effective amount (userShare for splits)
        const getEffectiveAmount = (e: any) => e.isSplit ? (e.userShare || 0) : e.amount;

        if (mode === 'days') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const total = expenses.filter(e => new Date(e.date).toDateString() === d.toDateString())
                    .reduce((s, e) => s + getEffectiveAmount(e), 0);
                periods.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), total });
            }
        } else if (mode === 'months') {
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const total = expenses.filter(e => {
                    const ed = new Date(e.date);
                    return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
                }).reduce((s, e) => s + getEffectiveAmount(e), 0);
                periods.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), total });
            }
        } else {
            for (let i = 2; i >= 0; i--) {
                const year = now.getFullYear() - i;
                const total = expenses.filter(e => new Date(e.date).getFullYear() === year)
                    .reduce((s, e) => s + getEffectiveAmount(e), 0);
                periods.push({ label: year.toString(), total });
            }
        }
        return periods;
    };

    const historicalData = getHistoricalData(compareMode);
    const maxHistorical = Math.max(...historicalData.map(p => p.total), 1);

    // Period comparison
    const getPeriodTotal = (date: Date, mode: CompareMode) => {
        // Helper to get effective amount (userShare for splits)
        const getEffectiveAmount = (e: any) => e.isSplit ? (e.userShare || 0) : e.amount;
        
        return expenses.filter(e => {
            const d = new Date(e.date);
            if (mode === 'days') return d.toDateString() === date.toDateString();
            if (mode === 'months') return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth();
            return d.getFullYear() === date.getFullYear();
        }).reduce((s, e) => s + getEffectiveAmount(e), 0);
    };

    const period1Total = getPeriodTotal(comparePeriod1, compareMode);
    const period2Total = getPeriodTotal(comparePeriod2, compareMode);
    const comparisonDiff = period1Total - period2Total;
    const comparisonPercent = period2Total > 0 ? ((comparisonDiff) / period2Total) * 100 : 0;

    const formatPeriod = (date: Date, mode: CompareMode) => {
        if (mode === 'days') return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (mode === 'months') return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return date.getFullYear().toString();
    };

    const navigateToCategory = (category: string) => {
        router.push({ pathname: '/(main)/expenses', params: { category } });
    };

    const navigateMonth = (dir: 1 | -1) => {
        const d = new Date(selectedMonth);
        d.setMonth(d.getMonth() + dir);
        setSelectedMonth(d);
    };

    const adjustPeriod = (periodNum: 1 | 2, dir: 1 | -1) => {
        const setter = periodNum === 1 ? setComparePeriod1 : setComparePeriod2;
        const current = periodNum === 1 ? comparePeriod1 : comparePeriod2;
        const d = new Date(current);
        if (compareMode === 'days') d.setDate(d.getDate() + dir);
        else if (compareMode === 'months') d.setMonth(d.getMonth() + dir);
        else d.setFullYear(d.getFullYear() + dir);
        setter(d);
    };

    // Simple Pie Chart Component
    const renderPieChart = () => {
        if (categoryData.length === 0) return null;
        const size = width - 80;
        const center = size / 2;
        const radius = size / 2 - 10;

        let startAngle = 0;
        const slices = categoryData.map((cat, _i) => {
            const angle = (cat.percentage / 100) * 360;
            const endAngle = startAngle + angle;
            const largeArc = angle > 180 ? 1 : 0;

            const x1 = center + radius * Math.cos((startAngle - 90) * Math.PI / 180);
            const y1 = center + radius * Math.sin((startAngle - 90) * Math.PI / 180);
            const x2 = center + radius * Math.cos((endAngle - 90) * Math.PI / 180);
            const y2 = center + radius * Math.sin((endAngle - 90) * Math.PI / 180);

            startAngle = endAngle;
            return { cat, x1, y1, x2, y2, largeArc };
        });

        return (
            <View style={styles.pieContainer}>
                <View style={[styles.pieChart, { width: size, height: size }]}>
                    {slices.map((slice, i) => (
                        <View
                            key={i}
                            style={[
                                styles.pieSlice,
                                {
                                    width: size,
                                    height: size,
                                    borderRadius: size / 2,
                                    borderWidth: radius,
                                    borderColor: 'transparent',
                                    borderTopColor: slice.cat.color,
                                    borderRightColor: slice.cat.percentage > 25 ? slice.cat.color : 'transparent',
                                    borderBottomColor: slice.cat.percentage > 50 ? slice.cat.color : 'transparent',
                                    borderLeftColor: slice.cat.percentage > 75 ? slice.cat.color : 'transparent',
                                    transform: [{ rotate: `${(slices.slice(0, i).reduce((s, p) => s + p.cat.percentage, 0) / 100) * 360}deg` }],
                                }
                            ]}
                        />
                    ))}
                    <View style={[styles.pieCenter, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.pieCenterAmount, { color: theme.colors.text }]}>
                            {currencySymbol}{totalInPeriod.toLocaleString()}
                        </Text>
                        <Text style={[styles.pieCenterLabel, { color: theme.colors.textSecondary }]}>Total</Text>
                    </View>
                </View>
                <View style={styles.pieLegend}>
                    {categoryData.slice(0, 4).map((cat, i) => (
                        <View key={i} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>{cat.name}</Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    };

    const renderBreakdown = () => (
        <>
            <View style={styles.monthNav}>
                <TouchableOpacity onPress={() => navigateMonth(-1)} style={styles.navBtn}>
                    <MaterialIcons name="chevron-left" size={28} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.monthLabel, { color: theme.colors.text }]}>
                    {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <TouchableOpacity onPress={() => navigateMonth(1)} style={styles.navBtn}>
                    <MaterialIcons name="chevron-right" size={28} color={theme.colors.text} />
                </TouchableOpacity>
            </View>

            {/* Pie Chart */}
            {renderPieChart()}

            {/* Category List */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>By Category</Text>
                {categoryData.length === 0 ? (
                    <View style={styles.emptyState}>
                        <MaterialIcons name="pie-chart" size={48} color={theme.colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No expenses this month</Text>
                    </View>
                ) : (
                    categoryData.map((cat, i) => (
                        <TouchableOpacity
                            key={i}
                            style={[styles.categoryItem, i < categoryData.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}
                            onPress={() => navigateToCategory(cat.name)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.categoryIconBox, { backgroundColor: cat.color + '20' }]}>
                                <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                            </View>
                            <View style={styles.categoryDetails}>
                                <View style={styles.categoryHeader}>
                                    <Text style={[styles.categoryName, { color: theme.colors.text }]}>{cat.name}</Text>
                                    <Text style={[styles.categoryAmount, { color: theme.colors.text }]}>
                                        {currencySymbol}{cat.total.toLocaleString()}
                                    </Text>
                                </View>
                                <View style={styles.categoryMeta}>
                                    <Text style={[styles.percentText, { color: cat.color }]}>{cat.percentage.toFixed(1)}%</Text>
                                    <Text style={[styles.countText, { color: theme.colors.textSecondary }]}>
                                        {cat.count} expense{cat.count > 1 ? 's' : ''}
                                    </Text>
                                    <MaterialIcons name="chevron-right" size={18} color={theme.colors.textTertiary} />
                                </View>
                                <View style={[styles.progressTrack, { backgroundColor: theme.colors.border }]}>
                                    <View style={[styles.progressFill, { backgroundColor: cat.color, width: `${cat.percentage}%` }]} />
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </View>
        </>
    );

    const renderComparison = () => (
        <>
            {/* Compare Mode Selector */}
            <View style={styles.compareModes}>
                {(['days', 'months', 'years'] as CompareMode[]).map(mode => (
                    <TouchableOpacity
                        key={mode}
                        style={[styles.compareModeBtn, { backgroundColor: compareMode === mode ? theme.colors.primary : theme.colors.surface }]}
                        onPress={() => setCompareMode(mode)}
                    >
                        <Text style={[styles.compareModeText, { color: compareMode === mode ? '#FFF' : theme.colors.textSecondary }]}>
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Historical Trend Chart */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {compareMode === 'days' ? 'Last 7 Days' : compareMode === 'months' ? 'Last 6 Months' : 'Last 3 Years'}
                </Text>
                <ScrollView horizontal={compareMode === 'days'} showsHorizontalScrollIndicator={false}>
                    <View style={[styles.barChart, compareMode === 'days' && { width: 320 }]}>
                        {historicalData.map((period, i) => (
                            <View key={i} style={styles.barItem}>
                                <Text style={[styles.barValue, { color: theme.colors.textSecondary }]}>
                                    {period.total > 999 ? `${(period.total / 1000).toFixed(0)}k` : period.total}
                                </Text>
                                <View style={[styles.bar, { backgroundColor: theme.colors.border }]}>
                                    <View style={[styles.barFill, {
                                        backgroundColor: theme.colors.primary,
                                        height: `${Math.max((period.total / maxHistorical) * 100, 5)}%`
                                    }]} />
                                </View>
                                <Text style={[styles.barLabel, { color: theme.colors.textSecondary }]}>{period.label}</Text>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* Period Comparison */}
            <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Compare Periods</Text>

                <View style={styles.periodRow}>
                    <TouchableOpacity onPress={() => adjustPeriod(1, -1)} style={styles.periodArrow}>
                        <MaterialIcons name="chevron-left" size={24} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <View style={[styles.periodBox, { backgroundColor: theme.colors.primary + '15' }]}>
                        <Text style={[styles.periodLabel, { color: theme.colors.primary }]}>{formatPeriod(comparePeriod1, compareMode)}</Text>
                        <Text style={[styles.periodAmount, { color: theme.colors.text }]}>{currencySymbol}{period1Total.toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustPeriod(1, 1)} style={styles.periodArrow}>
                        <MaterialIcons name="chevron-right" size={24} color={theme.colors.primary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.vsRow}><Text style={[styles.vsText, { color: theme.colors.textSecondary }]}>vs</Text></View>

                <View style={styles.periodRow}>
                    <TouchableOpacity onPress={() => adjustPeriod(2, -1)} style={styles.periodArrow}>
                        <MaterialIcons name="chevron-left" size={24} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={[styles.periodBox, { backgroundColor: theme.colors.border }]}>
                        <Text style={[styles.periodLabel, { color: theme.colors.textSecondary }]}>{formatPeriod(comparePeriod2, compareMode)}</Text>
                        <Text style={[styles.periodAmount, { color: theme.colors.text }]}>{currencySymbol}{period2Total.toLocaleString()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => adjustPeriod(2, 1)} style={styles.periodArrow}>
                        <MaterialIcons name="chevron-right" size={24} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Result */}
                <View style={styles.resultBox}>
                    <MaterialIcons
                        name={comparisonDiff > 0 ? 'trending-up' : comparisonDiff < 0 ? 'trending-down' : 'trending-flat'}
                        size={32}
                        color={comparisonDiff > 0 ? '#EF4444' : comparisonDiff < 0 ? '#10B981' : theme.colors.textSecondary}
                    />
                    <Text style={[styles.resultDiff, { color: comparisonDiff > 0 ? '#EF4444' : comparisonDiff < 0 ? '#10B981' : theme.colors.text }]}>
                        {comparisonDiff > 0 ? '+' : ''}{currencySymbol}{Math.abs(comparisonDiff).toLocaleString()}
                    </Text>
                    <Text style={[styles.resultPercent, { color: theme.colors.textSecondary }]}>
                        {comparisonPercent > 0 ? '+' : ''}{comparisonPercent.toFixed(1)}%
                    </Text>
                </View>
            </View>
        </>
    );

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <LoadingView message="Loading insights..." />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.colors.text }]}>Insights</Text>
                </View>

                <View style={[styles.viewToggle, { backgroundColor: theme.colors.surface }]}>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'breakdown' && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setViewMode('breakdown')}
                    >
                        <MaterialIcons name="pie-chart" size={18} color={viewMode === 'breakdown' ? '#FFF' : theme.colors.textSecondary} />
                        <Text style={[styles.toggleText, { color: viewMode === 'breakdown' ? '#FFF' : theme.colors.textSecondary }]}>Breakdown</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggleBtn, viewMode === 'compare' && { backgroundColor: theme.colors.primary }]}
                        onPress={() => setViewMode('compare')}
                    >
                        <MaterialIcons name="compare-arrows" size={18} color={viewMode === 'compare' ? '#FFF' : theme.colors.textSecondary} />
                        <Text style={[styles.toggleText, { color: viewMode === 'compare' ? '#FFF' : theme.colors.textSecondary }]}>Compare</Text>
                    </TouchableOpacity>
                </View>

                {viewMode === 'breakdown' && (
                    <View style={[styles.typeToggle, { backgroundColor: theme.colors.surface }]}>
                        <TouchableOpacity
                            style={[styles.typeToggleBtn, transactionType === 'expense' && { backgroundColor: theme.colors.primary }]}
                            onPress={() => setTransactionType('expense')}
                        >
                            <Text style={[styles.typeToggleText, { color: transactionType === 'expense' ? '#FFF' : theme.colors.textSecondary }]}>Expenses</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeToggleBtn, transactionType === 'income' && { backgroundColor: theme.colors.primary }]}
                            onPress={() => setTransactionType('income')}
                        >
                            <Text style={[styles.typeToggleText, { color: transactionType === 'income' ? '#FFF' : theme.colors.textSecondary }]}>Income</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {viewMode === 'breakdown' ? renderBreakdown() : renderComparison()}

                {/* Smart Insights */}
                <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 20 }}>
                    <SmartInsightsCard selectedMonth={selectedMonth} />
                </View>
            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: 24, fontWeight: '700' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 16 },

    viewToggle: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, padding: 4, marginBottom: 8 },
    toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, gap: 6 },
    toggleText: { fontSize: 14, fontWeight: '600' },
    typeToggle: { flexDirection: 'row', marginHorizontal: 16, borderRadius: 12, padding: 4, marginBottom: 16 },
    typeToggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 10 },
    typeToggleText: { fontSize: 13, fontWeight: '600' },

    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 12 },
    navBtn: { padding: 4 },
    monthLabel: { fontSize: 17, fontWeight: '600' },

    pieContainer: { alignItems: 'center', marginVertical: 16 },
    pieChart: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
    pieSlice: { position: 'absolute' },
    pieCenter: { position: 'absolute', width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
    pieCenterAmount: { fontSize: 18, fontWeight: '700' },
    pieCenterLabel: { fontSize: 12 },
    pieLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendText: { fontSize: 12 },

    card: { marginHorizontal: 16, borderRadius: 16, padding: 16, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },

    emptyState: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { marginTop: 12, fontSize: 14 },

    categoryItem: { flexDirection: 'row', paddingVertical: 14 },
    categoryIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    categoryDetails: { flex: 1, marginLeft: 14 },
    categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    categoryName: { fontSize: 15, fontWeight: '600' },
    categoryAmount: { fontSize: 15, fontWeight: '700' },
    categoryMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
    percentText: { fontSize: 12, fontWeight: '700' },
    countText: { fontSize: 12, flex: 1 },
    progressTrack: { height: 4, borderRadius: 2, marginTop: 8 },
    progressFill: { height: 4, borderRadius: 2 },

    compareModes: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 16 },
    compareModeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
    compareModeText: { fontSize: 14, fontWeight: '600' },

    barChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160, paddingHorizontal: 4 },
    barItem: { alignItems: 'center', flex: 1 },
    barValue: { fontSize: 8, marginBottom: 4, textAlign: 'center' },
    bar: { width: 24, height: 100, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
    barLabel: { fontSize: 9, marginTop: 4, textAlign: 'center' },

    periodRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    periodArrow: { padding: 8, width: 44, alignItems: 'center' },
    periodBox: { flex: 1, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center' },
    periodLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
    periodAmount: { fontSize: 22, fontWeight: '700', marginTop: 6 },
    vsRow: { alignItems: 'center', paddingVertical: 6 },
    vsText: { fontSize: 13, fontWeight: '600' },

    resultBox: { alignItems: 'center', paddingVertical: 20, marginTop: 16, borderTopWidth: 1, borderTopColor: '#e5e5e5' },
    resultDiff: { fontSize: 26, fontWeight: '700', marginTop: 8 },
    resultPercent: { fontSize: 14, marginTop: 4 },
});
