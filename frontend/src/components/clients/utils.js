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

/**
 * Formats user input automatically to +48-xxx-xxx-xxx format.
 * Strips leading '48' prefix automatically so +48 is not duplicated.
 */
export function formatPhoneInput(value) {
  if (!value) return "";

  let digits = value.replace(/\D/g, "");

  // Always strip leading '48' country code if present, as +48 is prepended automatically
  if (digits.startsWith("48")) {
    digits = digits.slice(2);
  }

  digits = digits.slice(0, 9);

  if (digits.length === 0) return "";

  let formatted = "+48-";
  if (digits.length <= 3) {
    formatted += digits;
  } else if (digits.length <= 6) {
    formatted += `${digits.slice(0, 3)}-${digits.slice(3)}`;
  } else {
    formatted += `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return formatted;
}
