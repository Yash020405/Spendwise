// API Configuration - Auto-detect the correct URL
import Constants from 'expo-constants';

const getApiUrl = () => {
    // Auto-detect from Expo dev server FIRST
    const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
    if (debuggerHost) {
        const host = debuggerHost.split(':')[0];
        return `http://${host}:3000/api`;
    }

    // Fallback to env or localhost
    return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
};

const API_BASE_URL = getApiUrl();
console.log('[API] Using URL:', API_BASE_URL);

interface RequestConfig {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    token?: string;
}

class ApiService {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
        const { method = 'GET', body, token } = config;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }

        return data;
    }

    // Auth endpoints
    async login(email: string, password: string) {
        return this.request('/auth/login', {
            method: 'POST',
            body: { email, password },
        });
    }

    async signup(name: string, email: string, password: string, currency?: string) {
        return this.request('/auth/signup', {
            method: 'POST',
            body: { name, email, password, currency },
        });
    }

    async getProfile(token: string) {
        return this.request('/auth/me', { token });
    }

    async updateProfile(token: string, data: { name?: string; currency?: string; monthlyBudget?: number }) {
        return this.request('/auth/me', {
            method: 'PUT',
            token,
            body: data,
        });
    }

    // Expense endpoints
    async getExpenses(token: string, params?: { startDate?: string; endDate?: string; category?: string }) {
        let query = '';
        if (params) {
            const searchParams = new URLSearchParams();
            if (params.startDate) searchParams.append('startDate', params.startDate);
            if (params.endDate) searchParams.append('endDate', params.endDate);
            if (params.category) searchParams.append('category', params.category);
            query = `?${searchParams.toString()}`;
        }
        return this.request(`/expenses${query}`, { token });
    }

    async createExpense(token: string, expense: any) {
        return this.request('/expenses', {
            method: 'POST',
            token,
            body: expense,
        });
    }

    async updateExpense(token: string, id: string, expense: any) {
        return this.request(`/expenses/${id}`, {
            method: 'PUT',
            token,
            body: expense,
        });
    }

    async deleteExpense(token: string, id: string) {
        return this.request(`/expenses/${id}`, {
            method: 'DELETE',
            token,
        });
    }

    async syncExpenses(token: string, expenses: any[]) {
        return this.request('/expenses/sync', {
            method: 'POST',
            token,
            body: { expenses },
        });
    }

    async getDailySummary(token: string, date?: string) {
        const query = date ? `?date=${date}` : '';
        return this.request(`/expenses/summary/daily${query}`, { token });
    }

    async getMonthlySummary(token: string, month?: number, year?: number) {
        const params = new URLSearchParams();
        if (month) params.append('month', month.toString());
        if (year) params.append('year', year.toString());
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/expenses/summary/monthly${query}`, { token });
    }

    async getCategorySummary(token: string, startDate?: string, endDate?: string) {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/expenses/summary/category${query}`, { token });
    }

    async compareMonths(token: string, months: number[], year?: number) {
        const params = new URLSearchParams();
        params.append('months', months.join(','));
        if (year) params.append('year', year.toString());
        return this.request(`/expenses/compare?${params.toString()}`, { token });
    }

    async getInsights(token: string) {
        return this.request('/expenses/insights', { token });
    }

    // Category endpoints
    async getCategories(token: string) {
        return this.request('/categories', { token });
    }

    async createCategory(token: string, category: { name: string; icon: string; color: string }) {
        return this.request('/categories', {
            method: 'POST',
            token,
            body: category,
        });
    }

    async updateCategory(token: string, id: string, category: { name?: string; icon?: string; color?: string }) {
        return this.request(`/categories/${id}`, {
            method: 'PUT',
            token,
            body: category,
        });
    }

    async deleteCategory(token: string, id: string) {
        return this.request(`/categories/${id}`, {
            method: 'DELETE',
            token,
        });
    }

    async getCategoryIcons() {
        return this.request('/categories/icons');
    }

    // Budget endpoints
    async getBudgets(token: string, month?: number, year?: number) {
        const params = new URLSearchParams();
        if (month) params.append('month', month.toString());
        if (year) params.append('year', year.toString());
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/budgets${query}`, { token });
    }

    async setBudget(token: string, budget: { category?: string; amount: number; month?: number; year?: number }) {
        return this.request('/budgets', {
            method: 'POST',
            token,
            body: budget,
        });
    }

    async getBudgetStatus(token: string, month?: number, year?: number) {
        const params = new URLSearchParams();
        if (month) params.append('month', month.toString());
        if (year) params.append('year', year.toString());
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/budgets/status${query}`, { token });
    }

    // Income endpoints
    async getIncomeSources(token: string) {
        return this.request('/income/sources', { token });
    }

    async getIncome(token: string, params?: { startDate?: string; endDate?: string; source?: string }) {
        let query = '';
        if (params) {
            const searchParams = new URLSearchParams();
            if (params.startDate) searchParams.append('startDate', params.startDate);
            if (params.endDate) searchParams.append('endDate', params.endDate);
            if (params.source) searchParams.append('source', params.source);
            query = `?${searchParams.toString()}`;
        }
        return this.request(`/income${query}`, { token });
    }

    async createIncome(token: string, income: { amount: number; source: string; description?: string; date?: string }) {
        return this.request('/income', {
            method: 'POST',
            token,
            body: income,
        });
    }

    async updateIncome(token: string, id: string, income: any) {
        return this.request(`/income/${id}`, {
            method: 'PUT',
            token,
            body: income,
        });
    }

    async deleteIncome(token: string, id: string) {
        return this.request(`/income/${id}`, {
            method: 'DELETE',
            token,
        });
    }

    async getIncomeSummary(token: string, month?: number, year?: number) {
        const params = new URLSearchParams();
        if (month) params.append('month', month.toString());
        if (year) params.append('year', year.toString());
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/income/summary/monthly${query}`, { token });
    }

    async getBalance(token: string, params?: { month?: number; year?: number; startDate?: string; endDate?: string }) {
        const searchParams = new URLSearchParams();
        if (params?.month) searchParams.append('month', params.month.toString());
        if (params?.year) searchParams.append('year', params.year.toString());
        if (params?.startDate) searchParams.append('startDate', params.startDate);
        if (params?.endDate) searchParams.append('endDate', params.endDate);
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return this.request(`/income/balance${query}`, { token });
    }

    // Recurring transaction endpoints
    async getRecurring(token: string, params?: { type?: string; isActive?: boolean }) {
        const searchParams = new URLSearchParams();
        if (params?.type) searchParams.append('type', params.type);
        if (params?.isActive !== undefined) searchParams.append('isActive', params.isActive.toString());
        const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
        return this.request(`/recurring${query}`, { token });
    }

    async createRecurring(token: string, recurring: {
        type: 'expense' | 'income';
        amount: number;
        category?: string;
        source?: string;
        paymentMethod?: string;
        description?: string;
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
        dayOfMonth?: number;
        startDate?: string;
        endDate?: string;
    }) {
        return this.request('/recurring', {
            method: 'POST',
            token,
            body: recurring,
        });
    }

    async updateRecurring(token: string, id: string, recurring: any) {
        return this.request(`/recurring/${id}`, {
            method: 'PUT',
            token,
            body: recurring,
        });
    }

    async deleteRecurring(token: string, id: string) {
        return this.request(`/recurring/${id}`, {
            method: 'DELETE',
            token,
        });
    }

    async toggleRecurring(token: string, id: string) {
        return this.request(`/recurring/${id}/toggle`, {
            method: 'POST',
            token,
        });
    }

    async generateRecurring(token: string, id: string) {
        return this.request(`/recurring/${id}/generate`, {
            method: 'POST',
            token,
        });
    }

    async processRecurring(token: string) {
        return this.request('/recurring/process', {
            method: 'POST',
            token,
        });
    }

    // AI Insights endpoints
    async getAIInsights(token: string, timeRange: 'week' | 'month' | 'year' = 'month', month?: number, year?: number) {
        return this.request('/ai/insights', {
            method: 'POST',
            token,
            body: { timeRange, month, year },
        });
    }

    // Split expense endpoints
    async updateParticipantPayment(token: string, expenseId: string, participantId: string, data: { isPaid: boolean; paidAmount?: number }) {
        return this.request(`/expenses/${expenseId}/participants/${participantId}/payment`, {
            method: 'PUT',
            token,
            body: data,
        });
    }

    async getSplitBalances(token: string) {
        return this.request('/expenses/split/balances', { token });
    }
}

export const api = new ApiService(API_BASE_URL);
export default api;
