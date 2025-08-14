let API_BASE_URL = 'http://localhost:3001'; // Default for fallback

export function initializeApi(port: number) {
  API_BASE_URL = `http://localhost:${port}`;
  console.log(`API client initialized to use port: ${port}`);
}

// A generic fetch wrapper
export async function apiFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `Request to ${path} failed with status ${response.status}`);
  }
  return response.json();
}
