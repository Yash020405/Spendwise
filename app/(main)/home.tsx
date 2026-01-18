import React, { useEffect, useState, useCallback } from 'react';
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
import { useToast } from '../../components/Toast';
import { Card } from '../../components/ui';
import api from '../../utils/api';
import AppWalkthrough from '../../components/AppWalkthrough';
import { syncPendingExpenses, getPendingCount, cacheExpenses, getMergedExpenses } from '../../utils/offlineSync';

const { width } = Dimensions.get('window');

// Category colors and icons
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

interface User {
  name: string;
  currency: string;
  currencySymbol: string;
  monthlyBudget: number;
}

interface BalanceSummary {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  savingsRate: number;
}

export default function HomeScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomeList, setIncomeList] = useState<Income[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [weekSpent, setWeekSpent] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      const userData = await AsyncStorage.getItem('@user');

      if (!token || !userData) {
        router.replace('/(auth)/welcome');
        return;
      }

      setUser(JSON.parse(userData));

      // Fetch expenses from server
      try {
        const expensesResponse: any = await api.getExpenses(token);
        if (expensesResponse.success && Array.isArray(expensesResponse.data)) {
          // Cache server data
          await cacheExpenses(expensesResponse.data);
        }
      } catch (err: any) {
        // Network error - we'll use cached + offline data (no error toast)
        console.log('Network error, using cached data:', err.message);
      }

      // Fetch income list
      let fetchedIncome: Income[] = [];
      try {
        const incomeRes: any = await api.getIncome(token);
        // Handle both 'data' and 'income' keys for compatibility
        const incomeData = incomeRes.data || incomeRes.income;
        if (incomeRes.success && Array.isArray(incomeData)) {
          fetchedIncome = incomeData;
          setIncomeList(fetchedIncome);
          console.log('✅ Income loaded:', fetchedIncome.length, 'entries');
        } else {
          console.log('⚠️ Income fetch - no data:', incomeRes);
        }
      } catch (err) {
        console.log('❌ Income fetch failed:', err);
      }

      // Always use merged data (cached server + offline pending)
      try {
        const expenseList = await getMergedExpenses();

        // Combine into unified activity using fetched income (not stale state)
        const combinedByDate: Transaction[] = [
          ...expenseList.map(e => ({ ...e, type: 'expense' as const })),
          ...fetchedIncome.map(i => ({ ...i, type: 'income' as const }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setRecentTransactions(combinedByDate.slice(0, 5));

        // Calculate monthly total (current month)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthTotal = expenseList
          .filter((e: any) => new Date(e.date) >= monthStart)
          .reduce((sum: number, e: any) => sum + e.amount, 0);
        setTotalSpent(monthTotal);

        // Calculate today's total
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTotal = expenseList
          .filter((e: any) => new Date(e.date) >= today)
          .reduce((sum: number, e: any) => sum + e.amount, 0);
        setTodaySpent(todayTotal);

        // Calculate week total
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekTotal = expenseList
          .filter((e: any) => new Date(e.date) >= weekAgo)
          .reduce((sum: number, e: any) => sum + e.amount, 0);
        setWeekSpent(weekTotal);
      } catch (mergeErr) {
        console.error('Failed to merge transactions:', mergeErr);
      }

      // Fetch income/expense balance
      try {
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          const balanceRes: any = await api.getBalance(token);
          if (balanceRes.success && balanceRes.balance) {
            setBalance(balanceRes.balance);
          }
        }
      } catch (balanceErr) {
        console.log('Balance fetch failed, continuing without:', balanceErr);
      }

    } catch (error) {
      console.log('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      checkAndSyncPending();
    }, [])
  );

  // Check for pending offline expenses and sync them
  const checkAndSyncPending = async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);

      if (count > 0) {
        // Try to sync, but don't block if it fails
        setSyncing(true);
        const token = await AsyncStorage.getItem('@auth_token');
        if (token) {
          try {
            const result = await syncPendingExpenses(token);
            if (result.synced > 0) {
              showToast({ message: `Synced ${result.synced} offline expense(s)`, type: 'success' });
              // Refresh data after successful sync
              await fetchData();

              // Check budget after sync
              try {
                const { getBudgetWarning } = await import('../../utils/budgetNotification');
                const expenseList = await getMergedExpenses();
                const warning = await getBudgetWarning(expenseList);
                if (warning) {
                  setTimeout(() => {
                    showToast({
                      message: warning,
                      type: 'warning'
                    });
                  }, 1000);
                }
              } catch (e) {
                console.log('Budget check failed:', e);
              }
            }
            const newCount = await getPendingCount();
            setPendingCount(newCount);
          } catch (syncError: any) {
            // Only show error if it's not a network issue
            if (!syncError.message?.includes('Network') && !syncError.message?.includes('fetch')) {
              console.log('Sync error:', syncError.message);
            }
          }
        }
        setSyncing(false);
      }
    } catch (e) {
      console.error('Sync check failed:', e);
      setSyncing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkAndSyncPending();
    await fetchData();
    setRefreshing(false);
  };

  const budgetPercentage = user?.monthlyBudget && user.monthlyBudget > 0
    ? Math.round((totalSpent / user.monthlyBudget) * 100)
    : 0;

  const getBudgetStatus = () => {
    if (!user?.monthlyBudget || user.monthlyBudget === 0) {
      return { color: theme.colors.info, label: 'Set Budget' };
    }
    if (budgetPercentage >= 100) return { color: theme.colors.error, label: 'Over Budget!' };
    if (budgetPercentage >= 80) return { color: theme.colors.warning, label: 'Almost there' };
    return { color: theme.colors.success, label: 'On Track' };
  };

  const budgetStatus = getBudgetStatus();
  const currencySymbol = user?.currencySymbol || '₹';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="account-balance-wallet" size={48} color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading your finances...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <AppWalkthrough onComplete={() => { }} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: theme.colors.textSecondary }]}>
              Hello, {user?.name?.split(' ')[0] || 'there'}
            </Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Your Wallet
            </Text>
          </View>
          <View style={styles.headerButtons}>
            {/* Sync indicator */}
            {pendingCount > 0 && (
              <TouchableOpacity
                onPress={checkAndSyncPending}
                style={[styles.syncButton, { backgroundColor: syncing ? theme.colors.warning + '20' : theme.colors.info + '20' }]}
              >
                <MaterialIcons
                  name={syncing ? 'sync' : 'cloud-off'}
                  size={20}
                  color={syncing ? theme.colors.warning : theme.colors.info}
                />
                <Text style={[styles.syncText, { color: syncing ? theme.colors.warning : theme.colors.info }]}>
                  {syncing ? 'Syncing...' : `${pendingCount}`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={toggleTheme}
              style={[styles.themeButton, { backgroundColor: theme.colors.surface }]}
            >
              <MaterialIcons
                name={isDark ? 'light-mode' : 'dark-mode'}
                size={22}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Total Spent Card - Clickable */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push({ pathname: '/(main)/expenses', params: { viewMode: 'monthly' } })}
        >
          <Card variant="glass" style={styles.totalCard}>
            <View style={styles.totalCardContent}>
              <View style={styles.totalHeader}>
                <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>
                  Spent This Month
                </Text>
                <View style={[styles.statusBadge, { backgroundColor: budgetStatus.color + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: budgetStatus.color }]} />
                  <Text style={[styles.statusText, { color: budgetStatus.color }]}>
                    {budgetStatus.label}
                  </Text>
                </View>
              </View>

              <Text style={[styles.totalAmount, { color: theme.colors.text }]}>
                {currencySymbol}{totalSpent.toLocaleString()}
              </Text>

              {user?.monthlyBudget && user.monthlyBudget > 0 ? (
                <>
                  <Text style={[styles.budgetText, { color: theme.colors.textSecondary }]}>
                    of {currencySymbol}{user.monthlyBudget.toLocaleString()} budget
                  </Text>
                  <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          backgroundColor: budgetStatus.color,
                          width: `${Math.min(budgetPercentage, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.setBudgetLink}
                  onPress={() => router.push('/(main)/profile')}
                >
                  <Text style={[styles.setBudgetText, { color: theme.colors.primary }]}>
                    Tap to set a monthly budget →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        </TouchableOpacity>

        {/* Quick Stats - Today and Week only */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/(main)/expenses', params: { viewMode: 'daily' } })}
          >
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: theme.colors.primaryLight + '20' }]}>
                <MaterialIcons name="today" size={20} color={theme.colors.primary} />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {currencySymbol}{todaySpent.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                Today
              </Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/(main)/expenses', params: { viewMode: 'weekly' } })}
          >
            <Card style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#10B98120' }]}>
                <MaterialIcons name="date-range" size={20} color="#10B981" />
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {currencySymbol}{weekSpent.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                This Week
              </Text>
            </Card>
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        {balance && (
          <Card style={[styles.balanceCard, { backgroundColor: theme.colors.surface }] as any}>
            <View style={styles.balanceTop}>
              <View>
                <Text style={[styles.balanceLabel, { color: theme.colors.textSecondary }]}>This Month's Balance</Text>
                <Text style={[styles.balanceValue, { color: balance.netBalance >= 0 ? '#10B981' : '#EF4444' }]}>
                  {balance.netBalance >= 0 ? '+' : ''}{currencySymbol}{balance.netBalance.toLocaleString()}
                </Text>
              </View>
              <View style={[styles.savingsBadge, { backgroundColor: balance.savingsRate >= 0 ? '#10B98120' : '#EF444420' }]}>
                <Text style={[styles.savingsText, { color: balance.savingsRate >= 0 ? '#10B981' : '#EF4444' }]}>
                  {balance.savingsRate >= 0 ? '+' : ''}{balance.savingsRate}% Saved
                </Text>
              </View>
            </View>

            <View style={[styles.balanceDivider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.balanceBottom}>
              <View style={styles.balanceSubItem}>
                <View style={[styles.itemIcon, { backgroundColor: '#10B98120' }]}>
                  <MaterialIcons name="arrow-downward" size={18} color="#10B981" />
                </View>
                <View>
                  <Text style={[styles.itemLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                  <Text style={[styles.itemValue, { color: '#10B981' }]}>+{currencySymbol}{balance.totalIncome.toLocaleString()}</Text>
                </View>
              </View>
              <View style={[styles.itemSeparator, { backgroundColor: theme.colors.border }]} />
              <View style={styles.balanceSubItem}>
                <View style={[styles.itemIcon, { backgroundColor: '#EF444420' }]}>
                  <MaterialIcons name="arrow-upward" size={18} color="#EF4444" />
                </View>
                <View>
                  <Text style={[styles.itemLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                  <Text style={[styles.itemValue, { color: '#EF4444' }]}>-{currencySymbol}{balance.totalExpenses.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          </Card>
        )}

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recent Activity
            </Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity onPress={() => router.push({ pathname: '/(main)/expenses', params: { category: '' } })}>
                <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
                  See All →
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Card style={styles.activityCard}>
            {recentTransactions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="receipt-long" size={40} color={theme.colors.textTertiary} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No recent activity
                </Text>
              </View>
            ) : (
              recentTransactions.map((item, index) => {
                const isIncome = item.type === 'income';
                const config = isIncome ? { color: '#10B981', icon: 'trending-up' } : (CATEGORY_CONFIG[(item as Expense).category] || CATEGORY_CONFIG.Other);
                return (
                  <View key={item._id}>
                    <TouchableOpacity
                      style={styles.activityItem}
                      onPress={() => isIncome ? null : router.push({ pathname: '/(main)/edit-expense', params: { id: item._id } })}
                    >
                      <View style={[styles.activityIcon, { backgroundColor: config.color + '15' }]}>
                        <MaterialIcons name={config.icon as any} size={20} color={config.color} />
                      </View>
                      <View style={styles.activityDetails}>
                        <Text style={[styles.activityTitle, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.description || (isIncome ? (item as Income).source : (item as Expense).category)}
                        </Text>
                        <Text style={[styles.activitySubtitle, { color: theme.colors.textSecondary }]}>
                          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {isIncome ? 'Income' : (item as Expense).paymentMethod}
                        </Text>
                      </View>
                      <Text style={[
                        styles.activityAmount,
                        { color: isIncome ? '#10B981' : theme.colors.text }
                      ]}>
                        {isIncome ? '+' : '-'}{currencySymbol}{item.amount.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                    {index < recentTransactions.length - 1 && (
                      <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                    )}
                  </View>
                );
              })
            )}
          </Card>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
  },
  greeting: {
    fontSize: 15,
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  themeButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 24,
  },
  totalCardContent: {},
  totalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 4,
  },
  budgetText: {
    fontSize: 14,
    marginBottom: 16,
  },
  setBudgetLink: {
    marginTop: 8,
  },
  setBudgetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 10,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 14,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 6,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  expenseCard: {
    marginBottom: 10,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseCategory: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: 12,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  expenseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // Premium Balance Card Styles
  balanceCard: {
    padding: 24,
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  savingsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  savingsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 20,
  },
  balanceBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceSubItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  itemValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 1,
  },
  itemSeparator: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginHorizontal: 15,
  },

  // Action Row
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  mainAddBtn: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  addBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainAddBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Activity Styles
  activityCard: {
    padding: 8,
    borderRadius: 20,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityDetails: {
    flex: 1,
    marginLeft: 12,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  activitySubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  menuOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 20,
  },
  menuOption: {
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
