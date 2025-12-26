import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../utils/ThemeContext';
import { Input, Button } from '../../components/ui';
import api from '../../utils/api';

const CURRENCIES = [
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'Pound' },
];

export default function RegisterScreen() {
    const { theme } = useTheme();
    const router = useRouter();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedCurrency, setSelectedCurrency] = useState('INR');
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!name.trim()) newErrors.name = 'Name is required';
        if (!email.trim()) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email';
        if (!password) newErrors.password = 'Password is required';
        else if (password.length < 6) newErrors.password = 'Min 6 characters';
        if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords don\'t match';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async () => {
        if (!validate()) return;

        setLoading(true);
        try {
            const response: any = await api.signup({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
                currency: selectedCurrency,
            });

            if (response.success) {
                await AsyncStorage.setItem('@auth_token', response.data.token);
                await AsyncStorage.setItem('@user', JSON.stringify(response.data.user));
                router.replace('/(main)/home');
            } else {
                Alert.alert('Error', response.message || 'Registration failed');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Back Button */}
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: theme.colors.surface }]}
                        onPress={() => router.back()}
                    >
                        <MaterialIcons name="arrow-back" size={22} color={theme.colors.text} />
                    </TouchableOpacity>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>
                            Create Account
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
                            Start tracking your expenses today
                        </Text>
                    </View>

                    {/* Form */}
                    <View style={styles.form}>
                        <Input
                            label="Name"
                            placeholder="John Doe"
                            value={name}
                            onChangeText={setName}
                            leftIcon="person"
                            error={errors.name}
                            autoCapitalize="words"
                        />

                        <Input
                            label="Email"
                            placeholder="john@email.com"
                            value={email}
                            onChangeText={setEmail}
                            leftIcon="email"
                            error={errors.email}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <Input
                            label="Password"
                            placeholder="••••••••"
                            value={password}
                            onChangeText={setPassword}
                            leftIcon="lock"
                            error={errors.password}
                            isPassword
                        />

                        <Input
                            label="Confirm Password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            leftIcon="lock-outline"
                            error={errors.confirmPassword}
                            isPassword
                        />

                        {/* Currency Selection */}
                        <View style={styles.currencySection}>
                            <Text style={[styles.currencyLabel, { color: theme.colors.text }]}>
                                Currency
                            </Text>
                            <View style={styles.currencyOptions}>
                                {CURRENCIES.map((curr) => (
                                    <TouchableOpacity
                                        key={curr.code}
                                        style={[
                                            styles.currencyOption,
                                            {
                                                backgroundColor: selectedCurrency === curr.code
                                                    ? theme.colors.primary
                                                    : theme.colors.surface,
                                                borderColor: selectedCurrency === curr.code
                                                    ? theme.colors.primary
                                                    : theme.colors.border,
                                            },
                                        ]}
                                        onPress={() => setSelectedCurrency(curr.code)}
                                    >
                                        <Text
                                            style={[
                                                styles.currencySymbol,
                                                {
                                                    color: selectedCurrency === curr.code
                                                        ? '#FFFFFF'
                                                        : theme.colors.text,
                                                },
                                            ]}
                                        >
                                            {curr.symbol}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.currencyCode,
                                                {
                                                    color: selectedCurrency === curr.code
                                                        ? '#FFFFFF'
                                                        : theme.colors.textSecondary,
                                                },
                                            ]}
                                        >
                                            {curr.code}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <Button
                        title={loading ? 'Creating...' : 'Create Account'}
                        onPress={handleRegister}
                        loading={loading}
                        disabled={loading}
                        style={styles.submitButton}
                    />

                    {/* Login Link */}
                    <TouchableOpacity
                        style={styles.loginLink}
                        onPress={() => router.push('/(auth)/login')}
                    >
                        <Text style={[styles.loginText, { color: theme.colors.textSecondary }]}>
                            Already have an account?{' '}
                            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
                                Sign In
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 32,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    header: {
        marginBottom: 28,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
    },
    form: {
        gap: 16,
    },
    currencySection: {
        marginTop: 4,
    },
    currencyLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 10,
    },
    currencyOptions: {
        flexDirection: 'row',
        gap: 10,
    },
    currencyOption: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    currencySymbol: {
        fontSize: 18,
        fontWeight: '700',
    },
    currencyCode: {
        fontSize: 11,
        marginTop: 2,
    },
    submitButton: {
        marginTop: 28,
    },
    loginLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    loginText: {
        fontSize: 14,
    },
});
