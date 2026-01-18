import mongoose from 'mongoose';

// Income source categories
export const INCOME_SOURCES = [
    { name: 'Salary', icon: 'payments', color: '#10B981' },
    { name: 'Freelance', icon: 'laptop', color: '#3B82F6' },
    { name: 'Investment', icon: 'trending-up', color: '#8B5CF6' },
    { name: 'Gift', icon: 'card-giftcard', color: '#EC4899' },
    { name: 'Refund', icon: 'replay', color: '#F59E0B' },
    { name: 'Other', icon: 'attach-money', color: '#6B7280' },
];

const incomeSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
        source: {
            type: String,
            required: [true, 'Source is required'],
            enum: INCOME_SOURCES.map(s => s.name),
            default: 'Other',
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        date: {
            type: Date,
            required: true,
            default: Date.now,
            index: true,
        },
        isRecurring: {
            type: Boolean,
            default: false,
        },
        recurringId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'RecurringTransaction',
            sparse: true,
        },
        localId: {
            type: String,
            sparse: true, // For offline sync matching
        },
        synced: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for efficient queries
incomeSchema.index({ userId: 1, date: -1 });
incomeSchema.index({ userId: 1, source: 1 });

const Income = mongoose.model('Income', incomeSchema);

export default Income;
