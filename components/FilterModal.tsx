import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../utils/ThemeContext';

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    initialFilters: FilterState;
    categoryConfig: Record<string, { color: string; icon: string }>;
    paymentConfig: Record<string, { icon: string; color: string }>;
}

export interface FilterState {
    type: 'all' | 'expense' | 'income';
    categories: string[];
    paymentMethods: string[];
    startDate?: Date;
    endDate?: Date;
    dateMode: 'default' | 'custom'; // default respects the ViewMode (Daily/Weekly/Monthly) outside
}

export default function FilterModal({
    visible,
    onClose,
    onApply,
    initialFilters,
    categoryConfig,
    paymentConfig,
}: FilterModalProps) {
    const { theme } = useTheme();

    const [filters, setFilters] = useState<FilterState>(initialFilters);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    useEffect(() => {
        if (visible) {
            setFilters(initialFilters);
        }
    }, [visible, initialFilters]);

    const toggleCategory = (cat: string) => {
        const current = filters.categories;
        const index = current.indexOf(cat);
        let newCats: string[];
        if (index >= 0) {
            newCats = current.filter(c => c !== cat);
        } else {
            newCats = [...current, cat];
        }
        setFilters({ ...filters, categories: newCats });
    };

    const togglePayment = (pm: string) => {
        const current = filters.paymentMethods;
        const index = current.indexOf(pm);
        let newPms: string[];
        if (index >= 0) {
            newPms = current.filter(p => p !== pm);
        } else {
            newPms = [...current, pm];
        }
        setFilters({ ...filters, paymentMethods: newPms });
    };

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({
            type: 'all',
            categories: [],
            paymentMethods: [],
            startDate: undefined,
            endDate: undefined,
            dateMode: 'default',
        });
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Filters</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                        {/* Transaction Type */}
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Type</Text>
                        <View style={styles.row}>
                            {(['all', 'expense', 'income'] as const).map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    style={[
                                        styles.chip,
                                        filters.type === t && { backgroundColor: theme.colors.primary },
                                        filters.type !== t && { borderColor: theme.colors.border, borderWidth: 1 }
                                    ]}
                                    onPress={() => setFilters({ ...filters, type: t })}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        { color: filters.type === t ? '#FFF' : theme.colors.text }
                                    ]}>
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Date Range */}
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 16 }]}>Date Range</Text>
                        <View style={styles.row}>
                            <TouchableOpacity
                                style={[
                                    styles.chip,
                                    filters.dateMode === 'default' && { backgroundColor: theme.colors.primary },
                                    filters.dateMode !== 'default' && { borderColor: theme.colors.border, borderWidth: 1 }
                                ]}
                                onPress={() => setFilters({ ...filters, dateMode: 'default' })}
                            >
                                <Text style={[styles.chipText, { color: filters.dateMode === 'default' ? '#FFF' : theme.colors.text }]}>
                                    Default View
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.chip,
                                    filters.dateMode === 'custom' && { backgroundColor: theme.colors.primary },
                                    filters.dateMode !== 'custom' && { borderColor: theme.colors.border, borderWidth: 1 }
                                ]}
                                onPress={() => setFilters({ ...filters, dateMode: 'custom', startDate: new Date(), endDate: new Date() })}
                            >
                                <Text style={[styles.chipText, { color: filters.dateMode === 'custom' ? '#FFF' : theme.colors.text }]}>
                                    Custom Range
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {filters.dateMode === 'custom' && (
                            <View style={styles.datePickerRow}>
                                <TouchableOpacity
                                    style={[styles.dateBtn, { backgroundColor: theme.colors.background }]}
                                    onPress={() => setShowStartPicker(true)}
                                >
                                    <Text style={{ color: theme.colors.text }}>
                                        {filters.startDate ? filters.startDate.toLocaleDateString() : 'Start Date'}
                                    </Text>
                                </TouchableOpacity>
                                <Text style={{ color: theme.colors.text }}>to</Text>
                                <TouchableOpacity
                                    style={[styles.dateBtn, { backgroundColor: theme.colors.background }]}
                                    onPress={() => setShowEndPicker(true)}
                                >
                                    <Text style={{ color: theme.colors.text }}>
                                        {filters.endDate ? filters.endDate.toLocaleDateString() : 'End Date'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Categories */}
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 16 }]}>Categories</Text>
                        <View style={styles.grid}>
                            {Object.entries(categoryConfig).map(([name, conf]) => {
                                const isSelected = filters.categories.includes(name);
                                return (
                                    <TouchableOpacity
                                        key={name}
                                        style={[
                                            styles.categoryChip,
                                            isSelected && { backgroundColor: conf.color + '20', borderColor: conf.color, borderWidth: 1 },
                                            !isSelected && { backgroundColor: theme.colors.background }
                                        ]}
                                        onPress={() => toggleCategory(name)}
                                    >
                                        <MaterialIcons name={conf.icon as any} size={16} color={isSelected ? conf.color : theme.colors.textSecondary} />
                                        <Text style={[
                                            styles.categoryText,
                                            { color: isSelected ? conf.color : theme.colors.text }
                                        ]}>{name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Payment Methods */}
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 16 }]}>Payment Methods</Text>
                        <View style={styles.grid}>
                            {Object.entries(paymentConfig).map(([name, conf]) => {
                                const isSelected = filters.paymentMethods.includes(name);
                                return (
                                    <TouchableOpacity
                                        key={name}
                                        style={[
                                            styles.categoryChip,
                                            isSelected && { backgroundColor: conf.color + '20', borderColor: conf.color, borderWidth: 1 },
                                            !isSelected && { backgroundColor: theme.colors.background }
                                        ]}
                                        onPress={() => togglePayment(name)}
                                    >
                                        <MaterialIcons name={conf.icon as any} size={16} color={isSelected ? conf.color : theme.colors.textSecondary} />
                                        <Text style={[
                                            styles.categoryText,
                                            { color: isSelected ? conf.color : theme.colors.text }
                                        ]}>{name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                            <Text style={[styles.resetText, { color: theme.colors.textSecondary }]}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.applyBtn, { backgroundColor: theme.colors.primary }]} onPress={handleApply}>
                            <Text style={styles.applyText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {showStartPicker && (
                <DateTimePicker
                    value={filters.startDate || new Date()}
                    mode="date"
                    onChange={(e, date) => {
                        setShowStartPicker(Platform.OS === 'ios');
                        if (date) setFilters({ ...filters, startDate: date });
                    }}
                />
            )}
            {showEndPicker && (
                <DateTimePicker
                    value={filters.endDate || new Date()}
                    mode="date"
                    onChange={(e, date) => {
                        setShowEndPicker(Platform.OS === 'ios');
                        if (date) setFilters({ ...filters, endDate: date });
                    }}
                />
            )}
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { height: '80%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
    title: { fontSize: 18, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 100 },
    sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    chipText: { fontSize: 14, fontWeight: '500' },
    datePickerRow: { flexDirection: 'row', marginTop: 12, alignItems: 'center', gap: 12 },
    dateBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    categoryText: { fontSize: 13, fontWeight: '500' },
    footer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', justifyContent: 'space-between', alignItems: 'center' },
    resetBtn: { padding: 12 },
    resetText: { fontSize: 15, fontWeight: '600' },
    applyBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
    applyText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
});
