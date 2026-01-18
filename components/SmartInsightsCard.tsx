import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/ThemeContext';
import { Card } from './ui';
import api from '../utils/api';

interface Insight {
    type: 'success' | 'warning' | 'info' | 'tip';
    title: string;
    message: string;
}

interface SmartInsightsCardProps {
    selectedMonth?: Date;
}

export default function SmartInsightsCard({ selectedMonth }: SmartInsightsCardProps) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(true); // Default expanded for better visibility

    // Format month for display
    const getMonthLabel = () => {
        if (!selectedMonth) return 'This Month';
        return selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const fetchInsights = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            // Always use the selectedMonth prop, or default to current month
            const targetDate = selectedMonth || new Date();
            const month = targetDate.getMonth();  // 0-indexed
            const year = targetDate.getFullYear();

            console.log('🔍 SmartInsights: Fetching for', targetDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), '-> month:', month, 'year:', year);

            const response: any = await api.getAIInsights(token, 'month', month, year);
            console.log('🔍 SmartInsights: Full API Response:', JSON.stringify(response, null, 2));
            if (response.success && response.data) {
                console.log('🔍 SmartInsights: Summary data:', response.data.summary);
                setInsights(response.data.insights || []);
                setSummary(response.data.summary);
            } else {
                setError('Unable to generate insights');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to get insights');
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch when month changes
    useEffect(() => {
        fetchInsights();
    }, [selectedMonth]);

    const getInsightStyle = (type: string) => {
        switch (type) {
            case 'success': return { icon: 'check-circle', color: '#10B981', bg: '#10B98120' };
            case 'warning': return { icon: 'warning', color: '#F59E0B', bg: '#F59E0B20' };
            case 'tip': return { icon: 'lightbulb', color: '#8B5CF6', bg: '#8B5CF620' };
            default: return { icon: 'info', color: '#3B82F6', bg: '#3B82F620' };
        }
    };

    return (
        <Card style={[styles.container, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }] as any}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={[styles.iconBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                        <MaterialIcons name="auto-awesome" size={20} color={theme.colors.primary} />
                    </View>
                    <View>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Smart Insights</Text>
                        <Text style={[styles.monthLabel, { color: theme.colors.primary }]}>
                            {getMonthLabel()}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={fetchInsights}
                    disabled={loading}
                    style={[styles.refreshBtn, { backgroundColor: theme.colors.background }]}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <MaterialIcons name="refresh" size={20} color={theme.colors.primary} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Summary Stats */}
            {summary && !loading && (
                <View style={[styles.summaryRow, { backgroundColor: theme.colors.background }]}>
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                            +₹{(summary.totalIncome || 0).toLocaleString()}
                        </Text>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Income</Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
                            -₹{(summary.totalExpenses || 0).toLocaleString()}
                        </Text>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Expenses</Text>
                    </View>
                    <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />
                    <View style={styles.summaryItem}>
                        <Text style={[styles.summaryValue, { color: (summary.netBalance || 0) >= 0 ? '#10B981' : '#EF4444' }]}>
                            {(summary.netBalance || 0) >= 0 ? '+' : ''}₹{(summary.netBalance || 0).toLocaleString()}
                        </Text>
                        <Text style={[styles.summaryLabel, { color: theme.colors.textSecondary }]}>Net</Text>
                    </View>
                </View>
            )}

            {/* Loading */}
            {loading && (
                <View style={styles.loadingState}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
                        Analyzing {getMonthLabel()}...
                    </Text>
                </View>
            )}

            {/* Empty State */}
            {insights.length === 0 && !loading && !error && (
                <TouchableOpacity style={styles.emptyState} onPress={fetchInsights}>
                    <MaterialIcons name="psychology" size={40} color={theme.colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                        Tap to analyze {getMonthLabel()}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Error */}
            {error && (
                <TouchableOpacity style={styles.emptyState} onPress={fetchInsights}>
                    <MaterialIcons name="error-outline" size={40} color={theme.colors.error} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>{error}</Text>
                    <Text style={[styles.retryText, { color: theme.colors.primary }]}>Tap to retry</Text>
                </TouchableOpacity>
            )}

            {/* Insights List - Now fully visible */}
            {insights.length > 0 && !loading && (
                <View style={styles.insightsList}>
                    {insights.map((insight, index) => {
                        const style = getInsightStyle(insight.type);
                        return (
                            <View key={index} style={[styles.insightItem, { backgroundColor: style.bg }]}>
                                <View style={styles.insightHeader}>
                                    <MaterialIcons name={style.icon as any} size={18} color={style.color} />
                                    <Text style={[styles.insightTitle, { color: style.color }]}>
                                        {insight.title}
                                    </Text>
                                </View>
                                <Text style={[styles.insightMessage, { color: theme.colors.text }]}>
                                    {insight.message}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            )}
        </Card>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
    },
    monthLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: 2,
    },
    refreshBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    summaryRow: {
        flexDirection: 'row',
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: '700',
    },
    summaryLabel: {
        fontSize: 11,
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        marginHorizontal: 8,
    },

    loadingState: {
        paddingVertical: 32,
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
    },

    emptyState: {
        paddingVertical: 32,
        alignItems: 'center',
        gap: 8,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
    },
    retryText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
    },

    insightsList: {
        gap: 12,
    },
    insightItem: {
        padding: 14,
        borderRadius: 14,
    },
    insightHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    insightTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    insightMessage: {
        fontSize: 14,
        lineHeight: 22,
    },
});
