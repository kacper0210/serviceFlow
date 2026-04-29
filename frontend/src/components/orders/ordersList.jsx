import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import AddOrderForm from "./addOrderForm";
import EditOrderForm from "./editOrderForm";
import OrderDetails from "./orderDetails";

export default function OrdersList() {
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("list");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get("status");
    if (statusParam) {
      setFilterStatus(statusParam);
    }
  }, [location.search]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [detailsId, setDetailsId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const token = authData?.token;
      const headers = { "Authorization": `Bearer ${token}` };

      const ordersRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders`, { headers });
      const ordersData = await ordersRes.json();

      const clientsRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/clients`, { headers });
      const clientsData = await clientsRes.json();

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setClients(Array.isArray(clientsData) ? clientsData : []);

    } catch (err) {
      console.error(err);
      alert("Błąd pobierania danych");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to zlecenie?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/orders/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (err) {
      alert("Nie udało się usunąć.");
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filterStatus) {
      const st = (order.status || "").toLowerCase();
      if (filterStatus === "zakonczone" && !st.includes("zako")) return false;
      if (filterStatus !== "zakonczone" && st !== filterStatus) return false;
    }

    const search = searchText.toLowerCase();
    const titleMatch = order.title?.toLowerCase().includes(search);

    const client = clients.find(c => c.id === order.client_id);
    const clientName = client ? `${client.first_name} ${client.last_name}`.toLowerCase() : "";
    const clientMatch = clientName.includes(search);

    return !searchText || titleMatch || clientMatch;
  });

  return (
    <div className="orders-container">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--border-color)', paddingBottom: '10px' }}>
        <button 
          className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-secondary-outline'}`} 
          onClick={() => setActiveTab('list')}
        >
          📝 Lista Zleceń
        </button>
        <button 
          className={`btn ${activeTab === 'profits' ? 'btn-primary' : 'btn-secondary-outline'}`} 
          onClick={() => setActiveTab('profits')}
        >
          📈 Dochody z palca na wykres
        </button>
      </div>

      {activeTab === 'profits' && <ManualProfitsView />}

      {activeTab === 'list' && (
        <>
          <div className="toolbar">
        <div className="search-box">
          <input
            className="filter-input"
            placeholder="Szukaj (tytuł, klient)..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <select
            className="filter-input"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="">Wszystkie statusy</option>
            <option value="nowe">Nowe</option>
            <option value="w_trakcie">W realizacji</option>
            <option value="zakonczone">Zakończone</option>
          </select>
        </div>

        <div className="actions-box">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Dodaj zlecenie
          </button>
        </div>

      </div>

      <div className="table-container">
        {loading ? (
          <p style={{ padding: 20 }}>Ładowanie...</p>
        ) : (
          <>
            <table className="orders-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Tytuł</th>
                  <th>Klient</th>
                  <th>Termin</th>
                  <th>Cena</th>
                  <th>Status</th>
                  <th>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(order => {
                  const client = clients.find(c => c.id === order.client_id);
                  return (
                    <tr key={order.id}>
                      <td data-label="ID">#{order.id}</td>
                      <td data-label="Tytuł"><strong>{order.title}</strong></td>
                      <td data-label="Klient">
                        {client ? `${client.first_name} ${client.last_name}` : "Nieznany"}
                      </td>
                      <td data-label="Termin">
                        {order.deadline ? new Date(order.deadline).toLocaleDateString() : "-"}
                      </td>
                      <td data-label="Cena">{order.price ? `${order.price} zł` : "-"}</td>
                      <td data-label="Status">
                        <span className={`status-badge status-${order.status}`}>
                          {order.status.replace("_", " ")}
                        </span>
                      </td>
                      <td data-label="Akcje">
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap' }}>
                          <button className="btn-table" onClick={() => setDetailsId(order.id)}>Podgląd</button>
                          <button className="btn-table" onClick={() => setEditOrder(order)}>Edytuj</button>
                          <button className="btn-table btn-delete" onClick={() => handleDelete(order.id)}>Usuń</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: "center", padding: 20 }}>Brak wyników</td></tr>
                )}
              </tbody>
            </table>

            {filteredOrders.length > itemsPerPage && (
              <div className="pagination-row">
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  &lt; Poprzednia
                </button>
                <span>Strona {currentPage} z {Math.ceil(filteredOrders.length / itemsPerPage)}</span>
                <button
                  className="pagination-btn"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredOrders.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(filteredOrders.length / itemsPerPage)}
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
          <div className="modal-content">
            <button className="close-btn" onClick={() => setShowAddModal(false)}>✕</button>
            <h3 style={{ marginTop: 0, textAlign: "center" }}>Nowe zlecenie</h3>
            <AddOrderForm onOrderAdded={(newOrder) => {
              setOrders(prev => [newOrder, ...prev]);
              setShowAddModal(false);
            }} />
          </div>
        </div>
      )}

      {editOrder && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setEditOrder(null)}>✕</button>
            <EditOrderForm
              order={editOrder}
              clients={clients}
              onCancel={() => setEditOrder(null)}
              onSaved={() => {
                fetchData();
                setEditOrder(null);
              }}
            />
          </div>
        </div>
      )}

      {detailsId && (
        <OrderDetails orderId={detailsId} onClose={() => setDetailsId(null)} />
      )}

        </>
      )}

    </div>
  );
}

function ManualProfitsView() {
  const [manualProfits, setManualProfits] = useState({});
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const authData = JSON.parse(localStorage.getItem("auth"));
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/settings/all`, {
          headers: { "Authorization": `Bearer ${authData?.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const map = {};
          data.forEach(s => {
            const k = `${s.year}-${String(s.month).padStart(2, "0")}`;
            map[k] = s.manual_profit;
          });
          setManualProfits(map);
        }
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (mKey, val) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const [y, m] = mKey.split("-");
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/settings`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authData?.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          year: parseInt(y), month: parseInt(m), manual_profit: val === "" ? null : parseFloat(val)
        })
      });
    } catch(e) { console.error(e); }
  };

  if (loading) return <p>Ładowanie formularza...</p>;

  return (
    <div style={{ background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
      <h2 style={{ marginTop: 0 }}>Ręczna edycja dochodów na wykresie</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Wpisane tutaj wartości nadpiszą automatyczne wyliczenia netto na wykresie głównym. Zostaw pole puste, aby przywrócić wyliczenie automatyczne z zakończonych zleceń.
      </p>

      <div style={{ marginBottom: '25px' }}>
        <label style={{ fontWeight: 'bold' }}>Wybierz rok: </label>
        <select 
          value={year} 
          onChange={e => setYear(parseInt(e.target.value))} 
          className="form-select" 
          style={{ width: '120px', display: 'inline-block', marginLeft: '10px' }}
        >
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
        {Array.from({length: 12}, (_, i) => i + 1).map(m => {
          const mKey = `${year}-${String(m).padStart(2, "0")}`;
          return (
            <div key={mKey} style={{ background: 'var(--bg-gray)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', textTransform: 'capitalize' }}>
                {new Date(0, m - 1).toLocaleString('pl-PL', {month: 'long'})}
              </label>
              <input 
                type="number" 
                value={manualProfits[mKey] !== undefined && manualProfits[mKey] !== null ? manualProfits[mKey] : ""}
                onChange={e => setManualProfits(prev => ({...prev, [mKey]: e.target.value}))}
                onBlur={e => handleSave(mKey, e.target.value)}
                className="form-input"
                placeholder="Auto"
                style={{ width: '100%', textAlign: 'center', fontSize: '1.1rem', padding: '8px' }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}