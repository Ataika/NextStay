import axios, { AxiosError } from "axios";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

// Base API URL (can be moved to .env)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// Create axios instance
const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 seconds
});

// Request interceptor - adds Bearer token
http.interceptors.request.use(
  (config) => {
    const { token } = useAuthStore.getState();
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handles errors
http.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle 401 - unauthorized
    if (error.response?.status === 401) {
      const { clearAuth } = useAuthStore.getState();
      clearAuth();
      
      // Redirect to login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      
      toast.error("Session expired. Please login again.");
      return Promise.reject(error);
    }

    // Handle other errors
    const errorMessage = getErrorMessage(error);
    toast.error(errorMessage);
    
    return Promise.reject(error);
  }
);

// Function to get error message
function getErrorMessage(error: AxiosError): string {
  // If there is a message from the server
  if (error.response?.data) {
    const data = error.response.data as { message?: string; detail?: string; error?: string };
    
    if (data.message) return data.message;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
  }

  // If there is a status code
  if (error.response?.status) {
    const statusMessages: Record<number, string> = {
      400: "Invalid request",
      403: "Access denied",
      404: "Resource not found",
      500: "Internal server error",
      502: "Service temporarily unavailable",
      503: "Service overloaded",
    };

    return statusMessages[error.response.status] || `Error code: ${error.response.status}`;
  }

  // If there is no response from the server
  if (error.request) {
    return "Server is not responding. Check your internet connection.";
  }

  // General error
  return error.message || "An unknown error occurred";
}

export default http;
