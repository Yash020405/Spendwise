import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export interface Income {
    _id?: string;
    localId: string;
    userId?: string;
    amount: number;
    source: string;
    description?: string;
    date: string;
    isRecurring?: boolean;
    synced: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface IncomeSource {
    name: string;
    icon: string;
    color: string;
}

export interface BalanceSummary {
    totalIncome: number;
    totalExpenses: number;
    netBalance: number;
    savingsRate: number;
}

export interface IncomeState {
    income: Income[];
    sources: IncomeSource[];
    balance: BalanceSummary | null;
    loading: boolean;
    error: string | null;
    lastSynced: string | null;
}

const initialState: IncomeState = {
    income: [],
    sources: [
        { name: 'Salary', icon: 'payments', color: '#10B981' },
        { name: 'Freelance', icon: 'laptop', color: '#3B82F6' },
        { name: 'Investment', icon: 'trending-up', color: '#8B5CF6' },
        { name: 'Gift', icon: 'card-giftcard', color: '#EC4899' },
        { name: 'Refund', icon: 'replay', color: '#F59E0B' },
        { name: 'Other', icon: 'attach-money', color: '#6B7280' },
    ],
    balance: null,
    loading: false,
    error: null,
    lastSynced: null,
};

// Async thunks
export const loadIncomeFromStorage = createAsyncThunk(
    'income/loadFromStorage',
    async () => {
        const stored = await AsyncStorage.getItem('@income');
        return stored ? JSON.parse(stored) : [];
    }
);

export const saveIncomeLocally = createAsyncThunk(
    'income/saveLocally',
    async (incomeData: Omit<Income, 'localId' | 'synced'>, { getState }) => {
        const newIncome: Income = {
            ...incomeData,
            localId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            synced: false,
        };

        const state = getState() as { income: IncomeState };
        const updatedIncome = [newIncome, ...state.income.income];
        await AsyncStorage.setItem('@income', JSON.stringify(updatedIncome));

        return newIncome;
    }
);

export const deleteIncomeLocally = createAsyncThunk(
    'income/deleteLocally',
    async (localId: string, { getState }) => {
        const state = getState() as { income: IncomeState };
        const updatedIncome = state.income.income.filter(i => i.localId !== localId);
        await AsyncStorage.setItem('@income', JSON.stringify(updatedIncome));
        return localId;
    }
);

const incomeSlice = createSlice({
    name: 'income',
    initialState,
    reducers: {
        setIncome: (state, action: PayloadAction<Income[]>) => {
            state.income = action.payload;
        },
        addIncome: (state, action: PayloadAction<Income>) => {
            state.income.unshift(action.payload);
        },
        updateIncome: (state, action: PayloadAction<Income>) => {
            const index = state.income.findIndex(i => i.localId === action.payload.localId);
            if (index !== -1) {
                state.income[index] = action.payload;
            }
        },
        removeIncome: (state, action: PayloadAction<string>) => {
            state.income = state.income.filter(i => i.localId !== action.payload);
        },
        setBalance: (state, action: PayloadAction<BalanceSummary>) => {
            state.balance = action.payload;
        },
        setSources: (state, action: PayloadAction<IncomeSource[]>) => {
            state.sources = action.payload;
        },
        markAsSynced: (state, action: PayloadAction<string>) => {
            const income = state.income.find(i => i.localId === action.payload);
            if (income) {
                income.synced = true;
            }
        },
        setLastSynced: (state, action: PayloadAction<string>) => {
            state.lastSynced = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadIncomeFromStorage.pending, (state) => {
                state.loading = true;
            })
            .addCase(loadIncomeFromStorage.fulfilled, (state, action) => {
                state.loading = false;
                state.income = action.payload;
            })
            .addCase(loadIncomeFromStorage.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to load income';
            })
            .addCase(saveIncomeLocally.fulfilled, (state, action) => {
                state.income.unshift(action.payload);
            })
            .addCase(deleteIncomeLocally.fulfilled, (state, action) => {
                state.income = state.income.filter(i => i.localId !== action.payload);
            });
    },
});

export const {
    setIncome,
    addIncome,
    updateIncome,
    removeIncome,
    setBalance,
    setSources,
    markAsSynced,
    setLastSynced,
    setLoading,
    setError,
    clearError,
} = incomeSlice.actions;

export default incomeSlice.reducer;
