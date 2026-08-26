/**
 * Global HTTP Fetch Interceptor for Auto Logout on Expired Sessions (HTTP 401 / 403).
 */
const originalFetch = window.fetch;

window.fetch = async (...args) => {
  const response = await originalFetch(...args);

  if (response.status === 401 || response.status === 403) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    
    // Do not trigger auto-logout on failed login attempts (/api/login)
    if (!url.includes('/api/login')) {
      console.warn(`[Auth Interceptor] Session expired or invalid token (HTTP ${response.status}). Auto logging out...`);
      localStorage.removeItem("auth");
      window.dispatchEvent(new Event("auth-changed"));
    }
  }

  return response;
};
