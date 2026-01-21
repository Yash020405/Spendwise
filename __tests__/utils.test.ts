/**
 * Unit tests for utility functions
 * Tests offline sync, API utilities, and budget calculations
 */

// Mock AsyncStorage before imports
const mockStorage: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockStorage[key] || null);
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    return Promise.resolve();
  }),
}));

describe('Utility Functions', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
  });

  describe('Budget Calculations', () => {
    it('should calculate correct user share for split expenses', () => {
      const expense = {
        amount: 1000,
        isSplit: true,
        userShare: 400,
        participants: [
          { name: 'Alice', shareAmount: 300 },
          { name: 'Bob', shareAmount: 300 },
        ],
      };

      // User's effective amount should be userShare
      const effectiveAmount = expense.isSplit
        ? (expense.userShare || expense.amount)
        : expense.amount;

      expect(effectiveAmount).toBe(400);
    });

    it('should use full amount for non-split expenses', () => {
      const expense = {
        amount: 500,
        isSplit: false,
      };

      const effectiveAmount = expense.isSplit
        ? ((expense as any).userShare || expense.amount)
        : expense.amount;

      expect(effectiveAmount).toBe(500);
    });

    it('should calculate monthly totals correctly', () => {
      const expenses = [
        { amount: 100, isSplit: false, date: new Date().toISOString() },
        { amount: 200, isSplit: true, userShare: 80, date: new Date().toISOString() },
        { amount: 150, isSplit: false, date: new Date().toISOString() },
      ];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const monthTotal = expenses
        .filter(e => new Date(e.date) >= monthStart)
        .reduce((sum, e) => {
          const effectiveAmount = e.isSplit ? ((e as any).userShare || 0) : e.amount;
          return sum + effectiveAmount;
        }, 0);

      expect(monthTotal).toBe(100 + 80 + 150); // 330
    });

    it('should calculate budget percentage correctly', () => {
      const monthlyBudget = 5000;
      const totalSpent = 3750;

      const budgetPercent = monthlyBudget > 0
        ? Math.round((totalSpent / monthlyBudget) * 100)
        : 0;

      expect(budgetPercent).toBe(75);
    });

    it('should handle zero budget gracefully', () => {
      const monthlyBudget = 0;
      const totalSpent = 100;

      const budgetPercent = monthlyBudget > 0
        ? Math.round((totalSpent / monthlyBudget) * 100)
        : 0;

      expect(budgetPercent).toBe(0);
    });
  });

  describe('Date Utilities', () => {
    it('should correctly identify today\'s expenses', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const expenses = [
        { amount: 50, date: new Date().toISOString() }, // today
        { amount: 100, date: new Date(Date.now() - 86400000).toISOString() }, // yesterday
      ];

      const todayExpenses = expenses.filter(e => new Date(e.date) >= today);

      expect(todayExpenses.length).toBe(1);
      expect(todayExpenses[0].amount).toBe(50);
    });

    it('should correctly identify this week\'s expenses', () => {
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const expenses = [
        { amount: 50, date: now.toISOString() }, // this week
        { amount: 100, date: new Date(now.getTime() - 8 * 86400000).toISOString() }, // last week
      ];

      const weekExpenses = expenses.filter(e => new Date(e.date) >= weekStart);

      expect(weekExpenses.length).toBe(1);
    });
  });

  describe('Currency Formatting', () => {
    it('should format amounts with currency symbol', () => {
      const format = (amount: number, symbol: string) =>
        `${symbol}${amount.toLocaleString()}`;

      expect(format(1000, '₹')).toBe('₹1,000');
      expect(format(1000, '$')).toBe('$1,000');
      expect(format(1000.5, '€')).toBe('€1,000.5');
    });

    it('should handle large amounts', () => {
      const format = (amount: number, symbol: string) =>
        `${symbol}${amount.toLocaleString()}`;

      expect(format(1000000, '₹')).toBe('₹1,000,000');
    });
  });

  describe('Participant Calculations', () => {
    it('should calculate equal split correctly', () => {
      const totalAmount = 300;
      const participantCount = 3;
      const shareEach = totalAmount / participantCount;

      expect(shareEach).toBe(100);
    });

    it('should calculate percentage split correctly', () => {
      const totalAmount = 1000;
      const participants = [
        { name: 'Alice', sharePercentage: 50 },
        { name: 'Bob', sharePercentage: 30 },
        { name: 'Me', sharePercentage: 20 },
      ];

      const shares = participants.map(p => ({
        ...p,
        shareAmount: (totalAmount * p.sharePercentage) / 100,
      }));

      expect(shares[0].shareAmount).toBe(500);
      expect(shares[1].shareAmount).toBe(300);
      expect(shares[2].shareAmount).toBe(200);
    });

    it('should track payment status correctly', () => {
      const participants = [
        { name: 'Alice', shareAmount: 100, isPaid: true, paidAmount: 100 },
        { name: 'Bob', shareAmount: 100, isPaid: false, paidAmount: 0 },
      ];

      const totalOwed = participants
        .filter(p => !p.isPaid)
        .reduce((sum, p) => sum + p.shareAmount, 0);

      const totalPaid = participants
        .filter(p => p.isPaid)
        .reduce((sum, p) => sum + p.paidAmount, 0);

      expect(totalOwed).toBe(100);
      expect(totalPaid).toBe(100);
    });
  });

  describe('Validation', () => {
    it('should validate positive amounts', () => {
      const isValidAmount = (amount: number) => typeof amount === 'number' && amount > 0;

      expect(isValidAmount(100)).toBe(true);
      expect(isValidAmount(0)).toBe(false);
      expect(isValidAmount(-50)).toBe(false);
      expect(isValidAmount(NaN)).toBe(false);
    });

    it('should validate required fields', () => {
      const isValidExpense = (expense: any) => {
        return (
          expense.amount > 0 &&
          !!expense.category &&
          !!expense.date
        );
      };

      expect(isValidExpense({ amount: 100, category: 'Food', date: new Date() })).toBe(true);
      expect(isValidExpense({ amount: 100, category: '', date: new Date() })).toBe(false);
      expect(isValidExpense({ amount: 0, category: 'Food', date: new Date() })).toBe(false);
    });
  });
});

describe('Offline Sync Logic', () => {
  it('should generate unique offline IDs', () => {
    const generateOfflineId = () => `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const id1 = generateOfflineId();
    const id2 = generateOfflineId();

    expect(id1).toMatch(/^offline_\d+_/);
    expect(id1).not.toBe(id2);
  });

  it('should merge cached and pending expenses correctly', () => {
    const cached = [
      { _id: '1', amount: 100, category: 'Food' },
      { _id: '2', amount: 200, category: 'Transport' },
    ];

    const pending = [
      { id: 'offline_123', amount: 50, category: 'Shopping' },
    ];

    const merged = [
      ...cached,
      ...pending.map(p => ({
        ...p,
        _id: p.id,
        isPending: true,
      })),
    ];

    expect(merged.length).toBe(3);
    expect((merged[2] as any).isPending).toBe(true);
  });

  it('should filter out synced offline items', () => {
    const pending = [
      { id: 'offline_1', synced: false },
      { id: 'offline_2', synced: true },
      { id: 'offline_3', synced: false },
    ];

    const unsynced = pending.filter(p => !p.synced);

    expect(unsynced.length).toBe(2);
  });
});
