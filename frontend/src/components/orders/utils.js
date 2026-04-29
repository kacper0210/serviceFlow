import { authFetch } from "../../utils/authFetch";

export async function fetchOrdersFromApi(filter = {}) {
  try {
    const params = new URLSearchParams();
    if (filter.status) params.append("status", filter.status);
    if (filter.sort) params.append("sort", filter.sort);
    if (filter.search) params.append("search", filter.search);
    if (filter.minPrice) params.append("minPrice", filter.minPrice);
    if (filter.maxPrice) params.append("maxPrice", filter.maxPrice);
    if (filter.dateFrom) params.append("dateFrom", filter.dateFrom);
    if (filter.dateTo) params.append("dateTo", filter.dateTo);

    const res = await authFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders?${params.toString()}`);
    if (!res.ok) throw new Error("Blad serwera");
    return await res.json();
  } catch (err) {
    console.error("Blad pobierania zlecen:", err);
    return [];
  }
}

export async function fetchClientsFromApi() {
  try {
    const res = await authFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`);
    if (!res.ok) throw new Error("Blad serwera");
    return await res.json();
  } catch (err) {
    console.error("Blad pobierania klientow:", err);
    return [];
  }
}

export const STATUS_COLORS = {
  nowe: { bg: "#dbeafe", color: "#1e40af", label: "Nowe" },
  w_trakcie: { bg: "#fef3c7", color: "#92400e", label: "W realizacji" },
  zakończone: { bg: "#d1fae5", color: "#065f46", label: "Zakończone" },
};
