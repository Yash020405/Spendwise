import { configureStore } from '@reduxjs/toolkit';
import expenseReducer from './expenseSlice';
import authReducer from './authSlice';

export const store = configureStore({
    reducer: {
        expenses: expenseReducer,
        auth: authReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore these action types
                ignoredActions: ['expenses/saveLocally/fulfilled'],
            },
        }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
