import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    ActivityIndicator,
    Platform,
    Alert,
    TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/ThemeContext';
import api from '../utils/api';

interface ExportModalProps {
    visible: boolean;
    onClose: () => void;
    currencySymbol: string;
}

export default function ExportModal({ visible, onClose, currencySymbol }: ExportModalProps) {
    const { theme } = useTheme();
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [loading, setLoading] = useState(false);
    const [exportType, setExportType] = useState<'csv' | 'pdf'>('pdf');
    const [saveMode, setSaveMode] = useState<'share' | 'save'>('share');
    const [customFileName, setCustomFileName] = useState('');
    const [showNameInput, setShowNameInput] = useState(false);

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDateForAPI = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    const getDefaultFileName = () => {
        return `spendwise_${formatDateForAPI(startDate)}_to_${formatDateForAPI(endDate)}`;
    };

    const getFileName = () => {
        const baseName = customFileName.trim() || getDefaultFileName();
        // Sanitize filename
        return baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    };

    const handleExportCSV = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) {
                Alert.alert('Error', 'Please login to export data');
                return;
            }

            const csvContent = await api.getExportCSV(
                token,
                formatDateForAPI(startDate),
                formatDateForAPI(endDate)
            );

            const fileName = `${getFileName()}.csv`;
            const filePath = `${(FileSystem as any).documentDirectory}${fileName}`;

            await (FileSystem as any).writeAsStringAsync(filePath, csvContent);

            if (saveMode === 'save') {
                // Share with save option - user can choose to save to device
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(filePath, {
                        mimeType: 'text/csv',
                        dialogTitle: `Save ${fileName}`,
                        UTI: 'public.comma-separated-values-text',
                    });
                }
                Alert.alert('Success', `CSV exported as "${fileName}"`);
            } else {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(filePath, {
                        mimeType: 'text/csv',
                        dialogTitle: 'Export Spendwise Report',
                    });
                }
                Alert.alert('Success', 'CSV report exported successfully!');
            }

            onClose();
        } catch (error) {
            console.error('CSV export error:', error);
            Alert.alert('Error', 'Failed to export CSV. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        setLoading(true);
        try {
            const token = await AsyncStorage.getItem('@auth_token');
            if (!token) {
                Alert.alert('Error', 'Please login to export data');
                return;
            }

            const response: any = await api.getExportPDF(
                token,
                formatDateForAPI(startDate),
                formatDateForAPI(endDate)
            );

            const data = response.data;

            // Generate HTML for PDF
            const html = generatePDFHTML(data, currencySymbol);

            // Generate PDF
            const { uri } = await Print.printToFileAsync({ html });
            
            // Rename the file to custom name
            const fileName = `${getFileName()}.pdf`;
            const newUri = `${(FileSystem as any).documentDirectory}${fileName}`;
            await (FileSystem as any).moveAsync({ from: uri, to: newUri });

            if (saveMode === 'save') {
                // Share with save option - user can choose to save to device
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(newUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: `Save ${fileName}`,
                        UTI: 'com.adobe.pdf',
                    });
                }
                Alert.alert('Success', `PDF exported as "${fileName}"`);
            } else {
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(newUri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Export Spendwise Report',
                    });
                }
                Alert.alert('Success', 'PDF report exported successfully!');
            }

            onClose();
        } catch (error) {
            console.error('PDF export error:', error);
            Alert.alert('Error', 'Failed to export PDF. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const generatePDFHTML = (data: any, currency: string) => {
        const categoryRows = (data.categoryBreakdown || [])
            .map((cat: any) => `
                <tr>
                    <td>${cat.name}</td>
                    <td style="text-align: right;">${currency}${cat.amount.toLocaleString('en-IN')}</td>
                    <td style="text-align: right;">${cat.percentage}%</td>
                </tr>
            `).join('');

        const expenseRows = (data.expenses || []).slice(0, 20)
            .map((exp: any) => `
                <tr>
                    <td>${exp.date}</td>
                    <td>${exp.description}</td>
                    <td>${exp.category}</td>
                    <td style="text-align: right;">${currency}${exp.amount.toLocaleString('en-IN')}</td>
                </tr>
            `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Spendwise Report</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
                    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #10B981; padding-bottom: 20px; }
                    .logo { display: flex; align-items: center; gap: 10px; }
                    .logo-icon { width: 40px; height: 40px; background: linear-gradient(135deg, #10B981, #059669); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; }
                    .logo-text { font-size: 28px; font-weight: 700; color: #10B981; }
                    .report-title { text-align: right; }
                    .report-title h2 { font-size: 18px; color: #374151; }
                    .report-title p { font-size: 14px; color: #6B7280; }
                    .summary-cards { display: flex; gap: 20px; margin-bottom: 30px; }
                    .summary-card { flex: 1; padding: 20px; border-radius: 12px; text-align: center; }
                    .summary-card.expenses { background: #FEE2E2; border: 1px solid #FECACA; }
                    .summary-card.income { background: #D1FAE5; border: 1px solid #A7F3D0; }
                    .summary-card.savings { background: #DBEAFE; border: 1px solid #BFDBFE; }
                    .summary-card .label { font-size: 12px; color: #6B7280; margin-bottom: 5px; }
                    .summary-card .value { font-size: 24px; font-weight: 700; }
                    .summary-card.expenses .value { color: #DC2626; }
                    .summary-card.income .value { color: #059669; }
                    .summary-card.savings .value { color: #2563EB; }
                    .section { margin-bottom: 30px; }
                    .section h3 { font-size: 16px; color: #374151; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #E5E7EB; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #E5E7EB; }
                    th { background: #F9FAFB; font-weight: 600; color: #374151; }
                    tr:nth-child(even) { background: #FAFAFA; }
                    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 11px; color: #9CA3AF; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">
                        <div class="logo-icon">₹</div>
                        <span class="logo-text">Spendwise</span>
                    </div>
                    <div class="report-title">
                        <h2>Expense Report</h2>
                        <p>${data.dateRange}</p>
                    </div>
                </div>

                <div class="summary-cards">
                    <div class="summary-card expenses">
                        <div class="label">Total Expenses</div>
                        <div class="value">${currency}${(data.summary?.totalExpenses || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div class="summary-card income">
                        <div class="label">Total Income</div>
                        <div class="value">${currency}${(data.summary?.totalIncome || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div class="summary-card savings">
                        <div class="label">Net Savings</div>
                        <div class="value">${currency}${(data.summary?.netSavings || 0).toLocaleString('en-IN')}</div>
                    </div>
                </div>

                <div class="section">
                    <h3>Category Breakdown</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th style="text-align: right;">Amount</th>
                                <th style="text-align: right;">Percentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categoryRows || '<tr><td colspan="3">No data</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="section">
                    <h3>Recent Transactions (${Math.min((data.expenses || []).length, 20)} of ${(data.expenses || []).length})</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${expenseRows || '<tr><td colspan="4">No transactions</td></tr>'}
                        </tbody>
                    </table>
                </div>

                <div class="footer">
                    <p>Generated by Spendwise • ${new Date().toLocaleString('en-IN')}</p>
                </div>
            </body>
            </html>
        `;
    };

    const handleExport = () => {
        if (exportType === 'csv') {
            handleExportCSV();
        } else {
            handleExportPDF();
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Export Report</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcons name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Export Type Selection */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Export Format</Text>
                    <View style={styles.exportTypes}>
                        <TouchableOpacity
                            style={[
                                styles.exportTypeBtn,
                                { backgroundColor: theme.colors.surface },
                                exportType === 'pdf' && { backgroundColor: theme.colors.primary },
                            ]}
                            onPress={() => setExportType('pdf')}
                        >
                            <MaterialIcons
                                name="picture-as-pdf"
                                size={20}
                                color={exportType === 'pdf' ? '#FFF' : theme.colors.textSecondary}
                            />
                            <Text style={[
                                styles.exportTypeText,
                                { color: exportType === 'pdf' ? '#FFF' : theme.colors.text },
                            ]}>PDF</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.exportTypeBtn,
                                { backgroundColor: theme.colors.surface },
                                exportType === 'csv' && { backgroundColor: theme.colors.primary },
                            ]}
                            onPress={() => setExportType('csv')}
                        >
                            <MaterialIcons
                                name="table-chart"
                                size={20}
                                color={exportType === 'csv' ? '#FFF' : theme.colors.textSecondary}
                            />
                            <Text style={[
                                styles.exportTypeText,
                                { color: exportType === 'csv' ? '#FFF' : theme.colors.text },
                            ]}>CSV</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Date Range */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Date Range</Text>

                    <View style={styles.dateRow}>
                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowStartPicker(true)}
                        >
                            <MaterialIcons name="calendar-today" size={18} color={theme.colors.primary} />
                            <View>
                                <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]}>From</Text>
                                <Text style={[styles.dateValue, { color: theme.colors.text }]}>{formatDate(startDate)}</Text>
                            </View>
                        </TouchableOpacity>

                        <MaterialIcons name="arrow-forward" size={20} color={theme.colors.textSecondary} />

                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.colors.surface }]}
                            onPress={() => setShowEndPicker(true)}
                        >
                            <MaterialIcons name="event" size={18} color={theme.colors.primary} />
                            <View>
                                <Text style={[styles.dateLabel, { color: theme.colors.textSecondary }]}>To</Text>
                                <Text style={[styles.dateValue, { color: theme.colors.text }]}>{formatDate(endDate)}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Quick Presets */}
                    <View style={styles.presets}>
                        {[
                            { label: 'This Month', days: 0, isThisMonth: true },
                            { label: 'Last 30 Days', days: 30 },
                            { label: 'Last 90 Days', days: 90 },
                            { label: 'This Year', days: 0, isThisYear: true },
                        ].map((preset) => (
                            <TouchableOpacity
                                key={preset.label}
                                style={[styles.presetBtn, { borderColor: theme.colors.border }]}
                                onPress={() => {
                                    const now = new Date();
                                    if (preset.isThisMonth) {
                                        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
                                        setEndDate(now);
                                    } else if (preset.isThisYear) {
                                        setStartDate(new Date(now.getFullYear(), 0, 1));
                                        setEndDate(now);
                                    } else {
                                        setStartDate(new Date(now.getTime() - preset.days * 24 * 60 * 60 * 1000));
                                        setEndDate(now);
                                    }
                                }}
                            >
                                <Text style={[styles.presetText, { color: theme.colors.primary }]}>{preset.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Save Mode Toggle */}
                    <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Export Action</Text>
                    <View style={styles.exportTypes}>
                        <TouchableOpacity
                            style={[
                                styles.exportTypeBtn,
                                { backgroundColor: theme.colors.surface },
                                saveMode === 'share' && { backgroundColor: theme.colors.primary },
                            ]}
                            onPress={() => {
                                setSaveMode('share');
                                setShowNameInput(false);
                            }}
                        >
                            <MaterialIcons
                                name="share"
                                size={20}
                                color={saveMode === 'share' ? '#FFF' : theme.colors.textSecondary}
                            />
                            <Text style={[
                                styles.exportTypeText,
                                { color: saveMode === 'share' ? '#FFF' : theme.colors.text },
                            ]}>Share</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.exportTypeBtn,
                                { backgroundColor: theme.colors.surface },
                                saveMode === 'save' && { backgroundColor: theme.colors.primary },
                            ]}
                            onPress={() => {
                                setSaveMode('save');
                                setShowNameInput(true);
                            }}
                        >
                            <MaterialIcons
                                name="save-alt"
                                size={20}
                                color={saveMode === 'save' ? '#FFF' : theme.colors.textSecondary}
                            />
                            <Text style={[
                                styles.exportTypeText,
                                { color: saveMode === 'save' ? '#FFF' : theme.colors.text },
                            ]}>Save to Device</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Custom File Name */}
                    {showNameInput && (
                        <View style={styles.fileNameSection}>
                            <Text style={[styles.label, { color: theme.colors.textSecondary, marginTop: 16 }]}>File Name</Text>
                            <View style={[styles.fileNameInput, { backgroundColor: theme.colors.surface }]}>
                                <TextInput
                                    style={[styles.fileNameTextInput, { color: theme.colors.text }]}
                                    value={customFileName}
                                    onChangeText={setCustomFileName}
                                    placeholder={getDefaultFileName()}
                                    placeholderTextColor={theme.colors.textTertiary}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                <Text style={[styles.fileExtension, { color: theme.colors.textSecondary }]}>
                                    .{exportType}
                                </Text>
                            </View>
                            <Text style={[styles.fileNameHint, { color: theme.colors.textTertiary }]}>
                                Leave empty for default name
                            </Text>
                        </View>
                    )}

                    {/* Export Button */}
                    <TouchableOpacity
                        style={[styles.exportBtn, { backgroundColor: theme.colors.primary }]}
                        onPress={handleExport}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <MaterialIcons name={exportType === 'pdf' ? 'picture-as-pdf' : 'file-download'} size={20} color="#FFF" />
                                <Text style={styles.exportBtnText}>Export {exportType.toUpperCase()}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Date Pickers */}
                    {showStartPicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => {
                                setShowStartPicker(false);
                                if (date) setStartDate(date);
                            }}
                            maximumDate={endDate}
                        />
                    )}

                    {showEndPicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => {
                                setShowEndPicker(false);
                                if (date) setEndDate(date);
                            }}
                            minimumDate={startDate}
                            maximumDate={new Date()}
                        />
                    )}
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
    label: { fontSize: 14, fontWeight: '500', marginHorizontal: 20, marginTop: 20, marginBottom: 10 },
    exportTypes: { flexDirection: 'row', marginHorizontal: 20, gap: 12 },
    exportTypeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
    exportTypeText: { fontSize: 15, fontWeight: '600' },
    dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, gap: 10 },
    dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 10 },
    dateLabel: { fontSize: 11, marginBottom: 2 },
    dateValue: { fontSize: 14, fontWeight: '500' },
    presets: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 20, marginTop: 16, gap: 8 },
    presetBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    presetText: { fontSize: 12, fontWeight: '500' },
    fileNameSection: { marginHorizontal: 20 },
    fileNameInput: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 14, height: 48 },
    fileNameTextInput: { flex: 1, fontSize: 15 },
    fileExtension: { fontSize: 15, fontWeight: '500' },
    fileNameHint: { fontSize: 12, marginTop: 6, marginLeft: 4 },
    exportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 20, marginTop: 24, paddingVertical: 16, borderRadius: 14, gap: 8 },
    exportBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
