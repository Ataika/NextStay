import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";

// Базовый URL API (можно вынести в .env)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// Создаем axios instance
const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000, // 10 секунд
});

// Request interceptor - добавляет Bearer token
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
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

// Response interceptor - обрабатывает ошибки
http.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // Обработка 401 - неавторизован
    if (error.response?.status === 401) {
      const { clearAuth } = useAuthStore.getState();
      clearAuth();
      
      // Редирект на страницу логина
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      
      toast.error("Сессия истекла. Пожалуйста, войдите снова.");
      return Promise.reject(error);
    }

    // Обработка других ошибок
    const errorMessage = getErrorMessage(error);
    toast.error(errorMessage);
    
    return Promise.reject(error);
  }
);

// Функция для получения сообщения об ошибке
function getErrorMessage(error: AxiosError): string {
  // Если есть сообщение от сервера
  if (error.response?.data) {
    const data = error.response.data as { message?: string; detail?: string; error?: string };
    
    if (data.message) return data.message;
    if (data.detail) return data.detail;
    if (data.error) return data.error;
  }

  // Если есть статус код
  if (error.response?.status) {
    const statusMessages: Record<number, string> = {
      400: "Неверный запрос",
      403: "Доступ запрещен",
      404: "Ресурс не найден",
      500: "Внутренняя ошибка сервера",
      502: "Сервис временно недоступен",
      503: "Сервис перегружен",
    };

    return statusMessages[error.response.status] || `Ошибка ${error.response.status}`;
  }

  // Если нет ответа от сервера
  if (error.request) {
    return "Сервер не отвечает. Проверьте подключение к интернету.";
  }

  // Общая ошибка
  return error.message || "Произошла неизвестная ошибка";
}

export default http;
