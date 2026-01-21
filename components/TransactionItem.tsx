import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
    Food: { color: '#F59E0B', icon: 'restaurant' },
    Transport: { color: '#3B82F6', icon: 'directions-car' },
    Shopping: { color: '#EC4899', icon: 'shopping-bag' },
    Entertainment: { color: '#8B5CF6', icon: 'movie' },
    Bills: { color: '#EF4444', icon: 'receipt' },
    Health: { color: '#10B981', icon: 'local-hospital' },
    Education: { color: '#06B6D4', icon: 'school' },
    Other: { color: '#6B7280', icon: 'more-horiz' },
};

interface TransactionItemProps {
    item: {
        _id: string;
        amount: number;
        description?: string;
        date: string;
        type: 'expense' | 'income';
        category?: string;
        paymentMethod?: string;
        source?: string;
        isSplit?: boolean;
        userShare?: number;
        payer?: string;
        userHasPaidShare?: boolean;
    };
    currencySymbol: string;
    onPress?: () => void;
    theme: any;
}

/**
 * Memoized transaction item component for FlatList rendering
 * Prevents unnecessary re-renders when other items in the list change
 */
const TransactionItem = memo(function TransactionItem({
    item,
    currencySymbol,
    onPress,
    theme,
}: TransactionItemProps) {
    const isIncome = item.type === 'income';
    const config = isIncome
        ? { color: '#10B981', icon: 'trending-up' }
        : (CATEGORY_CONFIG[item.category || 'Other'] || CATEGORY_CONFIG.Other);

    // Use userShare for split expenses, otherwise use full amount
    const displayAmount = !isIncome && item.isSplit ? (item.userShare || item.amount) : item.amount;

    // Check if this is a split expense where someone else paid and user hasn't paid their share
    const iOweOnThis = item.isSplit && item.payer && item.payer !== 'me' && !item.userHasPaidShare;

    return (
        <TouchableOpacity
            style={[styles.container, { backgroundColor: theme.colors.surface }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.icon, { backgroundColor: config.color + '20' }]}>
                <MaterialIcons name={config.icon as any} size={22} color={config.color} />
            </View>
            <View style={styles.details}>
                <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
                    {item.description || (isIncome ? item.source : item.category)}
                </Text>
                <View style={styles.subtitleRow}>
                    <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                        {isIncome ? 'Income' : item.paymentMethod}
                    </Text>
                    {item.isSplit && (
                        <View style={[styles.splitBadge, { backgroundColor: iOweOnThis ? '#F59E0B' + '20' : '#8B5CF6' + '20' }]}>
                            <MaterialIcons name={iOweOnThis ? 'warning' : 'group'} size={10} color={iOweOnThis ? '#F59E0B' : '#8B5CF6'} />
                            <Text style={[styles.splitText, { color: iOweOnThis ? '#F59E0B' : '#8B5CF6' }]}>
                                {iOweOnThis ? 'You owe' : 'Split'}
                            </Text>
                        </View>
                    )}
                </View>
            </View>
            <Text style={[styles.amount, { color: isIncome ? '#10B981' : theme.colors.text }]}>
                {isIncome ? '+' : '-'}{currencySymbol}{displayAmount.toLocaleString()}
            </Text>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for memo - only re-render if these change
    return (
        prevProps.item._id === nextProps.item._id &&
        prevProps.item.amount === nextProps.item.amount &&
        prevProps.item.userShare === nextProps.item.userShare &&
        prevProps.item.isSplit === nextProps.item.isSplit &&
        prevProps.item.userHasPaidShare === nextProps.item.userHasPaidShare &&
        prevProps.item.payer === nextProps.item.payer &&
        prevProps.currencySymbol === nextProps.currencySymbol
    );
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        padding: 14,
        borderRadius: 12,
    },
    icon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    details: {
        flex: 1,
        marginLeft: 12,
    },
    title: {
        fontSize: 15,
        fontWeight: '600',
    },
    subtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        gap: 6,
    },
    subtitle: {
        fontSize: 13,
    },
    splitBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 3,
    },
    splitText: {
        fontSize: 10,
        fontWeight: '600',
    },
    amount: {
        fontSize: 16,
        fontWeight: '700',
    },
});

export default TransactionItem;
