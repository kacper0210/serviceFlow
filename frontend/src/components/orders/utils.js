export async function fetchOrdersFromApi(filter = {}) {
  try {
    const params = new URLSearchParams();
    if (filter.status) params.append("status", filter.status);
    if (filter.sort) params.append("sort", filter.sort);
    if (filter.search) params.append("search", filter.search);

    const res = await fetch(`http://localhost:4000/api/orders?${params.toString()}`);
    if (!res.ok) throw new Error("Błąd serwera");
    return await res.json();
  } catch (err) {
    console.error("Błąd pobierania zleceń:", err);
    return [];
  }
}

export async function fetchClientsFromApi() {
  try {
    const res = await fetch("http://localhost:4000/api/clients");
    if (!res.ok) throw new Error("Błąd serwera");
    return await res.json();
  } catch (err) {
    console.error("Błąd pobierania klientów:", err);
    return [];
  }
}
