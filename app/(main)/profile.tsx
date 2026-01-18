import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import { Card, Button } from '../../components/ui';
import api from '../../utils/api';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
];

interface User {
  name: string;
  email: string;
  currency: string;
  currencySymbol: string;
  monthlyBudget: number;
}

export default function ProfileScreen() {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const router = useRouter();
  const { showToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [budgetValue, setBudgetValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [carryOverBudget, setCarryOverBudget] = useState(false);

  useEffect(() => {
    loadUser();
    loadCarryOverSetting();
  }, []);

  const loadCarryOverSetting = async () => {
    try {
      const value = await AsyncStorage.getItem('@carry_over_budget');
      if (value !== null) setCarryOverBudget(value === 'true');
    } catch (error) { }
  };

  const toggleCarryOver = async (value: boolean) => {
    setCarryOverBudget(value);
    await AsyncStorage.setItem('@carry_over_budget', value.toString());
  };

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('@user');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUser(parsed);
        setBudgetValue(parsed.monthlyBudget?.toString() || '');
      }
    } catch (error) {
      console.error('Failed to load user');
    }
  };

  const updateUserData = async (updates: Partial<User>) => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('@auth_token');
      if (!token) return;

      const response: any = await api.updateProfile(token, updates);
      if (response.success) {
        const updatedUser = { ...user, ...updates } as User;
        setUser(updatedUser);
        await AsyncStorage.setItem('@user', JSON.stringify(updatedUser));
        showToast({ message: 'Settings saved!', type: 'success' });
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to update', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = (currency: typeof CURRENCIES[0]) => {
    updateUserData({ currency: currency.code, currencySymbol: currency.symbol } as any);
    setShowCurrencyPicker(false);
  };

  const handleBudgetSave = () => {
    const budget = parseFloat(budgetValue) || 0;
    updateUserData({ monthlyBudget: budget });
    setShowBudgetInput(false);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('@auth_token');
          await AsyncStorage.removeItem('@user');
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  const currentCurrency = CURRENCIES.find(c => c.code === user?.currency) || CURRENCIES[3];

  const MenuItem = ({
    icon,
    title,
    subtitle,
    onPress,
    rightElement,
    danger = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View
        style={[
          styles.menuIcon,
          {
            backgroundColor: danger
              ? theme.colors.error + '15'
              : theme.colors.primary + '15',
          },
        ]}
      >
        <MaterialIcons
          name={icon as any}
          size={20}
          color={danger ? theme.colors.error : theme.colors.primary}
        />
      </View>
      <View style={styles.menuContent}>
        <Text
          style={[
            styles.menuTitle,
            { color: danger ? theme.colors.error : theme.colors.text },
          ]}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.menuSubtitle, { color: theme.colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement || (
        onPress && <MaterialIcons name="chevron-right" size={22} color={theme.colors.textTertiary} />
      )}
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Settings</Text>
        </View>

        {/* User Info */}
        <Card variant="elevated" style={styles.userCard}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
            <Text style={styles.avatarText}>
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.userName, { color: theme.colors.text }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: theme.colors.textSecondary }]}>
            {user.email}
          </Text>
        </Card>

        {/* Budget & Currency */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            BUDGET & CURRENCY
          </Text>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="account-balance-wallet"
              title="Monthly Budget"
              subtitle={user.monthlyBudget ? `${currentCurrency.symbol}${user.monthlyBudget.toLocaleString()}` : 'Not set'}
              onPress={() => setShowBudgetInput(!showBudgetInput)}
            />
            {showBudgetInput && (
              <View style={[styles.inputRow, { borderTopColor: theme.colors.border }]}>
                <View style={[styles.budgetInput, { backgroundColor: theme.colors.surfaceSecondary }]}>
                  <Text style={[styles.currencyPrefix, { color: theme.colors.primary }]}>
                    {currentCurrency.symbol}
                  </Text>
                  <TextInput
                    style={[styles.budgetTextInput, { color: theme.colors.text }]}
                    value={budgetValue}
                    onChangeText={setBudgetValue}
                    keyboardType="numeric"
                    placeholder="50000"
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleBudgetSave}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>{saving ? '...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <MenuItem
              icon="attach-money"
              title="Currency"
              subtitle={`${currentCurrency.name} (${currentCurrency.symbol})`}
              onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
            />
            {showCurrencyPicker && (
              <View style={[styles.currencyPicker, { borderTopColor: theme.colors.border }]}>
                {CURRENCIES.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={[
                      styles.currencyOption,
                      {
                        backgroundColor: currentCurrency.code === curr.code
                          ? theme.colors.primary + '15'
                          : 'transparent',
                      },
                    ]}
                    onPress={() => handleCurrencyChange(curr)}
                  >
                    <Text style={[styles.currencySymbol, { color: theme.colors.primary }]}>
                      {curr.symbol}
                    </Text>
                    <Text style={[styles.currencyName, { color: theme.colors.text }]}>
                      {curr.name}
                    </Text>
                    {currentCurrency.code === curr.code && (
                      <MaterialIcons name="check" size={18} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <MenuItem
              icon="sync"
              title="Carry Over Budget"
              subtitle="Roll unused budget to next month"
              rightElement={
                <Switch
                  value={carryOverBudget}
                  onValueChange={toggleCarryOver}
                  trackColor={{ false: theme.colors.border, true: theme.colors.primary + '60' }}
                  thumbColor={carryOverBudget ? theme.colors.primary : '#f4f3f4'}
                />
              }
            />
          </Card>
        </View>

        {/* Quick Access */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            QUICK ACCESS
          </Text>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="repeat"
              title="Recurring Transactions"
              subtitle="Manage auto-repeat expenses & income"
              onPress={() => router.push('/(main)/recurring' as any)}
            />
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <MenuItem
              icon="category"
              title="Categories"
              subtitle="Customize expense categories"
              onPress={() => router.push('/(main)/categories' as any)}
            />
          </Card>
        </View>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            APPEARANCE
          </Text>
          <Card style={styles.menuCard}>
            <View style={styles.themeOptions}>
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: themeMode === mode
                        ? theme.colors.primary
                        : theme.colors.surfaceSecondary,
                    },
                  ]}
                  onPress={() => setThemeMode(mode)}
                >
                  <MaterialIcons
                    name={
                      mode === 'light' ? 'light-mode' :
                        mode === 'dark' ? 'dark-mode' :
                          'settings-brightness'
                    }
                    size={18}
                    color={themeMode === mode ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.themeOptionText,
                      {
                        color: themeMode === mode ? '#FFFFFF' : theme.colors.text,
                      },
                    ]}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
            ACCOUNT
          </Text>
          <Card style={styles.menuCard}>
            <MenuItem
              icon="logout"
              title="Logout"
              danger
              onPress={handleLogout}
            />
          </Card>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: theme.colors.textSecondary }]}>
            Spendwise v1.0.0
          </Text>
          <Text style={[styles.appTagline, { color: theme.colors.textTertiary }]}>
            Made by Yash Agarwal
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
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
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
  },
  userCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    alignItems: 'center',
    padding: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  menuSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 62,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
    borderTopWidth: 1,
  },
  budgetInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
  },
  currencyPrefix: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 4,
  },
  budgetTextInput: {
    flex: 1,
    fontSize: 16,
  },
  saveButton: {
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  currencyPicker: {
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 10,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    width: 26,
  },
  currencyName: {
    flex: 1,
    fontSize: 14,
  },
  themeOptions: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  appName: {
    fontSize: 14,
    fontWeight: '600',
  },
  appTagline: {
    fontSize: 12,
    marginTop: 4,
  },
});