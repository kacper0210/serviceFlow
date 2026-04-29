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
              <span>{client.phone}</span>
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