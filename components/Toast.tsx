import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../utils/ThemeContext';

interface ToastConfig {
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
}

interface ToastContextType {
    showToast: (config: ToastConfig) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        return { showToast: (config: ToastConfig) => console.log(config.message) };
    }
    return context;
};

const ICONS: Record<string, string> = {
    success: 'check-circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
};

const COLORS: Record<string, string> = {
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { theme } = useTheme();
    const [toast, setToast] = useState<ToastConfig | null>(null);
    const [opacity] = useState(new Animated.Value(0));
    const [translateY] = useState(new Animated.Value(-20));

    const showToast = useCallback((config: ToastConfig) => {
        setToast(config);

        Animated.parallel([
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();

        setTimeout(() => {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
            ]).start(() => setToast(null));
        }, config.duration || 2500);
    }, [opacity, translateY]);

    const type = toast?.type || 'info';

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <Animated.View
                    style={[
                        styles.container,
                        {
                            backgroundColor: theme.colors.surface,
                            borderLeftColor: COLORS[type],
                            opacity,
                            transform: [{ translateY }],
                        },
                    ]}
                >
                    <View style={[styles.iconBox, { backgroundColor: COLORS[type] + '20' }]}>
                        <MaterialIcons name={ICONS[type] as any} size={20} color={COLORS[type]} />
                    </View>
                    <Text style={[styles.message, { color: theme.colors.text }]} numberOfLines={2}>
                        {toast.message}
                    </Text>
                    <TouchableOpacity onPress={() => setToast(null)} style={styles.close}>
                        <MaterialIcons name="close" size={18} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </ToastContext.Provider>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 9999,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    message: {
        flex: 1,
        fontSize: 14,
        fontWeight: '500',
    },
    close: {
        padding: 4,
        marginLeft: 8,
    },
});
