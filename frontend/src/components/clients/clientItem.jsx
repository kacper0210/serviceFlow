import { useState } from "react";
import EditClientForm from "./editClientForm";
import ClientDetails from "./clientDetails";

export default function ClientItem({ client, isEditing, onEdit, onCancelEdit, onDelete, onSaved }) {
  const [showModal, setShowModal] = useState(false);

  // Jeśli jesteśmy w trybie edycji, wyświetlamy formularz zamiast karty
  if (isEditing) {
    return (
      <div className="client-card editing-mode">
        <EditClientForm
          client={client}
          onCancel={onCancelEdit}
          onSaved={onSaved}
        />
      </div>
    );
  }

  // Normalny widok karty klienta
  return (
    <div className="client-card">

      {/* Kliknięcie w treść otwiera szczegóły */}
      <div className="client-content-clickable" onClick={() => setShowModal(true)}>

        <div className="client-header">
          <span className="client-name">
            {client.first_name} {client.last_name}
          </span>

          {/* Prosty warunek do koloru etykiety */}
          <span className={client.type === 'firma' ? 'badge badge-company' : 'badge badge-person'}>
            {client.type === 'firma' ? 'Firma' : 'Osoba'}
          </span>
        </div>

        <div className="client-body">
          {client.company_name && (
            <div className="company-name-label">
              {client.company_name}
            </div>
          )}

          {/* Sekcja informacyjna - zrobiona "ręcznie" bez dodatkowych komponentów */}
          <div className="info-list">

            <div className="info-item">
              <span className="icon">✉️</span>
              <span>{client.email || "—"}</span>
            </div>

            <div className="info-item">
              <span className="icon">📞</span>
              {client.phone ? (
                <a 
                  href={`tel:${client.phone.replace(/\s+/g, '')}`}
                  className="phone-call-link"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    color: 'var(--primary-color)',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Zadzwoń do klienta"
                >
                  {client.phone} 
                  <span style={{
                    fontSize: '0.72rem',
                    background: '#22c55e',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 700
                  }}>
                    📞 Zadzwoń
                  </span>
                </a>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Brak telefonu</span>
              )}
            </div>

            <div className="info-item">
              <span className="icon">📍</span>
              <span>{client.address || "Brak adresu"}</span>
            </div>

            {client.nip && (
              <div className="info-item">
                <span className="icon">🏢</span>
                <span>NIP: {client.nip}</span>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Przyciski akcji na dole karty */}
      <div className="card-actions">
        <button className="btn-edit" onClick={onEdit}>
          Edytuj
        </button>
        <button className="btn-delete" onClick={onDelete}>
          Usuń
        </button>
      </div>

      {/* Modal ze szczegółami */}
      {showModal && (
        <ClientDetails
          clientId={client.id}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}