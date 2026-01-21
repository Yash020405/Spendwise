import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../utils/ThemeContext';
import { moderateScale, cardDimensions } from '../../utils/responsive';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'glass';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    padding = 'md',
    style,
}) => {
    const { theme, isDark } = useTheme();

    const getPadding = () => {
        switch (padding) {
            case 'none':
                return 0;
            case 'sm':
                return moderateScale(theme.spacing.sm);
            case 'md':
                return moderateScale(theme.spacing.md);
            case 'lg':
                return moderateScale(theme.spacing.lg);
            default:
                return moderateScale(theme.spacing.md);
        }
    };

    const getStyles = (): ViewStyle => {
        const baseStyle: ViewStyle = {
            backgroundColor: theme.colors.surface,
            borderRadius: cardDimensions.borderRadius,
            padding: getPadding(),
        };

        switch (variant) {
            case 'elevated':
                return {
                    ...baseStyle,
                    ...theme.shadows.md,
                };
            case 'glass':
                return {
                    ...baseStyle,
                    backgroundColor: isDark
                        ? 'rgba(30, 41, 59, 0.8)'
                        : 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 1,
                    borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(0, 0, 0, 0.05)',
                };
            default:
                return {
                    ...baseStyle,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                };
        }
    };

    return <View style={[getStyles(), style]}>{children}</View>;
};
