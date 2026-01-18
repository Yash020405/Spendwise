import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../utils/ThemeContext';
import * as Contacts from 'expo-contacts';

interface Participant {
    id: string;
    name: string;
    phone?: string;
    shareAmount: number;
    sharePercentage?: number;
    isPaid: boolean;
}

interface SplitModalProps {
    visible: boolean;
    onClose: () => void;
    totalAmount: number;
    currencySymbol: string;
    onSave: (participants: Participant[], splitType: 'equal' | 'custom' | 'percentage', userShare: number) => void;
}

export default function SplitModal({ visible, onClose, totalAmount, currencySymbol, onSave }: SplitModalProps) {
    const { theme } = useTheme();
    const [splitType, setSplitType] = useState<'equal' | 'custom' | 'percentage'>('equal');
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [includeMe, setIncludeMe] = useState(true);
    const [showContacts, setShowContacts] = useState(false);
    const [contacts, setContacts] = useState<any[]>([]);
    const [contactSearch, setContactSearch] = useState('');

    useEffect(() => {
        if (participants.length > 0 && splitType === 'equal') {
            recalculateEqual();
        }
    }, [participants.length, includeMe, totalAmount, splitType]);

    const recalculateEqual = () => {
        const count = participants.length + (includeMe ? 1 : 0);
        if (count === 0) return;
        const share = Math.round((totalAmount / count) * 100) / 100;
        setParticipants(prev => prev.map(p => ({ ...p, shareAmount: share })));
    };

    const loadContacts = async () => {
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status === 'granted') {
                const { data } = await Contacts.getContactsAsync({
                    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
                });
                setContacts(data.filter(c => c.name));
                setShowContacts(true);
            }
        } catch (error) {
            console.log('Contacts permission denied');
        }
    };

    const addParticipant = (name: string, phone?: string) => {
        if (!name.trim()) return;
        const count = participants.length + (includeMe ? 1 : 0) + 1;
        const share = splitType === 'equal' ? Math.round((totalAmount / count) * 100) / 100 : 0;

        setParticipants(prev => [
            ...prev,
            {
                id: Date.now().toString(),
                name: name.trim(),
                phone,
                shareAmount: share,
                isPaid: false,
            }
        ]);
        setNewName('');
        setNewPhone('');
    };

    const addFromContact = (contact: any) => {
        const phone = contact.phoneNumbers?.[0]?.number;
        addParticipant(contact.name, phone);
        setShowContacts(false);
        setContactSearch('');
    };

    const removeParticipant = (id: string) => {
        setParticipants(prev => prev.filter(p => p.id !== id));
    };

    const updateShare = (id: string, value: string) => {
        const amount = parseFloat(value) || 0;
        setParticipants(prev => prev.map(p =>
            p.id === id ? { ...p, shareAmount: amount } : p
        ));
    };

    const handleSave = () => {
        const count = participants.length + (includeMe ? 1 : 0);
        const othersTotal = participants.reduce((sum, p) => sum + p.shareAmount, 0);
        const userShare = includeMe ? totalAmount - othersTotal : 0;

        onSave(participants, splitType, userShare);
        onClose();
    };

    const getUserShare = () => {
        const othersTotal = participants.reduce((sum, p) => sum + p.shareAmount, 0);
        return includeMe ? totalAmount - othersTotal : 0;
    };

    const filteredContacts = contacts.filter(c =>
        c.name?.toLowerCase().includes(contactSearch.toLowerCase())
    ).slice(0, 20);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Split Expense</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Total */}
                        <View style={[styles.totalCard, { backgroundColor: theme.colors.surface }]}>
                            <Text style={[styles.totalLabel, { color: theme.colors.textSecondary }]}>Total Amount</Text>
                            <Text style={[styles.totalAmount, { color: theme.colors.text }]}>{currencySymbol}{totalAmount.toLocaleString()}</Text>
                        </View>

                        {/* Split Type */}
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Split Type</Text>
                        <View style={styles.splitTypes}>
                            {(['equal', 'custom'] as const).map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    style={[
                                        styles.splitTypeBtn,
                                        { backgroundColor: theme.colors.surface },
                                        splitType === type && { backgroundColor: theme.colors.primary }
                                    ]}
                                    onPress={() => setSplitType(type)}
                                >
                                    <MaterialIcons
                                        name={type === 'equal' ? 'drag-handle' : 'tune'}
                                        size={18}
                                        color={splitType === type ? '#FFF' : theme.colors.textSecondary}
                                    />
                                    <Text style={[
                                        styles.splitTypeText,
                                        { color: splitType === type ? '#FFF' : theme.colors.text }
                                    ]}>
                                        {type === 'equal' ? 'Equal' : 'Custom'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Include Me */}
                        <TouchableOpacity
                            style={[styles.includeMe, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setIncludeMe(!includeMe)}
                        >
                            <MaterialIcons
                                name={includeMe ? 'check-box' : 'check-box-outline-blank'}
                                size={22}
                                color={includeMe ? theme.colors.primary : theme.colors.textSecondary}
                            />
                            <Text style={[styles.includeMeText, { color: theme.colors.text }]}>Include myself</Text>
                            {includeMe && (
                                <Text style={[styles.myShare, { color: theme.colors.primary }]}>
                                    {currencySymbol}{getUserShare().toLocaleString()}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* Participants */}
                        <View style={styles.participantsHeader}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Participants</Text>
                            <TouchableOpacity onPress={loadContacts} style={styles.contactsBtn}>
                                <MaterialIcons name="contacts" size={18} color={theme.colors.primary} />
                                <Text style={[styles.contactsBtnText, { color: theme.colors.primary }]}>Contacts</Text>
                            </TouchableOpacity>
                        </View>

                        {participants.map((p) => (
                            <View key={p.id} style={[styles.participantCard, { backgroundColor: theme.colors.surface }]}>
                                <View style={styles.participantInfo}>
                                    <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
                                        <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                                            {p.name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={[styles.participantName, { color: theme.colors.text }]}>{p.name}</Text>
                                        {p.phone && <Text style={[styles.participantPhone, { color: theme.colors.textSecondary }]}>{p.phone}</Text>}
                                    </View>
                                </View>
                                {splitType === 'custom' ? (
                                    <TextInput
                                        style={[styles.shareInput, { color: theme.colors.text, backgroundColor: theme.colors.background }]}
                                        value={p.shareAmount.toString()}
                                        onChangeText={(v) => updateShare(p.id, v)}
                                        keyboardType="decimal-pad"
                                    />
                                ) : (
                                    <Text style={[styles.shareAmount, { color: theme.colors.text }]}>
                                        {currencySymbol}{p.shareAmount.toLocaleString()}
                                    </Text>
                                )}
                                <TouchableOpacity onPress={() => removeParticipant(p.id)}>
                                    <MaterialIcons name="close" size={20} color={theme.colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {/* Add Participant */}
                        <View style={[styles.addRow, { borderColor: theme.colors.border }]}>
                            <TextInput
                                style={[styles.addInput, { color: theme.colors.text }]}
                                value={newName}
                                onChangeText={setNewName}
                                placeholder="Add person's name"
                                placeholderTextColor={theme.colors.textTertiary}
                            />
                            <TouchableOpacity
                                style={[styles.addBtn, { backgroundColor: theme.colors.primary }]}
                                onPress={() => addParticipant(newName)}
                            >
                                <MaterialIcons name="add" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                            onPress={handleSave}
                        >
                            <Text style={styles.saveBtnText}>Split with {participants.length} {participants.length === 1 ? 'person' : 'people'}</Text>
                        </TouchableOpacity>
                    </ScrollView>

                    {/* Contacts Modal */}
                    <Modal visible={showContacts} transparent animationType="fade">
                        <View style={styles.overlay}>
                            <View style={[styles.contactsModal, { backgroundColor: theme.colors.background }]}>
                                <View style={styles.header}>
                                    <Text style={[styles.title, { color: theme.colors.text }]}>Select Contact</Text>
                                    <TouchableOpacity onPress={() => setShowContacts(false)}>
                                        <MaterialIcons name="close" size={24} color={theme.colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={[styles.searchInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
                                    value={contactSearch}
                                    onChangeText={setContactSearch}
                                    placeholder="Search contacts..."
                                    placeholderTextColor={theme.colors.textTertiary}
                                />
                                <ScrollView>
                                    {filteredContacts.map((contact, i) => (
                                        <TouchableOpacity
                                            key={contact.id || i}
                                            style={styles.contactItem}
                                            onPress={() => addFromContact(contact)}
                                        >
                                            <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20' }]}>
                                                <Text style={[styles.avatarText, { color: theme.colors.primary }]}>
                                                    {contact.name?.charAt(0).toUpperCase()}
                                                </Text>
                                            </View>
                                            <View>
                                                <Text style={[styles.contactName, { color: theme.colors.text }]}>{contact.name}</Text>
                                                {contact.phoneNumbers?.[0] && (
                                                    <Text style={[styles.contactPhone, { color: theme.colors.textSecondary }]}>
                                                        {contact.phoneNumbers[0].number}
                                                    </Text>
                                                )}
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '90%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
    title: { fontSize: 18, fontWeight: '600' },
    totalCard: { marginHorizontal: 20, marginTop: 16, padding: 16, borderRadius: 12, alignItems: 'center' },
    totalLabel: { fontSize: 13 },
    totalAmount: { fontSize: 28, fontWeight: '700', marginTop: 4 },
    label: { fontSize: 14, fontWeight: '500', marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
    splitTypes: { flexDirection: 'row', marginHorizontal: 20, gap: 12 },
    splitTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
    splitTypeText: { fontSize: 14, fontWeight: '500' },
    includeMe: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 12, gap: 10 },
    includeMeText: { flex: 1, fontSize: 15 },
    myShare: { fontSize: 16, fontWeight: '600' },
    participantsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 20 },
    contactsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    contactsBtnText: { fontSize: 13, fontWeight: '500' },
    participantCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8, padding: 12, borderRadius: 12 },
    participantInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 15, fontWeight: '600' },
    participantName: { fontSize: 15, fontWeight: '500' },
    participantPhone: { fontSize: 12 },
    shareInput: { width: 70, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, textAlign: 'center', marginRight: 10, fontSize: 15 },
    shareAmount: { fontSize: 16, fontWeight: '600', marginRight: 10 },
    addRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 4 },
    addInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    addBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    saveBtn: { marginHorizontal: 20, marginTop: 24, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    contactsModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '80%' },
    searchInput: { marginHorizontal: 20, marginTop: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 15 },
    contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
    contactName: { fontSize: 15, fontWeight: '500' },
    contactPhone: { fontSize: 12 },
});
