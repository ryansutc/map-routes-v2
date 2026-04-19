/**
 * This is just an entry point wherein all environment variables are defined
 * and exported as constants.
 * This allows for easy access to environment variables throughout the application.
 * It also provides a single source of truth for environment variables,
 * making it easier to manage and update them.
 */

/**
 * The full url to the backend api endpoints,
 * e.g: http://localhost:8000/api/
 */
export const BACKEND_DOMAIN: string =
  import.meta.env.VITE_BACKEND_DOMAIN || "http://localhost:8000/";
export const ACCOUNT_URI: string = import.meta.env.VITE_ACCOUNT_URI;
export const API_TIMEOUT = parseInt(
  import.meta.env.VITE_API_TIMEOUT || "5000",
  10
); // Default to 5000ms if not set
export const API_TOKEN = localStorage.getItem("token") || null;
export const GOOGLE_LOGIN_URL = import.meta.env.VITE_GOOGLE_LOGIN_URL || "http://localhost:8000/api/auth/google/";

const viteEnv = import.meta.env.VITE_ENV ?? import.meta.env.MODE;
export const IS_PRODUCTION = viteEnv === "production";
export const IS_DEVELOPMENT = viteEnv === "development";

// Tentative
export const HTTPS_KEY = import.meta.env.VITE_HTTPS_KEY || "";
export const HTTPS_CERT = import.meta.env.VITE_HTTPS_CERT || "";
