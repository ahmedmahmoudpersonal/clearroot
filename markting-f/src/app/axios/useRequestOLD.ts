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
  const Request = useApi();

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

  // Store/Business related requests
  const updateStore = async (id: string, body: Record<string, unknown>) => {
    return await Request.put(`stores/${id}`, body);
  };

  // Authentication requests
  const register = async (data: RegisterData): Promise<{ message: string }> => {
    const response = await Request.post("/auth/register", data);
    return response.data as { message: string };
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

  const finishProcess = async (data: { apiKey: string }) => {
    const response = await Request.post("/hubspot/finish", data);
    console.log(data, "finishProcess response", response);

    return response.data;
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

  const resetMerge = async (data: { groupId: number; apiKey: string }) => {
    const response = await Request.post("/hubspot/reset-merge", data);
    return response.data;
  };

  const removeContact = async (data: {
    contactId: number;
    groupId: number;
    apiKey: string;
  }) => {
    // The /hubspot/remove-contact endpoint already handles tracking in remove table
    const response = await Request.post("/hubspot/remove-contact", data);
    return response.data;
  };
  // const mergeContacts = async (data: {
  //   groupId: number;
  //   primaryAccountId: string;
  //   secondaryAccountId: string;
  //   apiKey: string;
  // }) => {
  //   const response = await Request.post("/hubspot/merge-contacts", data);
  //   return response.data;
  // };

  const mergeContacts = async (data: {
    groupId: number;
    primaryAccountId: string;
    secondaryAccountId: string | string[];
    apiKey: string;
  }) => {
    const response = await Request.post("/hubspot/merge-contacts", data);
    return response.data;
  };

  const resetMergeByGroup = async (data: {
    groupId: number;
    apiKey: string;
  }) => {
    const response = await Request.put("/hubspot/reset-merge-group", data);
    return response.data;
  };

  const resetAllPendingMerges = async (data: { apiKey: string }) => {
    const response = await Request.post(
      "/hubspot/reset-merge-before-finish",
      data
    );
    return response.data;
  };

  const getRemovalHistory = async (params?: {
    groupId?: number;
    apiKey?: string;
  }) => {
    const response = await Request.get("/removal/history", { params });
    return response.data;
  };

  const undoRemoval = async (removalId: number) => {
    const response = await Request.post(`/removal/undo/${removalId}`);
    return response.data;
  };

  const getProcessProgress = async (apiKey: string) => {
    const response = await Request.get("/hubspot/process-progress", {
      params: { apiKey },
    });
    return response.data;
  };

  const finalDeleteActionById = async (actionId: number, apiKey: string) => {
    try {
      const response = await Request({
        method: "DELETE",
        url: "/hubspot/delete-action",
        data: { actionId, apiKey },
      });
      return response.data;
    } catch (error: any) {
      // Check if it's a 404 error and enhance the error message
      if (error.response?.status === 404) {
        const enhancedError = {
          ...error,
          message: "Delete endpoint not implemented",
          response: error.response,
        };
        throw enhancedError;
      }
      // Re-throw other errors as-is
      throw error;
    }
  };
  const deleteActionById = async (actionId: number, apiKey: string) => {
    try {
      const response = await Request({
        method: "PUT",
        url: "/hubspot/delete-action",
        data: { actionId, apiKey },
      });
      return response.data;
    } catch (error: any) {
      // Check if it's a 404 error and enhance the error message
      if (error.response?.status === 404) {
        const enhancedError = {
          ...error,
          message: "Delete endpoint not implemented",
          response: error.response,
        };
        throw enhancedError;
      }
      // Re-throw other errors as-is
      throw error;
    }
  };

  return {
    // Store methods
    updateStore,

    // Auth methods
    register,
    verifyEmail,
    login,
    forgotPassword,
    resetPassword,
    getProfile,

    // HubSpot methods
    startHubSpotFetch,
    getDuplicates,
    submitMerge,
    resetMerge,
    removeContact,
    mergeContacts,
    // batchMergeContacts,
    resetMergeByGroup,
    resetAllPendingMerges,
    finishProcess,
    getActions,

    // Removal tracking methods
    getRemovalHistory,
    undoRemoval,

    // Process progress tracking
    getProcessProgress,

    // Contact management
    deleteActionById,
    // Contact management
    finalDeleteActionById,

    // Auth utility methods
    isAuthenticated,
    getCurrentUser,
  };
};

export default useRequest;
