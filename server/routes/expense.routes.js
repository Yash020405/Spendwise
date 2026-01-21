import express from 'express';
import Expense from '../models/expense.model.js';
import { protect } from '../middleware/auth.middleware.js';
import {
    sanitizeString,
    sanitizeMongoId,
    sanitizeNumber,
    sanitizeBoolean,
    sanitizeDate,
    sanitizeParticipants,
    sanitizeLocalId,
    sanitizeQueryParams,
} from '../utils/sanitize.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Create expense
router.post('/', async (req, res) => {
    try {
        // Sanitize all inputs
        const amount = sanitizeNumber(req.body.amount);
        const category = sanitizeString(req.body.category);
        const categoryIcon = sanitizeString(req.body.categoryIcon);
        const paymentMethod = sanitizeString(req.body.paymentMethod);
        const description = sanitizeString(req.body.description);
        const date = sanitizeDate(req.body.date);
        const localId = sanitizeLocalId(req.body.localId);
        const isSplit = sanitizeBoolean(req.body.isSplit);
        const splitType = sanitizeString(req.body.splitType);
        const participants = sanitizeParticipants(req.body.participants);
        const userShare = sanitizeNumber(req.body.userShare);
        const payer = sanitizeString(req.body.payer);
        const payerName = sanitizeString(req.body.payerName);
        const userHasPaidShare = sanitizeBoolean(req.body.userHasPaidShare);

        // Input validation
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be a positive number',
            });
        }

        // Calculate totals for split expenses
        let totalOwed = 0;
        let processedParticipants = [];

        if (isSplit && participants && participants.length > 0) {
            processedParticipants = participants.map(p => ({
                ...p,
                isPaid: p.isPaid || false,
                paidAmount: p.paidAmount || 0,
            }));
            const calculatedTotal = processedParticipants.reduce((sum, p) => sum + (p.shareAmount || 0), 0);
            // If user is the payer, strict totalOwed is what others owe. If not, self owes userShare.
            const isPayerMe = !payer || payer === 'me' || payer === req.user._id.toString();
            totalOwed = isPayerMe ? calculatedTotal : 0;
        }

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
            isSplit: isSplit || false,
            splitType: splitType || 'equal',
            participants: processedParticipants,
            payer: payer || req.user._id, // Default to user
            payerName: payerName || 'You',
            userShare: userShare || (isSplit ? amount - totalOwed : amount),
            userHasPaidShare: userHasPaidShare !== undefined ? userHasPaidShare : (payer === 'me' || !payer), // Default to true if I paid
            totalOwed,
            totalPaid: 0,
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
        // Sanitize all query parameters
        const sanitizedQuery = sanitizeQueryParams(req.query);
        const { startDate, endDate, category, paymentMethod, search, page = 1, limit = 50 } = sanitizedQuery;

        const query = { userId: req.user._id };

        // Search filter - search in description and category
        if (search) {
            const sanitizedSearch = sanitizeString(search);
            const searchRegex = { $regex: sanitizedSearch, $options: 'i' };
            query.$or = [
                { description: searchRegex },
                { category: searchRegex },
            ];
        }

        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        if (category) query.category = sanitizeString(category);
        if (paymentMethod) query.paymentMethod = sanitizeString(paymentMethod);

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
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid expense ID',
            });
        }

        const expense = await Expense.findOne({
            _id: sanitizedId,
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
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid expense ID',
            });
        }

        const { amount, category, categoryIcon, paymentMethod, description, date, isSplit, splitType, participants, userShare, payer, payerName, userHasPaidShare } = req.body;

        console.log('PUT expense - Request body:', JSON.stringify(req.body, null, 2));
        console.log('PUT expense - userHasPaidShare value:', userHasPaidShare, 'type:', typeof userHasPaidShare);

        // Sanitize update fields
        const updateFields = {};
        if (amount !== undefined && typeof amount === 'number') updateFields.amount = Number(amount);
        if (category && typeof category === 'string') updateFields.category = sanitizeString(String(category).trim());
        if (categoryIcon && typeof categoryIcon === 'string') updateFields.categoryIcon = sanitizeString(String(categoryIcon).trim());
        if (paymentMethod && typeof paymentMethod === 'string') updateFields.paymentMethod = sanitizeString(String(paymentMethod).trim());
        if (description && typeof description === 'string') updateFields.description = sanitizeString(String(description).trim().slice(0, 500));
        if (date) updateFields.date = new Date(date);

        // Handle userHasPaidShare update (for marking user's share as paid when someone else paid)
        if (userHasPaidShare !== undefined) {
            updateFields.userHasPaidShare = Boolean(userHasPaidShare);
            console.log('Setting userHasPaidShare to:', updateFields.userHasPaidShare);
        }

        // Handle split expense updates
        if (isSplit !== undefined) {
            updateFields.isSplit = Boolean(isSplit);
            updateFields.splitType = sanitizeString(splitType) || 'equal';
            if (participants && Array.isArray(participants)) {
                updateFields.participants = sanitizeParticipants(participants).map(p => ({
                    ...p,
                    isPaid: p.isPaid || false,
                    paidAmount: p.paidAmount || 0,
                }));
                const calculatedTotal = participants.reduce((sum, p) => sum + (p.shareAmount || 0), 0);
                // Note: payer logic handled by frontend, we just store what's sent
                updateFields.totalOwed = calculatedTotal;
            }
            if (userShare !== undefined) updateFields.userShare = Number(userShare);
            if (payer !== undefined) updateFields.payer = sanitizeString(payer);
            if (payerName !== undefined) updateFields.payerName = sanitizeString(payerName);
        }

        console.log('PUT expense - updateFields:', JSON.stringify(updateFields, null, 2));

        const expense = await Expense.findOneAndUpdate(
            { _id: sanitizedId, userId: req.user._id },
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        console.log('PUT expense - Updated expense userHasPaidShare:', expense.userHasPaidShare);

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
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid expense ID',
            });
        }

        const expense = await Expense.findOneAndDelete({
            _id: sanitizedId,
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
            // Sanitize each expense before processing
            const sanitizedExp = {
                amount: typeof exp.amount === 'number' ? Number(exp.amount) : 0,
                category: sanitizeString(exp.category || ''),
                categoryIcon: sanitizeString(exp.categoryIcon || ''),
                paymentMethod: sanitizeString(exp.paymentMethod || ''),
                description: sanitizeString(exp.description || ''),
                date: exp.date ? new Date(exp.date) : new Date(),
                localId: sanitizeString(exp.localId || ''),
                isSplit: Boolean(exp.isSplit),
                splitType: sanitizeString(exp.splitType || 'equal'),
                participants: exp.participants ? sanitizeParticipants(exp.participants) : [],
                userShare: typeof exp.userShare === 'number' ? Number(exp.userShare) : undefined,
                payer: exp.payer ? sanitizeString(exp.payer) : undefined,
                payerName: exp.payerName ? sanitizeString(exp.payerName) : undefined,
                userHasPaidShare: exp.userHasPaidShare !== undefined ? Boolean(exp.userHasPaidShare) : undefined,
            };

            // Check if expense with localId already exists
            const existing = await Expense.findOne({
                userId: req.user._id,
                localId: sanitizedExp.localId,
            });

            if (existing) {
                results.push({ localId: sanitizedExp.localId, status: 'exists', data: existing });
            } else {
                const newExpense = await Expense.create({
                    ...sanitizedExp,
                    userId: req.user._id,
                    synced: true,
                });
                results.push({ localId: sanitizedExp.localId, status: 'created', data: newExpense });
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

// Update participant payment status
router.put('/:id/participants/:participantId/payment', async (req, res) => {
    try {
        const sanitizedExpenseId = sanitizeMongoId(req.params.id);
        const sanitizedParticipantId = sanitizeMongoId(req.params.participantId);
        
        if (!sanitizedExpenseId || !sanitizedParticipantId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid expense ID or participant ID',
            });
        }

        const { isPaid, paidAmount } = req.body;

        const expense = await Expense.findOne({
            _id: sanitizedExpenseId,
            userId: req.user._id,
            isSplit: true,
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Split expense not found',
            });
        }

        const participant = expense.participants.id(sanitizedParticipantId);

        if (!participant) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found',
            });
        }

        participant.isPaid = Boolean(isPaid);
        participant.paidAmount = typeof paidAmount === 'number' ? Number(paidAmount) : (isPaid ? participant.shareAmount : 0);
        participant.paidDate = isPaid ? new Date() : null;

        // Recalculate total paid
        expense.totalPaid = expense.participants.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

        await expense.save();

        res.json({
            success: true,
            data: expense,
            message: isPaid ? 'Marked as paid' : 'Marked as unpaid',
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Get split expense balances (who owes whom)
router.get('/split/balances', async (req, res) => {
    try {
        const splitExpenses = await Expense.find({
            userId: req.user._id,
            isSplit: true,
        }).sort({ date: -1 });

        // Calculate balances per person
        const balances = {};

        for (const expense of splitExpenses) {
            for (const participant of expense.participants) {
                const key = participant.phone || participant.name;
                if (!balances[key]) {
                    balances[key] = {
                        name: participant.name,
                        phone: participant.phone,
                        totalOwed: 0,
                        totalPaid: 0,
                        pendingAmount: 0,
                    };
                }
                balances[key].totalOwed += participant.shareAmount || 0;
                balances[key].totalPaid += participant.paidAmount || 0;
                if (!participant.isPaid) {
                    balances[key].pendingAmount += (participant.shareAmount || 0) - (participant.paidAmount || 0);
                }
            }
        }

        const balanceList = Object.values(balances).sort((a, b) => b.pendingAmount - a.pendingAmount);

        res.json({
            success: true,
            data: {
                totalOwedToYou: balanceList.reduce((sum, b) => sum + b.totalOwed, 0),
                totalPaidBack: balanceList.reduce((sum, b) => sum + b.totalPaid, 0),
                pendingTotal: balanceList.reduce((sum, b) => sum + b.pendingAmount, 0),
                balances: balanceList,
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
