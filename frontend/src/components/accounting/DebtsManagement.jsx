import { useState, useEffect, useMemo, useCallback } from "react";
import "./debts.css";

export default function DebtsManagement() {
  const [debts, setDebts] = useState([]);
  const [summary, setSummary] = useState({ total_debt: 0, total_installments: 0 });
  const [snapshots, setSnapshots] = useState([]);
  const [payments, setPayments] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [totalFixedMonthly, setTotalFixedMonthly] = useState(0);
  const [pendingBills, setPendingBills] = useState([]);
  const [unpaidBillsTotal, setUnpaidBillsTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview | debts | fixed_bills | pending_bills

  // Modals & Editing states
  const [showAddDebtModal, setShowAddDebtModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);

  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  const [showAddSnapshotModal, setShowAddSnapshotModal] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState(null);
  const [showManageSnapshotsModal, setShowManageSnapshotsModal] = useState(false);

  const [showAddFixedModal, setShowAddFixedModal] = useState(false);
  const [editingFixed, setEditingFixed] = useState(null);

  const [showAddPendingModal, setShowAddPendingModal] = useState(false);
  const [editingPending, setEditingPending] = useState(null);

  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeScheduleDebt, setActiveScheduleDebt] = useState(null);
  const [activeScheduleList, setActiveScheduleList] = useState([]);
  const [scheduleFilter, setScheduleFilter] = useState("unpaid"); // "unpaid" | "all"

  // Fixed Incomes (Stałe Wpływy)
  const [fixedIncomes, setFixedIncomes] = useState([]);
  const [totalFixedIncomeMonthly, setTotalFixedIncomeMonthly] = useState(0);
  const [showAddFixedIncomeModal, setShowAddFixedIncomeModal] = useState(false);
  const [editingFixedIncome, setEditingFixedIncome] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    chart: true,
    schedule: true,
    installmentsBreakdown: true,
    debtsTable: true
  });

  const toggleSection = (sectionKey) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const [fixedIncomeForm, setFixedIncomeForm] = useState({
    name: "",
    amount: "",
    due_day: 1,
    category: "Stały przychód",
    notes: ""
  });

  // Forms
  const [debtForm, setDebtForm] = useState({
    creditor: "",
    total_amount: "",
    monthly_installment: "",
    capital_installment: "",
    interest_installment: "",
    due_day: 10,
    interest_notes: "",
    notes: ""
  });

  const [paymentForm, setPaymentForm] = useState({
    debt_id: "",
    creditor: "",
    amount: "",
    capital_amount: "",
    interest_amount: "",
    due_date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const [snapshotForm, setSnapshotForm] = useState({
    snapshot_date: new Date().toISOString().split('T')[0],
    total_debt: "",
    notes: ""
  });

  const [fixedForm, setFixedForm] = useState({
    name: "",
    amount: "",
    due_day: 10,
    category: "Stałe",
    notes: ""
  });

  const [pendingForm, setPendingForm] = useState({
    title: "",
    amount: "",
    due_date: new Date().toISOString().split('T')[0],
    invoice_number: "",
    category: "Faktura/Rachunek",
    notes: ""
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const headers = { "Authorization": `Bearer ${authData?.token}` };
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const [debtsRes, snapRes, payRes, fixedRes, pendRes, incomeRes] = await Promise.all([
        fetch(`${baseUrl}/api/debts`, { headers }),
        fetch(`${baseUrl}/api/debts/snapshots`, { headers }),
        fetch(`${baseUrl}/api/debts/payments`, { headers }),
        fetch(`${baseUrl}/api/debts/fixed-expenses`, { headers }),
        fetch(`${baseUrl}/api/debts/pending-bills`, { headers }),
        fetch(`${baseUrl}/api/debts/fixed-incomes`, { headers })
      ]);

      const debtsData = await debtsRes.json();
      const snapData = await snapRes.json();
      const payData = await payRes.json();
      const fixedData = await fixedRes.json();
      const pendData = await pendRes.json();
      const incomeData = await incomeRes.json();

      setDebts(Array.isArray(debtsData.debts) ? debtsData.debts : []);
      setSummary(debtsData.summary || { total_debt: 0, total_installments: 0 });
      setSnapshots(Array.isArray(snapData) ? snapData : []);
      setPayments(Array.isArray(payData) ? payData : []);
      setFixedExpenses(Array.isArray(fixedData.expenses) ? fixedData.expenses : []);
      setTotalFixedMonthly(fixedData.total_monthly || 0);
      setPendingBills(Array.isArray(pendData.bills) ? pendData.bills : []);

      setFixedIncomes(Array.isArray(incomeData.incomes) ? incomeData.incomes : []);
      setTotalFixedIncomeMonthly(incomeData.total_monthly_income || 0);
      setUnpaidBillsTotal(pendData.unpaid_total || 0);
    } catch (err) {
      console.error("[Debts Fetch Error]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Schedule Modal for a Debt
  const openScheduleModal = async (debt) => {
    setActiveScheduleDebt(debt);
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/debts/${debt.id}/schedule`, {
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveScheduleList(Array.isArray(data.schedule) ? data.schedule : []);
        setShowScheduleModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle Schedule Item Paid
  const handleToggleScheduleItem = async (scheduleId) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const res = await fetch(`${baseUrl}/api/debts/schedule/${scheduleId}/toggle-paid`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });

      if (res.ok) {
        if (activeScheduleDebt) {
          openScheduleModal(activeScheduleDebt);
        }
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Save Debt (Create / Edit)
  const handleSaveDebt = async (e) => {
    e.preventDefault();
    if (!debtForm.creditor.trim()) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const isEdit = Boolean(editingDebt);
      const url = isEdit ? `${baseUrl}/api/debts/${editingDebt.id}` : `${baseUrl}/api/debts`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(debtForm)
      });

      if (res.ok) {
        setShowAddDebtModal(false);
        setEditingDebt(null);
        setDebtForm({
          creditor: "",
          total_amount: "",
          monthly_installment: "",
          capital_installment: "",
          interest_installment: "",
          due_day: 10,
          interest_notes: "",
          notes: ""
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
      alert("Błąd zapisu zobowiązania");
    }
  };

  // Toggle monthly debt installment paid & auto-decrement debt balance by capital
  const handleToggleDebtMonthlyPaid = async (debtId) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const res = await fetch(`${baseUrl}/api/debts/${debtId}/toggle-monthly-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        }
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDebt = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to zobowiązanie?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/debts/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Save Payment
  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.creditor || !paymentForm.amount || !paymentForm.due_date) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const res = await fetch(`${baseUrl}/api/debts/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(paymentForm)
      });

      if (res.ok) {
        setShowAddPaymentModal(false);
        setPaymentForm({ debt_id: "", creditor: "", amount: "", capital_amount: "", interest_amount: "", due_date: new Date().toISOString().split('T')[0], notes: "" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePaymentPaid = async (paymentId, currentStatus) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const res = await fetch(`${baseUrl}/api/debts/payments/${paymentId}/toggle-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify({ is_paid: !currentStatus })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save Fixed Expense (Create / Edit)
  const handleSaveFixed = async (e) => {
    e.preventDefault();
    if (!fixedForm.name || !fixedForm.amount) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const isEdit = Boolean(editingFixed);
      const url = isEdit ? `${baseUrl}/api/debts/fixed-expenses/${editingFixed.id}` : `${baseUrl}/api/debts/fixed-expenses`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(fixedForm)
      });

      if (res.ok) {
        setShowAddFixedModal(false);
        setEditingFixed(null);
        setFixedForm({ name: "", amount: "", due_day: 10, category: "Stałe", notes: "" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditFixedModal = (fixed) => {
    setEditingFixed(fixed);
    setFixedForm({
      name: fixed.name,
      amount: fixed.amount,
      due_day: fixed.due_day || 10,
      category: fixed.category || "Stałe",
      notes: fixed.notes || ""
    });
    setShowAddFixedModal(true);
  };

  const handleDeleteFixed = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę płatność stałą?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/debts/fixed-expenses/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Fixed Income Handlers (Stałe Wpływy)
  const handleSaveFixedIncome = async (e) => {
    e.preventDefault();
    if (!fixedIncomeForm.name || !fixedIncomeForm.amount) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const isEdit = Boolean(editingFixedIncome);
      const url = isEdit ? `${baseUrl}/api/debts/fixed-incomes/${editingFixedIncome.id}` : `${baseUrl}/api/debts/fixed-incomes`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(fixedIncomeForm)
      });

      if (res.ok) {
        setShowAddFixedIncomeModal(false);
        setEditingFixedIncome(null);
        setFixedIncomeForm({ name: "", amount: "", due_day: 1, category: "Stały przychód", notes: "" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditFixedIncomeModal = (inc) => {
    setEditingFixedIncome(inc);
    setFixedIncomeForm({
      name: inc.name,
      amount: inc.amount,
      due_day: inc.due_day || 1,
      category: inc.category || "Stały przychód",
      notes: inc.notes || ""
    });
    setShowAddFixedIncomeModal(true);
  };

  const handleDeleteFixedIncome = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten wpływ stały?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/debts/fixed-incomes/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Save Pending Bill (Create / Edit)
  const handleSavePending = async (e) => {
    e.preventDefault();
    if (!pendingForm.title || !pendingForm.amount || !pendingForm.due_date) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const isEdit = Boolean(editingPending);
      const url = isEdit ? `${baseUrl}/api/debts/pending-bills/${editingPending.id}` : `${baseUrl}/api/debts/pending-bills`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(pendingForm)
      });

      if (res.ok) {
        setShowAddPendingModal(false);
        setEditingPending(null);
        setPendingForm({ title: "", amount: "", due_date: new Date().toISOString().split('T')[0], invoice_number: "", category: "Faktura/Rachunek", notes: "" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditPendingModal = (bill) => {
    setEditingPending(bill);
    setPendingForm({
      title: bill.title,
      amount: bill.amount,
      due_date: bill.due_date,
      invoice_number: bill.invoice_number || "",
      category: bill.category || "Faktura/Rachunek",
      notes: bill.notes || ""
    });
    setShowAddPendingModal(true);
  };

  const handleTogglePendingPaid = async (billId, currentStatus) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const res = await fetch(`${baseUrl}/api/debts/pending-bills/${billId}/toggle-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify({ is_paid: !currentStatus })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleFixedPaid = async (fixedId, currentStatus) => {
    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

      const res = await fetch(`${baseUrl}/api/debts/fixed-expenses/${fixedId}/toggle-paid`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify({ is_paid: !currentStatus })
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePending = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten rachunek z listy?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/debts/pending-bills/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Save Snapshot (Create / Edit)
  const handleSaveSnapshot = async (e) => {
    e.preventDefault();
    if (!snapshotForm.snapshot_date || !snapshotForm.total_debt) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const isEdit = Boolean(editingSnapshot);
      const url = isEdit ? `${baseUrl}/api/debts/snapshots/${editingSnapshot.id}` : `${baseUrl}/api/debts/snapshots`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authData?.token}`
        },
        body: JSON.stringify(snapshotForm)
      });

      if (res.ok) {
        setShowAddSnapshotModal(false);
        setEditingSnapshot(null);
        setSnapshotForm({ snapshot_date: new Date().toISOString().split('T')[0], total_debt: "", notes: "" });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const openEditSnapshotModal = (snap) => {
    setEditingSnapshot(snap);
    setSnapshotForm({
      snapshot_date: snap.snapshot_date,
      total_debt: snap.total_debt,
      notes: snap.notes || ""
    });
    setShowAddSnapshotModal(true);
  };

  const handleDeleteSnapshot = async (id) => {
    if (!window.confirm("Czy na pewno chcesz usunąć ten punkt z wykresu?")) return;

    try {
      const authData = JSON.parse(localStorage.getItem("auth"));
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      await fetch(`${baseUrl}/api/debts/snapshots/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${authData?.token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };



  const openEditModal = (debt) => {
    setEditingDebt(debt);
    setDebtForm({
      creditor: debt.creditor,
      total_amount: debt.total_amount,
      monthly_installment: debt.monthly_installment,
      capital_installment: debt.capital_installment || "",
      interest_installment: debt.interest_installment || "",
      due_day: debt.due_day || "",
      interest_notes: debt.interest_notes || "",
      notes: debt.notes || ""
    });
    setShowAddDebtModal(true);
  };

  const formatPLN = (amount) => {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(amount || 0);
  };

  const grandTotalMonthly = useMemo(() => {
    return Number(summary.total_installments || 0) + Number(totalFixedMonthly || 0);
  }, [summary.total_installments, totalFixedMonthly]);

  const currentMonthEndStr = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStr = String(month + 1).padStart(2, '0');
    return `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  }, []);

  const monthlySummary = useMemo(() => {
    // 1. Unpaid installments for debts (is_paid_this_month === false)
    const unpaidDebts = debts.filter(d => !d.is_paid_this_month);
    const paidDebts = debts.filter(d => d.is_paid_this_month);

    const unpaidInstallmentsTotal = unpaidDebts.reduce((sum, d) => sum + Number(d.monthly_installment || 0), 0);
    const paidInstallmentsTotal = paidDebts.reduce((sum, d) => sum + Number(d.monthly_installment || 0), 0);

    // 2. Unpaid pending bills DUE IN CURRENT MONTH OR OVERDUE (due_date <= currentMonthEndStr)
    const unpaidBillsThisMonth = pendingBills.filter(b => !b.is_paid && b.due_date <= currentMonthEndStr);
    const paidBillsThisMonth = pendingBills.filter(b => b.is_paid && b.due_date <= currentMonthEndStr);

    // Future pending bills (due after current month end, e.g. September)
    const futurePendingBills = pendingBills.filter(b => !b.is_paid && b.due_date > currentMonthEndStr);

    const unpaidBillsTotalSum = unpaidBillsThisMonth.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const paidBillsTotalSum = paidBillsThisMonth.reduce((sum, b) => sum + Number(b.amount || 0), 0);
    const futureBillsTotalSum = futurePendingBills.reduce((sum, b) => sum + Number(b.amount || 0), 0);

    // 3. Active fixed expenses (split by paid/unpaid status)
    const activeFixed = fixedExpenses.filter(f => f.is_active !== false);
    const unpaidFixed = activeFixed.filter(f => !f.is_paid_this_month);
    const paidFixed = activeFixed.filter(f => f.is_paid_this_month);

    const fixedExpensesTotal = unpaidFixed.reduce((sum, f) => sum + Number(f.amount || 0), 0);
    const paidFixedTotal = paidFixed.reduce((sum, f) => sum + Number(f.amount || 0), 0);

    // Grand total remaining to pay in CURRENT MONTH
    const totalRemainingToPay = unpaidInstallmentsTotal + unpaidBillsTotalSum + fixedExpensesTotal;

    return {
      unpaidInstallmentsTotal,
      paidInstallmentsTotal,
      unpaidDebtsCount: unpaidDebts.length,
      paidDebtsCount: paidDebts.length,
      unpaidBillsTotalSum,
      paidBillsTotalSum,
      unpaidBillsCount: unpaidBillsThisMonth.length,
      futureBillsTotalSum,
      futureBillsCount: futurePendingBills.length,
      fixedExpensesTotal,
      paidFixedTotal,
      totalRemainingToPay
    };
  }, [debts, pendingBills, fixedExpenses, currentMonthEndStr]);

  // SVG Chart Calculation
  const chartData = useMemo(() => {
    if (snapshots.length < 2) return null;
    const sorted = [...snapshots].sort((a, b) => new Date(a.snapshot_date) - new Date(b.snapshot_date));
    const values = sorted.map(s => Number(s.total_debt));
    const minVal = Math.min(...values) * 0.95;
    const maxVal = Math.max(...values) * 1.05;

    const width = 800;
    const height = 220;
    const padding = 35;

    const points = sorted.map((s, index) => {
      const x = padding + (index / (sorted.length - 1)) * (width - padding * 2);
      const y = height - padding - ((Number(s.total_debt) - minVal) / (maxVal - minVal)) * (height - padding * 2);
      return { x, y, date: s.snapshot_date, val: Number(s.total_debt) };
    });

    const pathD = points.reduce((acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { points, pathD, areaD, width, height, padding };
  }, [snapshots]);

  return (
    <div className="debts-container">
      {/* Top Title & Actions Bar */}
      <div className="debts-top-bar">
        <div className="debts-title-group">
          <h2>Finanse i Zobowiązania</h2>
          <p>Ewidencja łącznego długu, harmonogramu spłat, opłat stałych i faktur</p>
        </div>
        <div className="debts-actions-group">
          <button className="btn btn-primary btn-sm" onClick={() => {
            setEditingDebt(null);
            setDebtForm({ creditor: "", total_amount: "", monthly_installment: "", capital_installment: "", interest_installment: "", due_day: 10, interest_notes: "", notes: "" });
            setShowAddDebtModal(true);
          }}>
            + Zobowiązanie
          </button>
          <button className="btn btn-secondary-outline btn-sm" onClick={() => {
            setEditingFixedIncome(null);
            setFixedIncomeForm({ name: "", amount: "", due_day: 1, category: "Stały przychód", notes: "" });
            setShowAddFixedIncomeModal(true);
          }}>
            + Stały Wpływ
          </button>
          <button className="btn btn-secondary-outline btn-sm" onClick={() => {
            setEditingFixed(null);
            setFixedForm({ name: "", amount: "", due_day: 10, category: "Stałe", notes: "" });
            setShowAddFixedModal(true);
          }}>
            + Opłata Stała
          </button>
          <button className="btn btn-secondary-outline btn-sm" onClick={() => {
            setEditingPending(null);
            setPendingForm({ title: "", amount: "", due_date: new Date().toISOString().split('T')[0], invoice_number: "", category: "Faktura/Rachunek", notes: "" });
            setShowAddPendingModal(true);
          }}>
            + Do Zapłaty
          </button>
        </div>
      </div>

      {/* 4 Financial KPI Stat Cards */}
      <div className="financial-kpi-grid">
        <div className="kpi-card danger">
          <span className="kpi-label">Pozostało do zapłaty w tym miesiącu</span>
          <div className="kpi-value danger">
            {formatPLN(monthlySummary.totalRemainingToPay)}
          </div>
          <span className="kpi-subtext">
            Niezapłacone raty (<strong>{formatPLN(monthlySummary.unpaidInstallmentsTotal)}</strong>) + Stałe (<strong>{formatPLN(monthlySummary.fixedExpensesTotal)}</strong>)
            {monthlySummary.unpaidBillsTotalSum > 0 && (
              <> + Rachunki ({formatPLN(monthlySummary.unpaidBillsTotalSum)})</>
            )}
            {monthlySummary.futureBillsTotalSum > 0 && (
              <div style={{ marginTop: '4px', fontSize: '0.74rem', color: '#64748b' }}>
                Faktury z przyszłych miesięcy: <strong>{formatPLN(monthlySummary.futureBillsTotalSum)}</strong>
              </div>
            )}
          </span>
        </div>

        <div className="kpi-card success">
          <span className="kpi-label">Opłacone w tym miesiącu</span>
          <div className="kpi-value success">
            {formatPLN(monthlySummary.paidInstallmentsTotal + monthlySummary.paidBillsTotalSum + (monthlySummary.paidFixedTotal || 0))}
          </div>
          <span className="kpi-subtext">
            Opłacone raty i opłaty: <strong>{monthlySummary.paidDebtsCount} z {debts.length} rat</strong>
          </span>
        </div>

        <div className="kpi-card primary">
          <span className="kpi-label">Łączne obciążenie miesięczne</span>
          <div className="kpi-value primary">
            {formatPLN(grandTotalMonthly)}
          </div>
          <span className="kpi-subtext">
            Suma rat (<strong>{formatPLN(summary.total_installments)}</strong>) + Stałe (<strong>{formatPLN(totalFixedMonthly)}</strong>)
          </span>
        </div>

        <div className="kpi-card warning">
          <span className="kpi-label">Pozostały dług całkowity</span>
          <div className="kpi-value warning">
            {formatPLN(summary.total_debt)}
          </div>
          <span className="kpi-subtext">
            Wpisy wierzycieli: <strong>{debts.length}</strong>
          </span>
        </div>
      </div>

      {/* Segmented Pill Navigation */}
      <div className="segmented-nav-bar">
        <button
          className={`segmented-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Przegląd
        </button>
        <button
          className={`segmented-tab ${activeTab === 'debts' ? 'active' : ''}`}
          onClick={() => setActiveTab('debts')}
        >
          Długi i raty <span className="badge-count">{debts.length}</span>
        </button>
        <button
          className={`segmented-tab ${activeTab === 'fixed_incomes' ? 'active' : ''}`}
          onClick={() => setActiveTab('fixed_incomes')}
        >
          Stałe wpływy <span className="badge-count" style={{ background: '#10b981', color: '#fff' }}>{fixedIncomes.length}</span>
        </button>
        <button
          className={`segmented-tab ${activeTab === 'fixed_bills' ? 'active' : ''}`}
          onClick={() => setActiveTab('fixed_bills')}
        >
          Opłaty stałe <span className="badge-count">{fixedExpenses.length}</span>
        </button>
        <button
          className={`segmented-tab ${activeTab === 'pending_bills' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending_bills')}
        >
          Do zapłaty <span className="badge-count">{pendingBills.filter(b => !b.is_paid).length}</span>
        </button>
      </div>

      {/* VIEW 1: OVERVIEW WITH GRAPH & SPACIOUS FULL-WIDTH CARDS */}
      {activeTab === 'overview' && (
        <>
          {/* Row 1: Trend Chart */}
          <div className="minimal-chart-card">
            <div className="card-collapsible-header" onClick={() => toggleSection('chart')}>
              <div className="header-top-row">
                <h3 className="card-title">Wykres spadku długu</h3>
                <span className="collapse-pill">{collapsedSections.chart ? '▶ Rozwiń' : '▼ Zwiń'}</span>
              </div>
              <div className="header-bottom-actions" onClick={e => e.stopPropagation()}>
                <button className="btn-small" onClick={() => setShowManageSnapshotsModal(true)}>Zarządzaj punktami</button>
                <button className="btn-small primary" onClick={() => {
                  setEditingSnapshot(null);
                  setSnapshotForm({ snapshot_date: new Date().toISOString().split('T')[0], total_debt: "", notes: "" });
                  setShowAddSnapshotModal(true);
                }}>+ Zapisz Stan Na</button>
              </div>
            </div>

            {!collapsedSections.chart && (
              chartData ? (
                <div className="svg-chart-wrapper">
                  <svg viewBox={`0 0 ${chartData.width} ${chartData.height}`} className="debt-svg-chart">
                    <defs>
                      <linearGradient id="minimalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    <line x1={chartData.padding} y1={chartData.height - chartData.padding} x2={chartData.width - chartData.padding} y2={chartData.height - chartData.padding} stroke="var(--border-color)" />
                    <line x1={chartData.padding} y1={chartData.padding} x2={chartData.width - chartData.padding} y2={chartData.padding} stroke="var(--border-color)" strokeDasharray="4 4" opacity="0.3" />

                    <path d={chartData.areaD} fill="url(#minimalGrad)" />
                    <path d={chartData.pathD} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />

                    {chartData.points.map((p, idx) => (
                      <g key={idx} className="chart-point-group">
                        <circle cx={p.x} cy={p.y} r="4.5" fill="#6366f1" stroke="var(--bg-card)" strokeWidth="2" />
                        <text x={p.x} y={p.y - 10} textAnchor="middle" fill="var(--text-main)" fontSize="11" fontWeight="700">
                          {Math.round(p.val).toLocaleString('pl-PL')} zł
                        </text>
                        <text x={p.x} y={chartData.height - 10} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
                          {p.date.slice(5)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="chart-empty-state">
                  Dodaj punkty w czasie, aby utworzyć wykres spadku długu.
                </div>
              )
            )}
          </div>

          {/* Row 2: 2 Equal Columns (Terminarz & Zestawienie Rat) */}
          <div className="minimal-grid-2">
            {/* Column 1: Payment Checklist (Current Month Only) */}
            <div className="minimal-card">
              <div className="card-collapsible-header" onClick={() => toggleSection('schedule')}>
                <div className="header-top-row">
                  <h4 className="card-title">Terminarz spłat rat (sierpień 2026)</h4>
                  <span className="collapse-pill">{collapsedSections.schedule ? '▶ Rozwiń' : '▼ Zwiń'}</span>
                </div>
                <div className="header-bottom-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-small" onClick={() => setShowAddPaymentModal(true)}>+ Rata</button>
                </div>
              </div>

              {!collapsedSections.schedule && (
                <div className="checklist">
                  {payments.filter(p => p.due_date && p.due_date.startsWith(new Date().toISOString().slice(0, 7))).length === 0 ? (
                    <div className="chart-empty-state">Brak wpisanych terminów rat na ten miesiąc</div>
                  ) : (
                    [...payments.filter(p => p.due_date && p.due_date.startsWith(new Date().toISOString().slice(0, 7)))]
                      .sort((a, b) => {
                        if (a.is_paid !== b.is_paid) return a.is_paid ? 1 : -1;
                        return new Date(a.due_date) - new Date(b.due_date);
                      })
                      .map(p => (
                        <div key={p.id} className={`check-item ${p.is_paid ? 'is-done' : ''}`}>
                          <input
                            type="checkbox"
                            checked={p.is_paid}
                            onChange={() => handleTogglePaymentPaid(p.id, p.is_paid)}
                            className="custom-checkbox"
                          />
                          <div className="check-body">
                            <div className="check-title-row">
                              <span className="check-title">{p.creditor}</span>
                              <span className="check-amount">{formatPLN(p.amount)}</span>
                            </div>
                            <div className="check-sub">
                              Termin: {p.due_date} {p.interest_amount > 0 && `• Odsetki: ${formatPLN(p.interest_amount)}`}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Column 2: Installments Breakdown */}
            <div className="minimal-card">
              <div className="card-collapsible-header" onClick={() => toggleSection('installmentsBreakdown')}>
                <div className="header-top-row">
                  <h4 className="card-title">Zestawienie rat miesięcznych</h4>
                  <span className="collapse-pill">{collapsedSections.installmentsBreakdown ? '▶ Rozwiń' : '▼ Zwiń'}</span>
                </div>
                <div className="header-bottom-actions" onClick={e => e.stopPropagation()}>
                  <span className="badge-tag">Suma rat: {formatPLN(summary.total_installments)}</span>
                </div>
              </div>

              {!collapsedSections.installmentsBreakdown && (
                <div className="installments-breakdown-list">
                  {debts.filter(d => Number(d.monthly_installment) > 0).length === 0 ? (
                    <div className="chart-empty-state">Brak zdefiniowanych rat miesięcznych</div>
                  ) : (
                    debts.filter(d => Number(d.monthly_installment) > 0).map(d => (
                      <div key={d.id} className="inst-row">
                        <div>
                          <span className="inst-name">{d.creditor}</span>
                          <div className="check-sub">Do {d.due_day || 10} dnia miesiąca</div>
                        </div>
                        <strong className="inst-val">{formatPLN(d.monthly_installment)}</strong>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: SPACIOUS FULL-WIDTH MAIN TABLE */}
          <div className="minimal-card full-width">
            <div className="card-collapsible-header" onClick={() => toggleSection('debtsTable')}>
              <div className="header-top-row">
                <h4 className="card-title">Wykaz zobowiązań</h4>
                <span className="collapse-pill">{collapsedSections.debtsTable ? '▶ Rozwiń' : '▼ Zwiń'}</span>
              </div>
              <div className="header-bottom-actions" onClick={e => e.stopPropagation()}>
                <span className="badge-tag">Łączny kapitał: {formatPLN(summary.total_debt)}</span>
              </div>
            </div>

            {!collapsedSections.debtsTable && (
              <div className="table-responsive schedule-table-container">
                <table className="minimal-table responsive-cards">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: 40 }}>Spłacono</th>
                      <th>Wierzyciel / Bank</th>
                      <th className="text-center">Termin w Miesiącu</th>
                      <th className="text-right">Kapitał Długu</th>
                      <th className="text-right">Rata Miesięczna</th>
                      <th className="text-center" style={{ width: 80 }}>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.length === 0 ? (
                      <tr><td colSpan="6" className="text-center">Brak zapisanych zobowiązań.</td></tr>
                    ) : (
                      debts.map(d => (
                        <tr key={d.id} className={d.is_paid_this_month ? 'is-done' : ''}>
                          <td data-label="Spłacono" className="text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(d.is_paid_this_month)}
                              onChange={() => handleToggleDebtMonthlyPaid(d.id)}
                              className="custom-checkbox"
                              title="Zaznacz, aby odejmować kapitał od długu i zaktualizować wykres"
                            />
                          </td>
                          <td data-label="Wierzyciel">
                            <div className="col-bold">{d.creditor}</div>
                            {d.interest_notes && <div className="check-sub">{d.interest_notes}</div>}
                          </td>
                          <td data-label="Termin" className="text-center">
                            {d.due_day ? `Do ${d.due_day}. dnia` : <span className="check-sub" style={{ fontStyle: 'italic', opacity: 0.7 }}>Brak terminu</span>}
                          </td>
                          <td data-label="Kapitał" className="text-right col-amount">{formatPLN(d.total_amount)}</td>
                          <td data-label="Rata" className="text-right">
                            {Number(d.monthly_installment) > 0 ? (
                              <>
                                <div className="col-bold">{formatPLN(d.monthly_installment)}</div>
                                {(Number(d.capital_installment) > 0 || Number(d.interest_installment) > 0) && (
                                  <div className="check-sub">
                                    K: {formatPLN(d.capital_installment)} | O: {formatPLN(d.interest_installment)}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="check-sub" style={{ fontStyle: 'italic', opacity: 0.7 }}>Brak raty</span>
                            )}
                          </td>
                          <td data-label="Akcje" className="text-center">
                            <div className="actions-cell-inline">
                              <button className="btn-icon" onClick={() => openEditModal(d)} title="Edytuj">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                              </button>
                              <button className="btn-icon delete" onClick={() => handleDeleteDebt(d.id)} title="Usuń">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW 2: DEBTS LIST */}
      {activeTab === 'debts' && (
        <div className="minimal-card full-width">
          <div className="minimal-card-header">
            <h4>Wykaz zobowiązań i kredytów</h4>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setEditingDebt(null);
              setDebtForm({ creditor: "", total_amount: "", monthly_installment: "", capital_installment: "", interest_installment: "", due_day: 10, interest_notes: "", notes: "" });
              setShowAddDebtModal(true);
            }}>+ Dodaj Zobowiązanie</button>
          </div>

          <div className="table-responsive schedule-table-container">
            <table className="minimal-table responsive-cards">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: 40 }}>Rata Opłacona</th>
                  <th>Wierzyciel / Nazwa</th>
                  <th>Dzień Płatności</th>
                  <th className="text-right">Rata Miesięczna (Kapitał + Odsetki)</th>
                  <th className="text-right">Pozostały Kapitał Długu</th>
                  <th className="text-center">Harmonogram Spłat</th>
                  <th className="text-center" style={{ width: 80 }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {debts.length === 0 ? (
                  <tr><td colSpan="7" className="text-center">Brak zobowiązań.</td></tr>
                ) : (
                  debts.map(d => (
                    <tr key={d.id} className={d.is_paid_this_month ? 'is-done' : ''}>
                      <td data-label="Opłacono" className="text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(d.is_paid_this_month)}
                          onChange={() => handleToggleDebtMonthlyPaid(d.id)}
                          className="custom-checkbox"
                          title="Kliknięcie odejmuje ratę kapitałową od długu"
                        />
                      </td>
                      <td data-label="Wierzyciel">
                        <div className="col-bold">{d.creditor}</div>
                        {d.interest_notes && <div className="check-sub">{d.interest_notes}</div>}
                      </td>
                      <td data-label="Termin">
                        {d.due_day ? `Do ${d.due_day}. dnia` : <span className="check-sub" style={{ fontStyle: 'italic', opacity: 0.7 }}>Brak terminu</span>}
                      </td>
                      <td data-label="Rata" className="text-right">
                        <div className="col-bold">{formatPLN(d.monthly_installment)}</div>
                        <div className="check-sub">
                          Kapitał: {formatPLN(d.capital_installment)} • Odsetki: {formatPLN(d.interest_installment)}
                        </div>
                      </td>
                      <td data-label="Kapitał" className="text-right col-amount">{formatPLN(d.total_amount)}</td>
                      <td data-label="Harmonogram" className="text-center">
                        {Number(d.total_schedule_count) > 0 ? (
                          <button className="btn-small" onClick={() => {
                            setScheduleFilter("unpaid");
                            openScheduleModal(d);
                          }}>
                            Harmonogram ({d.unpaid_schedule_count} rat pozostało)
                          </button>
                        ) : (
                          <span className="check-sub">-</span>
                        )}
                      </td>
                      <td data-label="Akcje" className="text-center">
                        <div className="actions-cell-inline">
                          <button className="btn-icon" onClick={() => openEditModal(d)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDeleteDebt(d.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: FIXED EXPENSES */}
      {activeTab === 'fixed_bills' && (
        <div className="minimal-card full-width">
          <div className="minimal-card-header">
            <h4>Stałe płatności miesięczne</h4>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setEditingFixed(null);
              setFixedForm({ name: "", amount: "", due_day: 10, category: "Stałe", notes: "" });
              setShowAddFixedModal(true);
            }}>+ Dodaj Płatność Stałą</button>
          </div>

          <div className="table-responsive schedule-table-container">
            <table className="minimal-table responsive-cards">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: 40 }}>Spłacono</th>
                  <th>Nazwa Usługi</th>
                  <th>Kategoria</th>
                  <th className="text-center">Termin w Miesiącu</th>
                  <th className="text-right">Kwota Miesięczna</th>
                  <th className="text-center" style={{ width: 80 }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {fixedExpenses.length === 0 ? (
                  <tr><td colSpan="6" className="text-center">Brak płatności stałych.</td></tr>
                ) : (
                  fixedExpenses.map(f => (
                    <tr key={f.id} className={f.is_paid_this_month ? 'is-done' : ''}>
                      <td data-label="Spłacono" className="text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(f.is_paid_this_month)}
                          onChange={() => handleToggleFixedPaid(f.id, f.is_paid_this_month)}
                          className="custom-checkbox"
                          title="Zaznacz jako opłacone w tym miesiącu"
                        />
                      </td>
                      <td data-label="Usługa" className="col-bold">{f.name}</td>
                      <td data-label="Kategoria"><span className="badge-tag">{f.category || 'Stałe'}</span></td>
                      <td data-label="Termin" className="text-center">Do {f.due_day} dnia miesiąca</td>
                      <td data-label="Kwota" className={`text-right col-bold ${f.is_paid_this_month ? 'paid' : ''}`} style={{ color: f.is_paid_this_month ? '#10b981' : '#6366f1' }}>
                        {formatPLN(f.amount)}
                      </td>
                      <td data-label="Akcje" className="text-center">
                        <div className="actions-cell-inline">
                          <button className="btn-icon" onClick={() => openEditFixedModal(f)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDeleteFixed(f.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3B: FIXED INCOMES (STAŁE WPŁYWY / PRZYCHODY) */}
      {activeTab === 'fixed_incomes' && (
        <div className="minimal-card full-width">
          <div className="minimal-card-header">
            <div>
              <h4>Stałe Miesięczne Wpływy (Przychody)</h4>
              <span className="check-sub">
                Łączne stałe wpływy: <strong style={{ color: '#10b981', fontSize: '1.05rem' }}>{formatPLN(totalFixedIncomeMonthly)}</strong> / miesiąc
              </span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setEditingFixedIncome(null);
              setFixedIncomeForm({ name: "", amount: "", due_day: 1, category: "Stały przychód", notes: "" });
              setShowAddFixedIncomeModal(true);
            }}>+ Dodaj Stały Wpływ</button>
          </div>

          <div className="table-responsive schedule-table-container">
            <table className="minimal-table responsive-cards">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: 40 }}>Lp.</th>
                  <th>Nazwa / Źródło Wpływu</th>
                  <th>Kategoria</th>
                  <th className="text-center">Dzień Miesiąca</th>
                  <th className="text-right">Kwota Wpływu (zł)</th>
                  <th className="text-center" style={{ width: 80 }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {fixedIncomes.length === 0 ? (
                  <tr><td colSpan="6" className="text-center">Brak dodanych stałych wpływów. Kliknij "+ Dodaj Stały Wpływ" aby wpisać swoje 3 stałe przychody.</td></tr>
                ) : (
                  fixedIncomes.map((inc, index) => (
                    <tr key={inc.id}>
                      <td data-label="Lp." className="text-center col-bold">#{index + 1}</td>
                      <td data-label="Źródło" className="col-bold">{inc.name}</td>
                      <td data-label="Kategoria"><span className="badge-tag" style={{ background: '#ecfdf5', color: '#047857' }}>{inc.category || 'Stały przychód'}</span></td>
                      <td data-label="Termin" className="text-center">Około {inc.due_day}. dnia miesiąca</td>
                      <td data-label="Kwota" className="text-right col-bold" style={{ color: '#10b981' }}>
                        {formatPLN(inc.amount)}
                      </td>
                      <td data-label="Akcje" className="text-center">
                        <div className="actions-cell-inline">
                          <button className="btn-icon" onClick={() => openEditFixedIncomeModal(inc)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDeleteFixedIncome(inc.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeTab === 'pending_bills' && (
        <div className="minimal-card full-width">
          <div className="minimal-card-header">
            <h4>Rachunki i faktury do zapłaty</h4>
            <button className="btn btn-primary btn-sm" onClick={() => {
              setEditingPending(null);
              setPendingForm({ title: "", amount: "", due_date: new Date().toISOString().split('T')[0], invoice_number: "", category: "Faktura/Rachunek", notes: "" });
              setShowAddPendingModal(true);
            }}>+ Dodaj Rachunek</button>
          </div>

          <div className="table-responsive schedule-table-container">
            <table className="minimal-table responsive-cards">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: 40 }}>Status</th>
                  <th>Tytuł Rachunku</th>
                  <th>Nr Faktury</th>
                  <th className="text-center">Termin Płatności</th>
                  <th className="text-right">Kwota</th>
                  <th className="text-center" style={{ width: 80 }}>Akcje</th>
                </tr>
              </thead>
              <tbody>
                {pendingBills.length === 0 ? (
                  <tr><td colSpan="6" className="text-center">Brak wpisanych rachunków.</td></tr>
                ) : (
                  pendingBills.map(b => (
                    <tr key={b.id} className={b.is_paid ? 'is-done' : ''}>
                      <td data-label="Status" className="text-center">
                        <input
                          type="checkbox"
                          checked={b.is_paid}
                          onChange={() => handleTogglePendingPaid(b.id, b.is_paid)}
                          className="custom-checkbox"
                        />
                      </td>
                      <td data-label="Tytuł" className="col-bold">{b.title}</td>
                      <td data-label="Faktura">{b.invoice_number || '-'}</td>
                      <td data-label="Termin" className="text-center">{b.due_date}</td>
                      <td data-label="Kwota" className={`text-right col-amount ${b.is_paid ? 'paid' : 'danger'}`}>
                        {formatPLN(b.amount)}
                      </td>
                      <td data-label="Akcje" className="text-center">
                        <div className="actions-cell-inline">
                          <button className="btn-icon" onClick={() => openEditPendingModal(b)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                          </button>
                          <button className="btn-icon delete" onClick={() => handleDeletePending(b.id)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE GRAPH SNAPSHOTS */}
      {showManageSnapshotsModal && (
        <div className="debt-modal-overlay" onClick={() => setShowManageSnapshotsModal(false)}>
          <div className="debt-modal-box schedule-modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header-flex">
              <div>
                <h3>Zarządzanie punktami wykresu (Stan na)</h3>
                <span className="check-sub">Poprawiaj daty i kwoty historycznych punktów zadłużenia</span>
              </div>
              <button className="btn-icon" onClick={() => setShowManageSnapshotsModal(false)}>✕</button>
            </div>

            <div className="table-responsive schedule-table-container">
              <table className="minimal-table">
                <thead>
                  <tr>
                    <th className="text-center">Data Stanu Na</th>
                    <th className="text-right">Łączny Dług (zł)</th>
                    <th>Uwagi / Opis</th>
                    <th className="text-center" style={{ width: 80 }}>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.length === 0 ? (
                    <tr><td colSpan="4" className="text-center">Brak zapisanych punktów w czasie.</td></tr>
                  ) : (
                    [...snapshots].sort((a, b) => new Date(b.snapshot_date) - new Date(a.snapshot_date)).map(s => (
                      <tr key={s.id}>
                        <td className="text-center col-bold">{s.snapshot_date}</td>
                        <td className="text-right col-amount">{formatPLN(s.total_debt)}</td>
                        <td>{s.notes || '-'}</td>
                        <td className="text-center">
                          <div className="actions-cell-inline">
                            <button className="btn-icon" onClick={() => {
                              setShowManageSnapshotsModal(false);
                              openEditSnapshotModal(s);
                            }} title="Edytuj kwotę / datę">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button className="btn-icon delete" onClick={() => handleDeleteSnapshot(s.id)} title="Usuń punkt z wykresu">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowManageSnapshotsModal(false)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOAN REPAYMENT SCHEDULE MODAL */}
      {showScheduleModal && activeScheduleDebt && (
        <div className="debt-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="debt-modal-box schedule-modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header-flex" style={{ flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3>Harmonogram spłat — {activeScheduleDebt.creditor}</h3>
                <span className="check-sub">
                  Postęp spłaty: <strong>{activeScheduleList.filter(s => s.is_paid).length} z {activeScheduleList.length} rat opłaconych</strong> (pozostało: <strong>{activeScheduleList.filter(s => !s.is_paid).length} rat</strong>)
                </span>
              </div>
              <div className="segmented-nav-bar" style={{ margin: 0, padding: '4px' }}>
                <button
                  className={`segmented-tab ${scheduleFilter === 'unpaid' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('unpaid')}
                >
                  Pozostałe raty ({activeScheduleList.filter(s => !s.is_paid).length})
                </button>
                <button
                  className={`segmented-tab ${scheduleFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setScheduleFilter('all')}
                >
                  Wszystkie raty ({activeScheduleList.length})
                </button>
              </div>
              <button className="btn-icon" onClick={() => setShowScheduleModal(false)}>✕</button>
            </div>

            <div className="table-responsive schedule-table-container">
              <table className="minimal-table">
                <thead>
                  <tr>
                    <th className="text-center">Lp.</th>
                    <th className="text-center">Spłacono</th>
                    <th className="text-center">Termin Spłaty</th>
                    <th className="text-right">Rata Kredytu</th>
                    <th className="text-right">Spłata Kapitału</th>
                    <th className="text-right">W tym Odsetki</th>
                    <th className="text-right">Pozostały Dług</th>
                  </tr>
                </thead>
                <tbody>
                  {(scheduleFilter === 'unpaid'
                    ? activeScheduleList.filter(s => !s.is_paid)
                    : activeScheduleList
                  ).map(s => (
                    <tr key={s.id} className={s.is_paid ? 'is-done' : ''}>
                      <td className="text-center col-bold">#{s.installment_number}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={Boolean(s.is_paid)}
                          onChange={() => handleToggleScheduleItem(s.id)}
                          className="custom-checkbox"
                          title="Zaznaczenie odejmuje kapitał i zaktualizuje salda długu"
                        />
                      </td>
                      <td className="text-center">{s.due_date}</td>
                      <td className="text-right col-bold">{formatPLN(s.total_installment)}</td>
                      <td className="text-right" style={{ color: '#10b981', fontWeight: 600 }}>{formatPLN(s.capital_part)}</td>
                      <td className="text-right" style={{ color: '#ef4444' }}>{formatPLN(s.interest_part)}</td>
                      <td className="text-right col-amount">{formatPLN(s.remaining_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Zamknij</button>
            </div>
          </div>
        </div>
      )}

      {/* Debt Modal with Due Day, Capital & Interest split */}
      {showAddDebtModal && (
        <div className="debt-modal-overlay" onClick={() => setShowAddDebtModal(false)}>
          <div className="debt-modal-box" onClick={e => e.stopPropagation()}>
            <h3>{editingDebt ? "Edytuj Zobowiązanie" : "Dodaj Zobowiązanie"}</h3>
            <form onSubmit={handleSaveDebt}>
              <div className="form-group">
                <label>Nazwa Wierzyciela / Banku *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Smartney, Wonga, Mama, PKO BP kredyt"
                  value={debtForm.creditor}
                  onChange={e => setDebtForm({ ...debtForm, creditor: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Łączna Kwota Długu (Kapitał w zł) *</label>
                  <input
                    type="text"
                    required
                    placeholder="np. 15000,00"
                    value={debtForm.total_amount}
                    onChange={e => setDebtForm({ ...debtForm, total_amount: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Dzień Płatności w Miesiącu (opcjonalnie)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="np. 10 lub zostaw puste"
                    value={debtForm.due_day || ''}
                    onChange={e => setDebtForm({ ...debtForm, due_day: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Rata Kapitałowa (odejmowana od długu)</label>
                  <input
                    type="text"
                    placeholder="np. 450,00"
                    value={debtForm.capital_installment}
                    onChange={e => {
                      const cap = e.target.value;
                      const intVal = debtForm.interest_installment;
                      const totalInst = (parseFloat(cap || 0) + parseFloat(intVal || 0)).toFixed(2);
                      setDebtForm({
                        ...debtForm,
                        capital_installment: cap,
                        monthly_installment: totalInst > 0 ? totalInst : debtForm.monthly_installment
                      });
                    }}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Rata Odsetkowa (koszt banku)</label>
                  <input
                    type="text"
                    placeholder="np. 150,00"
                    value={debtForm.interest_installment}
                    onChange={e => {
                      const intVal = e.target.value;
                      const cap = debtForm.capital_installment;
                      const totalInst = (parseFloat(cap || 0) + parseFloat(intVal || 0)).toFixed(2);
                      setDebtForm({
                        ...debtForm,
                        interest_installment: intVal,
                        monthly_installment: totalInst > 0 ? totalInst : debtForm.monthly_installment
                      });
                    }}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Łączna Rata Miesięczna (Kapitał + Odsetki) - wpisz 0 dla długu bez rat</label>
                <input
                  type="text"
                  placeholder="np. 0 lub 600,00"
                  value={debtForm.monthly_installment}
                  onChange={e => setDebtForm({ ...debtForm, monthly_installment: e.target.value })}
                  className="form-input"
                />
                <span className="check-sub" style={{ marginTop: '4px', display: 'block' }}>
                  Dla pożyczek prywatnych, linii limitu lub długów bezratowych wpisz 0. Dług zostanie ujęty w saldzie całkowitym bez dodawania raty do wydatków miesięcznych.
                </span>
              </div>

              <div className="form-group">
                <label>Kwestia Odsetek / Uwagi o Banku</label>
                <input
                  type="text"
                  placeholder="np. Rata zawiera 150 zł odsetek"
                  value={debtForm.interest_notes}
                  onChange={e => setDebtForm({ ...debtForm, interest_notes: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddDebtModal(false)}>Anuluj</button>
                <button type="submit" className="btn btn-primary">Zapisz Zobowiązanie</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fixed Expense Modal */}
      {showAddFixedModal && (
        <div className="debt-modal-overlay" onClick={() => setShowAddFixedModal(false)}>
          <div className="debt-modal-box" onClick={e => e.stopPropagation()}>
            <h3>{editingFixed ? "Edytuj Płatność Stałą" : "Dodaj Płatność Stałą"}</h3>
            <form onSubmit={handleSaveFixed}>
              <div className="form-group">
                <label>Nazwa Płatności / Usługi *</label>
                <input
                  type="text"
                  required
                  placeholder="np. T-Mobile abonament, Księgowość"
                  value={fixedForm.name}
                  onChange={e => setFixedForm({ ...fixedForm, name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Kwota Miesięczna (zł) *</label>
                  <input
                    type="text"
                    required
                    placeholder="np. 120,00"
                    value={fixedForm.amount}
                    onChange={e => setFixedForm({ ...fixedForm, amount: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Dzień Płatności</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="np. 15"
                    value={fixedForm.due_day}
                    onChange={e => setFixedForm({ ...fixedForm, due_day: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddFixedModal(false)}>Anuluj</button>
                <button type="submit" className="btn btn-primary">Zapisz Płatność Stałą</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pending Bill Modal */}
      {showAddPendingModal && (
        <div className="debt-modal-overlay" onClick={() => setShowAddPendingModal(false)}>
          <div className="debt-modal-box" onClick={e => e.stopPropagation()}>
            <h3>{editingPending ? "Edytuj Rachunek / Fakturę" : "Dodaj Rachunek do zapłaty"}</h3>
            <form onSubmit={handleSavePending}>
              <div className="form-group">
                <label>Tytuł / Nazwa Rachunku *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Rozliczenie Księgowej za lipiec"
                  value={pendingForm.title}
                  onChange={e => setPendingForm({ ...pendingForm, title: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Kwota Do Zapłaty (zł) *</label>
                  <input
                    type="text"
                    required
                    placeholder="np. 350,00"
                    value={pendingForm.amount}
                    onChange={e => setPendingForm({ ...pendingForm, amount: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Termin Płatności *</label>
                  <input
                    type="date"
                    required
                    value={pendingForm.due_date}
                    onChange={e => setPendingForm({ ...pendingForm, due_date: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPendingModal(false)}>Anuluj</button>
                <button type="submit" className="btn btn-primary">Zapisz Rachunek</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showAddPaymentModal && (
        <div className="debt-modal-overlay" onClick={() => setShowAddPaymentModal(false)}>
          <div className="debt-modal-box" onClick={e => e.stopPropagation()}>
            <h3>Dodaj Termin Spłaty Raty</h3>
            <form onSubmit={handleSavePayment}>
              <div className="form-group">
                <label>Wierzyciel *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Smartney"
                  value={paymentForm.creditor}
                  onChange={e => setPaymentForm({ ...paymentForm, creditor: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Kwota Rat (zł) *</label>
                  <input
                    type="text"
                    required
                    placeholder="np. 600,00"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Termin Płatności *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.due_date}
                    onChange={e => setPaymentForm({ ...paymentForm, due_date: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPaymentModal(false)}>Anuluj</button>
                <button type="submit" className="btn btn-primary">Dodaj do Terminarza</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Snapshot Modal (Create / Edit) */}
      {showAddSnapshotModal && (
        <div className="debt-modal-overlay" onClick={() => setShowAddSnapshotModal(false)}>
          <div className="debt-modal-box" onClick={e => e.stopPropagation()}>
            <h3>{editingSnapshot ? "Edytuj stan długu" : "Zapisz stan długu"}</h3>
            <form onSubmit={handleSaveSnapshot}>
              <div className="form-group">
                <label>Data Stanu Na *</label>
                <input
                  type="date"
                  required
                  value={snapshotForm.snapshot_date}
                  onChange={e => setSnapshotForm({ ...snapshotForm, snapshot_date: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Łączny Dług na ten Dzień (zł) *</label>
                <input
                  type="text"
                  required
                  placeholder="np. 69087,34"
                  value={snapshotForm.total_debt}
                  onChange={e => setSnapshotForm({ ...snapshotForm, total_debt: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Uwagi / Notatka</label>
                <input
                  type="text"
                  placeholder="np. Spłata z premii / korekta błędu"
                  value={snapshotForm.notes}
                  onChange={e => setSnapshotForm({ ...snapshotForm, notes: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowAddSnapshotModal(false);
                  setEditingSnapshot(null);
                }}>Anuluj</button>
                <button type="submit" className="btn btn-primary">Zapisz Punkt Wykresu</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Fixed Income Modal (Create / Edit) */}
      {showAddFixedIncomeModal && (
        <div className="debt-modal-overlay" onClick={() => setShowAddFixedIncomeModal(false)}>
          <div className="debt-modal-box" onClick={e => e.stopPropagation()}>
            <h3>{editingFixedIncome ? "Edytuj Stały Wpływ" : "Dodaj Stały Wpływ Miesięczny"}</h3>
            <form onSubmit={handleSaveFixedIncome}>
              <div className="form-group">
                <label>Nazwa Wpływu / Źródło Przychodu *</label>
                <input
                  type="text"
                  required
                  placeholder="np. Stałe zlecenie A / Klient X"
                  value={fixedIncomeForm.name}
                  onChange={e => setFixedIncomeForm({ ...fixedIncomeForm, name: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Kwota Miesięczna (zł) *</label>
                  <input
                    type="text"
                    required
                    placeholder="np. 2000,00"
                    value={fixedIncomeForm.amount}
                    onChange={e => setFixedIncomeForm({ ...fixedIncomeForm, amount: e.target.value })}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Orientacyjny Dzień Miesiąca</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="np. 1 lub 10"
                    value={fixedIncomeForm.due_day}
                    onChange={e => setFixedIncomeForm({ ...fixedIncomeForm, due_day: parseInt(e.target.value) || 1 })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Kategoria / Opis</label>
                <input
                  type="text"
                  placeholder="np. Kontrakt stały / Abonament klienta"
                  value={fixedIncomeForm.category}
                  onChange={e => setFixedIncomeForm({ ...fixedIncomeForm, category: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowAddFixedIncomeModal(false);
                  setEditingFixedIncome(null);
                }}>Anuluj</button>
                <button type="submit" className="btn btn-primary">Zapisz Wpływ</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
