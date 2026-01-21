import express from 'express';
import Expense from '../models/expense.model.js';
import Income from '../models/income.model.js';
import { protect } from '../middleware/auth.middleware.js';
import { sanitizeString, sanitizeQueryParams } from '../utils/sanitize.js';

const router = express.Router();

// All routes are protected
router.use(protect);

/**
 * GET /api/export/csv
 * Export expenses and income as CSV
 * Query params: startDate, endDate, type (expenses|income|all)
 */
router.get('/csv', async (req, res) => {
    try {
        const sanitizedParams = sanitizeQueryParams(req.query);
        const { startDate, endDate, type = 'all' } = sanitizedParams;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide startDate and endDate',
            });
        }

        const sanitizedType = sanitizeString(type);
        const dateQuery = {
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
        };

        let csvContent = '';
        const results = { expenses: [], income: [] };

        // Fetch expenses
        if (sanitizedType === 'all' || sanitizedType === 'expenses') {
            results.expenses = await Expense.find({
                userId: req.user._id,
                ...dateQuery,
            }).sort({ date: -1 });
        }

        // Fetch income
        if (sanitizedType === 'all' || sanitizedType === 'income') {
            results.income = await Income.find({
                userId: req.user._id,
                ...dateQuery,
            }).sort({ date: -1 });
        }

        // Build CSV for expenses
        if (results.expenses.length > 0) {
            csvContent += 'EXPENSES\n';
            csvContent += 'Date,Category,Description,Amount,Payment Method\n';
            for (const exp of results.expenses) {
                const date = new Date(exp.date).toLocaleDateString('en-IN');
                const description = (exp.description || '').replace(/,/g, ';').replace(/\n/g, ' ');
                csvContent += `${date},${exp.category || ''},${description},${exp.amount},${exp.paymentMethod || ''}\n`;
            }
        }

        // Build CSV for income
        if (results.income.length > 0) {
            csvContent += '\nINCOME\n';
            csvContent += 'Date,Source,Description,Amount\n';
            for (const inc of results.income) {
                const date = new Date(inc.date).toLocaleDateString('en-IN');
                const description = (inc.description || '').replace(/,/g, ';').replace(/\n/g, ' ');
                csvContent += `${date},${inc.source || ''},${description},${inc.amount}\n`;
            }
        }

        // Summary
        const totalExpenses = results.expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = results.income.reduce((sum, i) => sum + i.amount, 0);

        csvContent += '\nSUMMARY\n';
        csvContent += `Total Expenses,${totalExpenses}\n`;
        csvContent += `Total Income,${totalIncome}\n`;
        csvContent += `Net Savings,${totalIncome - totalExpenses}\n`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="spendwise_report_${startDate}_to_${endDate}.csv"`);
        res.send(csvContent);

    } catch (error) {
        console.error('CSV export error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating CSV',
            error: error.message,
        });
    }
});

/**
 * GET /api/export/pdf
 * Export expenses and income as PDF data (JSON for client-side PDF generation)
 * Query params: startDate, endDate
 */
router.get('/pdf', async (req, res) => {
    try {
        const sanitizedParams = sanitizeQueryParams(req.query);
        const { startDate, endDate } = sanitizedParams;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide startDate and endDate',
            });
        }

        const dateQuery = {
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
        };

        // Fetch all data
        const [expenses, income] = await Promise.all([
            Expense.find({ userId: req.user._id, ...dateQuery }).sort({ date: -1 }),
            Income.find({ userId: req.user._id, ...dateQuery }).sort({ date: -1 }),
        ]);

        // Calculate summaries
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
        const netSavings = totalIncome - totalExpenses;

        // Category breakdown
        const categoryBreakdown = {};
        for (const exp of expenses) {
            const cat = exp.category || 'Other';
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + exp.amount;
        }

        // Convert to array with percentages
        const categoryData = Object.entries(categoryBreakdown)
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        // Source breakdown for income
        const sourceBreakdown = {};
        for (const inc of income) {
            const src = inc.source || 'Other';
            sourceBreakdown[src] = (sourceBreakdown[src] || 0) + inc.amount;
        }

        const sourceData = Object.entries(sourceBreakdown)
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
            }))
            .sort((a, b) => b.amount - a.amount);

        // Format dates for display
        const formattedStartDate = new Date(startDate).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
        const formattedEndDate = new Date(endDate).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'short', day: 'numeric',
        });

        res.json({
            success: true,
            data: {
                reportTitle: 'Expense Report',
                dateRange: `${formattedStartDate} - ${formattedEndDate}`,
                generatedAt: new Date().toISOString(),
                user: {
                    name: req.user.name,
                    email: req.user.email,
                    currency: req.user.currency || 'INR',
                },
                summary: {
                    totalExpenses,
                    totalIncome,
                    netSavings,
                    expenseCount: expenses.length,
                    incomeCount: income.length,
                },
                categoryBreakdown: categoryData,
                sourceBreakdown: sourceData,
                expenses: expenses.map(e => ({
                    date: new Date(e.date).toLocaleDateString('en-IN'),
                    category: e.category,
                    description: e.description || '-',
                    amount: e.amount,
                    paymentMethod: e.paymentMethod || '-',
                })),
                income: income.map(i => ({
                    date: new Date(i.date).toLocaleDateString('en-IN'),
                    source: i.source,
                    description: i.description || '-',
                    amount: i.amount,
                })),
            },
        });

    } catch (error) {
        console.error('PDF data export error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating PDF data',
            error: error.message,
        });
    }
});

/**
 * GET /api/export/summary
 * Get a quick summary for a date range
 */
router.get('/summary', async (req, res) => {
    try {
        const sanitizedParams = sanitizeQueryParams(req.query);
        const { startDate, endDate } = sanitizedParams;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Please provide startDate and endDate',
            });
        }

        const dateQuery = {
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
        };

        const [expenseSum, incomeSum] = await Promise.all([
            Expense.aggregate([
                { $match: { userId: req.user._id, ...dateQuery } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            Income.aggregate([
                { $match: { userId: req.user._id, ...dateQuery } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
        ]);

        const totalExpenses = expenseSum[0]?.total || 0;
        const totalIncome = incomeSum[0]?.total || 0;

        res.json({
            success: true,
            data: {
                totalExpenses,
                totalIncome,
                netSavings: totalIncome - totalExpenses,
                expenseCount: expenseSum[0]?.count || 0,
                incomeCount: incomeSum[0]?.count || 0,
            },
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;
