import { useState, useEffect } from "react";
import OfferForm from "./OfferForm";
import OfferDetails from "./OfferDetails";
import "./offers.css";

export default function OffersList() {
  const [offers, setOffers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchText, setSearchText] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOffer, setEditingOffer] = useState(null);
  const [detailsId, setDetailsId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const headers = { "Authorization": `Bearer ${token}` };

      // Fetch offers
      const offersRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers`, { headers });
      const offersData = await offersRes.json();

      // Fetch clients for the creation dropdown
      const clientsRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, { headers });
      const clientsData = await clientsRes.json();

      setOffers(Array.isArray(offersData) ? offersData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);
    } catch (err) {
      console.error(err);
      alert("Błąd podczas pobierania danych ofert");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz trwale usunąć tę ofertę?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/offers/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      if (res.ok) {
        setOffers(prev => prev.filter(o => o.id !== id));
      } else {
        alert("Nie udało się usunąć oferty.");
      }
    } catch (err) {
      console.error(err);
      alert("Błąd podczas usuwania.");
    }
  };

  const filteredOffers = offers.filter(offer => {
    if (filterStatus && offer.status !== filterStatus) return false;

    const search = searchText.toLowerCase();
    const titleMatch = offer.title?.toLowerCase().includes(search);
    
    const clientName = `${offer.first_name || ""} ${offer.last_name || ""} ${offer.company_name || ""}`.toLowerCase();
    const clientMatch = clientName.includes(search);

    return !searchText || titleMatch || clientMatch;
  });

  return (
    <div className="offers-container">
      <div className="toolbar no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Moduł Ofertowania</h2>
      </div>

      <div className="toolbar no-print">
        <div className="search-box">
          <input
            className="filter-input"
            placeholder="Szukaj (tytuł, klient)..."
            value={searchText}
            onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
          />
          <select
            className="filter-input"
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Wszystkie statusy</option>
            <option value="robocza">Robocza</option>
            <option value="wyslana">Wysłana</option>
            <option value="zaakceptowana">Zaakceptowana</option>
            <option value="odrzucona">Odrzucona</option>
          </select>
        </div>

        <div className="actions-box">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Nowa oferta
          </button>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <p style={{ padding: 20 }}>Ładowanie ofert...</p>
        ) : (
          <>
            <table className="offers-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tytuł Oferty</th>
                  <th>Klient</th>
                  <th>Data utworzenia</th>
                  <th>Ważna do</th>
                  <th>Kwota Brutto</th>
                  <th>Status</th>
                  <th className="no-print">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredOffers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(offer => {
                  const clientName = offer.company_name 
                    ? offer.company_name 
                    : (offer.first_name && offer.last_name ? `${offer.first_name} ${offer.last_name}` : "Brak przypisanego klienta");
                  
                  return (
                    <tr key={offer.id}>
                      <td data-label="ID">#{offer.id}</td>
                      <td data-label="Tytuł"><strong>{offer.title}</strong></td>
                      <td data-label="Klient">{clientName}</td>
                      <td data-label="Utworzono">
                        {offer.created_at ? new Date(offer.created_at).toLocaleDateString('pl-PL') : "-"}
                      </td>
                      <td data-label="Ważna do">
                        {offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('pl-PL') : "-"}
                      </td>
                      <td data-label="Kwota Brutto" style={{ fontWeight: '600' }}>
                        {offer.total_gross ? `${parseFloat(offer.total_gross).toFixed(2)} zł` : "0.00 zł"}
                      </td>
                      <td data-label="Status">
                        <span className={`status-badge status-${offer.status}`}>
                          {offer.status}
                        </span>
                      </td>
                      <td data-label="Akcje" className="no-print">
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                          <button className="btn-table" onClick={() => setDetailsId(offer.id)}>Podgląd</button>
                          <button className="btn-table" onClick={() => setEditingOffer(offer)}>Edytuj</button>
                          <button className="btn-table btn-delete" onClick={() => handleDelete(offer.id)}>Usuń</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOffers.length === 0 && (
                  <tr>
                    <td colSpan="8" style={{ textAlign: "center", padding: 20 }}>Brak ofert spełniających kryteria.</td>
                  </tr>
                )}
              </tbody>
            </table>

            {filteredOffers.length > itemsPerPage && (
              <div className="pagination-row no-print">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  &lt; Poprzednia
                </button>
                <span>Strona {currentPage} z {Math.ceil(filteredOffers.length / itemsPerPage)}</span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredOffers.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(filteredOffers.length / itemsPerPage)}
                >
                  Następna &gt;
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            <h3 style={{ marginTop: 0, textAlign: "center" }}>Nowa Oferta</h3>
            <OfferForm 
              clients={clients} 
              onCancel={() => setShowAddModal(false)}
              onSaved={(newOffer) => {
                setOffers(prev => [newOffer, ...prev]);
                setShowAddModal(false);
              }} 
            />
          </div>
        </div>
      )}

      {editingOffer && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <button className="close-btn" onClick={() => setEditingOffer(null)}>✕</button>
            <h3 style={{ marginTop: 0, textAlign: "center" }}>Edycja Oferty #{editingOffer.id}</h3>
            <OfferForm
              offer={editingOffer}
              clients={clients}
              onCancel={() => setEditingOffer(null)}
              onSaved={() => {
                fetchData();
                setEditingOffer(null);
              }}
            />
          </div>
        </div>
      )}

      {detailsId && (
        <OfferDetails 
          offerId={detailsId} 
          onClose={() => setDetailsId(null)} 
          onConverted={() => {
            fetchData();
            setDetailsId(null);
          }}
        />
      )}
    </div>
  );
}
