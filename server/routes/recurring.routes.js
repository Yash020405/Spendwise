import express from 'express';
import RecurringTransaction from '../models/recurringTransaction.model.js';
import Expense from '../models/expense.model.js';
import Income from '../models/income.model.js';
import { protect } from '../middleware/auth.middleware.js';
import { sanitizeString, sanitizeMongoId, sanitizeQueryParams } from '../utils/sanitize.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   GET /api/recurring
// @desc    Get all recurring transactions for user
// @access  Private
router.get('/', async (req, res) => {
    try {
        const sanitizedQueryParams = sanitizeQueryParams(req.query);
        const { type, isActive } = sanitizedQueryParams;

        const query = { userId: req.user._id };
        if (type) query.type = sanitizeString(type);
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const recurring = await RecurringTransaction.find(query)
            .sort({ nextDueDate: 1 });

        res.json({
            success: true,
            count: recurring.length,
            data: recurring,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching recurring transactions',
            error: error.message,
        });
    }
});

// @route   POST /api/recurring
// @desc    Create new recurring transaction
// @access  Private
router.post('/', async (req, res) => {
    try {
        const {
            type,
            amount,
            category,
            source,
            paymentMethod,
            description,
            frequency,
            dayOfMonth,
            dayOfWeek,
            startDate,
            endDate,
        } = req.body;

        // Calculate initial next due date
        const start = startDate ? new Date(startDate) : new Date();
        const nextDueDate = new Date(start);

        // Adjust for day of month if monthly
        if (frequency === 'monthly' && dayOfMonth) {
            const maxDay = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
            nextDueDate.setDate(Math.min(dayOfMonth, maxDay));
        }

        const recurring = await RecurringTransaction.create({
            userId: req.user._id,
            type: sanitizeString(type || 'expense'),
            amount: Number(amount),
            category: sanitizeString(category || ''),
            source: sanitizeString(source || ''),
            paymentMethod: sanitizeString(paymentMethod || ''),
            description: sanitizeString(description || ''),
            frequency: sanitizeString(frequency || 'monthly'),
            dayOfMonth: dayOfMonth ? Number(dayOfMonth) : undefined,
            dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
            startDate: start,
            endDate: endDate ? new Date(endDate) : undefined,
            nextDueDate,
        });

        res.status(201).json({
            success: true,
            data: recurring,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error creating recurring transaction',
            error: error.message,
        });
    }
});

// @route   PUT /api/recurring/:id
// @desc    Update recurring transaction
// @access  Private
router.put('/:id', async (req, res) => {
    try {
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid recurring transaction ID',
            });
        }

        // Sanitize and validate each field explicitly
        const allowedFields = {};

        if (req.body.amount !== undefined && typeof req.body.amount === 'number') {
            allowedFields.amount = Number(req.body.amount);
        }
        if (req.body.description && typeof req.body.description === 'string') {
            allowedFields.description = sanitizeString(String(req.body.description).trim().slice(0, 500));
        }
        if (req.body.category && typeof req.body.category === 'string') {
            allowedFields.category = sanitizeString(String(req.body.category).trim());
        }
        if (req.body.source && typeof req.body.source === 'string') {
            allowedFields.source = sanitizeString(String(req.body.source).trim());
        }
        if (req.body.paymentMethod && typeof req.body.paymentMethod === 'string') {
            allowedFields.paymentMethod = sanitizeString(String(req.body.paymentMethod).trim());
        }
        if (req.body.frequency && typeof req.body.frequency === 'string') {
            allowedFields.frequency = sanitizeString(String(req.body.frequency).trim());
        }
        if (req.body.dayOfMonth !== undefined && typeof req.body.dayOfMonth === 'number') {
            allowedFields.dayOfMonth = Number(req.body.dayOfMonth);
        }
        if (req.body.isActive !== undefined && typeof req.body.isActive === 'boolean') {
            allowedFields.isActive = Boolean(req.body.isActive);
        }

        const recurring = await RecurringTransaction.findOneAndUpdate(
            { _id: sanitizedId, userId: req.user._id },
            { $set: allowedFields },
            { new: true, runValidators: true }
        );

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found',
            });
        }

        res.json({
            success: true,
            data: recurring,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Error updating recurring transaction',
            error: error.message,
        });
    }
});

// @route   DELETE /api/recurring/:id
// @desc    Delete recurring transaction
// @access  Private
router.delete('/:id', async (req, res) => {
    try {
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid recurring transaction ID',
            });
        }

        const recurring = await RecurringTransaction.findOneAndDelete({
            _id: sanitizedId,
            userId: req.user._id,
        });

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found',
            });
        }

        res.json({
            success: true,
            message: 'Recurring transaction deleted',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting recurring transaction',
            error: error.message,
        });
    }
});

// @route   POST /api/recurring/:id/toggle
// @desc    Toggle active status (pause/resume)
// @access  Private
router.post('/:id/toggle', async (req, res) => {
    try {
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid recurring transaction ID',
            });
        }

        const recurring = await RecurringTransaction.findOne({
            _id: sanitizedId,
            userId: req.user._id,
        });

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found',
            });
        }

        recurring.isActive = !recurring.isActive;
        await recurring.save();

        res.json({
            success: true,
            data: recurring,
            message: recurring.isActive ? 'Recurring transaction resumed' : 'Recurring transaction paused',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error toggling recurring transaction',
            error: error.message,
        });
    }
});

// @route   POST /api/recurring/:id/generate
// @desc    Manually generate transaction from recurring template
// @access  Private
router.post('/:id/generate', async (req, res) => {
    try {
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid recurring transaction ID',
            });
        }

        const recurring = await RecurringTransaction.findOne({
            _id: sanitizedId,
            userId: req.user._id,
        });

        if (!recurring) {
            return res.status(404).json({
                success: false,
                message: 'Recurring transaction not found',
            });
        }

        // Check if already generated today (prevent duplicates)
        if (recurring.lastGeneratedDate) {
            const lastGen = new Date(recurring.lastGeneratedDate);
            const today = new Date();
            if (
                lastGen.getFullYear() === today.getFullYear() &&
                lastGen.getMonth() === today.getMonth() &&
                lastGen.getDate() === today.getDate()
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Already generated today. Next generation available tomorrow.',
                });
            }
        }

        let generated;

        if (recurring.type === 'expense') {
            generated = await Expense.create({
                userId: req.user._id,
                amount: recurring.amount,
                category: recurring.category,
                paymentMethod: recurring.paymentMethod,
                description: recurring.description,
                date: new Date(),
            });
        } else {
            generated = await Income.create({
                userId: req.user._id,
                amount: recurring.amount,
                source: recurring.source,
                description: recurring.description,
                date: new Date(),
                isRecurring: true,
                recurringId: recurring._id,
            });
        }

        // Update next due date
        recurring.lastGeneratedDate = new Date();
        recurring.nextDueDate = recurring.calculateNextDueDate();
        await recurring.save();

        res.json({
            success: true,
            data: generated,
            recurring: recurring,
            message: `${recurring.type} generated successfully`,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error generating transaction',
            error: error.message,
        });
    }
});

// @route   POST /api/recurring/process
// @desc    Process all due recurring transactions (can be called by cron job)
// @access  Private (or system)
router.post('/process', async (req, res) => {
    try {
        const now = new Date();

        // Find all active recurring transactions that are due
        const dueTransactions = await RecurringTransaction.find({
            isActive: true,
            nextDueDate: { $lte: now },
            $or: [
                { endDate: { $exists: false } },
                { endDate: { $gte: now } },
            ],
        });

        const results = {
            processed: 0,
            expenses: 0,
            income: 0,
            errors: [],
        };

        for (const recurring of dueTransactions) {
            try {
                if (recurring.type === 'expense') {
                    await Expense.create({
                        userId: recurring.userId,
                        amount: recurring.amount,
                        category: recurring.category,
                        paymentMethod: recurring.paymentMethod,
                        description: recurring.description,
                        date: new Date(),
                    });
                    results.expenses++;
                } else {
                    await Income.create({
                        userId: recurring.userId,
                        amount: recurring.amount,
                        source: recurring.source,
                        description: recurring.description,
                        date: new Date(),
                        isRecurring: true,
                        recurringId: recurring._id,
                    });
                    results.income++;
                }

                recurring.lastGeneratedDate = new Date();
                recurring.nextDueDate = recurring.calculateNextDueDate();
                await recurring.save();
                results.processed++;
            } catch (err) {
                results.errors.push({
                    id: recurring._id,
                    error: err.message,
                });
            }
        }

        res.json({
            success: true,
            message: `Processed ${results.processed} recurring transactions`,
            results,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error processing recurring transactions',
            error: error.message,
        });
    }
});

export default router;
