import EditOrderForm from "./editOrderForm";

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
        border: "1px solid var(--card-border)",
        borderRadius: "8px",
        background: "var(--card-bg)",
        padding: "10px",
        color: "var(--text)",
      }}
    >
      {isEditing ? (
        <EditOrderForm order={order} clients={clients} onCancel={onCancelEdit} onSaved={onSaved} />
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
            <button onClick={onEdit} className="btn-edit">
              ✏️ Edytuj
            </button>
            <button onClick={onDelete} className="btn-delete">
              🗑️ Usuń
            </button>
          </div>
        </>
      )}
    </div>
  );
}
