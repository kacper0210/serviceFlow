import { useEffect, useState } from "react";
import AddClientForm from "./addClientForm";
import ClientDetails from "./clientDetails";
import EditClientForm from "./editClientForm";
import "./clients.css";

export default function ClientsList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("wszyscy");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [detailsId, setDetailsId] = useState(null);

  const [selectedIds, setSelectedIds] = useState([]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Błąd pobierania");

      const data = await res.json();
      setClients(data);
    } catch (err) {
      console.error(err);
      alert("Nie udało się pobrać listy klientów");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(client => {
    if (filterType !== "wszyscy" && client.type !== filterType) return false;

    const text = searchText.toLowerCase();
    const fullString = `${client.first_name} ${client.last_name} ${client.company_name || ""} ${client.email}`.toLowerCase();

    return fullString.includes(text);
  });

  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tego klienta?")) return;

    const authData = JSON.parse(localStorage.getItem("auth"));

    try {
      let res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData.token}` }
      });

      if (res.status === 400) {
        const confirmForce = window.confirm("Ten klient ma przypisane zlecenia. Czy usunąć go WRAZ ZE ZLECENIAMI? Tej operacji nie można cofnąć.");

        if (confirmForce) {
          res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients/${id}?force=true`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${authData.token}` }
          });
        } else {
          return;
        }
      }

      if (res.ok) {
        setClients(prev => prev.filter(c => c.id !== id));
        alert("Usunięto pomyślnie.");
      } else {
        alert("Wystąpił błąd podczas usuwania.");
      }

    } catch (e) {
      console.error(e);
      alert("Błąd serwera.");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Czy usunąć zaznaczone osoby (${selectedIds.length})?`)) return;

    const authData = JSON.parse(localStorage.getItem("auth"));

    for (const id of selectedIds) {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients/${id}?force=true`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData.token}` }
      });
    }

    setSelectedIds([]);
    fetchClients();
  };

  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const exportToCSV = () => {
    if (clients.length === 0) return;
    const header = "ID,Imie,Nazwisko,Firma,Email\n";
    const rows = clients.map(c =>
      `${c.id},${c.first_name},${c.last_name},${c.company_name || ""},${c.email}`
    ).join("\n");

    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'klienci.csv';
    a.click();
  };

  const selectAll = () => {
    if (selectedIds.length === filteredClients.length && filteredClients.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredClients.map(c => c.id));
    }
  };

  return (
    <div className="clients-page-container">


      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Szukaj klienta..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="wszyscy">Wszyscy</option>
            <option value="osoba_prywatna">Osoba prywatna</option>
            <option value="firma">Firma</option>
          </select>
        </div>

        <div className="actions-box">
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Dodaj klienta
          </button>
          <button className="btn-secondary" onClick={exportToCSV}>
            CSV
          </button>
          {selectedIds.length > 0 && (
            <button className="btn-danger" onClick={handleBulkDelete}>
              Usuń zaznaczone ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <p>Ładowanie danych...</p>
        ) : (
          <table className="clients-table">
            <thead>
               <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={filteredClients.length > 0 && selectedIds.length === filteredClients.length}
                    onChange={selectAll}
                  />
                </th>

                <th>Imię i Nazwisko / Firma</th>
                <th>Kontakt</th>
                <th>Typ</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(client => (
                <tr key={client.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(client.id)}
                      onChange={() => toggleSelect(client.id)}
                    />
                  </td>
                  <td>
                    <strong>{client.first_name} {client.last_name}</strong>
                    {client.company_name && (
                      <div className="company-subtext">{client.company_name}</div>
                    )}
                  </td>
                  <td>
                    <div>{client.email}</div>
                    <div style={{ fontSize: '0.85em', color: '#666' }}>{client.phone}</div>
                  </td>
                  <td>
                    <span className={`badge ${client.type === 'firma' ? 'badge-company' : 'badge-person'}`}>
                      {client.type === 'firma' ? 'Firma' : 'Osoba'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                      <button className="btn-table" onClick={() => setDetailsId(client.id)}>Podgląd</button>
                      <button className="btn-table" onClick={() => setEditingClient(client)}>Edytuj</button>
                      <button className="btn-table btn-delete" onClick={() => handleDelete(client.id)}>Usuń</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "20px" }}>
                    Brak wyników wyszukiwania
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            <AddClientForm onClientAdded={(newClient) => {
              setClients(prev => [...prev, newClient]);
              setShowAddModal(false);
            }} />
          </div>
        </div>
      )}

      {editingClient && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setEditingClient(null)}>✕</button>
            <EditClientForm
              client={editingClient}
              onCancel={() => setEditingClient(null)}
              onSaved={() => {
                fetchClients();
                setEditingClient(null);
              }}
            />
          </div>
        </div>
      )}

      {detailsId && (
        <ClientDetails
          clientId={detailsId}
          onClose={() => setDetailsId(null)}
        />
      )}

    </div>
  );
}