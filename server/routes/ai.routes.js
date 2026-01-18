import express from 'express';
import Expense from '../models/expense.model.js';
import Income from '../models/income.model.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);

// @route   POST /api/ai/insights
// @desc    Generate AI-powered spending insights using OpenRouter
// @access  Private
router.post('/insights', async (req, res) => {
    try {
        const { timeRange = 'month', month, year } = req.body;
        const now = new Date();

        console.log('📊 AI Insights Request:', { timeRange, month, year, userId: req.user._id });

        // Determine date range - use UTC to match MongoDB storage
        let startDate, endDate;

        if (month !== undefined && year !== undefined) {
            // Specific month target - use UTC dates
            startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
            endDate = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
            console.log('📅 Date range (UTC):', {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                monthName: new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })
            });
        } else {
            // Rolling time range target
            switch (timeRange) {
                case 'week':
                    startDate = new Date(now);
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'year':
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
                    break;
                case 'month':
                default:
                    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
            }
            endDate = now;
        }

        // Aggregate expense data
        const expenses = await Expense.find({
            userId: req.user._id,
            date: { $gte: startDate, $lte: endDate },
        });

        const income = await Income.find({
            userId: req.user._id,
            date: { $gte: startDate, $lte: endDate },
        });

        console.log('📋 Found', expenses.length, 'expenses, total:', expenses.reduce((s, e) => s + e.amount, 0));
        console.log('📋 Found', income.length, 'income entries, total:', income.reduce((s, i) => s + i.amount, 0));

        // Calculate summaries
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);

        // Category breakdown with counts
        const categoryDetails = {};
        expenses.forEach(e => {
            if (!categoryDetails[e.category]) {
                categoryDetails[e.category] = { total: 0, count: 0, notes: [] };
            }
            categoryDetails[e.category].total += e.amount;
            categoryDetails[e.category].count += 1;
            if (e.description) {
                categoryDetails[e.category].notes.push(e.description);
            }
        });

        // Income source breakdown
        const incomeDetails = {};
        income.forEach(i => {
            if (!incomeDetails[i.source]) {
                incomeDetails[i.source] = { total: 0, count: 0 };
            }
            incomeDetails[i.source].total += i.amount;
            incomeDetails[i.source].count += 1;
        });

        // Day of week analysis
        const dayOfWeekTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        expenses.forEach(e => {
            const day = new Date(e.date).getDay();
            dayOfWeekTotals[day] += e.amount;
        });

        // Recent transactions (top 10 by amount)
        const topExpenses = [...expenses]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10)
            .map(e => ({
                amount: e.amount,
                category: e.category,
                note: e.description || '',
                date: new Date(e.date).toLocaleDateString()
            }));

        // Build prompt for AI with enhanced data
        const promptData = {
            totalExpenses,
            totalIncome,
            netBalance: totalIncome - totalExpenses,
            categoryDetails,
            incomeDetails,
            dayOfWeekSpending: dayOfWeekTotals,
            transactionCount: expenses.length,
            incomeCount: income.length,
            topExpenses,
            timeRange,
            currency: req.user.currency || 'INR',
        };
        console.log('🤖 AI Prompt Data:', JSON.stringify(promptData, null, 2));
        const prompt = buildInsightPrompt(promptData);

        // Check if OpenRouter API key is configured
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            // Return rule-based insights if no API key
            const ruleBasedInsights = generateRuleBasedInsights({
                totalExpenses,
                totalIncome,
                categoryDetails,
                dayOfWeekTotals,
                expenses,
            });

            return res.json({
                success: true,
                data: {
                    insights: ruleBasedInsights,
                    source: 'rules',
                    summary: {
                        totalExpenses,
                        totalIncome,
                        netBalance: totalIncome - totalExpenses,
                        topCategory: Object.keys(categoryDetails).sort((a, b) => (categoryDetails[b]?.total || 0) - (categoryDetails[a]?.total || 0))[0],
                    },
                },
            });
        }

        // Call OpenRouter API
        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://spendwise.app',
                'X-Title': 'Spendwise',
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3-haiku',
                messages: [
                    {
                        role: 'system',
                        content: `You are a personal finance advisor analyzing real spending data. Provide specific, actionable insights based on the ACTUAL numbers provided. Be direct and practical.

IMPORTANT RULES:
- Reference the EXACT amounts and categories from the data
- Give SPECIFIC advice based on their actual spending patterns
- If they have no transactions, tell them to start tracking
- Compare their spending ratios to healthy benchmarks (50/30/20 rule)
- Mention specific categories by name with real amounts

Return ONLY a JSON array (no other text) with 3-5 insight objects. Each object must have:
- "type": one of "success", "warning", "info", or "tip"
- "title": very short headline (2-3 words max)
- "message": extremely concise one-sentence insight (max 15 words) with real numbers`,
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                max_tokens: 400,
            }),
        });

        if (!aiResponse.ok) {
            throw new Error('AI service temporarily unavailable');
        }

        const aiData = await aiResponse.json();
        const aiContent = aiData.choices?.[0]?.message?.content;

        // Parse AI response
        let insights = [];
        try {
            // Try to extract JSON from the response
            const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                insights = JSON.parse(jsonMatch[0]);
            }
        } catch (parseError) {
            // If parsing fails, create a simple insight from the text
            insights = [{
                type: 'info',
                title: 'AI Analysis',
                message: aiContent?.substring(0, 200) || 'Analysis complete',
            }];
        }

        res.json({
            success: true,
            data: {
                insights,
                source: 'ai',
                summary: {
                    totalExpenses,
                    totalIncome,
                    netBalance: totalIncome - totalExpenses,
                    topCategory: Object.keys(categoryDetails).sort((a, b) => (categoryDetails[b]?.total || 0) - (categoryDetails[a]?.total || 0))[0],
                },
            },
        });

    } catch (error) {
        console.error('AI insights error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating insights',
            error: error.message,
        });
    }
});

// Helper function to build the prompt
function buildInsightPrompt(data) {
    const {
        totalExpenses,
        totalIncome,
        netBalance,
        categoryDetails,
        incomeDetails,
        dayOfWeekSpending,
        transactionCount,
        incomeCount,
        topExpenses,
        timeRange,
        currency
    } = data;

    // Format category breakdown with details
    const categoryList = Object.entries(categoryDetails || {})
        .sort((a, b) => b[1].total - a[1].total)
        .map(([cat, details]) => {
            const percent = totalExpenses > 0 ? ((details.total / totalExpenses) * 100).toFixed(0) : 0;
            const noteExamples = details.notes.slice(0, 3).join(', ');
            return `${cat}: ${currency} ${details.total.toLocaleString()} (${percent}%, ${details.count} transactions)${noteExamples ? ` - Examples: ${noteExamples}` : ''}`;
        })
        .join('\n  - ');

    // Format income sources
    const incomeList = Object.entries(incomeDetails || {})
        .map(([source, details]) => `${source}: ${currency} ${details.total.toLocaleString()} (${details.count} entries)`)
        .join(', ');

    // Format day of week spending
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daySpending = (dayOfWeekSpending || [])
        .map((amt, i) => `${days[i]}: ${currency} ${amt.toLocaleString()}`)
        .join(', ');

    // Calculate key metrics
    const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : 0;
    const expenseToIncomeRatio = totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : 'N/A';

    // Format top expenses
    const topExpensesList = (topExpenses || [])
        .map(e => `${currency} ${e.amount.toLocaleString()} - ${e.category}${e.note ? ` (${e.note})` : ''} on ${e.date}`)
        .join('\n  - ');

    return `PERSONAL FINANCE DATA FOR ${(timeRange || 'month').toUpperCase()}:

FINANCIAL SUMMARY:
- Total Income: ${currency} ${totalIncome.toLocaleString()} (${incomeCount || 0} sources)
- Total Expenses: ${currency} ${totalExpenses.toLocaleString()} (${transactionCount || 0} transactions)
- Net Balance: ${currency} ${netBalance.toLocaleString()} (${netBalance >= 0 ? 'SURPLUS' : 'DEFICIT'})
- Savings Rate: ${savingsRate}%
- Expense-to-Income Ratio: ${expenseToIncomeRatio}%

INCOME BREAKDOWN:
${incomeList || 'No income recorded'}

SPENDING BY CATEGORY (highest to lowest):
  - ${categoryList || 'No expense data'}

TOP EXPENSES:
  - ${topExpensesList || 'No expenses'}

DAILY SPENDING PATTERN:
${daySpending}

Based on this REAL financial data, provide 4-6 personalized, actionable insights:
1. Analyze their savings rate compared to recommended 20% benchmark
2. Evaluate their top spending categories - are they concerning or reasonable?
3. Identify weekend vs weekday spending patterns
4. Look at individual transaction notes for specific spending habits
5. Provide 2-3 specific actionable tips to optimize their finances
6. Highlight any achievements or concerning patterns

FORMAT: Return a JSON array of insights with format:
[{"type": "success|warning|tip|info", "title": "Short Title", "message": "Detailed message with specific numbers"}]

Be specific - use the actual numbers, category names, and note details in your analysis!`;
}

// Rule-based insights when AI is not available
function generateRuleBasedInsights(data) {
    const { totalExpenses, totalIncome, categoryDetails, dayOfWeekTotals, expenses } = data;
    const insights = [];

    // Income vs Expense
    const netBalance = totalIncome - totalExpenses;
    if (netBalance > 0) {
        const savingsRate = ((netBalance / totalIncome) * 100).toFixed(0);
        insights.push({
            type: 'success',
            title: 'Positive Balance',
            message: `You saved ${savingsRate}% of your income this period. Keep up the good work!`,
        });
    } else if (netBalance < 0 && totalIncome > 0) {
        insights.push({
            type: 'warning',
            title: 'Overspending Alert',
            message: `You spent more than you earned. Consider reviewing non-essential expenses.`,
        });
    }

    // Top category - handle new structure where categoryDetails has {total, count, notes}
    const sortedCategories = Object.entries(categoryDetails || {}).sort((a, b) => (b[1]?.total || 0) - (a[1]?.total || 0));
    if (sortedCategories.length > 0) {
        const [topCat, topData] = sortedCategories[0];
        const topAmount = topData?.total || 0;
        const percentage = totalExpenses > 0 ? ((topAmount / totalExpenses) * 100).toFixed(0) : 0;
        insights.push({
            type: 'info',
            title: `Top Spending: ${topCat}`,
            message: `${topCat} accounts for ${percentage}% of your spending (${topData?.count || 0} transactions).`,
        });
    }

    // Weekend vs weekday spending
    const weekdayTotal = dayOfWeekTotals.slice(1, 6).reduce((a, b) => a + b, 0);
    const weekendTotal = dayOfWeekTotals[0] + dayOfWeekTotals[6];
    const weekendAvg = weekendTotal / 2;
    const weekdayAvg = weekdayTotal / 5;

    if (weekendAvg > weekdayAvg * 1.5) {
        insights.push({
            type: 'tip',
            title: 'Weekend Spending',
            message: `You spend ${((weekendAvg / weekdayAvg - 1) * 100).toFixed(0)}% more on weekends. Plan weekend activities to manage costs.`,
        });
    }

    // Transaction frequency
    if (expenses.length > 30) {
        insights.push({
            type: 'info',
            title: 'High Activity',
            message: `You made ${expenses.length} transactions. Consider consolidating purchases for better tracking.`,
        });
    }

    return insights;
}

export default router;
