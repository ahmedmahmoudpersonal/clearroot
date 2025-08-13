import useApi from "./useApi";
import { getCookie } from "cookies-next";

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string[];
}

export interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

const useRequest = () => {
  // Get latest action for a given apiKey
  const getLatestAction = async (apiKey: string) => {
    return await Request.get(`/hubspot/latest-action/${apiKey}`);
  };
  const Request = useApi();

  // Utility and merge-related methods
  const resetMerge = async (groupId: number) => {
    return await Request.post(`/hubspot/reset-merge`, { groupId });
  };

  const removeContact = async (contactId: number) => {
    return await Request.delete(`/hubspot/remove-contact/${contactId}`);
  };

  const mergeContacts = async (data: any) => {
    return await Request.post(`/hubspot/merge-contacts`, data);
  };

  const resetMergeByGroup = async (groupId: number) => {
    return await Request.post(`/hubspot/reset-merge-by-group`, { groupId });
  };

  const resetAllPendingMerges = async () => {
    return await Request.post(`/hubspot/reset-all-pending-merges`);
  };

  const finishProcess = async () => {
    return await Request.post(`/hubspot/finish-process`);
  };

  const getActions = async (params?: { page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());

    const url =
      params && (params.page || params.limit)
        ? `/hubspot/actions?${queryParams.toString()}`
        : "/hubspot/actions";

    const response = await Request.get(url);
    return response.data;
  };

  const getRemovalHistory = async () => {
    return await Request.get(`/hubspot/removal-history`);
  };

  const undoRemoval = async (removalId: number) => {
    return await Request.post(`/hubspot/undo-removal`, { removalId });
  };

  const getProcessProgress = async () => {
    return await Request.get(`/hubspot/process-progress`);
  };

  const deleteActionById = async (actionId: number) => {
    return await Request.delete(`/hubspot/actions/${actionId}`);
  };

  const finalDeleteActionById = async (actionId: number) => {
    return await Request.delete(`/hubspot/final-actions/${actionId}`);
  };

  // Store methods
  const updateStore = async (id: string, body: Record<string, unknown>) => {
    return await Request.put(`stores/${id}`, body);
  };

  // Auth methods
  const register = async (data: RegisterData): Promise<{ message: string }> => {
    const response = await Request.post("/auth/register", data);
    return response.data as { message: string };
  };

  // Get current user's plan
  const getUserPlan = async () => {
    const response = await Request.get("/plans/user");
    return response.data;
  };

  // HubSpot integration methods
  const startHubSpotFetch = async (data: {
    name: string;
    apiKey: string;
    filters: string[];
  }): Promise<{ message: string; actionId: number; status: string }> => {
    const response = await Request.post("/hubspot/start-fetch", data);
    return response.data as {
      message: string;
      actionId: number;
      status: string;
    };
  };

  const getDuplicates = async (params: {
    apiKey: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    queryParams.append("apiKey", params.apiKey);
    if (params.page) queryParams.append("page", params.page.toString());
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const response = await Request.get(
      `/hubspot/duplicates?${queryParams.toString()}`
    );
    return response.data;
  };

  const submitMerge = async (data: {
    groupId: number;
    selectedContactId: number;
    selectedContactHubspotId: string;
    updatedData: Record<string, string>;
    removedIds: number[];
    allContactsData: any[];
    apiKey: string;
  }) => {
    const response = await Request.post("/hubspot/submit-merge", data);
    return response.data;
  };

  // Stripe payment verification
  const verifyStripeSession = async (sessionId: string) => {
    const response = await Request.post("/stripe/verify-session", {
      session_id: sessionId,
    });
    return response.data;
  };
  // Stripe payment
  const createStripeCheckoutSession = async (data: {
    planType: string;
    contactCount: number;
    userId: number;
    apiKey?: string;
  }) => {
    const response = await Request.post(
      "/stripe/create-checkout-session",
      data
    );
    return response.data;
  };

  // Authentication utility functions
  const isAuthenticated = (): boolean => {
    const token = getCookie("auth_token");
    return !!token;
  };

  const getCurrentUser = () => {
    const userCookie = getCookie("user");
    if (userCookie) {
      try {
        return JSON.parse(userCookie as string);
      } catch {
        return null;
      }
    }
    return null;
  };

  const verifyEmail = async (token: string): Promise<{ message: string }> => {
    const response = await Request.get(`/auth/verify-email?token=${token}`);
    return response.data as { message: string };
  };

  const login = async (data: LoginData): Promise<AuthResponse> => {
    const response = await Request.post("/auth/login", data);
    return response.data as AuthResponse;
  };

  const forgotPassword = async (
    data: ForgotPasswordData
  ): Promise<{ message: string }> => {
    const response = await Request.post("/auth/forgot-password", data);
    return response.data as { message: string };
  };

  const resetPassword = async (
    data: ResetPasswordData
  ): Promise<{ message: string }> => {
    const response = await Request.post("/auth/reset-password", data);
    return response.data as { message: string };
  };

  const getProfile = async (): Promise<User> => {
    const response = await Request.get("/auth/profile");
    return response.data as User;
  };

  // ...existing code...

  return {
    createStripeCheckoutSession,
    verifyStripeSession,
    updateStore,
    register,
    verifyEmail,
    login,
    forgotPassword,
    resetPassword,
    getProfile,
    isAuthenticated,
    getCurrentUser,
    getUserPlan,
    startHubSpotFetch,
    getDuplicates,
    submitMerge,
    resetMerge,
    removeContact,
    mergeContacts,
    resetMergeByGroup,
    resetAllPendingMerges,
    finishProcess,
    getActions,
    getLatestAction,
    getRemovalHistory,
    undoRemoval,
    getProcessProgress,
    deleteActionById,
    finalDeleteActionById,
  };
};

export default useRequest;
