import { API_TIMEOUT, BACKEND_DOMAIN } from "@/utils/environment";
import axios from "axios";

export const axiosInstance = axios.create({
  baseURL: BACKEND_DOMAIN,
  timeout: API_TIMEOUT,
  withCredentials: true,
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// ⚠️ Handle errors globally
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("[API Error]", error.response || error.message);
    return Promise.reject(error);
  }
);
