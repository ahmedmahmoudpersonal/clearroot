'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-toastify';
import { setCookie } from 'cookies-next';
import useRequest, { type LoginData } from '@/app/axios/useRequest';
import { Eye, EyeOff, LogIn, Mail, Lock } from 'lucide-react';

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useRequest();

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        try {
            const result = await login(data as LoginData);

            // Store auth token and user info in cookies
            setCookie('auth_token', result.access_token, {
                maxAge: 30 * 24 * 60 * 60, // 30 days
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });

            setCookie('user', JSON.stringify(result.user), {
                maxAge: 30 * 24 * 60 * 60, // 30 days
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
            });

            toast.success('Login successful!');
            router.push('/dashboard');
        } catch (error: unknown) {
            const axiosError = error as { response?: { data?: { message?: string } } };
            const errorMessage = axiosError?.response?.data?.message || 'Login failed';
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                            <LogIn className="w-6 h-6 text-indigo-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            Welcome Back
                        </h1>
                        <p className="text-gray-600">
                            Sign in to your account to continue
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    id="email"
                                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    placeholder="Enter your email"
                                    {...register('email')}
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                    placeholder="Enter your password"
                                    {...register('password')}
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                    ) : (
                                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                    Signing In...
                                </div>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-8 text-center space-y-4">
                        <Link
                            href="/forgot-password"
                            className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                        >
                            Forgot your password?
                        </Link>
                        <p className="text-gray-600 text-sm">
                            Don&apos;t have an account?{' '}
                            <Link href="/" className="text-indigo-600 hover:text-indigo-500 font-medium">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
