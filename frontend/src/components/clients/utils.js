import { authFetch } from "../../utils/authFetch";

export async function fetchClientsFromApi() {
  try {
    const res = await authFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`);
    if (!res.ok) throw new Error("Błąd serwera");
    return await res.json();
  } catch (err) {
    console.error("Błąd pobierania klientów:", err);
    return [];
  }
}
