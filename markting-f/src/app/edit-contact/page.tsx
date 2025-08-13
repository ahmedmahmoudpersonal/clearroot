'use client';

import { useState, useEffect, Suspense } from 'react';
function Loading() {
    return <div className="text-center py-8">Loading...</div>;
}
import { useSearchParams } from 'next/navigation';
import useRequest from '@/app/axios/useRequest';


function EditContactPageContent() {
    const searchParams = useSearchParams();
    const { isAuthenticated, submitMerge } = useRequest();
    const [isLoading, setIsLoading] = useState(false);
    const [resultMessage, setResultMessage] = useState('');

    // Example contact data - in real app this would come from your backend
    const [contactData, setContactData] = useState({
        selectedContactId: 1,
        selectedContactHubspotId: '12345',
        groupId: 1,
        apiKey: searchParams?.get('apiKey') || '',
        updatedData: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com, john.doe.work@company.com', // Multiple emails
            phone: '+1234567890',
            company: 'Example Corp'
        },
        removedIds: [2, 3], // IDs of contacts to be removed/merged
        allContactsData: [
            { id: 1, hubspotId: '12345', firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' },
            { id: 2, hubspotId: '23456', firstName: 'John', lastName: 'Doe', email: 'john.doe.work@company.com' },
            { id: 3, hubspotId: '34567', firstName: 'J', lastName: 'Doe', email: 'j.doe@example.com' }
        ],
        updateHubSpot: true
    });

    // Check authentication on component mount
    useEffect(() => {
        if (!isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
    }, [isAuthenticated]);

    const handleTestMerge = async () => {
        setIsLoading(true);
        setResultMessage('');

        try {
            const result = await submitMerge(contactData) as any;

            setResultMessage(`✅ Success: ${result.message}`);
            console.log('Merge details:', result.details);

            // Display HubSpot operation results
            if (result.details?.hubspotOperations) {
                const operations = result.details.hubspotOperations;
                let hubspotMsg = '';

                if (operations.updateResult?.success) {
                    hubspotMsg += '✅ Contact updated in HubSpot successfully\n';
                } else if (operations.updateResult?.error) {
                    hubspotMsg += `❌ Failed to update contact in HubSpot: ${operations.updateResult.error}\n`;
                }

                operations.deleteResults?.forEach((deleteResult: any) => {
                    if (deleteResult.success) {
                        hubspotMsg += `✅ Contact ${deleteResult.hubspotId} deleted from HubSpot\n`;
                    } else {
                        hubspotMsg += `❌ Failed to delete contact ${deleteResult.hubspotId}: ${deleteResult.error}\n`;
                    }
                });

                if (hubspotMsg) {
                    setResultMessage(prev => prev + '\n\nHubSpot Operations:\n' + hubspotMsg);
                }
            }
        } catch (error: any) {
            console.error('Error submitting merge:', error);
            setResultMessage(`❌ Network Error: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (field: string, value: any) => {
        if (field.startsWith('updatedData.')) {
            const dataField = field.replace('updatedData.', '');
            setContactData(prev => ({
                ...prev,
                updatedData: {
                    ...prev.updatedData,
                    [dataField]: value
                }
            }));
        } else {
            setContactData(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
            {/* ...existing code... */}
            <h1 className="text-2xl font-bold mb-6">HubSpot Contact Editing Demo</h1>
            {/* ...existing code... */}
            {/* The rest of your form and UI code remains unchanged */}
            {/* ...existing code... */}
        </div>
    );
}

export default function EditContactPage() {
    return (
        <Suspense fallback={<Loading />}>
            <EditContactPageContent />
        </Suspense>
    );
}
