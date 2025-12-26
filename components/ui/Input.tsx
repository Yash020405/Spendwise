import React, { useState } from 'react';
import {
    View,
    TextInput,
    Text,
    StyleSheet,
    ViewStyle,
    TextInputProps,
    TouchableOpacity,
} from 'react-native';
import { useTheme } from '../../utils/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    leftIcon?: keyof typeof MaterialIcons.glyphMap;
    rightIcon?: keyof typeof MaterialIcons.glyphMap;
    onRightIconPress?: () => void;
    containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    leftIcon,
    rightIcon,
    onRightIconPress,
    containerStyle,
    secureTextEntry,
    ...props
}) => {
    const { theme } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const getBorderColor = () => {
        if (error) return theme.colors.error;
        if (isFocused) return theme.colors.primary;
        return theme.colors.border;
    };

    const showPasswordToggle = secureTextEntry !== undefined;
    const actualSecureEntry = secureTextEntry && !isPasswordVisible;

    return (
        <View style={[styles.container, containerStyle]}>
            {label && (
                <Text
                    style={[
                        styles.label,
                        {
                            color: error ? theme.colors.error : theme.colors.textSecondary,
                            ...theme.typography.bodySmall,
                        },
                    ]}
                >
                    {label}
                </Text>
            )}
            <View
                style={[
                    styles.inputContainer,
                    {
                        borderColor: getBorderColor(),
                        backgroundColor: theme.colors.surface,
                        borderRadius: theme.borderRadius.md,
                    },
                ]}
            >
                {leftIcon && (
                    <MaterialIcons
                        name={leftIcon}
                        size={20}
                        color={theme.colors.textSecondary}
                        style={styles.leftIcon}
                    />
                )}
                <TextInput
                    {...props}
                    secureTextEntry={actualSecureEntry}
                    onFocus={(e) => {
                        setIsFocused(true);
                        props.onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setIsFocused(false);
                        props.onBlur?.(e);
                    }}
                    placeholderTextColor={theme.colors.textTertiary}
                    style={[
                        styles.input,
                        {
                            color: theme.colors.text,
                            ...theme.typography.body,
                        },
                        props.style,
                    ]}
                />
                {showPasswordToggle && (
                    <TouchableOpacity
                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                        style={styles.rightIcon}
                    >
                        <MaterialIcons
                            name={isPasswordVisible ? 'visibility' : 'visibility-off'}
                            size={20}
                            color={theme.colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
                {rightIcon && !showPasswordToggle && (
                    <TouchableOpacity
                        onPress={onRightIconPress}
                        style={styles.rightIcon}
                        disabled={!onRightIconPress}
                    >
                        <MaterialIcons
                            name={rightIcon}
                            size={20}
                            color={theme.colors.textSecondary}
                        />
                    </TouchableOpacity>
                )}
            </View>
            {error && (
                <Text
                    style={[
                        styles.error,
                        {
                            color: theme.colors.error,
                            ...theme.typography.caption,
                        },
                    ]}
                >
                    {error}
                </Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    label: {
        marginBottom: 8,
        fontWeight: '500',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        paddingHorizontal: 16,
        height: 52,
    },
    input: {
        flex: 1,
        height: '100%',
    },
    leftIcon: {
        marginRight: 12,
    },
    rightIcon: {
        marginLeft: 12,
        padding: 4,
    },
    error: {
        marginTop: 6,
    },
});
