import express from 'express';
import Income, { INCOME_SOURCES } from '../models/income.model.js';
import Expense from '../models/expense.model.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   GET /api/income/sources
// @desc    Get available income sources
// @access  Private
router.get('/sources', (req, res) => {
    res.json({
        success: true,
        sources: INCOME_SOURCES,
    });
});

// @route   GET /api/income
// @desc    Get all income entries for user
// @access  Private
router.get('/', async (req, res) => {
    try {
        const { startDate, endDate, source } = req.query;

        const query = { userId: req.user._id };

        // Date range filter
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Source filter
        if (source) {
            query.source = source;
        }

        const income = await Income.find(query)
            .sort({ date: -1 })
            .limit(500);

        res.json({
            success: true,
            count: income.length,
            data: income,
        });
        console.log('📥 Income fetched for user', req.user._id, ':', income.length, 'entries');
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching income',
            error: error.message,
        });
    }
});

// @route   POST /api/income
// @desc    Create new income entry
// @access  Private
router.post('/', async (req, res) => {
    try {
        const { amount, source, description, date, localId } = req.body;

        const income = await Income.create({
            userId: req.user._id,
            amount,
            source: source || 'Other',
            description,
            date: date || new Date(),
            localId,
        });

        res.status(201).json({
            success: true,
            income,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error creating income',
            error: error.message,
        });
    }
});

// @route   PUT /api/income/:id
// @desc    Update income entry
// @access  Private
router.put('/:id', async (req, res) => {
    try {
        const { amount, source, description, date } = req.body;

        const income = await Income.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { amount, source, description, date },
            { new: true, runValidators: true }
        );

        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Income not found',
            });
        }

        res.json({
            success: true,
            income,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error updating income',
            error: error.message,
        });
    }
});

// @route   DELETE /api/income/:id
// @desc    Delete income entry
// @access  Private
router.delete('/:id', async (req, res) => {
    try {
        const income = await Income.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Income not found',
            });
        }

        res.json({
            success: true,
            message: 'Income deleted',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting income',
            error: error.message,
        });
    }
});

// @route   GET /api/income/summary/monthly
// @desc    Get monthly income summary
// @access  Private
router.get('/summary/monthly', async (req, res) => {
    try {
        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
        const targetYear = year ? parseInt(year) : now.getFullYear();

        const startDate = new Date(targetYear, targetMonth, 1);
        const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

        const income = await Income.find({
            userId: req.user._id,
            date: { $gte: startDate, $lte: endDate },
        });

        const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);

        // Group by source
        const bySource = income.reduce((acc, i) => {
            if (!acc[i.source]) {
                acc[i.source] = 0;
            }
            acc[i.source] += i.amount;
            return acc;
        }, {});

        res.json({
            success: true,
            summary: {
                month: targetMonth + 1,
                year: targetYear,
                totalIncome,
                count: income.length,
                bySource,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching income summary',
            error: error.message,
        });
    }
});

// @route   GET /api/income/balance
// @desc    Get net balance (income - expenses) for a period
// @access  Private
router.get('/balance', async (req, res) => {
    try {
        const { startDate, endDate, month, year } = req.query;

        let dateQuery = {};

        if (startDate && endDate) {
            dateQuery = {
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                },
            };
        } else if (month && year) {
            const targetMonth = parseInt(month) - 1;
            const targetYear = parseInt(year);
            dateQuery = {
                date: {
                    $gte: new Date(targetYear, targetMonth, 1),
                    $lte: new Date(targetYear, targetMonth + 1, 0, 23, 59, 59),
                },
            };
        } else {
            // Default to current month
            const now = new Date();
            dateQuery = {
                date: {
                    $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                    $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
                },
            };
        }

        // Get total income
        const incomeResult = await Income.aggregate([
            { $match: { userId: req.user._id, ...dateQuery } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        // Get total expenses
        const expenseResult = await Expense.aggregate([
            { $match: { userId: req.user._id, ...dateQuery } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);

        const totalIncome = incomeResult[0]?.total || 0;
        const totalExpenses = expenseResult[0]?.total || 0;
        const netBalance = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : 0;

        res.json({
            success: true,
            balance: {
                totalIncome,
                totalExpenses,
                netBalance,
                savingsRate: parseFloat(savingsRate),
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error calculating balance',
            error: error.message,
        });
    }
});

export default router;
