import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    Dimensions,
    Linking,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../utils/ThemeContext';
import * as Contacts from 'expo-contacts';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Participant {
    id: string;
    _id?: string; // MongoDB ObjectId when loaded from server
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
    initialPayer?: string;
    initialParticipants?: Participant[];
    initialSplitType?: 'equal' | 'custom' | 'percentage';
    initialUserHasPaid?: boolean;
    onSave: (participants: Participant[], splitType: 'equal' | 'custom' | 'percentage', userShare: number, payer: string, userHasPaid: boolean) => void;
}

export default function SplitModal({ 
    visible, 
    onClose, 
    totalAmount, 
    currencySymbol, 
    initialPayer = 'me', 
    initialParticipants = [],
    initialSplitType = 'equal',
    initialUserHasPaid = false,
    onSave 
}: SplitModalProps) {
    const { theme } = useTheme();
    const [splitType, setSplitType] = useState<'equal' | 'custom' | 'percentage'>(initialSplitType);
    const [participants, setParticipants] = useState<Participant[]>(initialParticipants);
    const [payer, setPayer] = useState<string>(initialPayer); // 'me' or participant.id
    const [newName, setNewName] = useState('');
    const [includeMe, setIncludeMe] = useState(true);
    const [userHasPaid, setUserHasPaid] = useState(initialUserHasPaid); // Track if user has paid their share when someone else paid
    const [customUserShare, setCustomUserShare] = useState<number | null>(null); // Custom user share when someone else paid
    // Contacts feature - commented out, requires development build
    const [_showContacts, _setShowContacts] = useState(false);
    const [contacts, setContacts] = useState<any[]>([]);
    const [contactSearch, setContactSearch] = useState('');
    const [_loadingContacts, _setLoadingContacts] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false); // Track if initial load is done
    const [_contactsError, _setContactsError] = useState<string | null>(null);
    const [_keyboardVisible, setKeyboardVisible] = useState(false);
    const inputRef = useRef<TextInput>(null);

    // Initialize or reset states when modal opens
    const initializeStates = () => {
        console.log('[SplitModal] initializeStates called with initialUserHasPaid:', initialUserHasPaid);
        setIsInitialized(false); // Mark as not initialized during setup
        // If we have initial data, use it; otherwise reset to defaults
        if (initialParticipants.length > 0) {
            setSplitType(initialSplitType);
            setParticipants([...initialParticipants]); // Keep their isPaid status intact!
            setPayer(initialPayer);
            setUserHasPaid(initialUserHasPaid);
            console.log('[SplitModal] Set userHasPaid to:', initialUserHasPaid);
            // Reset custom user share - will be recalculated
            setCustomUserShare(null);
        } else {
            setSplitType('equal');
            setParticipants([]);
            setPayer('me');
            setUserHasPaid(false);
            setCustomUserShare(null);
        }
        setNewName('');
        setIncludeMe(true);
        _setShowContacts(false);
        setContactSearch('');
        _setContactsError(null);
        // Mark as initialized after a short delay to skip the payer useEffect
        setTimeout(() => setIsInitialized(true), 100);
    };

    // Track keyboard visibility
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => setKeyboardVisible(true)
        );
        const keyboardDidHideListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => setKeyboardVisible(false)
        );

        return () => {
            keyboardDidShowListener.remove();
            keyboardDidHideListener.remove();
        };
    }, []);

    // Initialize states when modal becomes visible
    useEffect(() => {
        if (visible) {
            initializeStates();
        }
    }, [visible, initialParticipants, initialPayer, initialSplitType, initialUserHasPaid]);

    useEffect(() => {
        if (participants.length > 0 && splitType === 'equal') {
            recalculateEqual();
        }
    }, [participants.length, includeMe, totalAmount, splitType]);

    // Track previous payer to detect actual changes
    const prevPayerRef = useRef<string | null>(null);

    // Auto-mark payer's share as paid and reset previous payer's status
    // ONLY when user actively changes the payer (not on initial load)
    useEffect(() => {
        // Skip if not initialized yet (loading existing data)
        if (!isInitialized) {
            // Store the initial payer so we can detect actual changes later
            prevPayerRef.current = payer;
            return;
        }
        
        // Only reset userHasPaid if the payer actually changed (not just initialization completing)
        const payerActuallyChanged = prevPayerRef.current !== null && prevPayerRef.current !== payer;
        
        if (participants.length > 0) {
            setParticipants(prev => prev.map(p => {
                const pId = p.id || (p as any)._id;
                return {
                    ...p,
                    // If this person is the payer, mark as paid; otherwise reset to false (not settled)
                    isPaid: pId === payer ? true : false
                };
            }));
        }
        
        // Reset "I have paid my share" ONLY when payer actually changes by user action
        if (payerActuallyChanged) {
            console.log('[SplitModal] Payer changed from', prevPayerRef.current, 'to', payer, '- resetting userHasPaid');
            setUserHasPaid(false);
        }
        
        prevPayerRef.current = payer;
    }, [payer, isInitialized]);

    const recalculateEqual = () => {
        const count = participants.length + (includeMe ? 1 : 0);
        if (count === 0) return;
        const share = Math.round((totalAmount / count) * 100) / 100;
        setParticipants(prev => prev.map(p => ({ ...p, shareAmount: share })));
    };

    // Contacts feature - commented out, requires development build
    const _loadContacts = async () => {
        _setLoadingContacts(true);
        _setContactsError(null);
        
        try {
            // Check if contacts API is available
            if (!Contacts || !Contacts.getPermissionsAsync) {
                _setContactsError('Contacts API not available. Please rebuild the app.');
                return;
            }

            // First check current permission status
            const permissionResponse = await Contacts.getPermissionsAsync();
            console.log('Initial permission status:', permissionResponse.status);
            
            let finalStatus = permissionResponse.status;
            
            // If not determined or not granted, request permission
            if (finalStatus !== 'granted') {
                console.log('Requesting contacts permission...');
                const requestResponse = await Contacts.requestPermissionsAsync();
                finalStatus = requestResponse.status;
                console.log('Permission after request:', finalStatus);
            }
            
            if (finalStatus === 'granted') {
                console.log('Permission granted, fetching contacts...');
                
                // Fetch contacts with pagination for better performance
                const { data, hasNextPage } = await Contacts.getContactsAsync({
                    fields: [
                        Contacts.Fields.Name,
                        Contacts.Fields.FirstName,
                        Contacts.Fields.LastName,
                        Contacts.Fields.PhoneNumbers,
                    ],
                    sort: Contacts.SortTypes.FirstName,
                    pageSize: 500, // Limit for performance
                    pageOffset: 0,
                });
                
                console.log(`Fetched ${data.length} contacts, hasNextPage: ${hasNextPage}`);
                
                if (!data || data.length === 0) {
                    _setContactsError('No contacts found on this device. Please add contacts first.');
                    return;
                }
                
                // Filter contacts that have a valid name
                const validContacts = data.filter(contact => {
                    const name = contact.name || 
                                 `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
                    return name && name.length > 0;
                }).map(contact => ({
                    ...contact,
                    // Ensure name is set
                    name: contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                }));
                
                console.log(`Valid contacts with names: ${validContacts.length}`);
                
                if (validContacts.length === 0) {
                    _setContactsError('No contacts with names found. Please ensure your contacts have names.');
                    return;
                }
                
                setContacts(validContacts);
                _setShowContacts(true);
                _setContactsError(null);
                
            } else if (finalStatus === 'denied') {
                // Permission was denied, show alert with option to open settings
                Alert.alert(
                    'Contacts Access Required',
                    'To split expenses with your contacts, please grant contacts access in Settings.\n\nGo to Settings > Apps > Spendwise > Permissions > Contacts',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { 
                            text: 'Open Settings', 
                            onPress: () => Linking.openSettings()
                        }
                    ]
                );
                _setContactsError('Permission denied. Tap "Contacts" button again after granting permission in Settings.');
            } else {
                // undetermined or other status
                console.log('Unexpected permission status:', finalStatus);
                _setContactsError(`Unable to access contacts (status: ${finalStatus}). Please try again.`);
            }
        } catch (error: any) {
            console.error('Contacts error:', error);
            const errorMessage = error?.message || 'Unknown error occurred';
            
            // Provide more specific error messages
            if (errorMessage.includes('not linked') || errorMessage.includes('native module')) {
                _setContactsError('Contacts module not linked. Please rebuild the app with: npx expo prebuild && npx expo run:android');
            } else if (errorMessage.includes('permission')) {
                _setContactsError('Permission error. Please check app permissions in device settings.');
            } else {
                _setContactsError(`Failed to load contacts: ${errorMessage}`);
            }
        } finally {
            _setLoadingContacts(false);
        }
    };

    const togglePaidStatus = (id: string) => {
        setParticipants(prev => prev.map(p => {
            const pId = p.id || (p as any)._id;
            return pId === id ? { ...p, isPaid: !p.isPaid } : p;
        }));
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
    };

    // Contacts feature - commented out, requires development build
    const _addFromContact = (contact: any) => {
        const phone = contact.phoneNumbers?.[0]?.number;
        addParticipant(contact.name, phone);
        _setShowContacts(false);
        setContactSearch('');
    };

    const removeParticipant = (id: string) => {
        setParticipants(prev => prev.filter(p => {
            const pId = p.id || (p as any)._id;
            return pId !== id;
        }));
    };

    const updateShare = (id: string, value: string) => {
        const amount = parseFloat(value) || 0;
        setParticipants(prev => prev.map(p => {
            const pId = p.id || (p as any)._id;
            return pId === id ? { ...p, shareAmount: amount } : p;
        }));
    };

    const handleSave = () => {
        const othersTotal = participants.reduce((sum, p) => sum + p.shareAmount, 0);
        const userShare = includeMe ? totalAmount - othersTotal : 0;

        // Pass userHasPaid - only relevant when payer !== 'me'
        onSave(participants, splitType, userShare, payer, payer === 'me' ? true : userHasPaid);
        onClose();
    };

    const getUserShare = () => {
        // If custom user share is set (when someone else paid), use it
        if (customUserShare !== null && payer !== 'me') {
            return customUserShare;
        }
        const othersTotal = participants.reduce((sum, p) => sum + p.shareAmount, 0);
        return includeMe ? totalAmount - othersTotal : 0;
    };

    // Contacts feature - commented out, requires development build
    const _filteredContacts = contacts.filter(c =>
        c.name?.toLowerCase().includes(contactSearch.toLowerCase())
    ).slice(0, 50);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.keyboardAvoidingView}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <TouchableOpacity 
                    style={styles.overlay} 
                    activeOpacity={1} 
                    onPress={() => {
                        Keyboard.dismiss();
                    }}
                >
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Split Expense</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        showsVerticalScrollIndicator={false} 
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.scrollContent}
                    >
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

                        {/* Who Paid? */}
                        <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Who Paid?</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.payerScroll} contentContainerStyle={styles.payerContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.payerBtn,
                                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                                    payer === 'me' && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                                ]}
                                onPress={() => setPayer('me')}
                            >
                                <Text style={[styles.payerText, { color: payer === 'me' ? '#FFF' : theme.colors.text }]}>Me</Text>
                            </TouchableOpacity>
                            {participants.map((p, idx) => {
                                const pId = p.id || (p as any)._id || `payer-${idx}`;
                                return (
                                <TouchableOpacity
                                    key={pId}
                                    style={[
                                        styles.payerBtn,
                                        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                                        payer === pId && { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                                    ]}
                                    onPress={() => setPayer(pId)}
                                >
                                    <Text style={[styles.payerText, { color: payer === pId ? '#FFF' : theme.colors.text }]}>{p.name}</Text>
                                </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Show "I have paid my share" and editable share when someone else paid */}
                        {payer !== 'me' && includeMe && (
                            <View style={[styles.userShareSection, { backgroundColor: theme.colors.surface, borderRadius: 12, marginBottom: 16 }]}>
                                {/* My Share Amount - Editable */}
                                <View style={[styles.myShareRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingBottom: 12, marginBottom: 12 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <View style={[styles.avatar, { backgroundColor: theme.colors.primary + '20', marginRight: 12 }]}>
                                            <Text style={[styles.avatarText, { color: theme.colors.primary }]}>Me</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.userPaidText, { color: theme.colors.text }]}>My Share</Text>
                                            <Text style={[styles.userPaidSubtext, { color: theme.colors.textSecondary }]}>
                                                Enter your share of the expense
                                            </Text>
                                        </View>
                                    </View>
                                    <TextInput
                                        style={[styles.shareInput, { 
                                            color: theme.colors.text, 
                                            backgroundColor: theme.colors.background,
                                            minWidth: 80,
                                            textAlign: 'right',
                                        }]}
                                        value={getUserShare() > 0 ? getUserShare().toString() : ''}
                                        onChangeText={(v) => {
                                            const num = parseFloat(v) || 0;
                                            setCustomUserShare(num);
                                        }}
                                        keyboardType="decimal-pad"
                                        placeholder="0"
                                        placeholderTextColor={theme.colors.textTertiary}
                                        selectTextOnFocus
                                    />
                                </View>
                                
                                {/* I have paid toggle */}
                                <TouchableOpacity
                                    style={[styles.userPaidToggleInner, { backgroundColor: userHasPaid ? '#10B981' + '15' : 'transparent' }]}
                                    onPress={() => setUserHasPaid(!userHasPaid)}
                                >
                                    <MaterialIcons
                                        name={userHasPaid ? 'check-circle' : 'radio-button-unchecked'}
                                        size={22}
                                        color={userHasPaid ? '#10B981' : theme.colors.textSecondary}
                                    />
                                    <View style={styles.userPaidInfo}>
                                        <Text style={[styles.userPaidText, { color: theme.colors.text }]}>
                                            I have paid my share
                                        </Text>
                                        <Text style={[styles.userPaidSubtext, { color: theme.colors.textSecondary }]}>
                                            {userHasPaid 
                                                ? 'Settled with ' + (participants.find(p => (p.id || (p as any)._id) === payer)?.name || 'payer')
                                                : `You owe ${currencySymbol}${getUserShare().toLocaleString()} to ${participants.find(p => (p.id || (p as any)._id) === payer)?.name || 'payer'}`
                                            }
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Participants */}
                        <View style={styles.participantsHeader}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Participants</Text>
                            {/* Contacts button hidden - requires development build for native contacts access
                            <TouchableOpacity
                                onPress={loadContacts}
                                style={styles.contactsBtn}
                                disabled={loadingContacts}
                            >
                                {loadingContacts ? (
                                    <Text style={[styles.contactsBtnText, { color: theme.colors.textSecondary }]}>Loading...</Text>
                                ) : (
                                    <>
                                        <MaterialIcons name="contacts" size={18} color={theme.colors.primary} />
                                        <Text style={[styles.contactsBtnText, { color: theme.colors.primary }]}>Contacts</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            */}
                        </View>

                        {/* Contacts error hidden
                        {contactsError && (
                            <Text style={[styles.errorText, { color: theme.colors.error }]}>{contactsError}</Text>
                        )}
                        */}

                        {/* If someone else paid, only show the payer - other participants' debts are not my concern */}
                        {payer !== 'me' && (
                            <View style={[styles.infoBox, { backgroundColor: '#F59E0B' + '15', marginBottom: 12 }]}>
                                <MaterialIcons name="info-outline" size={16} color="#F59E0B" />
                                <Text style={[styles.infoText, { color: '#F59E0B' }]}>
                                    Only showing the payer. Other participants owe them directly, not you.
                                </Text>
                            </View>
                        )}

                        {participants.map((p, index) => {
                            const participantId = p.id || p._id || `participant-${index}`;
                            const isThePayer = payer === participantId || payer === p._id;
                            
                            // If someone else paid, only show the payer (skip other participants)
                            if (payer !== 'me' && !isThePayer) {
                                return null;
                            }
                            
                            return (
                                <View key={participantId} style={[
                                    styles.participantCard, 
                                    { 
                                        backgroundColor: isThePayer ? '#10B981' + '15' : theme.colors.surface,
                                        borderWidth: isThePayer ? 1 : 0,
                                        borderColor: isThePayer ? '#10B981' + '40' : 'transparent',
                                    }
                                ]}>
                                    {/* Show paid toggle only for non-payers when I paid */}
                                    {!isThePayer && payer === 'me' && (
                                        <TouchableOpacity
                                            onPress={() => togglePaidStatus(participantId)}
                                            style={[styles.paidToggle, { backgroundColor: p.isPaid ? '#10B981' + '20' : theme.colors.background }]}
                                        >
                                            <MaterialIcons
                                                name={p.isPaid ? 'check-circle' : 'radio-button-unchecked'}
                                                size={20}
                                                color={p.isPaid ? '#10B981' : theme.colors.textTertiary}
                                            />
                                        </TouchableOpacity>
                                    )}
                                    {isThePayer && (
                                        <View style={[styles.paidToggle, { backgroundColor: '#10B981' + '20' }]}>
                                            <MaterialIcons name="account-balance-wallet" size={20} color="#10B981" />
                                        </View>
                                    )}
                                    <View style={styles.participantInfo}>
                                        <View style={[styles.avatar, { backgroundColor: isThePayer ? '#10B981' + '30' : (p.isPaid ? '#10B981' + '20' : theme.colors.primary + '20') }]}>
                                            <Text style={[styles.avatarText, { color: isThePayer ? '#10B981' : (p.isPaid ? '#10B981' : theme.colors.primary) }]}>
                                                {p.name.charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.participantName, { color: theme.colors.text, textDecorationLine: (!isThePayer && p.isPaid) ? 'line-through' : 'none' }]}>
                                                {p.name}
                                            </Text>
                                            {p.phone && (
                                                <TouchableOpacity onPress={() => {/* Could open phone dialer */ }}>
                                                    <Text style={[styles.participantPhone, { color: theme.colors.primary }]}>{p.phone}</Text>
                                                </TouchableOpacity>
                                            )}
                                            {isThePayer && <Text style={[styles.paidLabel, { color: '#10B981' }]}>Paid the bill</Text>}
                                            {!isThePayer && p.isPaid && <Text style={[styles.paidLabel, { color: '#10B981' }]}>Settled</Text>}
                                        </View>
                                    </View>
                                    {/* Show share amount - editable in custom mode only when I paid */}
                                    {splitType === 'custom' && payer === 'me' ? (
                                        <TextInput
                                            style={[styles.shareInput, { 
                                                color: isThePayer ? '#10B981' : theme.colors.text, 
                                                backgroundColor: theme.colors.background,
                                                borderWidth: isThePayer ? 1 : 0,
                                                borderColor: '#10B981' + '40',
                                            }]}
                                            value={p.shareAmount > 0 ? p.shareAmount.toString() : ''}
                                            onChangeText={(v) => updateShare(participantId, v)}
                                            keyboardType="decimal-pad"
                                            placeholder="0"
                                            placeholderTextColor={theme.colors.textTertiary}
                                            selectTextOnFocus
                                        />
                                    ) : (
                                        <Text style={[styles.shareAmount, { color: isThePayer ? '#10B981' : theme.colors.text }]}>
                                            {isThePayer ? '+' : ''}{currencySymbol}{p.shareAmount.toLocaleString()}
                                        </Text>
                                    )}
                                    {/* Only show remove button when I paid and for non-payers */}
                                    {!isThePayer && payer === 'me' ? (
                                        <TouchableOpacity onPress={() => removeParticipant(participantId)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                            <MaterialIcons name="close" size={20} color={theme.colors.error} />
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ width: 20 }} />
                                    )}
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Fixed Footer with Add Input and Save Button */}
                    <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
                        {/* Add Participant - only when I paid */}
                        {payer === 'me' && (
                            <View style={[styles.addRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                                <TextInput
                                    ref={inputRef}
                                    style={[styles.addInput, { color: theme.colors.text }]}
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholder="Add person's name"
                                    placeholderTextColor={theme.colors.textTertiary}
                                    returnKeyType="done"
                                    onSubmitEditing={() => {
                                        if (newName.trim()) {
                                            addParticipant(newName);
                                        }
                                    }}
                                />
                                <TouchableOpacity
                                    style={[styles.addBtn, { backgroundColor: newName.trim() ? theme.colors.primary : theme.colors.primary + '50' }]}
                                    onPress={() => addParticipant(newName)}
                                    disabled={!newName.trim()}
                                >
                                    <MaterialIcons name="add" size={20} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Save Button */}
                        <TouchableOpacity
                            style={[styles.saveBtn, { backgroundColor: theme.colors.primary }]}
                            onPress={handleSave}
                        >
                            <Text style={styles.saveBtnText}>
                                {payer === 'me' 
                                    ? `Split with ${participants.length} ${participants.length === 1 ? 'person' : 'people'}`
                                    : 'Save Split Info'
                                }
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Contacts Modal - Hidden until development build is available */}
                </View>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    keyboardAvoidingView: { flex: 1 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SCREEN_HEIGHT * 0.85 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' },
    title: { fontSize: 18, fontWeight: '600' },
    scrollContent: { paddingBottom: 8 },
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
    contactsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8 },
    contactsBtnText: { fontSize: 13, fontWeight: '500' },
    errorText: { fontSize: 12, marginHorizontal: 20, marginTop: 8 },
    infoBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, padding: 12, borderRadius: 10, gap: 8 },
    infoText: { flex: 1, fontSize: 12, fontWeight: '500' },
    participantCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 8, padding: 12, borderRadius: 12 },
    paidToggle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    paidLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
    participantInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 15, fontWeight: '600' },
    participantName: { fontSize: 15, fontWeight: '500' },
    participantPhone: { fontSize: 12 },
    shareInput: { width: 80, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, textAlign: 'center', marginRight: 10, fontSize: 15, minHeight: 36 },
    shareAmount: { fontSize: 16, fontWeight: '600', marginRight: 10, minWidth: 70, textAlign: 'right' },
    // Fixed footer styles
    footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderTopWidth: 1 },
    addRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 4, marginBottom: 12 },
    addInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
    addBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    saveBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    // Contacts modal styles
    contactsModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: SCREEN_HEIGHT * 0.8 },
    searchInput: { marginHorizontal: 20, marginTop: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 15 },
    emptyContacts: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 14, marginTop: 12 },
    contactItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
    contactName: { fontSize: 15, fontWeight: '500' },
    contactPhone: { fontSize: 12 },
    payerScroll: { marginHorizontal: 0, marginBottom: 8 },
    payerContainer: { paddingHorizontal: 20, gap: 10 },
    payerBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    payerText: { fontSize: 14, fontWeight: '500' },
    // User paid toggle (when someone else paid)
    userPaidToggle: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 12, padding: 14, borderRadius: 12, gap: 12 },
    userPaidInfo: { flex: 1 },
    userPaidText: { fontSize: 15, fontWeight: '500' },
    userPaidSubtext: { fontSize: 12, marginTop: 2 },
    // User share section (when someone else paid - contains editable share and paid toggle)
    userShareSection: { marginHorizontal: 20, marginTop: 12, padding: 14 },
    myShareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    userPaidToggleInner: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, gap: 12 },
});
