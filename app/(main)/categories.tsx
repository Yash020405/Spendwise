import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../utils/ThemeContext';
import { useToast } from '../../components/Toast';
import { Card } from '../../components/ui';
import api from '../../utils/api';

// Available icons for categories
const AVAILABLE_ICONS = [
    'restaurant', 'directions-car', 'shopping-bag', 'movie', 'receipt',
    'local-hospital', 'school', 'home', 'flight', 'fitness-center',
    'pets', 'child-care', 'local-cafe', 'local-bar', 'phone',
    'wifi', 'electric-bolt', 'water-drop', 'local-gas-station', 'build',
];

// Available colors
const AVAILABLE_COLORS = [
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
    '#14B8A6', '#A855F7', '#F43F5E', '#22C55E', '#0EA5E9',
];

interface Category {
    _id: string;
    name: string;
    icon: string;
    color: string;
    isDefault: boolean;
    isActive: boolean;
}

export default function CategoriesScreen() {
    const { theme } = useTheme();
    const router = useRouter();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formIcon, setFormIcon] = useState('receipt');
    const [formColor, setFormColor] = useState('#6B7280');

    useFocusEffect(
        useCallback(() => {
            fetchCategories();
        }, [])
    );

    const fetchCategories = async () => {
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            const response: any = await api.getCategories(token);
            if (response.success) {
                setCategories(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            showToast({ message: 'Please enter a name', type: 'warning' });
            return;
        }

        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) return;

            let response: any;
            if (editingId) {
                response = await api.updateCategory(token, editingId, {
                    name: formName.trim(),
                    icon: formIcon,
                    color: formColor,
                });
            } else {
                response = await api.createCategory(token, {
                    name: formName.trim(),
                    icon: formIcon,
                    color: formColor,
                });
            }

            if (response.success) {
                showToast({ message: editingId ? 'Category updated!' : 'Category created!', type: 'success' });
                setShowModal(false);
                resetForm();
                fetchCategories();
            }
        } catch (error) {
            showToast({ message: 'Failed to save', type: 'error' });
        }
    };

    const handleEdit = (cat: Category) => {
        setEditingId(cat._id);
        setFormName(cat.name);
        setFormIcon(cat.icon);
        setFormColor(cat.color);
        setShowModal(true);
    };

    const handleDelete = async (cat: Category) => {
        if (cat.isDefault) {
            showToast({ message: 'Cannot delete default categories', type: 'warning' });
            return;
        }

        Alert.alert(
            'Delete Category',
            `Delete "${cat.name}"? Expenses using this category will remain.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const token = await AsyncStorage.getItem('@auth_token');
                            if (!token) return;

                            const response: any = await api.deleteCategory(token, cat._id);
                            if (response.success) {
                                showToast({ message: 'Deleted', type: 'success' });
                                fetchCategories();
                            }
                        } catch (error) {
                            showToast({ message: 'Failed to delete', type: 'error' });
                        }
                    },
                },
            ]
        );
    };

    const resetForm = () => {
        setEditingId(null);
        setFormName('');
        setFormIcon('receipt');
        setFormColor('#6B7280');
    };

    const openAddModal = () => {
        resetForm();
        setShowModal(true);
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <View style={styles.loadingContainer}>
                    <MaterialIcons name="category" size={48} color={theme.colors.primary} />
                    <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <MaterialIcons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Categories</Text>
                <TouchableOpacity onPress={openAddModal} style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}>
                    <MaterialIcons name="add" size={22} color="#FFF" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCategories(); }} />}
                contentContainerStyle={styles.content}
            >
                {/* Default Categories */}
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>Default</Text>
                {categories.filter(c => c.isDefault).map((cat) => (
                    <Card key={cat._id} style={styles.catCard}>
                        <View style={styles.catRow}>
                            <View style={[styles.iconBox, { backgroundColor: cat.color + '20' }]}>
                                <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                            </View>
                            <Text style={[styles.catName, { color: theme.colors.text }]}>{cat.name}</Text>
                            <View style={[styles.defaultBadge, { backgroundColor: theme.colors.surface }]}>
                                <Text style={[styles.defaultText, { color: theme.colors.textSecondary }]}>Default</Text>
                            </View>
                        </View>
                    </Card>
                ))}

                {/* Custom Categories */}
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 24 }]}>Custom</Text>
                {categories.filter(c => !c.isDefault).length === 0 ? (
                    <Card style={styles.emptyCard}>
                        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                            No custom categories yet
                        </Text>
                    </Card>
                ) : (
                    categories.filter(c => !c.isDefault).map((cat) => (
                        <Card key={cat._id} style={styles.catCard}>
                            <View style={styles.catRow}>
                                <View style={[styles.iconBox, { backgroundColor: cat.color + '20' }]}>
                                    <MaterialIcons name={cat.icon as any} size={22} color={cat.color} />
                                </View>
                                <Text style={[styles.catName, { color: theme.colors.text }]}>{cat.name}</Text>
                                <TouchableOpacity onPress={() => handleEdit(cat)} style={styles.actionBtn}>
                                    <MaterialIcons name="edit" size={18} color={theme.colors.primary} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(cat)} style={styles.actionBtn}>
                                    <MaterialIcons name="delete" size={18} color={theme.colors.error} />
                                </TouchableOpacity>
                            </View>
                        </Card>
                    ))
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Add/Edit Modal */}
            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: theme.colors.background }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                                {editingId ? 'Edit Category' : 'New Category'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                                <MaterialIcons name="close" size={24} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Name */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Name</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                                value={formName}
                                onChangeText={setFormName}
                                placeholder="Category name"
                                placeholderTextColor={theme.colors.textTertiary}
                            />

                            {/* Icon Picker */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Icon</Text>
                            <View style={styles.iconGrid}>
                                {AVAILABLE_ICONS.map((icon) => (
                                    <TouchableOpacity
                                        key={icon}
                                        style={[
                                            styles.iconOption,
                                            { backgroundColor: theme.colors.surface },
                                            formIcon === icon && { backgroundColor: formColor + '30', borderColor: formColor, borderWidth: 2 }
                                        ]}
                                        onPress={() => setFormIcon(icon)}
                                    >
                                        <MaterialIcons name={icon as any} size={22} color={formIcon === icon ? formColor : theme.colors.textSecondary} />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Color Picker */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Color</Text>
                            <View style={styles.colorGrid}>
                                {AVAILABLE_COLORS.map((color) => (
                                    <TouchableOpacity
                                        key={color}
                                        style={[
                                            styles.colorOption,
                                            { backgroundColor: color },
                                            formColor === color && styles.colorSelected
                                        ]}
                                        onPress={() => setFormColor(color)}
                                    >
                                        {formColor === color && <MaterialIcons name="check" size={18} color="#FFF" />}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Preview */}
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Preview</Text>
                            <View style={styles.preview}>
                                <View style={[styles.previewIcon, { backgroundColor: formColor + '20' }]}>
                                    <MaterialIcons name={formIcon as any} size={28} color={formColor} />
                                </View>
                                <Text style={[styles.previewName, { color: theme.colors.text }]}>
                                    {formName || 'Category Name'}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                                onPress={handleSave}
                            >
                                <Text style={styles.saveBtnText}>{editingId ? 'Update' : 'Create'} Category</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    loadingText: { fontSize: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '600' },
    addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20 },
    sectionTitle: { fontSize: 13, fontWeight: '600', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    catCard: { marginBottom: 8 },
    catRow: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    catName: { flex: 1, fontSize: 16, fontWeight: '500' },
    defaultBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    defaultText: { fontSize: 11, fontWeight: '600' },
    actionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    emptyCard: { padding: 24, alignItems: 'center' },
    emptyText: { fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
    modalTitle: { fontSize: 18, fontWeight: '600' },
    label: { fontSize: 14, fontWeight: '500', marginTop: 16, marginBottom: 8, marginHorizontal: 20 },
    input: { marginHorizontal: 20, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 16 },
    iconGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8 },
    iconOption: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10 },
    colorOption: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    colorSelected: { borderWidth: 3, borderColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
    preview: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, padding: 16, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 12, gap: 12 },
    previewIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    previewName: { fontSize: 18, fontWeight: '600' },
    saveBtn: { marginHorizontal: 20, marginTop: 24, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
