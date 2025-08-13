'use client';

import { useState } from 'react';

import { Search, Plus, Trash2, Filter, Settings, ChevronUp, ChevronDown } from 'lucide-react';

interface Condition {
    id: string;
    properties: string[];
}

interface DuplicateFiltersProps {
    filterType: 'default' | 'custom';
    setFilterType: (type: 'default' | 'custom') => void;
    selectedFilters: string[];
    setSelectedFilters: (filters: string[]) => void;
    selectAll: boolean;
    setSelectAll: (selectAll: boolean) => void;
    conditions: Condition[];
    setConditions: (conditions: Condition[]) => void;
    customProperties: string[];
    customPropsLoading: boolean;
    customPropsSearch: string;
    setCustomPropsSearch: (search: string) => void;
    apiKey: string;
}

const filterOptions = [
    { key: 'phone', label: 'Phone', description: 'Match contacts with same phone number' },
    { key: 'first_last_name', label: 'First & Last Name', description: 'Match contacts with same first and last name' },
    { key: 'first_name_phone', label: 'First Name & Phone', description: 'Match contacts with same first name and phone' },
    { key: 'first_last_name_company', label: 'First & Last Name & Company', description: 'Match contacts with same name and company' },
];

export default function DuplicateFilters({
    filterType,
    setFilterType,
    selectedFilters,
    setSelectedFilters,
    selectAll,
    setSelectAll,
    conditions,
    setConditions,
    customProperties,
    customPropsLoading,
    customPropsSearch,
    setCustomPropsSearch,
    apiKey
}: DuplicateFiltersProps) {
    // Add state for tracking which condition is expanded
    const [expandedConditionId, setExpandedConditionId] = useState<string | null>(null);

    // Filter checkbox handlers
    const handleFilterChange = (key: string) => {
        let updated;
        if (selectedFilters.includes(key)) {
            updated = selectedFilters.filter(f => f !== key);
        } else {
            updated = [...selectedFilters, key];
        }
        setSelectedFilters(updated);
        setSelectAll(updated.length === filterOptions.length);
    };

    const handleSelectAll = () => {
        if (selectAll) {
            setSelectedFilters([]);
            setSelectAll(false);
        } else {
            setSelectedFilters(filterOptions.map(f => f.key));
            setSelectAll(true);
        }
    };

    // Condition management functions
    const addCondition = () => {
        const newCondition = { id: Date.now().toString(), properties: [] };
        setConditions([...conditions, newCondition]);
        // Auto-expand the new condition
        setExpandedConditionId(newCondition.id);
    };

    const removeCondition = (conditionId: string) => {
        setConditions(conditions.filter(c => c.id !== conditionId));
        // If we're removing the expanded condition, collapse
        if (expandedConditionId === conditionId) {
            setExpandedConditionId(null);
        }
    };

    const updateConditionProperties = (conditionId: string, properties: string[]) => {
        setConditions(conditions.map(c =>
            c.id === conditionId ? { ...c, properties } : c
        ));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                        <Filter className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h4 className="text-lg font-semibold text-gray-900">Duplicate Detection Filters</h4>
                        <p className="text-sm text-gray-600">Configure how duplicates are identified</p>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {/* Filter Type Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                        Filter Type
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="relative">
                            <input
                                type="radio"
                                name="filterType"
                                value="default"
                                checked={filterType === 'default'}
                                onChange={(e) => setFilterType(e.target.value as 'default' | 'custom')}
                                className="sr-only"
                            />
                            <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${filterType === 'default'
                                    ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${filterType === 'default' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                                        }`}>
                                        {filterType === 'default' && (
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">Default Filters</div>
                                        <div className="text-sm text-gray-600">Pre-configured common duplicate patterns</div>
                                    </div>
                                </div>
                            </div>
                        </label>

                        <label className="relative">
                            <input
                                type="radio"
                                name="filterType"
                                value="custom"
                                checked={filterType === 'custom'}
                                onChange={(e) => setFilterType(e.target.value as 'default' | 'custom')}
                                disabled={!apiKey}
                                className="sr-only"
                            />
                            <div className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${!apiKey
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                                    : filterType === 'custom'
                                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${filterType === 'custom' ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                                        }`}>
                                        {filterType === 'custom' && (
                                            <div className="w-2 h-2 bg-white rounded-full"></div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium text-gray-900">Custom Properties</div>
                                        <div className="text-sm text-gray-600">
                                            {!apiKey ? 'Enter API key to enable' : 'Use HubSpot custom properties'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Default Filters */}
                {filterType === 'default' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h5 className="font-medium text-gray-900">Available Filters</h5>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                {selectAll ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filterOptions.map(opt => (
                                <label key={opt.key} className="relative">
                                    <input
                                        type="checkbox"
                                        checked={selectedFilters.includes(opt.key)}
                                        onChange={() => handleFilterChange(opt.key)}
                                        className="sr-only"
                                    />
                                    <div className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedFilters.includes(opt.key)
                                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-200'
                                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${selectedFilters.includes(opt.key)
                                                    ? 'border-indigo-500 bg-indigo-500'
                                                    : 'border-gray-300'
                                                }`}>
                                                {selectedFilters.includes(opt.key) && (
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-900">{opt.label}</div>
                                                <div className="text-sm text-gray-600 mt-1">{opt.description}</div>
                                            </div>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                                <div className="w-5 h-5 text-blue-600 mt-0.5">
                                    <svg fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-blue-800">Automatic Email Matching</p>
                                    <p className="text-sm text-blue-700">Contacts with identical email addresses are always included in duplicate detection.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Properties Condition Builder */}
                {filterType === 'custom' && apiKey && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h5 className="font-medium text-gray-900">Custom Conditions</h5>
                            <div className="flex items-center gap-2">
                                <Settings className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-600">Build your conditions</span>
                            </div>
                        </div>

                        {/* Search Properties */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={customPropsSearch}
                                onChange={e => setCustomPropsSearch(e.target.value)}
                                placeholder="Search HubSpot properties..."
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        {customPropsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                <span className="ml-3 text-gray-600">Loading properties...</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {conditions.map((condition, index) => (
                                    <div key={condition.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                                    Condition {index + 1}
                                                </span>
                                                {condition.properties.length > 0 && (
                                                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                                                        {condition.properties.length} selected
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedConditionId(
                                                        expandedConditionId === condition.id ? null : condition.id
                                                    )}
                                                    className="text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1 text-sm font-medium"
                                                >
                                                    {expandedConditionId === condition.id ? (
                                                        <>
                                                            <ChevronUp className="h-4 w-4" />
                                                            Hide Properties
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="h-4 w-4" />
                                                            Select Properties
                                                        </>
                                                    )}
                                                </button>
                                                {conditions.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCondition(condition.id)}
                                                        className="text-red-500 hover:text-red-700 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Show property list only for expanded condition */}
                                        {expandedConditionId === condition.id && (
                                            <div className="bg-white rounded-lg border border-gray-200 max-h-48 overflow-y-auto">
                                                {customProperties
                                                    .filter(p => p.toLowerCase().includes(customPropsSearch.toLowerCase()))
                                                    .map(p => (
                                                        <label key={p} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={condition.properties.includes(p)}
                                                                onChange={(e) => {
                                                                    const newProps = e.target.checked
                                                                        ? [...condition.properties, p]
                                                                        : condition.properties.filter(prop => prop !== p);
                                                                    updateConditionProperties(condition.id, newProps);
                                                                }}
                                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                            />
                                                            <span className="text-sm text-gray-700 font-medium">{p}</span>
                                                        </label>
                                                    ))}
                                                {customProperties.filter(p => p.toLowerCase().includes(customPropsSearch.toLowerCase())).length === 0 && (
                                                    <div className="p-4 text-center text-gray-500">
                                                        {customPropsSearch ? 'No properties match your search' : 'No properties available'}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {condition.properties.length > 0 && (
                                            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <p className="text-sm text-blue-800 font-medium">Selected Properties:</p>
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {condition.properties.map(prop => (
                                                        <span key={prop} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                                            {prop}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addCondition}
                                    className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Another Condition
                                </button>
                            </div>
                        )}

                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                                <div className="w-5 h-5 text-amber-600 mt-0.5">
                                    <svg fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-amber-800">How Conditions Work</p>
                                    <p className="text-sm text-amber-700">Contacts matching ANY condition will be considered duplicates. Each condition uses an AND operation for its selected properties.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
