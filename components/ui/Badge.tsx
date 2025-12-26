import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../utils/ThemeContext';

interface BadgeProps {
    label: string;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    size?: 'sm' | 'md';
    style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
    label,
    variant = 'default',
    size = 'sm',
    style,
}) => {
    const { theme } = useTheme();

    const getColors = () => {
        switch (variant) {
            case 'success':
                return { bg: theme.colors.successLight, text: theme.colors.success };
            case 'warning':
                return { bg: theme.colors.warningLight, text: theme.colors.warning };
            case 'error':
                return { bg: theme.colors.errorLight, text: theme.colors.error };
            case 'info':
                return { bg: theme.colors.infoLight, text: theme.colors.info };
            default:
                return { bg: theme.colors.surfaceSecondary, text: theme.colors.textSecondary };
        }
    };

    const colors = getColors();
    const fontSize = size === 'sm' ? 12 : 14;
    const padding = size === 'sm' ? { paddingVertical: 4, paddingHorizontal: 8 } : { paddingVertical: 6, paddingHorizontal: 12 };

    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: colors.bg,
                    borderRadius: theme.borderRadius.full,
                    ...padding,
                },
                style,
            ]}
        >
            <Text style={[styles.text, { color: colors.text, fontSize }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        alignSelf: 'flex-start',
    },
    text: {
        fontWeight: '600',
    },
});
