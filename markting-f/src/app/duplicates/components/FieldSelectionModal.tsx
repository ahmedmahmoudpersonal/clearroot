'use client';

import { useState, useEffect } from 'react';

interface Contact {
    id: number;
    hubspotId: string;
    lastModifiedDate?: Date | string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
    hs_additional_emails?: string;
    otherProperties?: Record<string, any>;
}

interface FieldData {
    firstName?: string;
    lastName?: string;
    phone?: string;
    company?: string;
    otherProperties?: Record<string, any>;
}

interface FieldSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    primaryContact: Contact;
    secondaryContacts: Contact[];
    onConfirm: (updatedPrimaryData: FieldData) => void;
}

export default function FieldSelectionModal({
    isOpen,
    onClose,
    primaryContact,
    secondaryContacts,
    onConfirm,
}: FieldSelectionModalProps) {
    const [selectedFields, setSelectedFields] = useState<FieldData>({
        firstName: primaryContact.firstName || '',
        lastName: primaryContact.lastName || '',
        phone: primaryContact.phone || '',
        company: primaryContact.company || '',
        otherProperties: primaryContact.otherProperties || {},
    });

    // Reset form when modal opens with new data
    useEffect(() => {
        if (isOpen) {
            setSelectedFields({
                firstName: primaryContact.firstName || '',
                lastName: primaryContact.lastName || '',
                phone: primaryContact.phone || '',
                company: primaryContact.company || '',
                otherProperties: primaryContact.otherProperties || {},
            });
        }
    }, [isOpen, primaryContact]);

    if (!isOpen) return null;

    const handleFieldChange = (field: keyof FieldData, value: string) => {
        setSelectedFields(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleOtherPropertyChange = (propertyName: string, value: string) => {
        setSelectedFields(prev => ({
            ...prev,
            otherProperties: {
                ...prev.otherProperties,
                [propertyName]: value
            }
        }));
    };

    // Get all unique other properties from all contacts
    const getAllOtherProperties = () => {
        const allContacts = [primaryContact, ...secondaryContacts];
        const allOtherProperties: Record<string, Set<string>> = {};

        allContacts.forEach(contact => {
            if (contact.otherProperties) {
                Object.entries(contact.otherProperties).forEach(([key, value]) => {
                    if (!allOtherProperties[key]) {
                        allOtherProperties[key] = new Set();
                    }
                    if (value && value.toString().trim()) {
                        allOtherProperties[key].add(value.toString());
                    }
                });
            }
        });

        // Convert sets to arrays
        const result: Record<string, string[]> = {};
        Object.entries(allOtherProperties).forEach(([key, valueSet]) => {
            result[key] = Array.from(valueSet);
        });

        return result;
    };

    const handleConfirm = () => {
        onConfirm(selectedFields);
        onClose();
    };

    // Get all unique values for each field from all contacts
    const getAllFieldOptions = (field: keyof Omit<Contact, 'id' | 'hubspotId' | 'lastModifiedDate' | 'email' | 'hs_additional_emails'>) => {
        const allContacts = [primaryContact, ...secondaryContacts];
        const values = allContacts
            .map(contact => contact[field])
            .filter(value => value && value.toString().trim())
            .filter((value, index, arr) => arr.indexOf(value) === index); // Remove duplicates
        return values as string[];
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fadeIn">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 01.88 7.9M12 3v1m0 16v1m8-9h1M4 12H3m15.36 6.36l.7.7M6.34 6.34l-.7-.7m12.02 0l.7-.7M6.34 17.66l-.7.7" /></svg>
                        Select Contact Fields
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Choose the values for each field from the available options or enter custom values.<br />
                        <span className="text-xs text-blue-500 font-medium">Email fields cannot be modified here.</span>
                    </p>
                </div>

                {/* Content */}
                <div className="px-8 py-6 space-y-8">
                    {/* First Name */}
                    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 transition hover:shadow-md">
                        <label className="block text-sm font-semibold text-gray-700 mb-3 tracking-wide">
                            First Name
                        </label>
                        <div className="space-y-2">
                            {getAllFieldOptions('firstName').map((option, index) => (
                                <label key={index} className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-lg transition hover:bg-blue-50">
                                    <input
                                        type="radio"
                                        name="firstName"
                                        value={option}
                                        checked={selectedFields.firstName === option}
                                        onChange={(e) => handleFieldChange('firstName', e.target.value)}
                                        className="accent-blue-600 w-4 h-4 transition group-hover:scale-110"
                                    />
                                    <span className="text-sm text-gray-800 group-hover:text-blue-700 font-medium">{option}</span>
                                </label>
                            ))}
                            <div className="flex items-center gap-2 mt-2 bg-white rounded-lg border border-gray-200 px-2 py-1 shadow-inner">
                                <input
                                    type="radio"
                                    name="firstName"
                                    value=""
                                    checked={!getAllFieldOptions('firstName').includes(selectedFields.firstName || '')}
                                    onChange={() => { }}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <input
                                    type="text"
                                    placeholder="Enter custom first name"
                                    value={getAllFieldOptions('firstName').includes(selectedFields.firstName || '') ? '' : selectedFields.firstName}
                                    onChange={(e) => handleFieldChange('firstName', e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-md focus:outline-none text-gray-900 transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Last Name */}
                    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 transition hover:shadow-md mt-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3 tracking-wide">
                            Last Name
                        </label>
                        <div className="space-y-2">
                            {getAllFieldOptions('lastName').map((option, index) => (
                                <label key={index} className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-lg transition hover:bg-blue-50">
                                    <input
                                        type="radio"
                                        name="lastName"
                                        value={option}
                                        checked={selectedFields.lastName === option}
                                        onChange={(e) => handleFieldChange('lastName', e.target.value)}
                                        className="accent-blue-600 w-4 h-4 transition group-hover:scale-110"
                                    />
                                    <span className="text-sm text-gray-800 group-hover:text-blue-700 font-medium">{option}</span>
                                </label>
                            ))}
                            <div className="flex items-center gap-2 mt-2 bg-white rounded-lg border border-gray-200 px-2 py-1 shadow-inner">
                                <input
                                    type="radio"
                                    name="lastName"
                                    value=""
                                    checked={!getAllFieldOptions('lastName').includes(selectedFields.lastName || '')}
                                    onChange={() => { }}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <input
                                    type="text"
                                    placeholder="Enter custom last name"
                                    value={getAllFieldOptions('lastName').includes(selectedFields.lastName || '') ? '' : selectedFields.lastName}
                                    onChange={(e) => handleFieldChange('lastName', e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-md focus:outline-none text-gray-900 transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 transition hover:shadow-md mt-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3 tracking-wide">
                            Phone
                        </label>
                        <div className="space-y-2">
                            {getAllFieldOptions('phone').map((option, index) => (
                                <label key={index} className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-lg transition hover:bg-blue-50">
                                    <input
                                        type="radio"
                                        name="phone"
                                        value={option}
                                        checked={selectedFields.phone === option}
                                        onChange={(e) => handleFieldChange('phone', e.target.value)}
                                        className="accent-blue-600 w-4 h-4 transition group-hover:scale-110"
                                    />
                                    <span className="text-sm text-gray-800 group-hover:text-blue-700 font-medium">{option}</span>
                                </label>
                            ))}
                            <div className="flex items-center gap-2 mt-2 bg-white rounded-lg border border-gray-200 px-2 py-1 shadow-inner">
                                <input
                                    type="radio"
                                    name="phone"
                                    value=""
                                    checked={!getAllFieldOptions('phone').includes(selectedFields.phone || '')}
                                    onChange={() => { }}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <input
                                    type="text"
                                    placeholder="Enter custom phone"
                                    value={getAllFieldOptions('phone').includes(selectedFields.phone || '') ? '' : selectedFields.phone}
                                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-md focus:outline-none text-gray-900 transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Company */}
                    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 transition hover:shadow-md mt-6">
                        <label className="block text-sm font-semibold text-gray-700 mb-3 tracking-wide">
                            Company
                        </label>
                        <div className="space-y-2">
                            {getAllFieldOptions('company').map((option, index) => (
                                <label key={index} className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-lg transition hover:bg-blue-50">
                                    <input
                                        type="radio"
                                        name="company"
                                        value={option}
                                        checked={selectedFields.company === option}
                                        onChange={(e) => handleFieldChange('company', e.target.value)}
                                        className="accent-blue-600 w-4 h-4 transition group-hover:scale-110"
                                    />
                                    <span className="text-sm text-gray-800 group-hover:text-blue-700 font-medium">{option}</span>
                                </label>
                            ))}
                            <div className="flex items-center gap-2 mt-2 bg-white rounded-lg border border-gray-200 px-2 py-1 shadow-inner">
                                <input
                                    type="radio"
                                    name="company"
                                    value=""
                                    checked={!getAllFieldOptions('company').includes(selectedFields.company || '')}
                                    onChange={() => { }}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <input
                                    type="text"
                                    placeholder="Enter custom company"
                                    value={getAllFieldOptions('company').includes(selectedFields.company || '') ? '' : selectedFields.company}
                                    onChange={(e) => handleFieldChange('company', e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-md focus:outline-none text-gray-900 transition"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Other Properties */}
                    {Object.keys(getAllOtherProperties()).length > 0 && (
                        <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-100 transition hover:shadow-md mt-6">
                            <label className="block text-sm font-semibold text-gray-700 mb-3 tracking-wide">
                                Additional Properties
                            </label>
                            <div className="space-y-4">
                                {Object.entries(getAllOtherProperties()).map(([propertyName, options]) => (
                                    <div key={propertyName} className="bg-white rounded-lg p-4 border border-gray-200">
                                        <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wider">
                                            {propertyName}
                                        </label>
                                        <div className="space-y-2">
                                            {options.map((option, index) => (
                                                <label key={index} className="flex items-center gap-2 cursor-pointer group py-1 px-2 rounded-lg transition hover:bg-blue-50">
                                                    <input
                                                        type="radio"
                                                        name={`otherProperty_${propertyName}`}
                                                        value={option}
                                                        checked={selectedFields.otherProperties?.[propertyName] === option}
                                                        onChange={(e) => handleOtherPropertyChange(propertyName, e.target.value)}
                                                        className="accent-blue-600 w-4 h-4 transition group-hover:scale-110"
                                                    />
                                                    <span className="text-sm text-gray-800 group-hover:text-blue-700 font-medium break-words flex-1">
                                                        {option.length > 80 ? `${option.substring(0, 80)}...` : option}
                                                    </span>
                                                </label>
                                            ))}
                                            <div className="flex items-center gap-2 mt-2 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1 shadow-inner">
                                                <input
                                                    type="radio"
                                                    name={`otherProperty_${propertyName}`}
                                                    value=""
                                                    checked={!options.includes(selectedFields.otherProperties?.[propertyName] || '')}
                                                    onChange={() => { }}
                                                    className="accent-blue-600 w-4 h-4"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder={`Enter custom ${propertyName}`}
                                                    value={options.includes(selectedFields.otherProperties?.[propertyName] || '') ? '' : selectedFields.otherProperties?.[propertyName] || ''}
                                                    onChange={(e) => handleOtherPropertyChange(propertyName, e.target.value)}
                                                    className="flex-1 px-3 py-2 rounded-md focus:outline-none text-gray-900 transition bg-white border border-gray-200"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-gray-100 bg-gradient-to-r from-white to-blue-50 rounded-b-2xl flex flex-col sm:flex-row justify-end items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 border border-transparent rounded-lg shadow-md hover:from-blue-700 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Proceed with Merge
                    </button>
                </div>
            </div>
        </div>
    );
}
