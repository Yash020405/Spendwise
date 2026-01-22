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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../utils/ThemeContext';
import api from '../utils/api';
import { Asset } from 'expo-asset';

// Category configuration matching the app's theme
const CATEGORY_CONFIG: Record<string, { color: string; icon: string }> = {
    Food: { color: '#F59E0B', icon: 'restaurant' },
    Transport: { color: '#3B82F6', icon: 'directions-car' },
    Shopping: { color: '#EC4899', icon: 'shopping-bag' },
    Entertainment: { color: '#8B5CF6', icon: 'movie' },
    Bills: { color: '#EF4444', icon: 'receipt' },
    Health: { color: '#10B981', icon: 'local-hospital' },
    Education: { color: '#06B6D4', icon: 'school' },
    Other: { color: '#6B7280', icon: 'more-horiz' },
};

// SVG Paths for PDF Generation (Material Design Icons)
const CATEGORY_ICONS: Record<string, string> = {
    Food: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z', // restaurant
    Transport: 'M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z', // directions-car
    Shopping: 'M19 6h-2c0-2.76-2.24-5-5-5S7 3.24 7 6H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-7-3c1.66 0 3 1.34 3 3H9c0-1.66 1.34-3 3-3zm0 10c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3s3-1.34 3-3h2c0 2.76-2.24 5-5 5z', // shopping-bag
    Entertainment: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z', // movie
    Bills: 'M18 17H6v-2h12v2zm0-4H6v-2h12v2zm0-4H6V7h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2 10.5 3.5 9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z', // receipt
    Health: 'M19 3H5c-1.1 0-1.99.9-1.99 2L3 19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-1 11h-4v4h-4v-4H6v-4h4V6h4v4h4v4z', // local-hospital
    Education: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z', // school
    Other: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z', // more-horiz
    Income: 'M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z' // trending-up
};

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

    const getLogoForPDF = async () => {
        try {
            const asset = Asset.fromModule(require('../assets/images/logo.png'));
            if (!asset.localUri) {
                await asset.downloadAsync();
            }
            if (asset.localUri) {
                const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                return `data:image/png;base64,${base64}`;
            }
        } catch (error) {
            console.error('Error loading logo:', error);
        }

        // Fallback SVG if logo fails to load
        const svgLogo = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <rect width="32" height="32" rx="6" fill="#374151"/>
            <text x="16" y="22" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">S</text>
        </svg>`;
        return `data:image/svg+xml;base64,${btoa(svgLogo)}`;
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

            if (!csvContent || csvContent.trim() === '') {
                Alert.alert('No Data', 'No transactions found for the selected date range.');
                return;
            }

            const fileName = `Spendwise_Report_${formatDateForAPI(startDate)}_to_${formatDateForAPI(endDate)}.csv`;
            const filePath = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.writeAsStringAsync(filePath, csvContent);

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(filePath, {
                    mimeType: 'text/csv',
                    dialogTitle: 'Export Report',
                });
            }

            onClose();
        } catch (error) {
            console.error('CSV export error:', error);
            Alert.alert('Error', 'Failed to export. Please try again.');
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

            if (!response.success || !response.data) {
                Alert.alert('No Data', 'No transactions found for the selected date range.');
                return;
            }

            const data = response.data;

            // Get logo for PDF embedding
            const logoDataUrl = await getLogoForPDF();

            // Generate HTML for PDF - NO EXTERNAL CSS, ALL INLINE
            const html = generatePDFHTML(data, currencySymbol, logoDataUrl);

            // Generate PDF using Print module
            const { uri } = await Print.printToFileAsync({ html });

            const fileName = `Spendwise_Report_${formatDateForAPI(startDate)}_to_${formatDateForAPI(endDate)}.pdf`;
            const customFilePath = `${FileSystem.documentDirectory}${fileName}`;

            await FileSystem.copyAsync({
                from: uri,
                to: customFilePath
            });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(customFilePath, {
                    mimeType: 'application/pdf',
                    dialogTitle: 'Export Report',
                });
            }

            onClose();
        } catch (error) {
            console.error('PDF export error:', error);
            Alert.alert('Error', 'Failed to export. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const generatePDFHTML = (data: any, currency: string, logoDataUrl: string = '') => {
        const summary = data.summary || {};
        const expenses = data.expenses || [];
        const income = data.income || [];
        const categoryBreakdown = data.categoryBreakdown || [];
        const user = data.user || {};

        const reportDate = new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const daysInPeriod = expenses.length > 0 ? expenses.length : 1;
        const totalExp = summary.totalExpenses || 0;
        const avgDailyExpense = Math.round(totalExp / daysInPeriod);

        // --- INLINE STYLES CONSTANTS ---
        const STYLE_BODY = "font-family: Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 40px; background-color: #ffffff;";
        const STYLE_HEADER = "width: 100%; border-bottom: 3px solid #1f2937; padding-bottom: 20px; margin-bottom: 40px;";
        const STYLE_LOGO_BOX = "width: 50px; height: 50px; background-color: #1f2937; border-radius: 8px; text-align: center; vertical-align: middle; line-height: 50px;";
        const STYLE_BRAND_TITLE = "font-size: 28px; font-weight: bold; color: #1f2937; margin: 0;";
        const STYLE_BRAND_SUB = "font-size: 14px; text-transform: uppercase; color: #6b7280; margin: 0; letter-spacing: 1px;";
        const STYLE_BADGE = "background-color: #1f2937; color: #ffffff; padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; display: inline-block;";

        const STYLE_CARD = "background-color: #f9fafb; padding: 15px; border-radius: 10px; border: 1px solid #e5e7eb; text-align: center; width: 23%;";
        const STYLE_CARD_LABEL = "font-size: 10px; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; letter-spacing: 1px;";
        const STYLE_CARD_VALUE = "font-size: 20px; font-weight: bold; color: #111827;";

        const STYLE_SECTION_HEADER = "margin-top: 40px; margin-bottom: 15px; border-left: 5px solid #1f2937; padding-left: 15px; font-size: 18px; font-weight: bold; color: #1f2937;";

        const STYLE_TH = "text-align: left; padding: 12px; background-color: #f3f4f6; color: #4b5563; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;";
        const STYLE_TD = "padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151;";
        const STYLE_TD_AMOUNT = "padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; font-weight: bold; text-align: right;";

        // --- GENERATE ROWS ---

        const expenseRows = expenses.map((exp: any, index: number) => {
            const config = CATEGORY_CONFIG[exp.category] || CATEGORY_CONFIG.Other;
            const iconPath = CATEGORY_ICONS[exp.category] || CATEGORY_ICONS.Other;
            const bg = index % 2 === 0 ? '#ffffff' : '#fafafa';

            return `
            <tr style="background-color: ${bg};">
                <td style="${STYLE_TD}">${exp.date || '-'}</td>
                <td style="${STYLE_TD}">
                    <table style="width:100%; border-collapse: collapse;">
                        <tr>
                            <td style="width: 30px; padding: 0;">
                                <div style="width: 24px; height: 24px; background-color: #f3f4f6; border-radius: 4px; text-align: center;">
                                    <svg width="14" height="14" style="margin-top: 5px;" fill="#6b7280" viewBox="0 0 24 24"><path d="${iconPath}" /></svg>
                                </div>
                            </td>
                            <td style="padding: 0; font-weight: 500;">${exp.description || exp.category}</td>
                        </tr>
                    </table>
                </td>
                <td style="${STYLE_TD}">
                    <span style="background-color: ${config.color}20; color: ${config.color}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                        ${exp.category}
                    </span>
                </td>
                <td style="${STYLE_TD_AMOUNT} color: #dc2626;">
                    ${currency}${(exp.amount || 0).toLocaleString('en-IN')}
                </td>
            </tr>`;
        }).join('');

        const incomeRows = income.map((inc: any, index: number) => {
            const iconPath = CATEGORY_ICONS.Income;
            const bg = index % 2 === 0 ? '#ffffff' : '#fafafa';
            return `
            <tr style="background-color: ${bg};">
                <td style="${STYLE_TD}">${inc.date || '-'}</td>
                <td style="${STYLE_TD}">
                     <table style="width:100%; border-collapse: collapse;">
                        <tr>
                            <td style="width: 30px; padding: 0;">
                                <div style="width: 24px; height: 24px; background-color: #ecfdf5; border-radius: 4px; text-align: center;">
                                    <svg width="14" height="14" style="margin-top: 5px;" fill="#059669" viewBox="0 0 24 24"><path d="${iconPath}" /></svg>
                                </div>
                            </td>
                            <td style="padding: 0; font-weight: 500;">${inc.description || inc.source}</td>
                        </tr>
                    </table>
                </td>
                <td style="${STYLE_TD}">
                    <span style="background-color: #d1fae5; color: #059669; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold;">
                        ${inc.source}
                    </span>
                </td>
                <td style="${STYLE_TD_AMOUNT} color: #059669;">
                    ${currency}${(inc.amount || 0).toLocaleString('en-IN')}
                </td>
            </tr>`;
        }).join('');

        const categoryRows = categoryBreakdown.map((cat: any) => {
            const config = CATEGORY_CONFIG[cat.name] || CATEGORY_CONFIG.Other;
            const iconPath = CATEGORY_ICONS[cat.name] || CATEGORY_ICONS.Other;
            return `
            <div style="margin-bottom: 15px; page-break-inside: avoid;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="width: 40px;">
                            <div style="width: 32px; height: 32px; background-color: ${config.color}20; border-radius: 8px; text-align: center; vertical-align: middle;">
                                <svg width="18" height="18" style="margin-top: 7px;" fill="${config.color}" viewBox="0 0 24 24"><path d="${iconPath}" /></svg>
                            </div>
                        </td>
                        <td>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span style="font-weight: bold; font-size: 13px;">${cat.name}</span>
                                <span style="font-weight: bold; color: ${config.color}; font-size: 13px;">${currency}${cat.amount.toLocaleString('en-IN')}</span>
                            </div>
                            <div style="width: 100%; height: 6px; background-color: #e5e7eb; border-radius: 3px; overflow: hidden;">
                                <div style="height: 100%; width: ${cat.percentage}%; background-color: ${config.color};"></div>
                            </div>
                        </td>
                        <td style="width: 50px; text-align: right; font-weight: bold; font-size: 12px; color: #6b7280;">
                            ${cat.percentage}%
                        </td>
                    </tr>
                </table>
            </div>`;
        }).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
            </head>
            <body style="${STYLE_BODY}">
                
                <!-- HEADER TABLE -->
                <table style="${STYLE_HEADER}">
                    <tr>
                        <td>
                            <table style="border-collapse: collapse;">
                                <tr>
                                    <td style="padding-right: 15px;">
                                        <div style="${STYLE_LOGO_BOX}">
                                            ${logoDataUrl
                ? `<img src="${logoDataUrl}" style="width: 30px; height: 30px; vertical-align: middle;" />`
                : '<span style="color:white; font-size:24px; font-weight:bold;">S</span>'}
                                        </div>
                                    </td>
                                    <td>
                                        <h1 style="${STYLE_BRAND_TITLE}">Spendwise</h1>
                                        <p style="${STYLE_BRAND_SUB}">Financial Report</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                        <td style="text-align: right; vertical-align: top;">
                            <div style="${STYLE_BADGE}">${data.dateRange || formatDate(startDate) + ' - ' + formatDate(endDate)}</div>
                            <div style="font-size: 11px; color: #6b7280; margin-top: 5px;">Generated: ${reportDate}</div>
                            <div style="font-size: 11px; color: #6b7280;">Currency: ${user.currency || 'INR'}</div>
                        </td>
                    </tr>
                </table>

                <!-- SUMMARY CARDS TABLE -->
                <table style="width: 100%; border-spacing: 10px; border-collapse: separate; margin-bottom: 30px;">
                    <tr>
                        <td style="${STYLE_CARD} background-color: #ecfdf5; border-color: #d1fae5;">
                            <div style="${STYLE_CARD_LABEL} color: #059669;">Income</div>
                            <div style="${STYLE_CARD_VALUE} color: #047857;">${currency}${(summary.totalIncome || 0).toLocaleString('en-IN')}</div>
                        </td>
                        <td style="${STYLE_CARD} background-color: #fef2f2; border-color: #fee2e2;">
                            <div style="${STYLE_CARD_LABEL} color: #dc2626;">Expenses</div>
                            <div style="${STYLE_CARD_VALUE} color: #b91c1c;">${currency}${(summary.totalExpenses || 0).toLocaleString('en-IN')}</div>
                        </td>
                        <td style="${STYLE_CARD} background-color: #eff6ff; border-color: #dbeafe;">
                            <div style="${STYLE_CARD_LABEL} color: #2563eb;">Savings</div>
                            <div style="${STYLE_CARD_VALUE} color: #1d4ed8;">${currency}${(summary.netSavings || 0).toLocaleString('en-IN')}</div>
                        </td>
                        <td style="${STYLE_CARD} background-color: #fffbeb; border-color: #fef3c7;">
                            <div style="${STYLE_CARD_LABEL} color: #d97706;">Daily Avg</div>
                            <div style="${STYLE_CARD_VALUE} color: #b45309;">${currency}${avgDailyExpense.toLocaleString('en-IN')}</div>
                        </td>
                    </tr>
                </table>

                ${categoryBreakdown.length > 0 ? `
                <div style="${STYLE_SECTION_HEADER} border-color: #4f46e5;">Spending Analysis</div>
                <div style="column-count: 2; column-gap: 40px;">
                    ${categoryRows}
                </div>
                ` : ''}

                ${expenses.length > 0 ? `
                <div style="${STYLE_SECTION_HEADER} border-color: #dc2626;">
                    Expense History 
                    <span style="background-color: #f3f4f6; color: #4b5563; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 10px; font-weight: normal;">
                        ${expenses.length} Records
                    </span>
                </div>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
                    <thead>
                        <tr>
                            <th style="${STYLE_TH} width: 15%;">Date</th>
                            <th style="${STYLE_TH} width: 45%;">Description</th>
                            <th style="${STYLE_TH} width: 20%;">Category</th>
                            <th style="${STYLE_TH} width: 20%; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>${expenseRows}</tbody>
                </table>
                ` : '<div style="text-align: center; padding: 30px; font-style: italic; color: #9ca3af;">No expenses recorded</div>'}

                ${income.length > 0 ? `
                <div style="${STYLE_SECTION_HEADER} border-color: #059669; margin-top: 50px;">
                    Income History
                    <span style="background-color: #f3f4f6; color: #4b5563; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 10px; font-weight: normal;">
                        ${income.length} Records
                    </span>
                </div>
                <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
                    <thead>
                        <tr>
                            <th style="${STYLE_TH} width: 15%;">Date</th>
                            <th style="${STYLE_TH} width: 45%;">Source</th>
                            <th style="${STYLE_TH} width: 20%;">Type</th>
                            <th style="${STYLE_TH} width: 20%; text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>${incomeRows}</tbody>
                </table>
                ` : ''}
                
                <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px;">
                    Generated by Spendwise App
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

    const setQuickDate = (type: 'thisMonth' | 'last30' | 'last90' | 'thisYear' | 'lastYear') => {
        const now = new Date();
        switch (type) {
            case 'thisMonth':
                setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
                setEndDate(now);
                break;
            case 'last30':
                setStartDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
                setEndDate(now);
                break;
            case 'last90':
                setStartDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
                setEndDate(now);
                break;
            case 'thisYear':
                setStartDate(new Date(now.getFullYear(), 0, 1));
                setEndDate(now);
                break;
            case 'lastYear':
                setStartDate(new Date(now.getFullYear() - 1, 0, 1));
                setEndDate(new Date(now.getFullYear() - 1, 11, 31));
                break;
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <MaterialIcons name="close" size={24} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: theme.colors.text }]}>Export Report</Text>
                        <View style={{ width: 24 }} />
                    </View>

                    {/* Format Selection */}
                    <View style={styles.formatSection}>
                        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Export Format</Text>
                        <View style={styles.formatSelector}>
                            <TouchableOpacity
                                style={[
                                    styles.formatButton,
                                    { backgroundColor: exportType === 'pdf' ? theme.colors.primary : theme.colors.surface },
                                ]}
                                onPress={() => setExportType('pdf')}
                            >
                                <MaterialIcons name="picture-as-pdf" size={20} color={exportType === 'pdf' ? '#FFF' : theme.colors.textSecondary} />
                                <Text style={[styles.formatButtonText, { color: exportType === 'pdf' ? '#FFF' : theme.colors.text }]}>PDF</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.formatButton,
                                    { backgroundColor: exportType === 'csv' ? theme.colors.primary : theme.colors.surface },
                                ]}
                                onPress={() => setExportType('csv')}
                            >
                                <MaterialIcons name="table-chart" size={20} color={exportType === 'csv' ? '#FFF' : theme.colors.textSecondary} />
                                <Text style={[styles.formatButtonText, { color: exportType === 'csv' ? '#FFF' : theme.colors.text }]}>CSV</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Date Selection */}
                    <View style={styles.dateSection}>
                        <Text style={[styles.sectionLabel, { color: theme.colors.textSecondary }]}>Date Range</Text>

                        <View style={styles.dateSelector}>
                            <TouchableOpacity
                                style={[styles.dateButton, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setShowStartPicker(true)}
                            >
                                <MaterialIcons name="date-range" size={16} color={theme.colors.primary} />
                                <View style={styles.dateTextContainer}>
                                    <Text style={[styles.dateValue, { color: theme.colors.text }]}>{formatDate(startDate)}</Text>
                                </View>
                            </TouchableOpacity>

                            <MaterialIcons name="arrow-forward" size={16} color={theme.colors.textTertiary} />

                            <TouchableOpacity
                                style={[styles.dateButton, { backgroundColor: theme.colors.surface }]}
                                onPress={() => setShowEndPicker(true)}
                            >
                                <MaterialIcons name="event-note" size={16} color={theme.colors.primary} />
                                <View style={styles.dateTextContainer}>
                                    <Text style={[styles.dateValue, { color: theme.colors.text }]}>{formatDate(endDate)}</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Quick Presets */}
                        <View style={styles.presetsContainer}>
                            <Text style={[styles.presetsLabel, { color: theme.colors.textSecondary }]}>Quick Select</Text>
                            <View style={styles.presetsRow}>
                                {[
                                    { label: 'This Month', type: 'thisMonth' as const, icon: 'today' },
                                    { label: '30 Days', type: 'last30' as const, icon: 'schedule' },
                                    { label: '90 Days', type: 'last90' as const, icon: 'date-range' },
                                    { label: 'This Year', type: 'thisYear' as const, icon: 'calendar-view-month' },
                                    { label: 'Last Year', type: 'lastYear' as const, icon: 'history' },
                                ].map((preset) => (
                                    <TouchableOpacity
                                        key={preset.type}
                                        style={[styles.presetButton, { borderColor: theme.colors.border }]}
                                        onPress={() => setQuickDate(preset.type)}
                                    >
                                        <MaterialIcons name={preset.icon} size={16} color={theme.colors.primary} />
                                        <Text style={[styles.presetButtonText, { color: theme.colors.primary }]}>{preset.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* Fixed Export Button at Bottom */}
                    <View style={[styles.bottomContainer, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
                        <TouchableOpacity
                            style={[styles.exportButton, { backgroundColor: theme.colors.primary }]}
                            onPress={handleExport}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                                <>
                                    <MaterialIcons
                                        name={exportType === 'pdf' ? 'picture-as-pdf' : 'table-chart'}
                                        size={20}
                                        color="#FFF"
                                    />
                                    <Text style={styles.exportButtonText}>Export {exportType.toUpperCase()}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

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
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end'
    },
    container: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: 480, // Optimized height for better spacing
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center'
    },
    formatSection: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12
    },
    dateSection: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center'
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8
    },
    dateButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 8
    },
    dateTextContainer: {
        flex: 1
    },
    dateValue: {
        fontSize: 14,
        fontWeight: '500'
    },
    formatSelector: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center'
    },
    formatButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
        maxWidth: 120
    },
    formatButtonText: {
        fontSize: 15,
        fontWeight: '600'
    },
    presetsContainer: {
        marginTop: 8
    },
    presetsLabel: {
        fontSize: 13,
        marginBottom: 8,
        textAlign: 'center'
    },
    presetsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center'
    },
    presetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 18,
        borderWidth: 1,
        gap: 4,
        minWidth: 85,
        justifyContent: 'center'
    },
    presetButtonText: {
        fontSize: 11,
        fontWeight: '500'
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingBottom: 34,
        paddingTop: 8,
        borderTopWidth: 1
    },
    exportButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        marginTop: 0
    },
    exportButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600'
    }
});
