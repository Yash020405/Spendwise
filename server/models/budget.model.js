import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        category: {
            type: String,
            default: null, // null means overall budget
        },
        amount: {
            type: Number,
            required: [true, 'Budget amount is required'],
            min: [0, 'Budget cannot be negative'],
        },
        month: {
            type: Number,
            required: true,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Ensure unique budget per user/category/month/year
budgetSchema.index({ userId: 1, category: 1, month: 1, year: 1 }, { unique: true });

const Budget = mongoose.model('Budget', budgetSchema);

export default Budget;
