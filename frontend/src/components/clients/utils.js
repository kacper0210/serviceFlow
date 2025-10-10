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
