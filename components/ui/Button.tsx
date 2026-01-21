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
import { moderateScale, scaleFontSize, touchTarget } from '../../utils/responsive';

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
                return { paddingVertical: moderateScale(8), paddingHorizontal: moderateScale(16) };
            case 'md':
                return { paddingVertical: moderateScale(14), paddingHorizontal: moderateScale(24) };
            case 'lg':
                return { paddingVertical: moderateScale(18), paddingHorizontal: moderateScale(32) };
            default:
                return { paddingVertical: moderateScale(14), paddingHorizontal: moderateScale(24) };
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm':
                return scaleFontSize(14);
            case 'md':
                return scaleFontSize(16);
            case 'lg':
                return scaleFontSize(18);
            default:
                return scaleFontSize(16);
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
                    borderRadius: moderateScale(theme.borderRadius.md),
                    minHeight: touchTarget.minSize, // Ensure minimum touch target
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
                                marginLeft: icon ? moderateScale(8) : 0,
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
