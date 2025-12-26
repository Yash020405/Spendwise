import mongoose from 'mongoose';

// Available icons for categories
export const AVAILABLE_ICONS = [
    'restaurant', 'fastfood', 'local-cafe', 'local-bar',
    'directions-car', 'directions-bus', 'local-taxi', 'flight',
    'shopping-bag', 'shopping-cart', 'store', 'local-mall',
    'movie', 'sports-esports', 'music-note', 'celebration',
    'receipt', 'payments', 'account-balance', 'credit-card',
    'local-hospital', 'medical-services', 'fitness-center', 'spa',
    'school', 'menu-book', 'laptop', 'phone-android',
    'home', 'build', 'electrical-services', 'plumbing',
    'pets', 'child-care', 'elderly', 'family-restroom',
    'more-horiz', 'category', 'attach-money', 'savings'
];

// Default categories
export const DEFAULT_CATEGORIES = [
    { name: 'Food', icon: 'restaurant', color: '#F59E0B', isDefault: true },
    { name: 'Transport', icon: 'directions-car', color: '#3B82F6', isDefault: true },
    { name: 'Shopping', icon: 'shopping-bag', color: '#EC4899', isDefault: true },
    { name: 'Entertainment', icon: 'movie', color: '#8B5CF6', isDefault: true },
    { name: 'Bills', icon: 'receipt', color: '#EF4444', isDefault: true },
    { name: 'Health', icon: 'local-hospital', color: '#10B981', isDefault: true },
    { name: 'Education', icon: 'school', color: '#06B6D4', isDefault: true },
    { name: 'Other', icon: 'more-horiz', color: '#6B7280', isDefault: true },
];

const categorySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            maxlength: 50,
        },
        icon: {
            type: String,
            enum: AVAILABLE_ICONS,
            default: 'category',
        },
        color: {
            type: String,
            default: '#6B7280',
            match: /^#[0-9A-Fa-f]{6}$/,
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Ensure unique category names per user
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

export default Category;
