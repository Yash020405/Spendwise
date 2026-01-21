import React, { useState, useCallback } from 'react';
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

interface AIInsight {
    type: 'success' | 'warning' | 'info' | 'tip';
    title: string;
    message: string;
}

interface AIInsightsCardProps {
    onRefresh?: () => void;
}

export default function AIInsightsCard({ onRefresh: _onRefresh }: AIInsightsCardProps) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<AIInsight[]>([]);
    const [, setSummary] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

    const fetchInsights = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const response: any = await api.getAIInsights(token, timeRange);
            if (response.success && response.data) {
                setInsights(response.data.insights || []);
                setSummary(response.data.summary);
            } else {
                setError('Failed to get insights');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to get insights');
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'success': return { name: 'check-circle', color: '#10B981' };
            case 'warning': return { name: 'warning', color: '#F59E0B' };
            case 'tip': return { name: 'lightbulb', color: '#8B5CF6' };
            default: return { name: 'info', color: '#3B82F6' };
        }
    };

    const getInsightBg = (type: string) => {
        switch (type) {
            case 'success': return '#10B98115';
            case 'warning': return '#F59E0B15';
            case 'tip': return '#8B5CF615';
            default: return '#3B82F615';
        }
    };

    return (
        <Card style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <MaterialIcons name="auto-awesome" size={20} color={theme.colors.primary} />
                    <Text style={[styles.title, { color: theme.colors.text }]}>Smart Insights</Text>
                </View>
                <TouchableOpacity onPress={fetchInsights} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : (
                        <MaterialIcons name="refresh" size={22} color={theme.colors.primary} />
                    )}
                </TouchableOpacity>
            </View>

            {/* Time Range Pills */}
            <View style={styles.pills}>
                {(['week', 'month', 'year'] as const).map((range) => (
                    <TouchableOpacity
                        key={range}
                        style={[
                            styles.pill,
                            { backgroundColor: timeRange === range ? theme.colors.primary : theme.colors.surface }
                        ]}
                        onPress={() => setTimeRange(range)}
                    >
                        <Text style={[
                            styles.pillText,
                            { color: timeRange === range ? '#FFF' : theme.colors.textSecondary }
                        ]}>
                            {range.charAt(0).toUpperCase() + range.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Content */}
            {insights.length === 0 && !loading && !error && (
                <View style={styles.emptyState}>
                    <MaterialIcons name="psychology" size={40} color={theme.colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                        Tap refresh to get personalized{'\n'}spending insights
                    </Text>
                </View>
            )}

            {error && (
                <View style={styles.emptyState}>
                    <MaterialIcons name="error-outline" size={40} color={theme.colors.error} />
                    <Text style={[styles.emptyText, { color: theme.colors.error }]}>{error}</Text>
                </View>
            )}

            {insights.length > 0 && (
                <ScrollView style={styles.insightsList} showsVerticalScrollIndicator={false}>
                    {insights.map((insight, index) => {
                        const iconConfig = getInsightIcon(insight.type);
                        return (
                            <View
                                key={index}
                                style={[styles.insightItem, { backgroundColor: getInsightBg(insight.type) }]}
                            >
                                <View style={styles.insightIcon}>
                                    <MaterialIcons name={iconConfig.name as any} size={18} color={iconConfig.color} />
                                </View>
                                <View style={styles.insightContent}>
                                    <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                                        {insight.title}
                                    </Text>
                                    <Text style={[styles.insightMessage, { color: theme.colors.textSecondary }]}>
                                        {insight.message}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>
            )}
        </Card>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    pills: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    pill: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    insightsList: {
        maxHeight: 250,
    },
    insightItem: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    insightIcon: {
        marginRight: 12,
        marginTop: 2,
    },
    insightContent: {
        flex: 1,
    },
    insightTitle: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    insightMessage: {
        fontSize: 13,
        lineHeight: 18,
    },
});
