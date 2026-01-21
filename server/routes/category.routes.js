import express from 'express';
import Category, { DEFAULT_CATEGORIES, AVAILABLE_ICONS } from '../models/category.model.js';
import { protect } from '../middleware/auth.middleware.js';
import { sanitizeString, sanitizeMongoId } from '../utils/sanitize.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// Get available icons
router.get('/icons', async (req, res) => {
    res.json({
        success: true,
        data: AVAILABLE_ICONS,
    });
});

// Get all categories for user (including defaults)
router.get('/', async (req, res) => {
    try {
        let categories = await Category.find({ userId: req.user._id, isActive: true });

        // If no categories, initialize with defaults
        if (categories.length === 0) {
            const defaultCats = DEFAULT_CATEGORIES.map(cat => ({
                ...cat,
                userId: req.user._id,
            }));
            await Category.insertMany(defaultCats);
            categories = await Category.find({ userId: req.user._id, isActive: true });
        }

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Create custom category
router.post('/', async (req, res) => {
    try {
        const { name, icon, color } = req.body;

        // Sanitize inputs
        const sanitizedName = sanitizeString(name || '');
        const sanitizedIcon = sanitizeString(icon || 'category');
        const sanitizedColor = sanitizeString(color || '#6B7280');

        // Check if category name already exists for user
        const existing = await Category.findOne({ userId: req.user._id, name: sanitizedName });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Category with this name already exists',
            });
        }

        const category = await Category.create({
            userId: req.user._id,
            name: sanitizedName,
            icon: sanitizedIcon,
            color: sanitizedColor,
            isDefault: false,
        });

        res.status(201).json({
            success: true,
            data: category,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Update category
router.put('/:id', async (req, res) => {
    try {
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category ID',
            });
        }

        const { name, icon, color } = req.body;

        // Sanitize update fields
        const updateFields = {};
        if (name && typeof name === 'string') updateFields.name = sanitizeString(String(name).trim().slice(0, 50));
        if (icon && typeof icon === 'string') updateFields.icon = sanitizeString(String(icon).trim());
        if (color && typeof color === 'string') updateFields.color = sanitizeString(String(color).trim());

        const category = await Category.findOneAndUpdate(
            { _id: sanitizedId, userId: req.user._id },
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found',
            });
        }

        res.json({
            success: true,
            data: category,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Delete category (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const sanitizedId = sanitizeMongoId(req.params.id);
        if (!sanitizedId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid category ID',
            });
        }

        const category = await Category.findOneAndUpdate(
            { _id: sanitizedId, userId: req.user._id, isDefault: false },
            { isActive: false },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found or cannot delete default category',
            });
        }

        res.json({
            success: true,
            message: 'Category deleted successfully',
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

// Reset to default categories
router.post('/reset', async (req, res) => {
    try {
        // Remove all custom categories
        await Category.deleteMany({ userId: req.user._id, isDefault: false });

        // Reactivate default categories
        await Category.updateMany(
            { userId: req.user._id, isDefault: true },
            { isActive: true }
        );

        // If no defaults exist, create them
        const existing = await Category.find({ userId: req.user._id, isDefault: true });
        if (existing.length === 0) {
            const defaultCats = DEFAULT_CATEGORIES.map(cat => ({
                ...cat,
                userId: req.user._id,
            }));
            await Category.insertMany(defaultCats);
        }

        const categories = await Category.find({ userId: req.user._id, isActive: true });

        res.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
});

export default router;
