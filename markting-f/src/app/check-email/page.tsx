'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';

export default function CheckEmailPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Check Your Email
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            We&apos;ve sent a verification link to your email address
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Verification Email Sent
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Please check your email and click the verification link to activate your account.
                    If you don&apos;t see the email, check your spam folder.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-4">
            <p className="text-sm text-gray-500">
              Didn&apos;t receive the email?
            </p>
            <button
              onClick={() => {
                // TODO: Implement resend verification email
                toast.info('Resend functionality coming soon');
              }}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Resend verification email
            </button>
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push('/login')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
