'use client';

import { baseURL } from '@/app/constant/main';
import Link from 'next/link';

interface ProcessStatusData {
    id: number;
    name: string;
    process_name: string;
    status: string;
    count: number;
    excel_link?: string;
}

interface ProcessStatusProps {
    status: ProcessStatusData | null;
    onFinish: () => void;
}

export default function ProcessStatus({ status, onFinish }: ProcessStatusProps) {
    if (!status) {
        return (
            <div className="bg-white rounded-lg shadow p-6 mb-8">
                <div className="text-center text-gray-500">
                    <p>No active process found</p>
                </div>
            </div>
        );
    }

    const getStatusColor = (processName: string) => {
        switch (processName) {
            case 'fetching':
                return 'bg-blue-100 text-blue-800';
            case 'filtering':
                return 'bg-yellow-100 text-yellow-800';
            case 'manually merge':
                return 'bg-green-100 text-green-800';
            case 'update hubspot':
                return 'bg-purple-100 text-purple-800';
            case 'finished':
                return 'bg-gray-100 text-gray-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusMessage = (processName: string) => {
        switch (processName) {
            case 'fetching':
                return 'Fetching contacts from HubSpot...';
            case 'filtering':
                return 'Analyzing contacts for duplicates...';
            case 'manually merge':
                return 'Ready for manual review and merging';
            case 'update hubspot':
                return 'Updating contacts in HubSpot...';
            case 'finished':
                return 'Process completed successfully';
            case 'error':
                return 'An error occurred during processing';
            case 'exceed':
                return 'your contact count is exceeded the limit of your plan please upgrade your plan';
            default:
                return 'Processing...';
        }
    };

    return (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.process_name)}`}>
                            {status.process_name}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-900">{status.name}</h3>
                        <p className="text-sm text-gray-500">{getStatusMessage(status.process_name)}</p>
                        {status.count > 0 && (
                            <p className="text-sm text-gray-600 mt-1">
                                {status.count} contacts processed
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex-shrink-0">
                    {status.process_name === 'manually merge' && (
                        <>
                            <button
                                onClick={onFinish}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 cursor-pointer"
                            >
                                Clear Integration
                            </button>
                            {/* <Link href="/dashboard" passHref>
                                <button
                                    type="button"
                                    className="ml-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 cursor-pointer"
                                >
                                    Back to Dashboard
                                </button>
                            </Link> */}
                        </>
                    )}

                    {status.process_name === 'finished' && status.excel_link && (
                        <a
                            href={`${baseURL}${status.excel_link}`}
                            download
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                            Download CSV
                        </a>
                    )}
                </div>
            </div>

            {/* Progress indicator for active processes */}
            {['fetching', 'filtering', 'update hubspot'].includes(status.process_name) && (
                <div className="mt-4">
                    <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                        </div>
                        <span className="ml-3 text-sm text-gray-500">In Progress...</span>
                    </div>
                </div>
            )}
        </div>
    );
}
