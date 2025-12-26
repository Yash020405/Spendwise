import React from 'react';
import {
    TouchableOpacity,
    Text,
    StyleSheet,
    ActivityIndicator,
    ViewStyle,
    TextStyle,
} from 'react-native';
import { useTheme } from '../../utils/ThemeContext';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    fullWidth?: boolean;
    style?: ViewStyle;
    textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    icon,
    fullWidth = false,
    style,
    textStyle,
}) => {
    const { theme } = useTheme();

    const getBackgroundColor = () => {
        if (disabled) return theme.colors.borderLight;
        switch (variant) {
            case 'primary':
                return theme.colors.primary;
            case 'secondary':
                return theme.colors.surfaceSecondary;
            case 'outline':
            case 'ghost':
                return 'transparent';
            default:
                return theme.colors.primary;
        }
    };

    const getTextColor = () => {
        if (disabled) return theme.colors.textTertiary;
        switch (variant) {
            case 'primary':
                return '#FFFFFF';
            case 'secondary':
                return theme.colors.text;
            case 'outline':
            case 'ghost':
                return theme.colors.primary;
            default:
                return '#FFFFFF';
        }
    };

    const getPadding = () => {
        switch (size) {
            case 'sm':
                return { paddingVertical: 8, paddingHorizontal: 16 };
            case 'md':
                return { paddingVertical: 14, paddingHorizontal: 24 };
            case 'lg':
                return { paddingVertical: 18, paddingHorizontal: 32 };
            default:
                return { paddingVertical: 14, paddingHorizontal: 24 };
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm':
                return 14;
            case 'md':
                return 16;
            case 'lg':
                return 18;
            default:
                return 16;
        }
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={[
                styles.button,
                {
                    backgroundColor: getBackgroundColor(),
                    borderColor: variant === 'outline' ? theme.colors.primary : 'transparent',
                    borderWidth: variant === 'outline' ? 2 : 0,
                    borderRadius: theme.borderRadius.md,
                    ...getPadding(),
                },
                fullWidth && styles.fullWidth,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.text,
                            {
                                color: getTextColor(),
                                fontSize: getFontSize(),
                                marginLeft: icon ? 8 : 0,
                            },
                            textStyle,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    text: {
        fontWeight: '600',
    },
});
