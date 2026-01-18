import { configureStore } from '@reduxjs/toolkit';
import expenseReducer from './expenseSlice';
import authReducer from './authSlice';
import incomeReducer from './incomeSlice';

export const store = configureStore({
    reducer: {
        expenses: expenseReducer,
        auth: authReducer,
        income: incomeReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: ['expenses/saveLocally/fulfilled', 'income/saveLocally/fulfilled'],
            },
        }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

