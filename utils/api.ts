// API Configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

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
}

export const api = new ApiService(API_BASE_URL);
export default api;
