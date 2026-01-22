import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PENDING_EXPENSES_KEY = '@pending_expenses';
const PENDING_DELETES_KEY = '@pending_deletes';
const PENDING_UPDATES_KEY = '@pending_updates';
const PENDING_INCOME_KEY = '@pending_income';
const PENDING_RECURRING_KEY = '@pending_recurring';
const CACHED_INCOME_KEY = '@cached_income';
const CACHED_RECURRING_KEY = '@cached_recurring';

const PENDING_INCOME_UPDATES_KEY = '@pending_income_updates';
const PENDING_INCOME_DELETES_KEY = '@pending_income_deletes';

interface PendingExpense {
  id: string;
  amount: number;
  category: string;
  paymentMethod: string;
  description?: string;
  date: string;
  createdAt: string;
  // Split expense fields
  isSplit?: boolean;
  splitType?: 'equal' | 'custom' | 'percentage';
  participants?: any[];
  userShare?: number;
  payer?: string;
  payerName?: string;
  userHasPaidShare?: boolean; // Track if user has paid their share when someone else paid
}

interface PendingIncome {
  id: string;
  amount: number;
  source: string;
  description?: string;
  date: string;
  createdAt: string;
}

interface PendingRecurring {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  category?: string;
  source?: string;
  paymentMethod?: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dayOfMonth?: number;
  createdAt: string;
}

interface PendingUpdate {
  id: string;
  data: any;
}

// Save expense locally when offline
export const saveOfflineExpense = async (expense: Omit<PendingExpense, 'id' | 'createdAt'>): Promise<PendingExpense> => {
  const pending = await getPendingExpenses();
  const newExpense: PendingExpense = {
    ...expense,
    id: `offline_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  pending.push(newExpense);
  await AsyncStorage.setItem(PENDING_EXPENSES_KEY, JSON.stringify(pending));
  return newExpense;
};

// Get all pending expenses
export const getPendingExpenses = async (): Promise<PendingExpense[]> => {
  const data = await AsyncStorage.getItem(PENDING_EXPENSES_KEY);
  return data ? JSON.parse(data) : [];
};

// Save pending delete
export const savePendingDelete = async (expenseId: string): Promise<void> => {
  const pending = await getPendingDeletes();
  if (!pending.includes(expenseId)) {
    pending.push(expenseId);
    await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending));
  }
};

// Get pending deletes
export const getPendingDeletes = async (): Promise<string[]> => {
  const data = await AsyncStorage.getItem(PENDING_DELETES_KEY);
  return data ? JSON.parse(data) : [];
};

// Save pending update
export const savePendingUpdate = async (expenseId: string, updateData: any): Promise<void> => {
  const pending = await getPendingUpdates();
  const existingIndex = pending.findIndex(p => p.id === expenseId);
  if (existingIndex >= 0) {
    pending[existingIndex].data = { ...pending[existingIndex].data, ...updateData };
  } else {
    pending.push({ id: expenseId, data: updateData });
  }
  await AsyncStorage.setItem(PENDING_UPDATES_KEY, JSON.stringify(pending));
};

// Get pending updates
export const getPendingUpdates = async (): Promise<PendingUpdate[]> => {
  const data = await AsyncStorage.getItem(PENDING_UPDATES_KEY);
  return data ? JSON.parse(data) : [];
};

// Sync all pending operations to server
export const syncPendingExpenses = async (token: string): Promise<{ synced: number; errors: number }> => {
  let synced = 0;
  let errors = 0;

  // Sync new expenses
  const pendingExpenses = await getPendingExpenses();
  const successfulCreates: string[] = [];

  for (const expense of pendingExpenses) {
    try {
      const response: any = await api.createExpense(token, {
        amount: expense.amount,
        category: expense.category,
        paymentMethod: expense.paymentMethod,
        description: expense.description,
        date: expense.date,
        // Include split expense data if present
        isSplit: expense.isSplit,
        splitType: expense.splitType,
        participants: expense.participants,
        userShare: expense.userShare,
        payer: expense.payer,
        payerName: expense.payerName,
        userHasPaidShare: expense.userHasPaidShare, // Include user paid share status
      });
      if (response.success) {
        successfulCreates.push(expense.id);
        synced++;
      } else {
        errors++;
      }
    } catch (e) {
      errors++;
    }
  }

  // Remove synced expenses
  if (successfulCreates.length > 0) {
    const remaining = pendingExpenses.filter(e => !successfulCreates.includes(e.id));
    await AsyncStorage.setItem(PENDING_EXPENSES_KEY, JSON.stringify(remaining));
  }

  // Sync updates
  const pendingUpdates = await getPendingUpdates();
  const successfulUpdates: string[] = [];

  for (const update of pendingUpdates) {
    try {
      const response: any = await api.updateExpense(token, update.id, update.data);
      if (response.success) {
        successfulUpdates.push(update.id);
        synced++;
      } else {
        errors++;
      }
    } catch (e) {
      errors++;
    }
  }

  if (successfulUpdates.length > 0) {
    const remaining = pendingUpdates.filter(u => !successfulUpdates.includes(u.id));
    await AsyncStorage.setItem(PENDING_UPDATES_KEY, JSON.stringify(remaining));
  }

  // Sync deletes
  const pendingDeletes = await getPendingDeletes();
  const successfulDeletes: string[] = [];

  for (const id of pendingDeletes) {
    try {
      await api.deleteExpense(token, id);
      successfulDeletes.push(id);
      synced++;
    } catch (e) {
      errors++;
    }
  }

  if (successfulDeletes.length > 0) {
    const remaining = pendingDeletes.filter(id => !successfulDeletes.includes(id));
    await AsyncStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(remaining));
  }

  return { synced, errors };
};

// Check if there are pending operations
export const hasPendingSync = async (): Promise<boolean> => {
  const expenses = await getPendingExpenses();
  const updates = await getPendingUpdates();
  const deletes = await getPendingDeletes();
  return expenses.length > 0 || updates.length > 0 || deletes.length > 0;
};

// Get count of pending operations
export const getPendingCount = async (): Promise<number> => {
  const expenses = await getPendingExpenses();
  const updates = await getPendingUpdates();
  const deletes = await getPendingDeletes();
  // Include income pending counts
  const income = await getPendingIncome();
  const incomeUpdates = await getPendingIncomeUpdates();
  const incomeDeletes = await getPendingIncomeDeletes();
  return expenses.length + updates.length + deletes.length + income.length + incomeUpdates.length + incomeDeletes.length;
};

// ============ SIMPLE EXPENSE CACHING ============
const CACHED_EXPENSES_KEY = '@cached_expenses';

// Save expenses to cache
export const cacheExpenses = async (expenses: any[]): Promise<void> => {
  await AsyncStorage.setItem(CACHED_EXPENSES_KEY, JSON.stringify(expenses));
};

// Get cached expenses
export const getCachedExpenses = async (): Promise<any[]> => {
  const data = await AsyncStorage.getItem(CACHED_EXPENSES_KEY);
  return data ? JSON.parse(data) : [];
};

// Update a single expense in cache
export const updateCachedExpense = async (expenseId: string, updates: any): Promise<void> => {
  const cached = await getCachedExpenses();
  const updatedCache = cached.map((expense: any) => 
    expense._id === expenseId ? { ...expense, ...updates } : expense
  );
  await cacheExpenses(updatedCache);
};

// Merge cached expenses with pending offline ones for display
export const getMergedExpenses = async (): Promise<any[]> => {
  const cached = await getCachedExpenses();
  const pending = await getPendingExpenses();
  const pendingDeletes = await getPendingDeletes();
  const pendingUpdates = await getPendingUpdates();

  // Filter out deleted items (both from server and offline)
  let merged = cached.filter((e: any) => !pendingDeletes.includes(e._id));

  // Apply pending updates to cached items
  merged = merged.map((expense: any) => {
    const update = pendingUpdates.find(u => u.id === expense._id);
    return update ? { ...expense, ...update.data } : expense;
  });

  // Add pending offline expenses (new ones not yet on server)
  const offlineExpenses = pending.map(p => ({
    _id: p.id,
    amount: p.amount,
    category: p.category,
    paymentMethod: p.paymentMethod,
    description: p.description,
    date: p.date,
    isOffline: true,
    // Include split expense fields
    isSplit: p.isSplit,
    splitType: p.splitType,
    participants: p.participants,
    userShare: p.userShare,
    payer: p.payer,
    payerName: p.payerName,
    userHasPaidShare: p.userHasPaidShare, // Include user paid share status
  }));

  // Combine and sort by date descending
  const all = [...merged, ...offlineExpenses];
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// ============ INCOME OFFLINE SUPPORT ============

// Save income locally when offline
export const saveOfflineIncome = async (income: Omit<PendingIncome, 'id' | 'createdAt'>): Promise<PendingIncome> => {
  const pending = await getPendingIncome();
  const newIncome: PendingIncome = {
    ...income,
    id: `offline_income_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  pending.push(newIncome);
  await AsyncStorage.setItem(PENDING_INCOME_KEY, JSON.stringify(pending));
  return newIncome;
};

// Get all pending income
export const getPendingIncome = async (): Promise<PendingIncome[]> => {
  const data = await AsyncStorage.getItem(PENDING_INCOME_KEY);
  return data ? JSON.parse(data) : [];
};

// Get pending income updates
export const getPendingIncomeUpdates = async (): Promise<PendingUpdate[]> => {
  const data = await AsyncStorage.getItem(PENDING_INCOME_UPDATES_KEY);
  return data ? JSON.parse(data) : [];
};

// Save pending income update
export const savePendingIncomeUpdate = async (id: string, updateData: any): Promise<void> => {
  const pending = await getPendingIncomeUpdates();
  const existingIndex = pending.findIndex(p => p.id === id);
  if (existingIndex >= 0) {
    pending[existingIndex].data = { ...pending[existingIndex].data, ...updateData };
  } else {
    pending.push({ id, data: updateData });
  }
  await AsyncStorage.setItem(PENDING_INCOME_UPDATES_KEY, JSON.stringify(pending));
};

// Get pending income deletes
export const getPendingIncomeDeletes = async (): Promise<string[]> => {
  const data = await AsyncStorage.getItem(PENDING_INCOME_DELETES_KEY);
  return data ? JSON.parse(data) : [];
};

// Save pending income delete
export const savePendingIncomeDelete = async (id: string): Promise<void> => {
  const pending = await getPendingIncomeDeletes();
  if (!pending.includes(id)) {
    pending.push(id);
    await AsyncStorage.setItem(PENDING_INCOME_DELETES_KEY, JSON.stringify(pending));
  }
};

// Cache income from server
export const cacheIncome = async (income: any[]): Promise<void> => {
  await AsyncStorage.setItem(CACHED_INCOME_KEY, JSON.stringify(income));
};

// Get cached income
export const getCachedIncome = async (): Promise<any[]> => {
  const data = await AsyncStorage.getItem(CACHED_INCOME_KEY);
  return data ? JSON.parse(data) : [];
};

// Merge cached income with pending offline ones for display
export const getMergedIncome = async (): Promise<any[]> => {
  const cached = await getCachedIncome();
  const pending = await getPendingIncome();
  const pendingDeletes = await getPendingIncomeDeletes();
  const pendingUpdates = await getPendingIncomeUpdates();

  // Filter out deleted items
  let merged = cached.filter((i: any) => !pendingDeletes.includes(i._id));

  // Apply pending updates
  merged = merged.map((income: any) => {
    const update = pendingUpdates.find(u => u.id === income._id);
    return update ? { ...income, ...update.data } : income;
  });

  // Add pending offline income
  const offlineIncome = pending.map(p => ({
    _id: p.id,
    amount: p.amount,
    source: p.source,
    description: p.description,
    date: p.date,
    isOffline: true,
  }));

  // Combine and sort by date descending
  const all = [...cached, ...offlineIncome];
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Sync pending income to server
export const syncPendingIncome = async (token: string): Promise<{ synced: number; errors: number }> => {
  let synced = 0;
  let errors = 0;

  const pendingIncome = await getPendingIncome();
  const successfulCreates: string[] = [];

  for (const income of pendingIncome) {
    try {
      const response: any = await api.createIncome(token, {
        amount: income.amount,
        source: income.source,
        description: income.description,
        date: income.date,
      });
      if (response.success) {
        successfulCreates.push(income.id);
        synced++;
      } else {
        errors++;
      }
    } catch (e) {
      errors++;
    }
  }

  // Remove synced income
  if (successfulCreates.length > 0) {
    const remaining = pendingIncome.filter(i => !successfulCreates.includes(i.id));
    await AsyncStorage.setItem(PENDING_INCOME_KEY, JSON.stringify(remaining));
  }

  // Sync updates
  const pendingUpdates = await getPendingIncomeUpdates();
  const successfulUpdates: string[] = [];

  for (const update of pendingUpdates) {
    try {
      const response: any = await api.updateIncome(token, update.id, update.data);
      if (response.success) {
        successfulUpdates.push(update.id);
        synced++;
      } else {
        errors++;
      }
    } catch (e) {
      errors++;
    }
  }

  if (successfulUpdates.length > 0) {
    const remaining = pendingUpdates.filter(u => !successfulUpdates.includes(u.id));
    await AsyncStorage.setItem(PENDING_INCOME_UPDATES_KEY, JSON.stringify(remaining));
  }

  // Sync deletes
  const pendingDeletes = await getPendingIncomeDeletes();
  const successfulDeletes: string[] = [];

  for (const id of pendingDeletes) {
    try {
      await api.deleteIncome(token, id);
      successfulDeletes.push(id);
      synced++;
    } catch (e) {
      errors++;
    }
  }

  if (successfulDeletes.length > 0) {
    const remaining = pendingDeletes.filter(id => !successfulDeletes.includes(id));
    await AsyncStorage.setItem(PENDING_INCOME_DELETES_KEY, JSON.stringify(remaining));
  }

  return { synced, errors };
};

// ============ RECURRING OFFLINE SUPPORT ============

// Save recurring locally when offline
export const saveOfflineRecurring = async (recurring: Omit<PendingRecurring, 'id' | 'createdAt'>): Promise<PendingRecurring> => {
  const pending = await getPendingRecurring();
  const newRecurring: PendingRecurring = {
    ...recurring,
    id: `offline_recurring_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  pending.push(newRecurring);
  await AsyncStorage.setItem(PENDING_RECURRING_KEY, JSON.stringify(pending));
  return newRecurring;
};

// Get all pending recurring
export const getPendingRecurring = async (): Promise<PendingRecurring[]> => {
  const data = await AsyncStorage.getItem(PENDING_RECURRING_KEY);
  return data ? JSON.parse(data) : [];
};

// Cache recurring from server
export const cacheRecurring = async (recurring: any[]): Promise<void> => {
  await AsyncStorage.setItem(CACHED_RECURRING_KEY, JSON.stringify(recurring));
};

// Get cached recurring
export const getCachedRecurring = async (): Promise<any[]> => {
  const data = await AsyncStorage.getItem(CACHED_RECURRING_KEY);
  return data ? JSON.parse(data) : [];
};

// Merge cached recurring with pending offline ones for display
export const getMergedRecurring = async (): Promise<any[]> => {
  const cached = await getCachedRecurring();
  const pending = await getPendingRecurring();

  // Add pending offline recurring
  const offlineRecurring = pending.map(p => ({
    _id: p.id,
    type: p.type,
    amount: p.amount,
    category: p.category,
    source: p.source,
    description: p.description,
    frequency: p.frequency,
    isActive: true,
    nextDueDate: new Date().toISOString(),
    isOffline: true,
  }));

  // Combine
  return [...cached, ...offlineRecurring];
};

// Sync pending recurring to server
export const syncPendingRecurring = async (token: string): Promise<{ synced: number; errors: number }> => {
  let synced = 0;
  let errors = 0;

  const pendingRecurring = await getPendingRecurring();
  const successfulCreates: string[] = [];

  for (const recurring of pendingRecurring) {
    try {
      const response: any = await api.createRecurring(token, {
        type: recurring.type,
        amount: recurring.amount,
        category: recurring.category,
        source: recurring.source,
        paymentMethod: recurring.paymentMethod,
        description: recurring.description,
        frequency: recurring.frequency,
        dayOfMonth: recurring.dayOfMonth,
      });
      if (response.success) {
        successfulCreates.push(recurring.id);
        synced++;
      } else {
        errors++;
      }
    } catch (e) {
      errors++;
    }
  }

  // Remove synced recurring
  if (successfulCreates.length > 0) {
    const remaining = pendingRecurring.filter(r => !successfulCreates.includes(r.id));
    await AsyncStorage.setItem(PENDING_RECURRING_KEY, JSON.stringify(remaining));
  }

  return { synced, errors };
};

// Check if there are pending income/recurring
export const hasPendingIncomeOrRecurring = async (): Promise<boolean> => {
  const income = await getPendingIncome();
  const recurring = await getPendingRecurring();
  return income.length > 0 || recurring.length > 0;
};

// Sync all pending operations (expenses, income, recurring)
export const syncAllPending = async (token: string): Promise<{ synced: number; errors: number }> => {
  const expenseResult = await syncPendingExpenses(token);
  const incomeResult = await syncPendingIncome(token);
  const recurringResult = await syncPendingRecurring(token);

  return {
    synced: expenseResult.synced + incomeResult.synced + recurringResult.synced,
    errors: expenseResult.errors + incomeResult.errors + recurringResult.errors,
  };
};

// Clear all offline data (for logout)
export const clearOfflineData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    PENDING_EXPENSES_KEY,
    PENDING_DELETES_KEY,
    PENDING_UPDATES_KEY,
    CACHED_EXPENSES_KEY,
    PENDING_INCOME_KEY,
    CACHED_INCOME_KEY,
    PENDING_RECURRING_KEY,
    CACHED_RECURRING_KEY,
  ]);
};

// ============ RECENT PARTICIPANTS (Independent, User-Specific Storage) ============
const RECENT_PARTICIPANTS_PREFIX = '@recent_participants_';

export interface RecentParticipant {
  name: string;
  phone?: string;
}

// Helper to get user-specific key
const getParticipantsKey = async (): Promise<string | null> => {
  try {
    const userData = await AsyncStorage.getItem('@user');
    if (userData) {
      const user = JSON.parse(userData);
      return `${RECENT_PARTICIPANTS_PREFIX}${user._id || user.id}`;
    }
    return null;
  } catch {
    return null;
  }
};

// Get recent participants from user-specific storage
export const getRecentParticipants = async (): Promise<RecentParticipant[]> => {
  try {
    const key = await getParticipantsKey();
    if (!key) return [];
    
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Save/update recent participants - merges new ones with existing (user-specific)
export const saveRecentParticipants = async (participants: { name: string; phone?: string }[]): Promise<void> => {
  try {
    const key = await getParticipantsKey();
    if (!key) return;
    
    const existing = await getRecentParticipants();
    const participantsMap = new Map<string, RecentParticipant>();
    
    // Add existing participants first
    existing.forEach(p => {
      participantsMap.set(p.name.toLowerCase(), p);
    });
    
    // Add/update with new participants
    participants.forEach(p => {
      const mapKey = p.name.toLowerCase();
      const current = participantsMap.get(mapKey);
      if (!current) {
        participantsMap.set(mapKey, { name: p.name, phone: p.phone });
      } else if (p.phone && !current.phone) {
        // Update phone if we didn't have it before
        participantsMap.set(mapKey, { name: p.name, phone: p.phone });
      }
    });
    
    await AsyncStorage.setItem(key, JSON.stringify(Array.from(participantsMap.values())));
  } catch {
    // Silent fail
  }
};

// Update a participant's details (name/phone change) - user-specific
export const updateRecentParticipant = async (oldName: string, newName: string, newPhone?: string): Promise<void> => {
  try {
    const key = await getParticipantsKey();
    if (!key) return;
    
    const participants = await getRecentParticipants();
    const updated = participants.map(p => 
      p.name.toLowerCase() === oldName.toLowerCase() 
        ? { name: newName, phone: newPhone } 
        : p
    );
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Silent fail
  }
};
