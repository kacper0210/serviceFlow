import { useEffect, useState } from "react";
import "./users.css";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "user",
    is_active: true
  });

  const getHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("auth"));
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authData?.token}`
    };
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/users`, {
        headers: getHeaders()
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Błąd pobierania");

      setUsers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/users`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Błąd dodawania");

      setForm({ email: "", password: "", role: "user", is_active: true });
      setUsers((prev) => [...prev, data]);
      alert("Dodano użytkownika!");

    } catch (e) {
      setError(e.message);
    }
  };

  const updateUser = async (id, patchData) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/users/${id}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(patchData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Błąd aktualizacji");

      setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));

    } catch (e) {
      alert("Błąd: " + e.message);
    }
  };

  const removeUser = async (id) => {
    if (!window.confirm("Czy na pewno usunąć tego użytkownika?")) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/users/${id}`, {
        method: "DELETE",
        headers: getHeaders()
      });

      if (!res.ok) throw new Error("Błąd usuwania");

      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      alert(e.message);
    }
  };

  const handleChangePassword = (id) => {
    const newPass = prompt("Podaj nowe hasło dla użytkownika:");
    if (newPass) {
      updateUser(id, { password: newPass });
    }
  };

  return (
    <div className="users-container">
      <h1 className="users-title">Zarządzanie Użytkownikami</h1>

      {error && <div className="users-error-alert">{error}</div>}

      <section className="users-card">
        <h3 className="users-section-title">Dodaj nowego użytkownika</h3>
        <form onSubmit={addUser} className="users-form">
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="users-input"
            required
            style={{ flex: 2, minWidth: 200 }}
          />
          <input
            placeholder="Hasło"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="users-input"
            required
            style={{ flex: 1, minWidth: 150 }}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="users-select"
            style={{ flex: 1, minWidth: 100 }}
          >
            <option value="user">Użytkownik</option>
            <option value="admin">Administrator</option>
          </select>

          <label className="users-checkbox-label">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Aktywny
          </label>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Dodawanie..." : "Dodaj użytkownika"}
          </button>
        </form>
      </section>

      <section className="users-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Rola</th>
                <th>Status</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td data-label="ID">#{u.id}</td>
                  <td data-label="Email"><strong>{u.email}</strong></td>
                  <td data-label="Rola">
                    <select
                      value={u.role}
                      onChange={(e) => updateUser(u.id, { role: e.target.value })}
                      className="form-select"
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td data-label="Status">
                    <label className="users-checkbox-label" style={{ fontSize: '0.9em' }}>
                      <input
                        type="checkbox"
                        checked={!!u.is_active}
                        onChange={(e) => updateUser(u.id, { is_active: e.target.checked })}
                      />
                      {u.is_active ? "Aktywny" : "Zablokowany"}
                    </label>
                  </td>
                  <td data-label="Akcje">
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleChangePassword(u.id)}
                        className="btn-table"
                      >
                        Hasło
                      </button>
                      <button
                        onClick={() => removeUser(u.id)}
                        className="btn-table btn-delete"
                      >
                        Usuń
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="users-empty-message">
                    Brak użytkowników w bazie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}