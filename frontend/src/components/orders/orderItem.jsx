import EditOrderForm from "./editOrderForm";
import { btnEdit, btnDelete } from "./ordersStyles";

export default function OrderItem({
  order,
  clients,
  isEditing,
  onEdit,
  onCancelEdit,
  onDelete,
  onSaved,
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        background: "#fff",
        padding: "10px",
        color: "#222",
      }}
    >
      {isEditing ? (
        <EditOrderForm
          order={order}
          clients={clients}
          onCancel={onCancelEdit}
          onSaved={onSaved}
        />
      ) : (
        <>
          <b>{order.title}</b> – {order.status}
          <br />
          <small>
            Klient: {order.first_name} {order.last_name}{" "}
            {order.phone
              ? `(📞 ${order.phone})`
              : order.email
              ? `(✉️ ${order.email})`
              : "(brak danych kontaktowych)"}
          </small>
          <br />
          {order.description}

          <div style={{ marginTop: "8px" }}>
            <button onClick={onEdit} style={btnEdit}>
              ✏️ Edytuj
            </button>
            <button onClick={onDelete} style={btnDelete}>
              🗑️ Usuń
            </button>
          </div>
        </>
      )}
    </div>
  );
}
