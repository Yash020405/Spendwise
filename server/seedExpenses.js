// Seed script to add mock expenses for testing
// Run with: node seedExpenses.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Expense from './models/expense.model.js';
import User from './models/user.model.js';

dotenv.config();

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Health', 'Education', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Card', 'UPI', 'Bank Transfer'];
const DESCRIPTIONS = {
    Food: ['Lunch', 'Coffee', 'Groceries', 'Dinner', 'Breakfast', 'Snacks', 'Restaurant'],
    Transport: ['Uber', 'Metro', 'Fuel', 'Bus fare', 'Cab', 'Parking'],
    Shopping: ['Clothes', 'Electronics', 'Amazon', 'Shoes', 'Books'],
    Entertainment: ['Netflix', 'Movie', 'Concert', 'Game', 'Spotify'],
    Bills: ['Electricity', 'Water', 'Internet', 'Phone', 'Rent'],
    Health: ['Medicine', 'Doctor', 'Gym', 'Pharmacy'],
    Education: ['Course', 'Books', 'Workshop', 'Subscription'],
    Other: ['Gift', 'Charity', 'Misc', 'Repair']
};

async function seedExpenses() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find first user
        const user = await User.findOne();
        if (!user) {
            console.log('No user found. Please register first.');
            process.exit(1);
        }

        console.log(`Seeding expenses for user: ${user.email}`);

        // Generate expenses for the last 60 days
        const expenses = [];
        const now = new Date();

        for (let daysAgo = 0; daysAgo < 60; daysAgo++) {
            const date = new Date(now);
            date.setDate(date.getDate() - daysAgo);

            // Random number of expenses per day (1-4)
            const numExpenses = Math.floor(Math.random() * 4) + 1;

            for (let i = 0; i < numExpenses; i++) {
                const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
                const descriptions = DESCRIPTIONS[category];
                const description = descriptions[Math.floor(Math.random() * descriptions.length)];
                const paymentMethod = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];
                const amount = Math.floor(Math.random() * 2000) + 50;

                const expenseDate = new Date(date);
                const hours = Math.floor(Math.random() * 14) + 8;
                const minutes = Math.floor(Math.random() * 60);
                expenseDate.setHours(hours, minutes, 0, 0);

                expenses.push({
                    userId: user._id,
                    amount,
                    category,
                    description,
                    paymentMethod,
                    date: new Date(expenseDate),
                });
            }
        }

        // Clear existing expenses for this user
        await Expense.deleteMany({ user: user._id });
        console.log('Cleared existing expenses');

        // Insert new expenses
        await Expense.insertMany(expenses);
        console.log(`Created ${expenses.length} mock expenses over 60 days`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
}

seedExpenses();
