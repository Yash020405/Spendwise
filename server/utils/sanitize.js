/**
 * Input Sanitization Utilities
 * Prevents NoSQL injection and other malicious input attacks
 */

import mongoose from 'mongoose';

/**
 * Sanitize a string value - removes any MongoDB operators
 * @param {any} value - The value to sanitize
 * @returns {string|null} - Sanitized string or null
 */
export const sanitizeString = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') {
        // Convert to string if it's a safe primitive
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        return null;
    }
    // Remove any MongoDB operators (keys starting with $)
    return value.replace(/[${}]/g, '');
};

/**
 * Sanitize a MongoDB ObjectId
 * @param {any} id - The ID to sanitize
 * @returns {string|null} - Valid ObjectId string or null
 */
export const sanitizeObjectId = (id) => {
    if (!id) return null;
    const idStr = String(id).trim();
    // Check if it's a valid ObjectId format (24 hex characters)
    if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) {
        return idStr;
    }
    return null;
};

/**
 * Sanitize a number value
 * @param {any} value - The value to sanitize
 * @returns {number|null} - Sanitized number or null
 */
export const sanitizeNumber = (value) => {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    if (isNaN(num) || !isFinite(num)) return null;
    return num;
};

/**
 * Sanitize a boolean value
 * @param {any} value - The value to sanitize
 * @returns {boolean|null} - Sanitized boolean or null
 */
export const sanitizeBoolean = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return null;
};

/**
 * Sanitize an email address
 * @param {any} email - The email to sanitize
 * @returns {string|null} - Sanitized email or null
 */
export const sanitizeEmail = (email) => {
    if (!email || typeof email !== 'string') return null;
    const sanitized = email.toLowerCase().trim().replace(/[${}]/g, '');
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : null;
};

/**
 * Sanitize a date value
 * @param {any} date - The date to sanitize
 * @returns {Date|null} - Valid Date object or null
 */
export const sanitizeDate = (date) => {
    if (!date) return null;
    const parsed = new Date(date);
    return isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Sanitize an array of strings
 * @param {any} arr - The array to sanitize
 * @returns {string[]} - Sanitized array of strings
 */
export const sanitizeStringArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr
        .map(item => sanitizeString(item))
        .filter(item => item !== null);
};

/**
 * Sanitize participant data for split expenses
 * @param {any} participant - The participant object to sanitize
 * @returns {object|null} - Sanitized participant or null
 */
export const sanitizeParticipant = (participant) => {
    if (!participant || typeof participant !== 'object') return null;
    
    return {
        id: sanitizeString(participant.id),
        _id: participant._id ? sanitizeString(String(participant._id)) : undefined,
        name: sanitizeString(participant.name),
        phone: participant.phone ? sanitizeString(participant.phone) : undefined,
        shareAmount: sanitizeNumber(participant.shareAmount) || 0,
        sharePercentage: participant.sharePercentage ? sanitizeNumber(participant.sharePercentage) : undefined,
        isPaid: sanitizeBoolean(participant.isPaid) || false,
        paidAmount: sanitizeNumber(participant.paidAmount) || 0,
        paidDate: participant.paidDate ? sanitizeDate(participant.paidDate) : undefined,
    };
};

/**
 * Sanitize an array of participants
 * @param {any} participants - The participants array to sanitize
 * @returns {object[]} - Sanitized array of participants
 */
export const sanitizeParticipants = (participants) => {
    if (!Array.isArray(participants)) return [];
    return participants
        .map(p => sanitizeParticipant(p))
        .filter(p => p !== null && p.name);
};

/**
 * Sanitize a localId (for offline sync)
 * @param {any} localId - The localId to sanitize
 * @returns {string|null} - Sanitized localId or null
 */
export const sanitizeLocalId = (localId) => {
    if (!localId) return null;
    const str = String(localId).trim();
    // LocalId should be alphanumeric with underscores, max 100 chars
    if (str.length > 100) return null;
    // Remove any potentially dangerous characters
    return str.replace(/[^a-zA-Z0-9_-]/g, '');
};

/**
 * Sanitize query parameters for filtering
 * @param {object} query - The query object to sanitize
 * @param {string[]} allowedFields - List of allowed field names
 * @returns {object} - Sanitized query object
 */
export const sanitizeQuery = (query, allowedFields = []) => {
    if (!query || typeof query !== 'object') return {};
    
    const sanitized = {};
    for (const [key, value] of Object.entries(query)) {
        // Skip if not in allowed fields
        if (allowedFields.length > 0 && !allowedFields.includes(key)) continue;
        
        // Skip any keys that look like MongoDB operators
        if (key.startsWith('$') || key.includes('.')) continue;
        
        // Skip objects that might contain operators
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
            // Check for MongoDB operators in nested object
            const hasOperator = Object.keys(value).some(k => k.startsWith('$'));
            if (hasOperator) continue;
        }
        
        sanitized[key] = value;
    }
    
    return sanitized;
};

/**
 * Sanitize URL query parameters (from req.query)
 * Returns sanitized strings for all values
 * @param {object} queryParams - The query params object to sanitize
 * @returns {object} - Sanitized query params
 */
export const sanitizeQueryParams = (queryParams) => {
    if (!queryParams || typeof queryParams !== 'object') return {};
    
    const sanitized = {};
    for (const [key, value] of Object.entries(queryParams)) {
        // Skip any keys that look like MongoDB operators
        if (key.startsWith('$') || key.includes('.')) continue;
        
        // Sanitize the key itself
        const sanitizedKey = key.replace(/[${}]/g, '');
        
        // Sanitize string values
        if (typeof value === 'string') {
            sanitized[sanitizedKey] = sanitizeString(value);
        } else if (Array.isArray(value)) {
            sanitized[sanitizedKey] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
        } else {
            sanitized[sanitizedKey] = value;
        }
    }
    
    return sanitized;
};

// Alias for backward compatibility
export const sanitizeMongoId = sanitizeObjectId;

export default {
    sanitizeString,
    sanitizeObjectId,
    sanitizeMongoId: sanitizeObjectId,
    sanitizeNumber,
    sanitizeBoolean,
    sanitizeEmail,
    sanitizeDate,
    sanitizeStringArray,
    sanitizeParticipant,
    sanitizeParticipants,
    sanitizeLocalId,
    sanitizeQuery,
    sanitizeQueryParams,
};
