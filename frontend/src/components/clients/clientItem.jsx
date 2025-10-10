import { useState } from "react";
import EditClientForm from "./editClientForm";
import ClientDetails from "./clientDetails";
import { btnEdit, btnDelete } from "./clientsStyles";

export default function ClientItem({
  client,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  onSaved,
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <li
      style={{
        marginBottom: "15px",
        padding: "15px",
        border: "1px solid #ddd",
        borderRadius: "8px",
        background: "#fff",
        color: "#222",
        position: "relative",
      }}
    >
      {isEditing ? (
        <EditClientForm
          client={client}
          onCancel={onCancelEdit}
          onSaved={onSaved}
        />
      ) : (
        <>
          {/* Klikalna część otwierająca szczegóły */}
          <div
            onClick={() => setShowDetails(true)}
            style={{
              cursor: "pointer",
              paddingBottom: "10px",
              borderBottom: "1px solid #eee",
            }}
          >
            <strong>
              {client.first_name} {client.last_name}
            </strong>
            <br />
            <span>{client.email || "— brak emaila —"}</span>
            <br />
            <small>{client.type}</small>
            <br />
            {client.company_name && (
              <>
                <span>{client.company_name}</span>
                <br />
              </>
            )}
            {client.phone && (
              <>
                <span>📞 {client.phone}</span>
                <br />
              </>
            )}
            {client.address && <span>📍 {client.address}</span>}
          </div>

          {/* Przyciski akcji */}
          <div style={{ marginTop: "10px" }}>
            <button onClick={onEdit} style={btnEdit}>
              ✏️ Edytuj
            </button>
            <button onClick={onDelete} style={btnDelete}>
              🗑️ Usuń
            </button>
          </div>

          {/* Modal szczegółów klienta */}
          {showDetails && (
            <ClientDetails
              clientId={client.id}
              onClose={() => setShowDetails(false)}
            />
          )}
        </>
      )}
    </li>
  );
}
