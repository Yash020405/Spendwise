import express from 'express';
import Budget from '../models/budget.model.js';
import Expense from '../models/expense.model.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Create or update budget
router.post('/', async (req, res) => {
    try {
        const { category, amount, month, year } = req.body;

        const targetMonth = month || new Date().getMonth() + 1;
        const targetYear = year || new Date().getFullYear();

        // Upsert budget
        const budget = await Budget.findOneAndUpdate(
            {
                userId: req.user._id,
                category: category || null,
                month: targetMonth,
                year: targetYear,
            },
            { amount },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(201).json({
            success: true,
            data: budget,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get budgets for month
router.get('/', async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const budgets = await Budget.find({
            userId: req.user._id,
            month: targetMonth,
            year: targetYear,
        });

        res.json({
            success: true,
            data: budgets,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Update budget
router.put('/:id', async (req, res) => {
    try {
        const { amount } = req.body;

        const budget = await Budget.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { amount },
            { new: true, runValidators: true }
        );

        if (!budget) {
            return res.status(404).json({
                success: false,
                message: 'Budget not found',
            });
        }

        res.json({
            success: true,
            data: budget,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Delete budget
router.delete('/:id', async (req, res) => {
    try {
        const budget = await Budget.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!budget) {
            return res.status(404).json({
                success: false,
                message: 'Budget not found',
            });
        }

        res.json({
            success: true,
            message: 'Budget deleted successfully',
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get budget status (budget vs actual spending)
router.get('/status', async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        // Get budgets
        const budgets = await Budget.find({
            userId: req.user._id,
            month: targetMonth,
            year: targetYear,
        });

        // Get actual spending
        const startDate = new Date(targetYear, targetMonth - 1, 1);
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        const spending = await Expense.aggregate([
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
                },
            },
        ]);

        const totalSpent = spending.reduce((acc, item) => acc + item.total, 0);

        // Build status for each budget
        const status = budgets.map(budget => {
            const categorySpending = budget.category === null
                ? totalSpent
                : (spending.find(s => s._id === budget.category)?.total || 0);

            const percentage = budget.amount > 0
                ? Math.round((categorySpending / budget.amount) * 100)
                : 0;

            const remaining = budget.amount - categorySpending;

            return {
                budget: budget,
                spent: categorySpending,
                remaining,
                percentage,
                status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok',
            };
        });

        res.json({
            success: true,
            data: {
                month: targetMonth,
                year: targetYear,
                totalSpent,
                budgetStatus: status,
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
