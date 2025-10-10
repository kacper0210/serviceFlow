export const inputStyle = {
  padding: "8px",
  border: "1px solid #ccc",
  borderRadius: "6px",
  width: "100%",
};

export const btnEdit = {
  marginRight: "8px",
  background: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 10px",
  cursor: "pointer",
};

export const btnDelete = {
  background: "#dc3545",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 10px",
  cursor: "pointer",
};

export const btnSave = {
  ...btnEdit,
  background: "#28a745",
};

export const btnCancel = {
  ...btnDelete,
  background: "#6c757d",
};

export const btnPrimary = {
  background: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 12px",
  fontSize: "15px",
  cursor: "pointer",
  transition: "background 0.3s",
};

btnPrimary["&:hover"] = {
  background: "#0056b3",
};
