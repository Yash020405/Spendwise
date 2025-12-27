import AsyncStorage from '@react-native-async-storage/async-storage';

interface BudgetStatus {
    budget: number;
    spent: number;
    remaining: number;
    percentUsed: number;
    isOverBudget: boolean;
    warningLevel: 'safe' | 'warning' | 'danger' | 'exceeded';
}

// Get currency symbol from user data
export const getCurrencySymbol = async (): Promise<string> => {
    try {
        const userData = await AsyncStorage.getItem('@user');
        if (userData) {
            const user = JSON.parse(userData);
            return user.currencySymbol || '₹';
        }
    } catch (e) {
        console.error('Failed to get currency symbol:', e);
    }
    return '₹';
};

// Get monthly budget from user data
export const getMonthlyBudget = async (): Promise<number> => {
    try {
        const userData = await AsyncStorage.getItem('@user');
        if (userData) {
            const user = JSON.parse(userData);
            return user.monthlyBudget || 0;
        }
    } catch (e) {
        console.error('Failed to get budget:', e);
    }
    return 0;
};

// Calculate current month's spending
export const calculateMonthlySpending = (expenses: any[]): number => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return expenses
        .filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate >= startOfMonth && expenseDate.getFullYear() === now.getFullYear() && expenseDate.getMonth() === now.getMonth();
        })
        .reduce((sum, e) => sum + (e.amount || 0), 0);
};

// Get budget status
export const getBudgetStatus = async (expenses: any[]): Promise<BudgetStatus> => {
    const budget = await getMonthlyBudget();
    const spent = calculateMonthlySpending(expenses);
    const remaining = Math.max(0, budget - spent);
    const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;

    let warningLevel: BudgetStatus['warningLevel'] = 'safe';
    if (percentUsed >= 100) {
        warningLevel = 'exceeded';
    } else if (percentUsed >= 90) {
        warningLevel = 'danger';
    } else if (percentUsed >= 75) {
        warningLevel = 'warning';
    }

    return {
        budget,
        spent,
        remaining,
        percentUsed,
        isOverBudget: spent > budget && budget > 0,
        warningLevel,
    };
};

// Get budget warning message based on current spending
export const getBudgetWarning = async (expenses: any[]): Promise<string | null> => {
    const budget = await getMonthlyBudget();

    if (budget <= 0) {
        return null;
    }

    const currencySymbol = await getCurrencySymbol();
    const spent = calculateMonthlySpending(expenses);
    const percent = (spent / budget) * 100;

    if (spent > budget) {
        const overBy = spent - budget;
        return `Budget Exceeded: You are over by ${currencySymbol}${overBy.toFixed(0)}`;
    } else if (percent >= 90) {
        return `Budget Alert: You have used ${percent.toFixed(0)}% of your monthly budget`;
    } else if (percent >= 75) {
        return `Budget Notice: You have used ${percent.toFixed(0)}% of your monthly budget`;
    }

    return null;
};

// Check if adding new expense would exceed budget  
export const checkBudgetAfterExpense = async (
    currentExpenses: any[],
    newExpenseAmount: number
): Promise<{
    willExceed: boolean;
    newTotal: number;
    budget: number;
    message: string | null;
}> => {
    const budget = await getMonthlyBudget();

    if (budget <= 0) {
        return { willExceed: false, newTotal: 0, budget: 0, message: null };
    }

    const currencySymbol = await getCurrencySymbol();
    const currentSpent = calculateMonthlySpending(currentExpenses);
    const newTotal = currentSpent + newExpenseAmount;

    const percentAfter = (newTotal / budget) * 100;
    const percentBefore = (currentSpent / budget) * 100;

    let message: string | null = null;

    // Check if we just exceeded the budget
    if (newTotal > budget && currentSpent <= budget) {
        const overBy = newTotal - budget;
        message = `Budget Exceeded: You are now over by ${currencySymbol}${overBy.toFixed(0)}`;
    }
    // Check if we crossed 90% threshold
    else if (percentAfter >= 90 && percentBefore < 90) {
        message = `Budget Alert: You have used ${percentAfter.toFixed(0)}% of your monthly budget`;
    }
    // Check if we crossed 75% threshold
    else if (percentAfter >= 75 && percentBefore < 75) {
        message = `Budget Notice: You have used ${percentAfter.toFixed(0)}% of your monthly budget`;
    }
    // If already over budget, show how much over
    else if (newTotal > budget) {
        const overBy = newTotal - budget;
        message = `Over Budget: ${currencySymbol}${overBy.toFixed(0)}`;
    }

    return {
        willExceed: newTotal > budget,
        newTotal,
        budget,
        message,
    };
};

// Get formatted budget message for display
export const getBudgetMessage = (status: BudgetStatus, currencySymbol: string = '₹'): string => {
    if (status.budget <= 0) {
        return 'No budget set';
    }

    if (status.isOverBudget) {
        const over = status.spent - status.budget;
        return `Over budget by ${currencySymbol}${over.toFixed(0)}`;
    }

    return `${currencySymbol}${status.remaining.toFixed(0)} remaining`;
};
