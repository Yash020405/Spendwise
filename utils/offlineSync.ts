import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const PENDING_EXPENSES_KEY = '@pending_expenses';
const PENDING_DELETES_KEY = '@pending_deletes';
const PENDING_UPDATES_KEY = '@pending_updates';

interface PendingExpense {
  id: string;
  amount: number;
  category: string;
  paymentMethod: string;
  description?: string;
  date: string;
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
  return expenses.length + updates.length + deletes.length;
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
  }));

  // Combine and sort by date descending
  const all = [...merged, ...offlineExpenses];
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Clear all offline data (for logout)
export const clearOfflineData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    PENDING_EXPENSES_KEY,
    PENDING_DELETES_KEY,
    PENDING_UPDATES_KEY,
    CACHED_EXPENSES_KEY,
  ]);
};
