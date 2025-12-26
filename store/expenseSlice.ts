import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface Expense {
    _id?: string;
    localId: string;
    userId?: string;
    amount: number;
    category: string;
    categoryIcon?: string;
    paymentMethod: string;
    description?: string;
    date: string;
    synced: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ExpenseState {
    expenses: Expense[];
    loading: boolean;
    error: string | null;
    lastSynced: string | null;
    offlineQueue: Expense[];
}

const initialState: ExpenseState = {
    expenses: [],
    loading: false,
    error: null,
    lastSynced: null,
    offlineQueue: [],
};

// Async thunks
export const loadExpensesFromStorage = createAsyncThunk(
    'expenses/loadFromStorage',
    async () => {
        const stored = await AsyncStorage.getItem('@expenses');
        return stored ? JSON.parse(stored) : [];
    }
);

export const saveExpenseLocally = createAsyncThunk(
    'expenses/saveLocally',
    async (expense: Omit<Expense, 'localId' | 'synced'>, { getState }) => {
        const newExpense: Expense = {
            ...expense,
            localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            synced: false,
        };

        const state = getState() as { expenses: ExpenseState };
        const updatedExpenses = [newExpense, ...state.expenses.expenses];
        await AsyncStorage.setItem('@expenses', JSON.stringify(updatedExpenses));

        return newExpense;
    }
);

export const deleteExpenseLocally = createAsyncThunk(
    'expenses/deleteLocally',
    async (localId: string, { getState }) => {
        const state = getState() as { expenses: ExpenseState };
        const updatedExpenses = state.expenses.expenses.filter(e => e.localId !== localId);
        await AsyncStorage.setItem('@expenses', JSON.stringify(updatedExpenses));
        return localId;
    }
);

const expenseSlice = createSlice({
    name: 'expenses',
    initialState,
    reducers: {
        setExpenses: (state, action: PayloadAction<Expense[]>) => {
            state.expenses = action.payload;
        },
        addExpense: (state, action: PayloadAction<Expense>) => {
            state.expenses.unshift(action.payload);
        },
        updateExpense: (state, action: PayloadAction<Expense>) => {
            const index = state.expenses.findIndex(e => e.localId === action.payload.localId);
            if (index !== -1) {
                state.expenses[index] = action.payload;
            }
        },
        removeExpense: (state, action: PayloadAction<string>) => {
            state.expenses = state.expenses.filter(e => e.localId !== action.payload);
        },
        markAsSynced: (state, action: PayloadAction<string>) => {
            const expense = state.expenses.find(e => e.localId === action.payload);
            if (expense) {
                expense.synced = true;
            }
        },
        setLastSynced: (state, action: PayloadAction<string>) => {
            state.lastSynced = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadExpensesFromStorage.pending, (state) => {
                state.loading = true;
            })
            .addCase(loadExpensesFromStorage.fulfilled, (state, action) => {
                state.loading = false;
                state.expenses = action.payload;
            })
            .addCase(loadExpensesFromStorage.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to load expenses';
            })
            .addCase(saveExpenseLocally.fulfilled, (state, action) => {
                state.expenses.unshift(action.payload);
            })
            .addCase(deleteExpenseLocally.fulfilled, (state, action) => {
                state.expenses = state.expenses.filter(e => e.localId !== action.payload);
            });
    },
});

export const {
    setExpenses,
    addExpense,
    updateExpense,
    removeExpense,
    markAsSynced,
    setLastSynced,
    clearError,
} = expenseSlice.actions;

export default expenseSlice.reducer;
