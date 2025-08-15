let API_BASE_URL = 'http://localhost:3001'; // Default for fallback
let isApiReady = false;
let apiReadyPromise: Promise<void> | null = null;
let resolveApiReady: (() => void) | null = null;

export function initializeApi(port: number) {
  API_BASE_URL = `http://localhost:${port}`;
  isApiReady = true;
  console.log(`API client initialized to use port: ${port}`);
  
  // Resolve the ready promise if it exists
  if (resolveApiReady) {
    resolveApiReady();
  }
}

export function waitForApiReady(): Promise<void> {
  if (isApiReady) {
    return Promise.resolve();
  }
  
  if (!apiReadyPromise) {
    apiReadyPromise = new Promise<void>((resolve) => {
      resolveApiReady = resolve;
    });
  }
  
  return apiReadyPromise;
}

// A generic fetch wrapper
export async function apiFetch(path: string, options: RequestInit = {}) {
  // Wait for API to be ready before making requests
  await waitForApiReady();
  
  const url = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  console.log(`Making API request to: ${url}`);
  
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `Request to ${path} failed with status ${response.status}`);
  }
  return response.json();
}

// Expose initializeApi globally so preload can access it
if (typeof window !== 'undefined') {
  (window as any).initializeApi = initializeApi;
}
