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

interface User {
  name: string;
  currency: string;
  currencySymbol: string;
  monthlyBudget: number;
}

export default function HomeScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [todaySpent, setTodaySpent] = useState(0);
  const [weekSpent, setWeekSpent] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

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

      // Always use merged data (cached server + offline pending)
      try {
        const expenseList = await getMergedExpenses();

        // Sort by date descending and take first 5 for recent
        const sorted = [...expenseList].sort((a: any, b: any) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setExpenses(sorted.slice(0, 5) as Expense[]);

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
        console.error('Failed to merge expenses:', mergeErr);
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

        {/* Recent Expenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Recent Activity
            </Text>
            {expenses.length > 0 && (
              <TouchableOpacity onPress={() => router.push({ pathname: '/(main)/expenses', params: { category: '' } })}>
                <Text style={[styles.seeAll, { color: theme.colors.primary }]}>
                  See All →
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {expenses.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={[styles.emptyIconWrapper, { backgroundColor: theme.colors.primary + '15' }]}>
                <MaterialIcons name="receipt-long" size={32} color={theme.colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                No expenses yet
              </Text>
              <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                Start tracking your spending by{'\n'}adding your first expense
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => router.push('/(main)/add-expense')}
              >
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Add Expense</Text>
              </TouchableOpacity>
            </Card>
          ) : (
            expenses.map((expense) => {
              const config = CATEGORY_CONFIG[expense.category] || CATEGORY_CONFIG.Other;
              return (
                <TouchableOpacity
                  key={expense._id}
                  activeOpacity={0.7}
                  onPress={() => router.push({
                    pathname: '/(main)/edit-expense',
                    params: {
                      id: expense._id,
                      amount: expense.amount,
                      category: expense.category,
                      paymentMethod: expense.paymentMethod,
                      description: expense.description || '',
                      date: expense.date,
                    },
                  })}
                >
                  <Card style={styles.expenseCard}>
                    <View style={styles.expenseRow}>
                      <View style={[styles.categoryIcon, { backgroundColor: config.color + '15' }]}>
                        <MaterialIcons name={config.icon as any} size={22} color={config.color} />
                      </View>
                      <View style={styles.expenseInfo}>
                        <Text style={[styles.expenseCategory, { color: theme.colors.text }]}>
                          {expense.description || expense.category}
                        </Text>
                        <Text style={[styles.expenseDate, { color: theme.colors.textSecondary }]}>
                          {expense.category} • {formatDate(expense.date)}
                        </Text>
                      </View>
                      <View style={styles.expenseRight}>
                        <Text style={[styles.expenseAmount, { color: theme.colors.text }]}>
                          -{currencySymbol}{expense.amount.toLocaleString()}
                        </Text>
                        <MaterialIcons name="chevron-right" size={18} color={theme.colors.textTertiary} />
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              );
            })
          )}
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
});
