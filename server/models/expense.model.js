import mongoose from 'mongoose';

// Participant schema for split expenses
const participantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  shareAmount: {
    type: Number,
    default: 0,
  },
  sharePercentage: {
    type: Number,
  },
  isPaid: {
    type: Boolean,
    default: false,
  },
  paidDate: {
    type: Date,
  },
  paidAmount: {
    type: Number,
    default: 0,
  },
}, { _id: true });

const expenseSchema = new mongoose.Schema(
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
    category: {
      type: String,
      required: [true, 'Category is required'],
    },
    categoryIcon: {
      type: String,
      default: 'receipt', // Default icon
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Other'],
      default: 'Cash',
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
    localId: {
      type: String,
      sparse: true, // For offline sync matching
    },
    synced: {
      type: Boolean,
      default: true,
    },
    // Split expense fields
    isSplit: {
      type: Boolean,
      default: false,
    },
    splitType: {
      type: String,
      enum: ['equal', 'custom', 'percentage'],
      default: 'equal',
    },
    participants: [participantSchema],
    userShare: {
      type: Number, // The current user's portion of the expense
    },
    totalOwed: {
      type: Number, // Total amount others owe the user
      default: 0,
    },
    totalPaid: {
      type: Number, // Total amount already paid back
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
expenseSchema.index({ userId: 1, date: -1 });
expenseSchema.index({ userId: 1, category: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
