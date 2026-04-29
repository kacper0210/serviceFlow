import { useState, useEffect, useMemo } from "react";
import AddEntryForm from "./AddEntryForm";

export default function EntriesList({ type }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

  const labels = type === "revenue" ? {
    btn: "+ Dodaj Fakturę Sprzedaży",
    importBtn: "📥 Import Grupny XML",
    title: "Przychody (Faktury)",
  } : {
    btn: "+ Dodaj Fakturę Kosztową",
    importBtn: "📥 Import Hurtowy KSeF (XML)",
    title: "Koszty",
  };

  const sortedAndFilteredEntries = useMemo(() => {
    let result = entries.filter(e => {
        const search = searchTerm.toLowerCase();
        return (e.number?.toLowerCase().includes(search)) ||
               (e.contractor?.toLowerCase().includes(search)) ||
               (String(e.gross_amount).includes(search)) ||
               (e.category?.toLowerCase().includes(search));
    });

    if (sortConfig.key) {
        result.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            const numericCols = ['net_amount', 'vat_amount', 'gross_amount', 'vat_rate'];

            if (sortConfig.key === 'date') {
                valA = new Date(valA).getTime();
                valB = new Date(valB).getTime();
            } else if (numericCols.includes(sortConfig.key)) {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = (valA || "").toString().toLowerCase();
                valB = (valB || "").toString().toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }


    return result;
  }, [entries, searchTerm, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/entries?type=${type}`, {
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setEntries(data);
      } else {
        setEntries([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkImport = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    setImporting(true);
    const authData = JSON.parse(localStorage.getItem("auth"));
    
    for (const file of files) {
      try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const getTag = (tag) => xmlDoc.getElementsByTagName(tag)[0]?.textContent || "";
        
        const numer = getTag("NumerFaktury") || getTag("P_2");
        const data = getTag("DataWystawienia") || getTag("P_1");
        const ktr = xmlDoc.getElementsByTagName("Podmiot1")[0]?.getElementsByTagName("Nazwa")[0]?.textContent 
                 || xmlDoc.getElementsByTagName("Podmiot1")[0]?.getElementsByTagName("PelnaNazwa")[0]?.textContent
                 || "Nieznany Kontrahent";
        
        const net = parseFloat(getTag("P_13_1")) || 0;
        const vat = parseFloat(getTag("P_14_1")) || 0;
        const gross = parseFloat(getTag("P_15")) || (net + vat);

        if (!numer) continue;

        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/entries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${authData?.token}`
          },
          body: JSON.stringify({
            date: data,
            number: numer,
            contractor: ktr,
            description: "Import KSeF",
            net_amount: net,
            vat_rate: 23,
            vat_amount: vat,
            gross_amount: gross,
            category: type === "revenue" ? "Sprzedaż" : "Inne",
            is_car_cost: false,
            entry_type: type
          })
        });
      } catch (err) {
        console.error("Błąd pliku:", file.name, err);
      }
    }
    
    setImporting(false);
    fetchEntries();
    alert(`Zakończono import ${files.length} plików.`);
  };

  const handleToggleReady = async (entry) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/entries/${entry.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify({ is_ready: !entry.is_ready })
      });
      fetchEntries();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Czy usunąć ten wpis?")) return;
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/accounting/entries/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      fetchEntries();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [type]);

  const SortIcon = ({ col }) => {
    const isActive = sortConfig.key === col;
    return (
      <span style={{ 
        display: 'inline-block', 
        width: '20px', 
        textAlign: 'center', 
        opacity: isActive ? 1 : 0.2,
        marginLeft: col === 'date' || col === 'number' || col === 'contractor' || col === 'category' ? 5 : 0,
        marginRight: col === 'net_amount' || col === 'vat_amount' || col === 'gross_amount' ? 5 : 0,
      }}>
        {isActive ? (sortConfig.direction === 'asc' ? '🔼' : '🔽') : '↕'}
      </span>
    );
  };


  return (
    <div className="expenses-list">
      <div className="actions-bar" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{labels.btn}</button>
        <button 
          className="btn btn-secondary" 
          onClick={() => document.getElementById('bulk-import-input').click()}
          disabled={importing}
        >
          {importing ? "⌛ Importowanie..." : labels.importBtn}
        </button>
        <input 
          id="bulk-import-input"
          type="file" 
          multiple 
          accept=".xml" 
          style={{ display: 'none' }} 
          onChange={handleBulkImport}
        />

        <div style={{ flex: 1, minWidth: '200px', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 15 }}>
            <div className="entry-counter">
                Suma dokumentów: <strong>{sortedAndFilteredEntries.length}</strong> 
                <span style={{ marginLeft: '10px', color: 'var(--primary-color)' }}>
                  (W teczce: <strong>{sortedAndFilteredEntries.filter(e => e.is_ready).length}</strong>)
                </span>
            </div>
            <input 
                type="text" 
                placeholder="🔍 Szukaj..." 
                className="form-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '100%', borderRadius: '100px', padding: '10px 20px' }}
            />
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setShowAdd(false)}>✕</button>
            <AddEntryForm 
              type={type}
              onSaved={() => {
                setShowAdd(false);
                fetchEntries();
              }} 
              onCancel={() => setShowAdd(false)}
            />
          </div>
        </div>
      )}

      {editingEntry && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="close-btn" onClick={() => setEditingEntry(null)}>✕</button>
            <AddEntryForm 
              type={type}
              initialData={editingEntry}
              onSaved={() => {
                setEditingEntry(null);
                fetchEntries();
              }} 
              onCancel={() => setEditingEntry(null)}
            />
          </div>
        </div>
      )}

      <div className="table-responsive-container">
        <table className="table-accounting-modern">
          <thead>
            <tr>
              <th style={{ width: '50px', textAlign: 'center' }}>📁</th>
              <th onClick={() => requestSort('date')} style={{ cursor: 'pointer' }}>Data <SortIcon col="date" /></th>
              <th onClick={() => requestSort('number')} style={{ cursor: 'pointer' }}>Nr Dokumentu <SortIcon col="number" /></th>
              <th onClick={() => requestSort('contractor')} style={{ cursor: 'pointer' }}>{type === "revenue" ? "Klient" : "Kontrahent"} <SortIcon col="contractor" /></th>
              <th onClick={() => requestSort('category')} style={{ cursor: 'pointer' }}>Kategoria <SortIcon col="category" /></th>
              <th onClick={() => requestSort('net_amount')} className="text-right" style={{ cursor: 'pointer' }}><SortIcon col="net_amount" /> Netto</th>
              <th onClick={() => requestSort('vat_amount')} className="text-right" style={{ cursor: 'pointer' }}><SortIcon col="vat_amount" /> VAT</th>
              <th onClick={() => requestSort('gross_amount')} className="text-right" style={{ cursor: 'pointer' }}><SortIcon col="gross_amount" /> Brutto</th>
              <th className="text-right">Akcje</th>
            </tr>
          </thead>


          <tbody>
            {(() => {
              let currentMonthKey = "";
              return sortedAndFilteredEntries.reduce((acc, e) => {
                const d = new Date(e.date);
                const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                
                if (sortConfig.key === 'date' && mKey !== currentMonthKey) {
                  currentMonthKey = mKey;
                  const monthEntries = sortedAndFilteredEntries.filter(x => {
                    const xd = new Date(x.date);
                    return `${xd.getFullYear()}-${String(xd.getMonth() + 1).padStart(2, '0')}` === mKey;
                  });
                  const sumNet = monthEntries.reduce((sum, x) => sum + (parseFloat(x.net_amount) || 0), 0);
                  const sumVat = monthEntries.reduce((sum, x) => sum + (parseFloat(x.vat_amount) || 0), 0);
                  const sumGross = monthEntries.reduce((sum, x) => sum + (parseFloat(x.gross_amount) || 0), 0);
                  const monthReady = monthEntries.filter(x => x.is_ready).length;

                  acc.push(
                    <tr key={`header-${mKey}`} style={{ backgroundColor: 'var(--bg-gray)', borderBottom: '2px solid var(--border-color)', borderTop: '2px solid var(--border-color)' }}>
                       <td colSpan="5" style={{ padding: '12px 15px', fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--primary-color)' }}>
                         📅 {d.toLocaleString('pl-PL', { month: 'long', year: 'numeric' }).toUpperCase()} 
                         <span style={{ fontSize: '0.85rem', color: '#666', marginLeft: '10px', fontWeight: 'normal' }}>
                           (W teczce: {monthReady} / {monthEntries.length})
                         </span>
                       </td>
                       <td className="text-right" style={{ fontWeight: 'bold' }}>{sumNet.toFixed(2)} zł</td>
                       <td className="text-right" style={{ fontWeight: 'bold' }}>{sumVat.toFixed(2)} zł</td>
                       <td className="text-right" style={{ fontWeight: 'bold' }}>{sumGross.toFixed(2)} zł</td>
                       <td></td>
                    </tr>
                  );
                }

                acc.push(
                  <tr key={e.id} className={e.is_ready ? "row-ready" : ""}>
                    <td style={{ textAlign: 'center' }}>
                       <button 
                        className={`btn-ready-toggle ${e.is_ready ? 'active' : ''}`}
                        onClick={() => handleToggleReady(e)}
                        title={e.is_ready ? "Oznacz jako niegotowe" : "Oznacz jako gotowe do wysyłki"}
                       >
                         {e.is_ready ? "✅" : "⭕"}
                       </button>
                    </td>
                    <td>{new Date(e.date).toLocaleDateString()}</td>
                    <td><strong>{e.number}</strong></td>
                    <td>{e.contractor}</td>
                    <td>
                        <span className="badge-category">{e.category}</span>
                        {e.is_car_cost && <span className="badge-car" title="Auto (75% / 50%)">🚗</span>}
                    </td>
                    <td className="text-right">{e.net_amount} zł</td>
                    <td className="text-right">{e.vat_amount} zł ({e.vat_rate}%)</td>
                    <td className="text-right"><strong>{e.gross_amount} zł</strong></td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                        <button className="btn-table" onClick={() => setEditingEntry(e)}>Edytuj</button>
                        <button className="btn-table btn-delete" onClick={() => handleDelete(e.id)}>Usuń</button>
                      </div>
                    </td>
                  </tr>
                );
                return acc;
              }, []);
            })()}

            {sortedAndFilteredEntries.length === 0 && (
              <tr>
                <td colSpan="9" style={{textAlign: 'center', padding: '40px'}}>
                  {searchTerm ? `Brak wyników dla: "${searchTerm}"` : "Brak zapisanych wpisów w tej kategorii."}
                </td>
              </tr>
            )}

          </tbody>
        </table>
      </div>
    </div>
  );
}
