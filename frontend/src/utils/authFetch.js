export async function authFetch(url, options = {}) {
    let token = null;
    try {
        const authData = JSON.parse(localStorage.getItem("auth"));
        if (authData && authData.token) {
            token = authData.token;
        }
    } catch (e) {
        console.error("Błąd odczytu tokenu", e);
    }

    const headers = {
        "Content-Type": "application/json",
        ...options.headers,
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(url, config);

    if (response.status === 401) {
        window.dispatchEvent(new Event("auth-logout"));
    }

    return response;
}
