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
}

interface DuplicateGroup {
    id: number;
    group: Contact[];
}

interface MergeModalProps {
    isOpen: boolean;
    group: DuplicateGroup | null;
    onClose: () => void;
    onSubmit: (mergeData: {
        groupId: number;
        updatedData: Record<string, string>;
        removedIds: number[];
    }) => void;
}

type FieldType = 'firstName' | 'lastName' | 'email' | 'phone' | 'company';

export default function MergeModal({ isOpen, group, onClose, onSubmit }: MergeModalProps) {
    // Helper function to format date
    const formatDate = (date: Date | string | undefined) => {
        if (!date) return 'Not available';
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        if (isNaN(dateObj.getTime())) return 'Invalid date';
        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
    const [mergedData, setMergedData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        phone: '',
        company: '',
    });
    const [draggedData, setDraggedData] = useState<{
        field: FieldType;
        value: string;
        sourceContactId: number;
    } | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [dragOverTarget, setDragOverTarget] = useState<{ contactId: number, field: FieldType } | null>(null);
    const [touchDragData, setTouchDragData] = useState<{
        field: FieldType;
        value: string;
        sourceContactId: number;
        startX: number;
        startY: number;
    } | null>(null);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => {
        if (group && group.group.length > 0) {
            // Initialize contacts state
            setContacts([...group.group]);

            // Pre-select the first contact
            const firstContact = group.group[0];
            setSelectedContactId(firstContact.id);

            // Pre-fill with data from the first contact
            setMergedData({
                email: firstContact.email || '',
                firstName: firstContact.firstName || '',
                lastName: firstContact.lastName || '',
                phone: firstContact.phone || '',
                company: firstContact.company || '',
            });
        }

        // Detect touch device
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, [group]);

    if (!isOpen || !group) return null;

    // Get unique values for each field
    const getFieldOptions = (field: FieldType): string[] => {
        const values = contacts
            .map(contact => contact[field])
            .filter(value => value && value.trim() !== '')
            .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
        return values as string[];
    };

    // Check if field has conflicting values
    const hasConflict = (field: FieldType): boolean => {
        const options = getFieldOptions(field);
        return options.length > 1;
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, field: FieldType, value: string, contactId: number) => {
        setDraggedData({
            field,
            value,
            sourceContactId: contactId
        });
        e.dataTransfer.effectAllowed = 'move';
        // Add drag image
        e.dataTransfer.setData('text/plain', `${field}: ${value}`);
    };

    const handleDragOver = (e: React.DragEvent, contactId?: number, field?: FieldType) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (contactId && field) {
            setDragOverTarget({ contactId, field });
        }
    };

    const handleDragLeave = () => {
        setDragOverTarget(null);
    };

    const handleDrop = (e: React.DragEvent, targetContactId: number, targetField: FieldType) => {
        e.preventDefault();
        setDragOverTarget(null);

        if (!draggedData || draggedData.sourceContactId === targetContactId) {
            setDraggedData(null);
            return;
        }

        // Update contacts state with the field swap
        setContacts(prevContacts => {
            return prevContacts.map(contact => {
                if (contact.id === targetContactId) {
                    // Update target contact with dragged value
                    return {
                        ...contact,
                        [targetField]: draggedData.value
                    };
                }
                if (contact.id === draggedData.sourceContactId) {
                    // Update source contact with target value (swap)
                    const targetContact = prevContacts.find(c => c.id === targetContactId);
                    const targetValue = targetContact?.[targetField] || '';
                    return {
                        ...contact,
                        [draggedData.field]: targetValue
                    };
                }
                return contact;
            });
        });

        // If target contact is selected, update merged data
        if (targetContactId === selectedContactId) {
            setMergedData(prev => ({
                ...prev,
                [targetField]: draggedData.value
            }));
        }

        // If source contact is selected, update merged data with swapped value
        if (draggedData.sourceContactId === selectedContactId) {
            const targetContact = contacts.find(c => c.id === targetContactId);
            const targetValue = targetContact?.[targetField] || '';
            setMergedData(prev => ({
                ...prev,
                [draggedData.field]: targetValue
            }));
        }

        setDraggedData(null);
    };

    // Touch event handlers for mobile drag and drop
    const handleTouchStart = (e: React.TouchEvent, field: FieldType, value: string, sourceContactId: number) => {
        if (!isTouchDevice) return;

        setTouchDragData({
            field,
            value,
            sourceContactId,
            startY: e.touches[0].clientY,
            startX: e.touches[0].clientX
        });

        // Add visual feedback
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
        e.preventDefault();
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isTouchDevice || !touchDragData) return;
        e.preventDefault();

        // Calculate movement to provide visual feedback
        const touch = e.touches[0];
        const deltaY = Math.abs(touch.clientY - touchDragData.startY);
        const deltaX = Math.abs(touch.clientX - touchDragData.startX);

        // Add drag indication if moved enough
        if (deltaY > 10 || deltaX > 10) {
            (e.currentTarget as HTMLElement).style.transform = `translate(${touch.clientX - touchDragData.startX}px, ${touch.clientY - touchDragData.startY}px)`;
        }
    };

    const handleTouchEnd = (e: React.TouchEvent, targetField?: FieldType, targetContactId?: number) => {
        if (!isTouchDevice || !touchDragData) return;

        // Reset visual styling
        (e.currentTarget as HTMLElement).style.opacity = '';
        (e.currentTarget as HTMLElement).style.transform = '';

        // If we have target field and contact, perform the swap
        if (targetField && targetContactId && targetContactId !== touchDragData.sourceContactId) {
            // Same logic as handleDrop
            setContacts(prevContacts => {
                return prevContacts.map(contact => {
                    if (contact.id === targetContactId) {
                        return {
                            ...contact,
                            [targetField]: touchDragData.value
                        };
                    }
                    if (contact.id === touchDragData.sourceContactId) {
                        const targetContact = prevContacts.find(c => c.id === targetContactId);
                        const targetValue = (targetContact as any)?.[targetField] || '';
                        return {
                            ...contact,
                            [touchDragData.field]: targetValue
                        };
                    }
                    return contact;
                });
            });

            // Update merged data if needed
            if (targetContactId === selectedContactId) {
                setMergedData(prev => ({
                    ...prev,
                    [targetField]: touchDragData.value
                }));
            }

            if (touchDragData.sourceContactId === selectedContactId) {
                const targetContact = contacts.find(c => c.id === targetContactId);
                const targetValue = (targetContact as any)?.[targetField] || '';
                setMergedData(prev => ({
                    ...prev,
                    [touchDragData.field]: targetValue
                }));
            }
        }

        setTouchDragData(null);
    };

    const handleContactSelect = (contactId: number) => {
        setSelectedContactId(contactId);

        // Update merged data with selected contact's data
        const selectedContact = contacts.find(contact => contact.id === contactId);
        if (selectedContact) {
            setMergedData({
                email: selectedContact.email || '',
                firstName: selectedContact.firstName || '',
                lastName: selectedContact.lastName || '',
                phone: selectedContact.phone || '',
                company: selectedContact.company || '',
            });
        }
    };

    const handleFieldChange = (field: string, value: string) => {
        setMergedData(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const renderFieldInput = (field: FieldType, label: string) => {
        const options = getFieldOptions(field);
        const hasConflictingValues = hasConflict(field);

        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                    {label}
                    {hasConflictingValues && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Conflict Detected
                        </span>
                    )}
                </label>

                {hasConflictingValues ? (
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={mergedData[field]}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-3 px-4"
                            placeholder={`Enter ${label.toLowerCase()} or choose from options below`}
                        />
                        {/* <div className="text-xs text-gray-500">
                            <span className="font-medium">Available options:</span>
                            <div className="mt-1 space-y-1">
                                {options.map((option, index) => {
                                    const contactsWithValue = contacts.filter(c => c[field] === option);
                                    return (
                                        <div key={index} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded cursor-pointer hover:bg-gray-100" onClick={() => handleFieldChange(field, option)}>
                                            <span className="font-mono text-xs">{option}</span>
                                            <span className="text-xs text-gray-400">
                                                from HubSpot ID{contactsWithValue.length > 1 ? 's' : ''}: {contactsWithValue.map(c => c.hubspotId).join(', ')}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div> */}
                    </div>
                ) : (
                    <input
                        type="text"
                        value={mergedData[field]}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm py-3 px-4"
                        placeholder={options.length > 0 ? `Current: ${options[0]}` : `Enter ${label.toLowerCase()}`}
                    />
                )}
            </div>
        );
    };

    const handleSubmit = () => {
        if (!selectedContactId) return;

        // All other contacts will be removed except the selected one
        const removedIds = contacts
            .filter(contact => contact.id !== selectedContactId)
            .map(contact => contact.id);

        // Filter out empty values
        const updatedData = Object.fromEntries(
            Object.entries(mergedData).filter(([, value]) => value.trim() !== '')
        );

        onSubmit({
            groupId: group.id,
            updatedData,
            removedIds,
        });
    };

    const conflictCount = (['firstName', 'lastName', 'email', 'phone', 'company'] as FieldType[])
        .filter(field => hasConflict(field)).length;

    // Render draggable field component
    const renderDraggableField = (contact: Contact, field: FieldType, icon: React.ReactNode, label: string) => {
        const value = contact[field];
        if (!value) return null;

        const isBeingDragged = draggedData?.sourceContactId === contact.id && draggedData?.field === field;
        const isDropTarget = dragOverTarget?.contactId === contact.id && dragOverTarget?.field === field;
        const canDrop = draggedData && draggedData.sourceContactId !== contact.id;

        return (
            <div
                draggable
                onDragStart={(e) => handleDragStart(e, field, value, contact.id)}
                onDragOver={(e) => handleDragOver(e, contact.id, field)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, contact.id, field)}
                onTouchStart={(e) => handleTouchStart(e, field, value, contact.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={(e) => handleTouchEnd(e, field, contact.id)}
                className={`flex items-center text-gray-600 p-2 rounded cursor-move transition-all duration-200 border ${isBeingDragged
                    ? 'opacity-50 border-blue-500 bg-blue-50 scale-95'
                    : isDropTarget && canDrop
                        ? 'border-green-400 bg-green-50 shadow-lg scale-105'
                        : 'border-transparent hover:border-blue-300 hover:bg-gray-100'
                    } group`}
                title={`Drag to swap ${label.toLowerCase()} with another contact`}
            >
                <div className={`w-4 h-4 mr-2 transition-colors ${isBeingDragged
                    ? 'text-blue-500'
                    : isDropTarget && canDrop
                        ? 'text-green-500'
                        : 'text-gray-400 group-hover:text-blue-500'
                    }`}>
                    {icon}
                </div>
                <span className={`text-sm transition-colors ${isBeingDragged
                    ? 'text-blue-700'
                    : isDropTarget && canDrop
                        ? 'text-green-700 font-semibold'
                        : 'group-hover:text-blue-700'
                    }`}>
                    {value}
                </span>
                <svg className={`w-4 h-4 ml-auto transition-colors ${isBeingDragged
                    ? 'text-blue-500'
                    : isDropTarget && canDrop
                        ? 'text-green-500'
                        : 'text-gray-300 group-hover:text-blue-500'
                    }`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6L9 7h6l-1-1H10zM7 9l1 1h4l1-1H7zm-1 4l1 1h6l-1-1H6z" />
                </svg>
                {isDropTarget && canDrop && (
                    <div className="absolute inset-0 border-2 border-dashed border-green-400 rounded bg-green-50 bg-opacity-50 flex items-center justify-center">
                        <span className="text-xs font-semibold text-green-700">Drop here to swap</span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-end sm:items-center justify-center min-h-screen p-0 sm:p-4">
                {/* Background overlay */}
                <div
                    className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm"
                    onClick={onClose}
                ></div>

                {/* Modal panel */}
                <div className="relative w-full h-full sm:h-auto sm:max-w-7xl sm:max-h-[95vh] bg-white sm:rounded-2xl shadow-2xl transform transition-all overflow-hidden">
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-bold text-gray-900">
                                            Merge Duplicate Contacts
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            Select one contact to keep and drag fields between cards to swap values
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1zM2 15a1 1 0 011-1h14a1 1 0 110 2H3a1 1 0 01-1-1z" />
                                        </svg>
                                        Drag & Drop enabled
                                    </div>
                                    {conflictCount > 0 && (
                                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            {conflictCount} field{conflictCount > 1 ? 's have' : ' has'} conflicting values
                                        </div>
                                    )}
                                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                        </svg>
                                        {contacts.length} duplicate{contacts.length > 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={onClose}
                                className="self-start sm:self-center text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
                            >
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto h-[calc(100vh-140px)] sm:max-h-[calc(95vh-140px)] p-3 sm:p-6 pb-20 sm:pb-30">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                            {/* Contacts Selection */}
                            <div className="lg:col-span-1 order-1">
                                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 sm:p-4 lg:p-6 h-full">
                                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                                            Select Contact to Keep
                                        </h4>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                                        Choose one contact to keep - drag fields between cards to swap values
                                    </p>
                                    <div className="space-y-3 sm:space-y-4 max-h-[50vh] sm:max-h-[60vh] xl:max-h-96 overflow-y-auto pr-1 sm:pr-2">
                                        {contacts.map((contact) => (
                                            <div
                                                key={contact.id}
                                                className={`relative rounded-lg sm:rounded-xl border-2 p-3 sm:p-4 lg:p-5 cursor-pointer transition-all duration-200 ${selectedContactId === contact.id
                                                    ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                                                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                                                    }`}
                                                onClick={() => handleContactSelect(contact.id)}
                                            >
                                                {selectedContactId === contact.id && (
                                                    <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                                        <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                )}

                                                <div className="flex items-start gap-2 sm:gap-3">
                                                    <div className="flex items-center h-4 sm:h-5 mt-1">
                                                        <input
                                                            type="radio"
                                                            name="selectedContact"
                                                            checked={selectedContactId === contact.id}
                                                            onChange={() => handleContactSelect(contact.id)}
                                                            className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 border-gray-300 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="space-y-2 sm:space-y-3">
                                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                                                        {contact.firstName} {contact.lastName}
                                                                    </p>
                                                                    <div className="flex flex-col gap-1 mt-1">
                                                                        <span className="inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 w-fit">
                                                                            HubSpot ID: {contact.hubspotId}
                                                                        </span>
                                                                        <span className="inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 w-fit">
                                                                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                                                            </svg>
                                                                            Last Modified: {formatDate(contact.lastModifiedDate)}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                {selectedContactId === contact.id && (
                                                                    <div className="hidden sm:flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                        </svg>
                                                                        Selected
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="space-y-2">
                                                                {renderDraggableField(contact, 'email',
                                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                                    </svg>,
                                                                    'Email'
                                                                )}
                                                                {renderDraggableField(contact, 'phone',
                                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                                    </svg>,
                                                                    'Phone'
                                                                )}
                                                                {renderDraggableField(contact, 'company',
                                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                                                    </svg>,
                                                                    'Company'
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>                            {/* Merged Data Form */}
                            <div className="lg:col-span-1 order-2">
                                <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 h-full">
                                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <h4 className="text-base sm:text-lg font-semibold text-gray-900">
                                            Update Contact Data
                                        </h4>
                                    </div>
                                    <p className="text-xs sm:text-sm text-gray-600 mb-4">
                                        Modify the selected contact&apos;s data. Use dropdowns to choose from values available in duplicate contacts.
                                    </p>

                                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                                        {renderFieldInput('firstName', 'First Name')}
                                        {renderFieldInput('lastName', 'Last Name')}
                                        {renderFieldInput('email', 'Email')}
                                        {renderFieldInput('phone', 'Phone')}
                                        {renderFieldInput('company', 'Company')}
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Detailed Keeping and Removing Section */}
                        {selectedContactId && (
                            <div className="mt-6 sm:mt-8 px-3 sm:px-4 lg:px-6 space-y-4 sm:space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                                    {/* Keeping Section */}
                                    <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 order-1">
                                        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <h3 className="text-base sm:text-lg font-semibold text-green-700">
                                                Contact Being Kept
                                                {(() => {
                                                    const selectedContact = contacts.find(c => c.id === selectedContactId);
                                                    return selectedContact ? (
                                                        <span className="ml-2 text-sm font-normal text-green-600">
                                                            (HubSpot ID: {selectedContact.hubspotId})
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </h3>
                                        </div>
                                        {(() => {
                                            const selectedContact = contacts.find(c => c.id === selectedContactId);
                                            return selectedContact ? (
                                                <div className="bg-white border border-green-200 rounded-lg p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div>
                                                            <p className="font-semibold text-gray-900">
                                                                {selectedContact.firstName} {selectedContact.lastName}
                                                            </p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="inline-flex items-center px-2 py-1 mr-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zM7 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H7z" clipRule="evenodd" />
                                                                    </svg>
                                                                    HubSpot ID: {selectedContact.hubspotId}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-gray-500 mt-2">
                                                                Last Modified: {formatDate(selectedContact.lastModifiedDate)}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                            </svg>
                                                            Primary
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 text-sm">
                                                        {selectedContact.email && (
                                                            <div className="flex items-center gap-2">
                                                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                                </svg>
                                                                <span className="text-gray-700">{selectedContact.email}</span>
                                                            </div>
                                                        )}
                                                        {selectedContact.phone && (
                                                            <div className="flex items-center gap-2">
                                                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                                </svg>
                                                                <span className="text-gray-700">{selectedContact.phone}</span>
                                                            </div>
                                                        )}
                                                        {selectedContact.company && (
                                                            <div className="flex items-center gap-2">
                                                                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                                                </svg>
                                                                <span className="text-gray-700">{selectedContact.company}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>

                                    {/* Removing Section */}
                                    <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 order-2">
                                        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-red-500 rounded-full flex items-center justify-center">
                                                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <h3 className="text-base sm:text-lg font-semibold text-red-700">
                                                Contacts Being Removed
                                                <span className="ml-2 text-sm font-normal text-red-600">
                                                    ({contacts.filter(c => c.id !== selectedContactId).length} contacts with HubSpot IDs)
                                                </span>
                                            </h3>
                                        </div>
                                        <div className="space-y-2 sm:space-y-3">
                                            {contacts
                                                .filter(contact => contact.id !== selectedContactId)
                                                .map((contact) => (
                                                    <div key={contact.id} className="bg-white border border-red-200 rounded-lg p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div>
                                                                <p className="font-semibold text-gray-900">
                                                                    {contact.firstName} {contact.lastName}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className="inline-flex items-center px-2 mr-1 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                                                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                            <path fillRule="evenodd" d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zM7 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H7z" clipRule="evenodd" />
                                                                        </svg>
                                                                        HubSpot ID: {contact.hubspotId}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-gray-500 mt-2">
                                                                    Last Modified: {formatDate(contact.lastModifiedDate)}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                </svg>
                                                                Duplicate
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 text-sm">
                                                            {contact.email && (
                                                                <div className="flex items-center gap-2">
                                                                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                                    </svg>
                                                                    <span className="text-gray-600">{contact.email}</span>
                                                                </div>
                                                            )}
                                                            {contact.phone && (
                                                                <div className="flex items-center gap-2">
                                                                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                                    </svg>
                                                                    <span className="text-gray-600">{contact.phone}</span>
                                                                </div>
                                                            )}
                                                            {contact.company && (
                                                                <div className="flex items-center gap-2">
                                                                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                                                                    </svg>
                                                                    <span className="text-gray-600">{contact.company}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>



                    {/* Enhanced Action buttons */}
                    <div className="sticky bottom-0 bg-white border-t border-gray-200 px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                        <div className="flex flex-col gap-3 sm:gap-4">
                            {/* Progress indicator */}
                            <div className="flex items-center justify-center sm:justify-start text-xs sm:text-sm text-gray-500">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                <span className="text-center sm:text-left">
                                    {selectedContactId ? `Contact ${contacts.find(c => c.id === selectedContactId)?.hubspotId || selectedContactId} selected` : 'No contact selected'}
                                </span>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 w-full justify-between">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 border border-gray-300 rounded-lg sm:rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                                >
                                    <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={selectedContactId === null}
                                    className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 border border-transparent rounded-lg sm:rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500 transition-all duration-200 transform hover:scale-105 active:scale-95"
                                >
                                    <svg className="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Update Contact
                                    {selectedContactId && (
                                        <span className="ml-2 px-2 py-1 bg-white bg-opacity-20 rounded-full text-xs text-blue-600">
                                            HubSpot ID: {contacts.find(c => c.id === selectedContactId)?.hubspotId || selectedContactId}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
