'use client';

import { useEffect, useState } from 'react';
import { PlanModal } from '@/app/plan';
import { useRouter } from 'next/navigation';
import { getCookie, deleteCookie } from 'cookies-next';
import { toast } from 'react-toastify';
import useRequest, { type User } from '@/app/axios/useRequest';
import { LogOut, User as UserIcon, BarChart3, Plus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import DuplicateFilters from './components/DuplicateFilters';

interface Action {
    id: number;
    name: string;
    process_name: string;
    status: string;
    count: number;
    api_key: string;
    excel_link?: string;
    created_at: string;
}

interface ActionsResponse {
    data: Action[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    type Plan = {
        id: number;
        userId: number;
        planType: string;
        activationDate: string;
        mergeGroupsUsed: number;
        contactCount: number;
        billingEndDate: string;
        paymentStatus: string;
        paymentId: number;
        is_paid_plan?: boolean;
    };
    const [plan, setPlan] = useState<Plan | null>(null);
    // Example: Add plan fields to user type if not present
    // interface User {
    //   ...existing fields...
    //   plan_name?: string;
    //   plan_status?: string;
    //   is_paid_plan?: boolean;
    // }
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [actions, setActions] = useState<Action[]>([]);
    const [actionsLoading, setActionsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalActions, setTotalActions] = useState(0);
    const itemsPerPage = 5;


    // Form state
    const [formData, setFormData] = useState({
        name: '',
        apiKey: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [removingActionId, setRemovingActionId] = useState<number | null>(null);

    // Duplicate filter state for integration
    const [selectedFilters, setSelectedFilters] = useState<string[]>(['phone', 'first_last_name', 'first_name_phone', 'first_last_name_company']); // default: all selected
    const [selectAll, setSelectAll] = useState(true);

    // Filter type selection
    const [filterType, setFilterType] = useState<'default' | 'custom'>('default');

    // Custom properties state
    const [customProperties, setCustomProperties] = useState<string[]>([]); // all available properties
    const [customPropsLoading, setCustomPropsLoading] = useState(false);
    const [customPropsSearch, setCustomPropsSearch] = useState('');

    // Condition builder state
    interface Condition {
        id: string;
        properties: string[];
    }
    const [conditions, setConditions] = useState<Condition[]>([{ id: Date.now().toString(), properties: [] }]);

    const { getProfile, getActions, startHubSpotFetch, finalDeleteActionById, getUserPlan, getHubSpotProperties } = useRequest();

    const checkAuth = async () => {
        try {
            const token = getCookie('auth_token');
            if (!token) {
                router.push('/login');
                return;
            }

            const userProfile = await getProfile();
            setUser(userProfile);
            // Fetch user plan details
            try {
                const planDetails = await getUserPlan();
                const planObj = {
                    ...(planDetails as Plan),
                    is_paid_plan: (planDetails as any).planType === 'paid',
                };
                setPlan(planObj);
            } catch {
                setPlan(null);
            }
        } catch (error) {
            console.error('Failed to get user profile:', error);
            // Clear cookies and redirect to login
            deleteCookie('auth_token');
            deleteCookie('user');
            router.push('/login');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchActions = async (page: number = 1) => {
        try {
            setActionsLoading(true);
            const response = await getActions({ page, limit: itemsPerPage }) as ActionsResponse;

            if (response && typeof response === 'object') {
                // Check if response has pagination structure
                if (response.data && Array.isArray(response.data)) {
                    setActions(response.data);
                    if (response.pagination) {
                        setCurrentPage(response.pagination.page);
                        setTotalPages(response.pagination.totalPages);
                        setTotalActions(response.pagination.total);
                    } else {
                        setCurrentPage(1);
                        setTotalPages(1);
                        setTotalActions(response.data.length);
                    }
                } else if (Array.isArray(response)) {
                    // Fallback for non-paginated response
                    setActions(response);
                    setCurrentPage(1);
                    setTotalPages(1);
                    setTotalActions(response.length);
                } else {
                    setActions([]);
                    setCurrentPage(1);
                    setTotalPages(1);
                    setTotalActions(0);
                }
            } else {
                setActions([]);
                setCurrentPage(1);
                setTotalPages(1);
                setTotalActions(0);
            }
        } catch (error) {
            console.error('Error fetching actions:', error);
            setActions([]);
            setCurrentPage(1);
            setTotalPages(1);
            setTotalActions(0);
        } finally {
            setActionsLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchActions(1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            fetchActions(page);
        }
    };

    // Fetch custom properties for API key
    const fetchCustomProperties = async (apiKey: string) => {
        setCustomPropsLoading(true);
        try {
            const properties = await getHubSpotProperties(apiKey);
            setCustomProperties(properties);
        } catch (error) {
            console.error('Error fetching properties:', error);
            setCustomProperties([]);
        } finally {
            setCustomPropsLoading(false);
        }
    };

    // When API key changes, fetch custom properties and clear conditions
    useEffect(() => {
        setConditions([{ id: Date.now().toString(), properties: [] }]);
        setCustomProperties([]);
        if (formData.apiKey && filterType === 'custom') {
            fetchCustomProperties(formData.apiKey);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.apiKey, filterType]);

    const transformDefaultFilters = (filters: string[]): string[] => {
        const filterMapping: { [key: string]: string } = {
            'phone': 'condition_1:phone',
            'first_last_name': 'condition_2:firstname,lastname',
            'first_name_phone': 'condition_3:firstname,phone',
            'first_last_name_company': 'condition_4:firstname,lastname,company'
        };

        const transformedFilters = ['same_email']; // Always include same_email first

        filters.forEach(filter => {
            if (filter !== 'same_email' && filterMapping[filter]) {
                transformedFilters.push(filterMapping[filter]);
            }
        });

        return transformedFilters;
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            let filtersToSend: string[];

            if (filterType === 'default') {
                // Transform default filters to new format
                filtersToSend = transformDefaultFilters([...selectedFilters, 'same_email']);
            } else {
                // Custom filters: build from conditions
                filtersToSend = ['same_email']; // Always include same email
                conditions.forEach((condition, index) => {
                    if (condition.properties.length > 0) {
                        filtersToSend.push(`condition_${index}:${condition.properties.join(',')}`);
                    }
                });
            }

            const result = await startHubSpotFetch({
                ...formData,
                filters: filtersToSend,
            });

            // Handle the response properly
            if (result && result.message) {
                toast.success(result.message);
                console.log('Integration started with action ID:', result.actionId, 'Status:', result.status);
            } else {
                toast.success('HubSpot integration started successfully');
            }

            setShowForm(false);
            setFormData({ name: '', apiKey: '' });
            setSelectedFilters(['phone', 'first_last_name', 'first_name_phone', 'first_last_name_company']);
            setSelectAll(true);
            setConditions([{ id: Date.now().toString(), properties: [] }]);
            setCustomProperties([]);
            setFilterType('default');
            // Refresh actions list
            fetchActions(currentPage);
            // Navigate to duplicates page
            router.push(`/duplicates?apiKey=${encodeURIComponent(formData.apiKey)}`);
        } catch (error: any) {
            console.error('Error starting HubSpot integration:', error);

            // Enhanced error handling
            let errorMessage = 'Failed to start HubSpot integration';
            if (error?.response?.data?.message) {
                errorMessage = error.response.data.message;
            } else if (error?.message) {
                errorMessage = error.message;
            }

            toast.error(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'finished':
                return 'bg-green-100 text-green-800';
            case 'manually merge':
                return 'bg-yellow-100 text-yellow-800';
            case 'fetching':
            case 'filtering':
            case 'update hubspot':
                return 'bg-blue-100 text-blue-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const handleRemoveAction = async (actionId: number, apiKey: string) => {
        // const confirmed = window.confirm(
        //     'Are you sure you want to remove this action?\n\n' +
        //     'This will permanently delete the action record.\n\n' +
        //     'This action cannot be undone.'
        // );

        // if (!confirmed) return;

        setRemovingActionId(actionId);
        try {
            // await deleteActionById(actionId);
            await finalDeleteActionById(actionId, apiKey);
            toast.success('Action has been successfully removed');
            // Refresh the actions list
            await fetchActions(currentPage);
        } catch (error: any) {
            console.error('Error removing action:', error);

            // Handle specific 404 error for missing endpoint
            if (error?.response?.status === 404) {
                toast.error('Remove functionality is not yet implemented on the backend. Please contact your administrator.');
            } else if (error?.response?.data?.message) {
                toast.error(`Failed to remove action: ${error.response.data.message}`);
            } else {
                toast.error('Failed to remove action. Please try again later.');
            }
        } finally {
            setRemovingActionId(null);
        }
    };

    const handleLogout = () => {
        deleteCookie('auth_token');
        deleteCookie('user');
        toast.success('Logged out successfully');
        router.push('/login');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!user) {
        return null; // Will redirect to login
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center">
                            <BarChart3 className="h-8 w-8 text-indigo-600 mr-3" />
                            <h1 className="text-xl font-semibold text-gray-900">
                                HubSpot Duplicate Management
                            </h1>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <UserIcon className="h-5 w-5 text-gray-500" />
                                <span className="text-sm text-gray-700">
                                    {user.first_name} {user.last_name}
                                </span>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <LogOut className="h-4 w-4 mr-1" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                {/* Welcome Section */}
                <div className="bg-white overflow-hidden shadow rounded-lg mb-8">
                    <div className="px-6 py-8">
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                Welcome back, {user.first_name}!
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Manage your HubSpot duplicate contacts and streamline your CRM data.
                            </p>

                            {/* Email Verification Notice */}
                            {!user.verified && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
                                    <div className="flex items-center justify-center">
                                        <div className="text-sm text-yellow-800">
                                            <strong>Email verification required:</strong> Please check your email ({user.email}) and click the verification link to activate all features.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                {/* Account Info */}
                <div className="bg-white overflow-hidden shadow rounded-lg mb-8">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
                    </div>
                    <div className="px-6 py-4">
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Name</dt>
                                <dd className="text-sm text-gray-900">{user.first_name} {user.last_name}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Email</dt>
                                <dd className="text-sm text-gray-900">{user.email}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Phone</dt>
                                <dd className="text-sm text-gray-900">{user.phone || 'Not provided'}</dd>
                            </div>
                            <div>
                                <dt className="text-sm font-medium text-gray-500">Account Status</dt>
                                <dd className="text-sm">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${user.verified
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {user.verified ? 'Verified' : 'Pending Verification'}
                                    </span>
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>
                {/* Plan Details Section */}

                {/* {plan?.is_paid_plan && (
                    <div className="bg-white shadow-lg rounded-xl mb-8">
                        <div className="px-8 py-6 border-b border-blue-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <BarChart3 className="h-6 w-6 text-indigo-600" />
                                <h3 className="text-lg font-semibold text-gray-900">Plan Details</h3>
                            </div>
                            <button
                                onClick={() => setShowPlanModal(true)}
                                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-blue-600 rounded-lg shadow hover:from-indigo-700 hover:to-blue-700 transition"
                            >
                                Upgrade Plan
                            </button>
                        </div>
                        <div className="px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="w-full md:w-auto grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`inline-block w-3 h-3 rounded-full ${plan?.planType === 'paid' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                        <span className="font-medium text-gray-700">Type</span>
                                    </div>
                                    <div className="text-sm font-normal text-gray-900">{plan?.planType === 'paid' ? 'Paid' : 'Free'}</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-gray-700">Payment Status</span>
                                        {plan?.paymentStatus === 'active' ? (
                                            <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-semibold">Active</span>
                                        ) : (
                                            <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-800 text-xs font-semibold">Inactive</span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-gray-700">Activation Date</span>
                                    </div>
                                    <div className="text-sm text-gray-900">{plan?.activationDate ? new Date(plan.activationDate).toLocaleDateString() : '-'}</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-gray-700">Billing End Date</span>
                                    </div>
                                    <div className="text-sm text-gray-900">{plan?.billingEndDate ? new Date(plan.billingEndDate).toLocaleDateString() : '-'}</div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-gray-700">Contacts Allowed</span>
                                    </div>
                                    <div className="text-sm text-gray-900">{plan?.contactCount ?? '-'}</div>
                                </div>
                            </div>

                        </div>
                    </div>
                )} */}

                {/* Actions Section */}
                {/* HubSpot Integrations Section */}
                <div className="bg-white shadow rounded-lg">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium text-gray-900">HubSpot Integrations</h3>
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="cursor-pointer inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                New Integration
                            </button>
                        </div>
                    </div>

                    {/* Integration Form */}
                    {showForm && (
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                            <form onSubmit={handleFormSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Integration Name
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Enter integration name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            HubSpot API Key
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.apiKey}
                                            onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                                            required
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Enter your HubSpot API key"
                                        />
                                    </div>
                                </div>

                                {/* Duplicate Filters Component */}
                                <DuplicateFilters
                                    filterType={filterType}
                                    setFilterType={setFilterType}
                                    selectedFilters={selectedFilters}
                                    setSelectedFilters={setSelectedFilters}
                                    selectAll={selectAll}
                                    setSelectAll={setSelectAll}
                                    conditions={conditions}
                                    setConditions={setConditions}
                                    customProperties={customProperties}
                                    customPropsLoading={customPropsLoading}
                                    customPropsSearch={customPropsSearch}
                                    setCustomPropsSearch={setCustomPropsSearch}
                                    apiKey={formData.apiKey}
                                />

                                <div className="flex justify-end space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting ||
                                            (filterType === 'default' && selectedFilters.length === 0) ||
                                            (filterType === 'custom' && conditions.every(c => c.properties.length === 0))
                                        }
                                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isSubmitting ? 'Starting...' : 'Start Integration'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Actions List */}
                    <div className="px-6 py-4">
                        {actionsLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : actions.length === 0 ? (
                            <div className="text-center py-12">
                                <h3 className="mt-2 text-sm font-medium text-gray-900">No integrations found</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Get started by creating a new HubSpot integration.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="divide-y divide-gray-200">
                                    {actions.map((action) => (
                                        <div key={action.id} className="py-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-4">
                                                        <div>
                                                            <h3 className="text-sm font-medium text-gray-900">{action.name}</h3>
                                                            <p className="text-sm text-gray-500">
                                                                Created: {new Date(action.created_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(action.process_name)}`}>
                                                            {action.process_name}
                                                        </div>
                                                        {action.count > 0 && (
                                                            <div className="text-sm text-gray-600">
                                                                {action.count} contacts
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center space-x-3">
                                                    {/* Show Review Duplicates for manually merge */}
                                                    {action.process_name === 'manually merge' && (
                                                        <button
                                                            onClick={() => router.push(`/duplicates?apiKey=${encodeURIComponent(action.api_key)}`)}
                                                            className="cursor-pointer text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                                                        >
                                                            Review Duplicates
                                                        </button>
                                                    )}
                                                    {/* Show Remove button if status is 'processing' or Review Duplicates button is shown */}
                                                    {(action.status === 'processing' || action.process_name === 'manually merge') && (
                                                        <button
                                                            onClick={() => handleRemoveAction(action.id, action.api_key)}
                                                            disabled={removingActionId === action.id}
                                                            className="cursor-pointer text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Trash2 className="h-3 w-3 mr-1" />
                                                            {removingActionId === action.id ? 'Removing...' : 'Remove'}
                                                        </button>
                                                    )}
                                                    {void console.log(action, "0000")}

                                                    {['fetching', 'filtering', 'update hubspot'].includes(action.process_name) && (
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-sm text-gray-500">Processing...</span>
                                                            <button
                                                                onClick={() => handleRemoveAction(action.id, action.api_key)}
                                                                disabled={removingActionId === action.id}
                                                                className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Trash2 className="h-3 w-3 mr-1" />
                                                                {removingActionId === action.id ? 'Removing...' : 'Remove'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                                        <div className="flex items-center text-sm text-gray-500">
                                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalActions)} of {totalActions} integrations
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                                Previous
                                            </button>

                                            <div className="flex items-center space-x-1">
                                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                    let pageNum;
                                                    if (totalPages <= 5) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage <= 3) {
                                                        pageNum = i + 1;
                                                    } else if (currentPage >= totalPages - 2) {
                                                        pageNum = totalPages - 4 + i;
                                                    } else {
                                                        pageNum = currentPage - 2 + i;
                                                    }

                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => handlePageChange(pageNum)}
                                                            className={`px-3 py-1 text-sm font-medium rounded-md ${pageNum === currentPage
                                                                ? 'bg-indigo-600 text-white'
                                                                : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="inline-flex items-center px-2 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>


            </main>
            {/* PlanModal Popup */}
            <PlanModal
                apiKey={formData.apiKey || ''}
                open={showPlanModal}
                onClose={() => setShowPlanModal(false)}
                userId={user?.id}
                plan={plan}
                contactCount={plan?.contactCount || 0}
            />
        </div>
    );
}
