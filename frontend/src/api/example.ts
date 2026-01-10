// Пример использования API клиента
import http from "./http";

// Пример API функций
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await http.post("/auth/login", { email, password });
    return response.data;
  },

  logout: async () => {
    const response = await http.post("/auth/logout");
    return response.data;
  },
};

export const roomsApi = {
  getAll: async () => {
    const response = await http.get("/rooms");
    return response.data;
  },

  getById: async (id: number) => {
    const response = await http.get(`/rooms/${id}`);
    return response.data;
  },

  create: async (data: unknown) => {
    const response = await http.post("/rooms", data);
    return response.data;
  },
};
