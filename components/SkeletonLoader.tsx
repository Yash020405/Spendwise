import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, Easing } from 'react-native';
import { useTheme } from '../utils/ThemeContext';

interface SkeletonProps {
    width?: number | string;
    height?: number;
    borderRadius?: number;
    style?: ViewStyle;
}

/**
 * Skeleton loading placeholder with smooth shimmer animation
 * Use for perceived performance improvement while data loads
 */
export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
    const { theme } = useTheme();
    const shimmerValue = useRef(new Animated.Value(0.4)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(shimmerValue, {
                    toValue: 0.7,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(shimmerValue, {
                    toValue: 0.4,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [shimmerValue]);

    return (
        <Animated.View
            style={[
                {
                    width: width as any,
                    height,
                    borderRadius,
                    backgroundColor: theme.colors.border,
                    opacity: shimmerValue,
                },
                style,
            ]}
        />
    );
}

/**
 * Skeleton for expense/transaction list items
 */
export function TransactionItemSkeleton() {
    const { theme } = useTheme();
    return (
        <View style={[styles.transactionItem, { backgroundColor: theme.colors.surface }]}>
            <Skeleton width={44} height={44} borderRadius={12} />
            <View style={styles.transactionContent}>
                <Skeleton width="60%" height={16} />
                <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
            </View>
            <Skeleton width={70} height={18} />
        </View>
    );
}

/**
 * Skeleton for category breakdown items
 */
export function CategoryItemSkeleton() {
    const { theme } = useTheme();
    return (
        <View style={[styles.categoryItem, { borderBottomColor: theme.colors.border }]}>
            <Skeleton width={44} height={44} borderRadius={12} />
            <View style={styles.categoryContent}>
                <View style={styles.categoryHeader}>
                    <Skeleton width="50%" height={16} />
                    <Skeleton width={60} height={16} />
                </View>
                <Skeleton width="30%" height={12} style={{ marginTop: 6 }} />
                <Skeleton width="100%" height={4} borderRadius={2} style={{ marginTop: 8 }} />
            </View>
        </View>
    );
}

/**
 * Skeleton for stat cards on home screen
 */
export function StatCardSkeleton() {
    const { theme } = useTheme();
    return (
        <View style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
            <Skeleton width={36} height={36} borderRadius={10} />
            <Skeleton width={80} height={20} style={{ marginTop: 8 }} />
            <Skeleton width={50} height={12} style={{ marginTop: 4 }} />
        </View>
    );
}

/**
 * Skeleton for the main balance card
 */
export function BalanceCardSkeleton() {
    const { theme } = useTheme();
    return (
        <View style={[styles.balanceCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.balanceHeader}>
                <Skeleton width={120} height={14} />
                <Skeleton width={80} height={24} borderRadius={12} />
            </View>
            <Skeleton width={180} height={42} style={{ marginTop: 12 }} />
            <Skeleton width={140} height={14} style={{ marginTop: 8 }} />
            <Skeleton width="100%" height={6} borderRadius={3} style={{ marginTop: 16 }} />
        </View>
    );
}

/**
 * Full page loading skeleton for home screen
 */
export function HomeScreenSkeleton() {
    return (
        <View style={styles.container}>
            <BalanceCardSkeleton />
            <View style={styles.statsRow}>
                <StatCardSkeleton />
                <StatCardSkeleton />
            </View>
            <View style={styles.section}>
                <Skeleton width={120} height={18} style={{ marginBottom: 16 }} />
                {[1, 2, 3].map(i => (
                    <TransactionItemSkeleton key={i} />
                ))}
            </View>
        </View>
    );
}

/**
 * Full page loading skeleton for expenses screen
 */
export function ExpensesScreenSkeleton() {
    return (
        <View style={styles.container}>
            <Skeleton width="100%" height={44} borderRadius={12} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={40} borderRadius={10} style={{ marginBottom: 16 }} />
            {[1, 2, 3, 4, 5].map(i => (
                <TransactionItemSkeleton key={i} />
            ))}
        </View>
    );
}

/**
 * Full page loading skeleton for insights screen
 */
export function InsightsScreenSkeleton() {
    return (
        <View style={styles.container}>
            <Skeleton width="100%" height={44} borderRadius={12} style={{ marginBottom: 16 }} />
            <Skeleton width={200} height={200} borderRadius={100} style={{ alignSelf: 'center', marginVertical: 20 }} />
            {[1, 2, 3].map(i => (
                <CategoryItemSkeleton key={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    transactionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
    },
    transactionContent: {
        flex: 1,
        marginLeft: 12,
    },
    categoryItem: {
        flexDirection: 'row',
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    categoryContent: {
        flex: 1,
        marginLeft: 14,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        marginHorizontal: 4,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: 24,
    },
    balanceCard: {
        padding: 24,
        borderRadius: 20,
        marginBottom: 20,
    },
    balanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    section: {
        marginTop: 8,
    },
});
