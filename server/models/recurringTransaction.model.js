import mongoose from 'mongoose';

const recurringTransactionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['expense', 'income'],
            required: true,
            default: 'expense',
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
        // For expenses
        category: {
            type: String,
            default: 'Other',
        },
        paymentMethod: {
            type: String,
            enum: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Other'],
            default: 'Cash',
        },
        // For income
        source: {
            type: String,
            default: 'Other',
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        // Recurrence settings
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'yearly'],
            required: true,
            default: 'monthly',
        },
        dayOfMonth: {
            type: Number,
            min: 1,
            max: 31,
            default: 1, // For monthly recurrence
        },
        dayOfWeek: {
            type: Number,
            min: 0,
            max: 6, // 0 = Sunday, 6 = Saturday
        },
        startDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        endDate: {
            type: Date, // Optional end date
        },
        nextDueDate: {
            type: Date,
            required: true,
            index: true,
        },
        lastGeneratedDate: {
            type: Date,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        // Split expense support
        isSplit: {
            type: Boolean,
            default: false,
        },
        participants: [{
            name: { type: String, required: true },
            phone: { type: String },
            shareAmount: { type: Number },
            sharePercentage: { type: Number },
            isPaid: { type: Boolean, default: false },
            paidDate: { type: Date },
        }],
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
recurringTransactionSchema.index({ userId: 1, isActive: 1 });
recurringTransactionSchema.index({ nextDueDate: 1, isActive: 1 });

// Calculate next due date based on frequency
recurringTransactionSchema.methods.calculateNextDueDate = function () {
    const current = this.nextDueDate || this.startDate || new Date();
    const next = new Date(current);

    switch (this.frequency) {
        case 'daily':
            next.setDate(next.getDate() + 1);
            break;
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            // Handle month overflow (e.g., Jan 31 -> Feb 28)
            if (this.dayOfMonth) {
                const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
                next.setDate(Math.min(this.dayOfMonth, maxDay));
            }
            break;
        case 'yearly':
            next.setFullYear(next.getFullYear() + 1);
            break;
    }

    return next;
};

const RecurringTransaction = mongoose.model('RecurringTransaction', recurringTransactionSchema);

export default RecurringTransaction;
