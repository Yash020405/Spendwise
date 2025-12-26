import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
    id: string;
    name: string;
    email: string;
    currency: string;
    currencySymbol: string;
    monthlyBudget: number;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}

const initialState: AuthState = {
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    error: null,
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (
            state,
            action: PayloadAction<{ user: User; token: string }>
        ) => {
            state.user = action.payload.user;
            state.token = action.payload.token;
            state.isAuthenticated = true;
            state.error = null;
            // Persist token
            AsyncStorage.setItem('@auth_token', action.payload.token);
            AsyncStorage.setItem('@user', JSON.stringify(action.payload.user));
        },
        updateUser: (state, action: PayloadAction<Partial<User>>) => {
            if (state.user) {
                state.user = { ...state.user, ...action.payload };
                AsyncStorage.setItem('@user', JSON.stringify(state.user));
            }
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.isAuthenticated = false;
            AsyncStorage.removeItem('@auth_token');
            AsyncStorage.removeItem('@user');
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
        restoreAuth: (
            state,
            action: PayloadAction<{ user: User; token: string } | null>
        ) => {
            if (action.payload) {
                state.user = action.payload.user;
                state.token = action.payload.token;
                state.isAuthenticated = true;
            }
        },
    },
});

export const {
    setCredentials,
    updateUser,
    logout,
    setLoading,
    setError,
    restoreAuth,
} = authSlice.actions;

export default authSlice.reducer;
