import express from 'express';
import Expense from '../models/expense.model.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Create expense
router.post('/', async (req, res) => {
    try {
        const { amount, category, categoryIcon, paymentMethod, description, date, localId } = req.body;

        const expense = await Expense.create({
            userId: req.user._id,
            amount,
            category,
            categoryIcon,
            paymentMethod,
            description,
            date: date || new Date(),
            localId,
            synced: true,
        });

        res.status(201).json({
            success: true,
            data: expense,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get all expenses with filters
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, category, paymentMethod, page = 1, limit = 50 } = req.query;

        const query = { userId: req.user._id };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        if (category) query.category = category;
        if (paymentMethod) query.paymentMethod = paymentMethod;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const expenses = await Expense.find(query)
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Expense.countDocuments(query);

        res.json({
            success: true,
            data: expenses,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get single expense
router.get('/:id', async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        res.json({
            success: true,
            data: expense,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Update expense
router.put('/:id', async (req, res) => {
    try {
        const { amount, category, categoryIcon, paymentMethod, description, date } = req.body;

        const expense = await Expense.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { amount, category, categoryIcon, paymentMethod, description, date },
            { new: true, runValidators: true }
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        res.json({
            success: true,
            data: expense,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Delete expense
router.delete('/:id', async (req, res) => {
    try {
        const expense = await Expense.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        res.json({
            success: true,
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Sync offline expenses
router.post('/sync', async (req, res) => {
    try {
        const { expenses } = req.body;

        if (!Array.isArray(expenses)) {
            return res.status(400).json({
                success: false,
                message: 'Expenses must be an array',
            });
        }

        const results = [];

        for (const exp of expenses) {
            // Check if expense with localId already exists
            const existing = await Expense.findOne({
                userId: req.user._id,
                localId: exp.localId,
            });

            if (existing) {
                results.push({ localId: exp.localId, status: 'exists', data: existing });
            } else {
                const newExpense = await Expense.create({
                    ...exp,
                    userId: req.user._id,
                    synced: true,
                });
                results.push({ localId: exp.localId, status: 'created', data: newExpense });
            }
        }

        res.json({
            success: true,
            data: results,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get daily summary
router.get('/summary/daily', async (req, res) => {
    try {
        const { date } = req.query;
        const targetDate = date ? new Date(date) : new Date();

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        const summary = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startOfDay, $lte: endOfDay },
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        const totalSpent = summary.reduce((acc, item) => acc + item.total, 0);

        res.json({
            success: true,
            data: {
                date: targetDate.toISOString().split('T')[0],
                totalSpent,
                byCategory: summary,
            },
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get monthly summary
router.get('/summary/monthly', async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        const summary = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Daily breakdown
        const dailyBreakdown = await Expense.aggregate([
            {
                $match: {
                    userId: req.user._id,
                    date: { $gte: startDate, $lte: endDate },
                },
            },
            {
                $group: {
                    _id: { $dayOfMonth: '$date' },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        const totalSpent = summary.reduce((acc, item) => acc + item.total, 0);
        const avgDaily = totalSpent / endDate.getDate();

        res.json({
            success: true,
            data: {
                month: targetMonth,
                year: targetYear,
                totalSpent,
                avgDaily: Math.round(avgDaily * 100) / 100,
                byCategory: summary,
                dailyBreakdown,
            },
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get category breakdown
router.get('/summary/category', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const query = { userId: req.user._id };

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        const breakdown = await Expense.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$category',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    avgAmount: { $avg: '$amount' },
                },
            },
            { $sort: { total: -1 } },
        ]);

        const totalSpent = breakdown.reduce((acc, item) => acc + item.total, 0);

        // Add percentage to each category
        const breakdownWithPercentage = breakdown.map(item => ({
            ...item,
            percentage: totalSpent > 0 ? Math.round((item.total / totalSpent) * 100) : 0,
        }));

        res.json({
            success: true,
            data: {
                totalSpent,
                breakdown: breakdownWithPercentage,
            },
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Compare months
router.get('/compare', async (req, res) => {
    try {
        const { months, year } = req.query;

        if (!months) {
            return res.status(400).json({
                success: false,
                message: 'Please provide months to compare (e.g., months=1,2)',
            });
        }

        const monthsArray = months.split(',').map(m => parseInt(m.trim()));
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const comparisons = [];

        for (const month of monthsArray) {
            const startDate = new Date(targetYear, month - 1, 1);
            const endDate = new Date(targetYear, month, 0, 23, 59, 59, 999);

            const summary = await Expense.aggregate([
                {
                    $match: {
                        userId: req.user._id,
                        date: { $gte: startDate, $lte: endDate },
                    },
                },
                {
                    $group: {
                        _id: '$category',
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
            ]);

            const total = summary.reduce((acc, item) => acc + item.total, 0);

            comparisons.push({
                month,
                year: targetYear,
                total,
                byCategory: summary,
            });
        }

        // Calculate changes between consecutive months
        const changes = [];
        for (let i = 1; i < comparisons.length; i++) {
            const prev = comparisons[i - 1];
            const curr = comparisons[i];
            const change = curr.total - prev.total;
            const changePercent = prev.total > 0 ? Math.round((change / prev.total) * 100) : 0;

            changes.push({
                from: { month: prev.month, year: prev.year },
                to: { month: curr.month, year: curr.year },
                change,
                changePercent,
            });
        }

        res.json({
            success: true,
            data: {
                comparisons,
                changes,
            },
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get spending insights
router.get('/insights', async (req, res) => {
    try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        // Current month data
        const currentStart = new Date(currentYear, currentMonth - 1, 1);
        const currentEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

        // Last month data
        const lastStart = new Date(lastMonthYear, lastMonth - 1, 1);
        const lastEnd = new Date(lastMonthYear, lastMonth, 0, 23, 59, 59, 999);

        const [currentData, lastData] = await Promise.all([
            Expense.aggregate([
                { $match: { userId: req.user._id, date: { $gte: currentStart, $lte: currentEnd } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]),
            Expense.aggregate([
                { $match: { userId: req.user._id, date: { $gte: lastStart, $lte: lastEnd } } },
                { $group: { _id: '$category', total: { $sum: '$amount' } } },
            ]),
        ]);

        const currentTotal = currentData.reduce((acc, item) => acc + item.total, 0);
        const lastTotal = lastData.reduce((acc, item) => acc + item.total, 0);

        const insights = [];

        // Overall spending change
        if (lastTotal > 0) {
            const overallChange = Math.round(((currentTotal - lastTotal) / lastTotal) * 100);
            if (overallChange > 0) {
                insights.push({
                    type: 'warning',
                    message: `You've spent ${overallChange}% more this month compared to last month`,
                    icon: 'trending-up',
                });
            } else if (overallChange < 0) {
                insights.push({
                    type: 'success',
                    message: `Great! You've spent ${Math.abs(overallChange)}% less this month`,
                    icon: 'trending-down',
                });
            }
        }

        // Category-wise insights
        const currentByCategory = {};
        const lastByCategory = {};

        currentData.forEach(item => { currentByCategory[item._id] = item.total; });
        lastData.forEach(item => { lastByCategory[item._id] = item.total; });

        for (const category of Object.keys(currentByCategory)) {
            const current = currentByCategory[category] || 0;
            const last = lastByCategory[category] || 0;

            if (last > 0) {
                const change = Math.round(((current - last) / last) * 100);
                if (change > 20) {
                    insights.push({
                        type: 'warning',
                        message: `You spent ${change}% more on ${category} this month`,
                        category,
                        icon: 'alert-circle',
                    });
                }
            }
        }

        // Top spending category
        const topCategory = currentData.sort((a, b) => b.total - a.total)[0];
        if (topCategory) {
            insights.push({
                type: 'info',
                message: `${topCategory._id} is your highest expense category this month`,
                category: topCategory._id,
                icon: 'pie-chart',
            });
        }

        res.json({
            success: true,
            data: {
                currentMonth: { month: currentMonth, year: currentYear, total: currentTotal },
                lastMonth: { month: lastMonth, year: lastMonthYear, total: lastTotal },
                insights,
            },
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;
