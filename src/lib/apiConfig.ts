/**
 * Central API Configuration for Thadam Frontend
 * All API requests (Razorpay, Gemini AI, Rates, Admin Cloud Functions)
 * point to the Render backend URL https://thadam-app.onrender.com or
 * the environment variable VITE_API_BASE_URL.
 */

export const API_BASE_URL =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || "https://thadam-app.onrender.com";

export function getApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const baseUrl = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${baseUrl}${cleanEndpoint}`;
}
