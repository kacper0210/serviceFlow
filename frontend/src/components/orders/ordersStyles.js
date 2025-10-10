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
  background: "#6c757d",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  padding: "6px 10px",
  cursor: "pointer",
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

// 🔹 Przycisk „+”
export const btnIcon = {
  background: "#007bff",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  width: "36px",
  height: "36px",
  fontSize: "20px",
  cursor: "pointer",
  lineHeight: "0",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.2s",
};

btnIcon[":hover"] = {
  background: "#0056b3",
};

// 🔹 Tło modala
export const modalOverlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
};

// 🔹 Okno modala
export const modalBox = {
  background: "#fff",
  padding: "25px",
  borderRadius: "12px",
  width: "400px",
  maxHeight: "90vh",
  overflowY: "auto",
};

// 🔹 Przycisk „Zamknij”
export const btnClose = {
  marginTop: "10px",
  background: "#6c757d",
  color: "white",
  border: "none",
  borderRadius: "8px",
  padding: "8px 12px",
  cursor: "pointer",
  width: "100%",
};
