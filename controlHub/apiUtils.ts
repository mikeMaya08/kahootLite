import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.amikoo first (primary), then .env as fallback.
// Skip .env.amikoo if it only has the placeholder key to avoid dotenv's noisy
// "injected env" message when no real values are present.
const amikooEnv = resolve(process.cwd(), '.env.amikoo');
if (existsSync(amikooEnv)) {
  const content = readFileSync(amikooEnv, 'utf8');
  const hasRealKey = /^\s*(?:export\s+)?AMIKOO_KEY\s*=\s*(?!your_amikoo_key_here\s*$).+$/m.test(content);
  if (hasRealKey) {
    dotenv.config({ path: amikooEnv });
  }
}

// Only load .env if it exists and has non-comment, non-empty lines
const dotEnvPath = resolve(process.cwd(), '.env');
if (existsSync(dotEnvPath)) {
  const content = readFileSync(dotEnvPath, 'utf8');
  const hasContent = /^\s*(?!#)[\w]/m.test(content); // At least one line with a variable
  if (hasContent) {
    dotenv.config();
  }
}

const DEFAULT_CONTROLHUB_URL = 'https://app.amikoo.ai';

export function getControlHubUrl(): string {
  const raw = (process.env.CONTROLHUB_URL || '').trim();
  const url = raw || DEFAULT_CONTROLHUB_URL;
  return url.replace(/\/+$/, '').toLowerCase();
}

const BASE_URL = getControlHubUrl();

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiRequestOptions {
  method: HttpMethod;
  endpoint: string;
  token: string;
  body?: any;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string | Record<string, any>;
}

/**
 * Makes an API request to the amikoo-reporter backend
 * @param options - The request options including method, endpoint, token, and optional body
 * @returns The API response with success flag and data/error
 */
export async function apiRequest<T = any>(options: ApiRequestOptions): Promise<ApiResponse<T>> {
  const { method, endpoint, token, body } = options;
  
  const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    const responseData: any = await response.json();

    if (!response.ok || !responseData.success) {
      const errPayload = responseData.data && Object.keys(responseData.data).length
        ? responseData.data
        : responseData.message || `Request failed (${response.status})`;
      return {
        success: false,
        error: errPayload,
      };
    }

    return {
      success: true,
      data: responseData.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Convenience methods
export const api = {
  get: <T = any>(endpoint: string, token: string) => 
    apiRequest<T>({ method: 'GET', endpoint, token }),
  
  post: <T = any>(endpoint: string, token: string, body?: any) => 
    apiRequest<T>({ method: 'POST', endpoint, token, body }),
  
  put: <T = any>(endpoint: string, token: string, body?: any) => 
    apiRequest<T>({ method: 'PUT', endpoint, token, body }),
  
  delete: <T = any>(endpoint: string, token: string) => 
    apiRequest<T>({ method: 'DELETE', endpoint, token }),
};
