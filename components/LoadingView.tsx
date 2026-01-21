import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '../utils/ThemeContext';

interface LoadingViewProps {
    message?: string;
    size?: 'small' | 'large';
    fullScreen?: boolean;
}

/**
 * Clean loading indicator component
 */
export function LoadingView({ message, size = 'large', fullScreen = true }: LoadingViewProps) {
    const { theme } = useTheme();

    return (
        <View style={[
            styles.container,
            fullScreen && styles.fullScreen,
            { backgroundColor: fullScreen ? theme.colors.background : 'transparent' }
        ]}>
            <ActivityIndicator size={size} color={theme.colors.primary} />
            {message && (
                <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
                    {message}
                </Text>
            )}
        </View>
    );
}

/**
 * Inline loading for smaller sections
 */
export function InlineLoading({ message }: { message?: string }) {
    const { theme } = useTheme();

    return (
        <View style={styles.inline}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            {message && (
                <Text style={[styles.inlineMessage, { color: theme.colors.textSecondary }]}>
                    {message}
                </Text>
            )}
        </View>
    );
}

/**
 * Loading overlay for modals/actions
 */
export function LoadingOverlay({ message }: { message?: string }) {
    const { theme } = useTheme();

    return (
        <View style={styles.overlay}>
            <View style={[styles.overlayContent, { backgroundColor: theme.colors.surface }]}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                {message && (
                    <Text style={[styles.message, { color: theme.colors.text }]}>
                        {message}
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    fullScreen: {
        flex: 1,
    },
    message: {
        marginTop: 12,
        fontSize: 14,
        fontWeight: '500',
    },
    inline: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
    },
    inlineMessage: {
        marginLeft: 10,
        fontSize: 14,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayContent: {
        padding: 24,
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 120,
    },
});

export default LoadingView;
