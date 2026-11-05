import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scissors, Settings, BarChart3, Database, Plus, Trash2,
  RefreshCw, Download, Upload, ShieldCheck, Printer, CheckCircle2,
  Layers, DollarSign, Calculator, AlertCircle, Pencil, Copy, X,
  Search, Clock, Ban, TrendingUp, Users, Save, FileSpreadsheet, RotateCcw, FileText
} from 'lucide-react';

// ============================================================
// HELPERS
// ============================================================
const fmt = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmtInt = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0);
const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleDateString('fr-FR'); };

const DEFAULT_SETTINGS = {
  tarifBase: 1.50,
  viselineStd: 0.50,
  viselineLourd: 1.00,
  fraisCalage: 25.00,
  seuilCalage: 10,
  prixMinPce: 2.00,
  atelierNom: "Atelier de Broderie Pro",
  devise: "DH",
  tva: 0,
  invoiceSeq: 1
};

const SEED_ORDERS = [
  { id: 1, client: "Ch 51", qty: 265, pts: 3946, vis: "OUI", unitPrice: 6.42, calage: 0, total: 1701.30, date: "2026-10-12" },
  { id: 2, client: "Villa Orangers", qty: 24, pts: 34951, vis: "LOURDE", unitPrice: 53.43, calage: 0, total: 1282.32, date: "2026-10-15" },
  { id: 3, client: "Pickalbatros", qty: 3, pts: 839, vis: "NON", unitPrice: 2.00, calage: 25.00, total: 31.00, date: "2026-10-18" },
  { id: 4, client: "Riad Elisa", qty: 45, pts: 6200, vis: "OUI", unitPrice: 9.80, calage: 0, total: 441.00, date: "2026-10-22" }
];

const STATUTS = {
  EN_ATTENTE: { label: 'En attente', cls: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
  PAYEE:      { label: 'Payée',      cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  ANNULEE:    { label: 'Annulée',    cls: 'bg-rose-500/20 text-rose-300 border border-rose-500/30' }
};
const CYCLE_STATUTS = ['EN_ATTENTE', 'PAYEE', 'ANNULEE'];

const sanitizeOrders = (arr) => arr
  .filter(o => o && o.client)
  .map(o => ({
    id: o.id ?? Date.now() + Math.random(),
    client: String(o.client),
    qty: Number(o.qty) || 0,
    pts: Number(o.pts) || 0,
    vis: ['OUI', 'LOURDE', 'NON'].includes(o.vis) ? o.vis : 'NON',
    unitPrice: Number(o.unitPrice) || 0,
    calage: Number(o.calage) || 0,
    total: Number(o.total) || 0,
    date: o.date || new Date().toISOString().split('T')[0],
    status: STATUTS[o.status] ? o.status : 'EN_ATTENTE',
    inv: o.inv || '',
    notes: o.notes || ''
  }));

// Print via a hidden iframe (avoids popup blockers)
function printHtml(html) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { try { document.body.removeChild(iframe); } catch { /* noop */ } }, 1500);
  }, 300);
}

function downloadFile(content, filename, type, charset = 'charset=utf-8;') {
  const blob = new Blob([content], { type: `${type};${charset}` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ============================================================
// UI PRIMITIVES
// ============================================================
function ToastStack({ toasts, onDismiss }) {
  const styles = {
    success: { cls: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-300', icon: <CheckCircle2 className="w-4 h-4 shrink-0" /> },
    error:   { cls: 'border-rose-500/40 bg-rose-950/90 text-rose-300', icon: <AlertCircle className="w-4 h-4 shrink-0" /> },
    info:    { cls: 'border-blue-500/40 bg-blue-950/90 text-blue-300', icon: <AlertCircle className="w-4 h-4 shrink-0" /> }
  };
  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 w-80 max-w-[90vw]">
      {toasts.map(t => {
        const s = styles[t.type] || styles.info;
        return (
          <div key={t.id} className={`flex items-start gap-2 border rounded-xl px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur animate-[slideIn_0.2s_ease-out] ${s.cls}`}>
            {s.icon}
            <span className="flex-1">{t.msg}</span>
            <button onClick={() => onDismiss(t.id)} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
    </div>
  );
}

function ConfirmModal({ state, onCancel }) {
  if (!state) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${state.danger ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400' : 'bg-amber-500/10 border border-amber-500/30 text-amber-400'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white">{state.title}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{state.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition">Annuler</button>
          <button
            onClick={() => { state.onConfirm(); onCancel(); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition ${state.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-500 hover:bg-amber-400 text-slate-950'}`}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // --- Persistence ---
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('broderie_enterprise_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  });

  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('broderie_enterprise_orders');
      if (!saved) return sanitizeOrders(SEED_ORDERS);
      const arr = JSON.parse(saved);
      if (!Array.isArray(arr)) return sanitizeOrders(SEED_ORDERS);
      return sanitizeOrders(arr);
    } catch {
      return sanitizeOrders(SEED_ORDERS);
    }
  });

  useEffect(() => { localStorage.setItem('broderie_enterprise_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('broderie_enterprise_orders', JSON.stringify(orders)); }, [orders]);

  // --- UI state ---
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const toastIdRef = useRef(0);

  const toast = (msg, type = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  // --- Order form state ---
  const [editing, setEditing] = useState(null); // order being edited or null
  const [formClient, setFormClient] = useState('');
  const [formQty, setFormQty] = useState(1);
  const [formPts, setFormPts] = useState(5000);
  const [formVis, setFormVis] = useState('NON');
  const [formNotes, setFormNotes] = useState('');

  // --- Registry filters ---
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const importInputRef = useRef(null);

  // ============================================================
  // PRICING ENGINE
  // ============================================================
  const currentCalculation = useMemo(() => {
    const qty = parseInt(formQty) || 1;
    const pts = parseInt(formPts) || 0;

    let basePrice = (pts / 1000) * settings.tarifBase;
    if (basePrice < settings.prixMinPce) basePrice = settings.prixMinPce;

    let visSupp = 0;
    if (formVis === 'OUI') visSupp = Number(settings.viselineStd) || 0;
    if (formVis === 'LOURDE') visSupp = Number(settings.viselineLourd) || 0;

    const unitPrice = basePrice + visSupp;
    const calageFee = qty <= settings.seuilCalage ? (Number(settings.fraisCalage) || 0) : 0;
    const totalLine = (qty * unitPrice) + calageFee;

    return { qty, pts, basePrice, visSupp, unitPrice, calageFee, totalLine };
  }, [formQty, formPts, formVis, settings]);

  const nextInvoiceNumber = (seq = settings.invoiceSeq) =>
    `FAC-${new Date().getFullYear()}-${String(Number(seq) || 1).padStart(4, '0')}`;

  // ============================================================
  // HANDLERS
  // ============================================================
  const resetForm = () => {
    setEditing(null);
    setFormClient('');
    setFormQty(1);
    setFormPts(5000);
    setFormVis('NON');
    setFormNotes('');
  };

  const loadForEdit = (order) => {
    setEditing(order);
    setFormClient(order.client);
    setFormQty(order.qty);
    setFormPts(order.pts);
    setFormVis(order.vis);
    setFormNotes(order.notes || '');
    setActiveTab('deviseur');
    toast(`Modification de ${order.inv || order.client}`, 'info');
  };

  const handleAddOrder = (e) => {
    e.preventDefault();
    if (!formClient.trim()) return;
    if (currentCalculation.qty < 1) { toast("La quantité doit être au moins 1.", 'error'); return; }

    if (editing) {
      const inv = editing.inv || nextInvoiceNumber();
      if (!editing.inv) setSettings(s => ({ ...s, invoiceSeq: (Number(s.invoiceSeq) || 1) + 1 }));
      const updated = {
        ...editing,
        client: formClient.trim(),
        qty: currentCalculation.qty,
        pts: currentCalculation.pts,
        vis: formVis,
        notes: formNotes.trim(),
        unitPrice: Number(currentCalculation.unitPrice.toFixed(2)),
        calage: Number(currentCalculation.calageFee.toFixed(2)),
        total: Number(currentCalculation.totalLine.toFixed(2)),
        inv
      };
      setOrders(orders.map(o => o.id === editing.id ? updated : o));
      toast(`Commande ${inv} mise à jour !`);
      resetForm();
    } else {
      const inv = nextInvoiceNumber();
      setSettings(s => ({ ...s, invoiceSeq: (Number(s.invoiceSeq) || 1) + 1 }));
      const newOrder = {
        id: Date.now(),
        client: formClient.trim(),
        qty: currentCalculation.qty,
        pts: currentCalculation.pts,
        vis: formVis,
        notes: formNotes.trim(),
        unitPrice: Number(currentCalculation.unitPrice.toFixed(2)),
        calage: Number(currentCalculation.calageFee.toFixed(2)),
        total: Number(currentCalculation.totalLine.toFixed(2)),
        date: new Date().toISOString().split('T')[0],
        status: 'EN_ATTENTE',
        inv
      };
      setOrders([newOrder, ...orders]);
      toast(`Commande ${inv} enregistrée dans la base !`);
      setFormClient('');
      setFormQty(1);
    }
  };

  const handleDeleteOrder = (order) => {
    setConfirmState({
      title: 'Supprimer la commande',
      message: `Confirmer la suppression définitive de ${order.inv || order.client} (${order.qty} pcs, ${fmt(order.total)} ${settings.devise}) ?`,
      danger: true,
      onConfirm: () => {
        setOrders(orders.filter(o => o.id !== order.id));
        if (editing?.id === order.id) resetForm();
        toast('Commande supprimée.', 'info');
      }
    });
  };

  const handleDuplicateOrder = (order) => {
    const inv = nextInvoiceNumber();
    setSettings(s => ({ ...s, invoiceSeq: (Number(s.invoiceSeq) || 1) + 1 }));
    setOrders([{
      ...order,
      id: Date.now(),
      date: new Date().toISOString().split('T')[0],
      status: 'EN_ATTENTE',
      inv,
      client: `${order.client} (copie)`
    }, ...orders]);
    toast(`Copie créée : ${inv}`);
  };

  const cycleStatus = (order) => {
    const next = CYCLE_STATUTS[(CYCLE_STATUTS.indexOf(order.status) + 1) % CYCLE_STATUTS.length];
    setOrders(orders.map(o => o.id === order.id ? { ...o, status: next } : o));
    toast(`${order.inv || order.client} → ${STATUTS[next].label}`, 'info');
  };

  const ensureInvoiceNumber = (order) => {
    if (order.inv) return order.inv;
    const inv = nextInvoiceNumber();
    setSettings(s => ({ ...s, invoiceSeq: (Number(s.invoiceSeq) || 1) + 1 }));
    setOrders(orders.map(o => o.id === order.id ? { ...o, inv } : o));
    if (editing?.id === order.id) setEditing(e => e && { ...e, inv });
    return inv;
  };

  const handlePrintInvoice = (order) => {
    const inv = ensureInvoiceNumber(order);
    const tvaRate = Number(settings.tva) || 0;
    const ht = Number(order.total) || 0;
    const tvaAmt = ht * tvaRate / 100;
    const ttc = ht + tvaAmt;
    const visLabel = order.vis === 'OUI' ? `+ viseline standard (${fmt(settings.viselineStd)} ${settings.devise})` :
      order.vis === 'LOURDE' ? `+ viseline lourde (${fmt(settings.viselineLourd)} ${settings.devise})` : '';

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${inv}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;color:#1e293b}
      body{padding:40px;max-width:800px;margin:auto}
      .head{display:flex;justify-content:space-between;border-bottom:4px solid #d97706;padding-bottom:16px;margin-bottom:28px}
      .brand h1{font-size:22px;color:#1e293b}
      .brand p{font-size:11px;color:#64748b;margin-top:4px}
      .inv h2{font-size:26px;letter-spacing:2px;color:#d97706;text-align:right}
      .inv p{font-size:12px;color:#64748b;text-align:right;margin-top:4px}
      .stamp{display:inline-block;border:3px double #10b981;color:#10b981;font-size:20px;font-weight:800;padding:4px 14px;transform:rotate(-6deg);border-radius:6px;margin-left:14px}
      .b2{background:#f1f5f9;border-radius:10px;padding:14px 18px;margin-bottom:20px;display:flex;justify-content:space-between;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#1e293b;color:#fff;text-align:left;padding:10px 12px}
      td{padding:10px 12px;border-bottom:1px solid #e2e8f0}
      .r{text-align:right}
      tfoot td{font-weight:bold;background:#fffbeb}
      .totals{margin-top:24px;margin-left:auto;width:280px;font-size:13px}
      .totals div{display:flex;justify-content:space-between;padding:6px 12px}
      .totals .ttc{background:#1e293b;color:#fff;font-weight:800;font-size:15px;border-radius:8px}
      .notes{margin-top:24px;background:#fefce8;border:1px solid #fde047;border-radius:10px;padding:12px 16px;font-size:12px;color:#713f12}
      .foot{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:10px;color:#94a3b8;text-align:center}
    </style></head><body>
      <div class="head">
        <div class="brand"><h1>${settings.atelierNom}</h1><p>Devis & Facturation — Broderie</p></div>
        <div class="inv"><h2>FACTURE ${order.status === 'PAYEE' ? '<span class="stamp">PAYÉE</span>' : ''}</h2><p>N° ${inv}</p><p>Date : ${fmtDate(order.date)}</p></div>
      </div>
      <div class="b2"><div><strong>Client / Modèle :</strong> ${order.client}</div><div><strong>Statut :</strong> ${STATUTS[order.status]?.label || 'En attente'}</div></div>
      <table>
        <thead><tr><th>Description</th><th class="r">Qté</th><th class="r">Prix unitaire</th><th class="r">Montant</th></tr></thead>
        <tbody>
          <tr><td>Broderie ${fmtInt(order.pts)} points / pièce ${visLabel}</td><td class="r">${fmtInt(order.qty)}</td><td class="r">${fmt(order.unitPrice)} ${settings.devise}</td><td class="r">${fmt(order.qty * order.unitPrice)} ${settings.devise}</td></tr>
          ${Number(order.calage) > 0 ? `<tr><td>Frais de calage (petite série ≤ ${settings.seuilCalage} pcs)</td><td class="r">1</td><td class="r">${fmt(order.calage)} ${settings.devise}</td><td class="r">${fmt(order.calage)} ${settings.devise}</td></tr>` : ''}
        </tbody>
      </table>
      <div class="totals">
        <div><span>Total HT</span><span>${fmt(ht)} ${settings.devise}</span></div>
        ${tvaRate > 0 ? `<div><span>TVA (${fmt(tvaRate)} %)</span><span>${fmt(tvaAmt)} ${settings.devise}</span></div>` : ''}
        <div class="ttc"><span>TOTAL${tvaRate > 0 ? ' TTC' : ''}</span><span>${fmt(ttc)} ${settings.devise}</span></div>
      </div>
      ${order.notes ? `<div class="notes"><strong>Notes :</strong> ${order.notes}</div>` : ''}
      <div class="foot">Facture générée par ${settings.atelierNom} — Le ${fmtDate(new Date().toISOString().split('T')[0])}</div>
    </body></html>`;
    printHtml(html);
    toast(`Facture ${inv} générée.`, 'info');
  };

  // --- Exports / Imports ---
  const handleExportJSON = () => {
    downloadFile(
      JSON.stringify({ app: "broderie-pro", version: 4.3, exportedAt: new Date().toISOString(), settings, orders }, null, 2),
      `broderie_backup_${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );
    toast('Sauvegarde JSON téléchargée.');
  };

  const handleExportCSV = () => {
    const rows = [["Date", "Facture", "Client", "Pieces", "Points", "Viseline", "Prix unitaire", "Calage", "Total", "Devise", "Statut"]];
    filteredOrders.forEach(o => rows.push([
      o.date, o.inv, o.client, o.qty, o.pts, o.vis,
      o.unitPrice.toFixed(2), o.calage.toFixed(2), o.total.toFixed(2), settings.devise, STATUTS[o.status].label
    ]));
    rows.push([]);
    rows.push(["TOTAL", "", "", filteredOrders.reduce((a, o) => a + o.qty, 0), "", "", "", "", filteredOrders.reduce((a, o) => a + (o.status === 'ANNULEE' ? 0 : o.total), 0).toFixed(2), settings.devise, ""]);
    downloadFile("\uFEFF" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n"),
      `broderie_commandes_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    toast(`CSV exporté (${filteredOrders.length} lignes visibles).`);
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const incOrders = Array.isArray(data) ? data : data.orders;
        const incSettings = Array.isArray(data) ? null : data.settings;
        if (!Array.isArray(incOrders)) throw new Error('format');
        const clean = sanitizeOrders(incOrders);
        setConfirmState({
          title: 'Restaurer la sauvegarde',
          message: `Remplacer la base actuelle (${orders.length} commandes) par les ${clean.length} commandes du fichier ? ${incSettings ? 'La grille tarifaire ' : 'Les données '}seront aussi importées.`,
          danger: true,
          onConfirm: () => {
            setOrders(clean);
            if (incSettings) setSettings({ ...DEFAULT_SETTINGS, ...incSettings });
            toast(`Restauration réussie : ${clean.length} commandes.`);
          }
        });
      } catch {
        toast('Fichier JSON invalide ou corrompu.', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleResetOrders = () => {
    setConfirmState({
      title: 'Vider le registre',
      message: `Supprimer les ${orders.length} commandes ? Cette action est irréversible (pensez au backup JSON).`,
      danger: true,
      onConfirm: () => { setOrders([]); toast('Registre vidé.', 'info'); }
    });
  };

  const handleResetAll = () => {
    setConfirmState({
      title: 'Réinitialiser l\'application',
      message: 'Supprimer TOUTES les données (commandes + paramètres) et restaurer l\'état d\'usine ?',
      danger: true,
      onConfirm: () => {
        setOrders(sanitizeOrders(SEED_ORDERS));
        setSettings({ ...DEFAULT_SETTINGS });
        resetForm();
        toast('Application réinitialisée aux données de démonstration.', 'info');
      }
    });
  };

  // ============================================================
  // DERIVED DATA
  // ============================================================
  const filteredOrders = useMemo(() => {
    let list = [...orders];
    const q = searchQ.trim().toLowerCase();
    if (q) list = list.filter(o => o.client.toLowerCase().includes(q) || (o.inv || '').toLowerCase().includes(q) || (o.notes || '').toLowerCase().includes(q));
    if (filterStatus !== 'ALL') list = list.filter(o => o.status === filterStatus);
    if (dateFrom) list = list.filter(o => o.date >= dateFrom);
    if (dateTo) list = list.filter(o => o.date <= dateTo);
    const sorters = {
      date_desc: (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
      date_asc: (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
      total_desc: (a, b) => b.total - a.total,
      total_asc: (a, b) => a.total - b.total,
      qty_desc: (a, b) => b.qty - a.qty,
      client_asc: (a, b) => a.client.localeCompare(b.client, 'fr')
    };
    return list.sort(sorters[sortBy] || sorters.date_desc);
  }, [orders, searchQ, filterStatus, dateFrom, dateTo, sortBy]);

  const filteredTotals = useMemo(() => ({
    total: filteredOrders.reduce((a, o) => a + (o.status === 'ANNULEE' ? 0 : o.total), 0),
    qty: filteredOrders.reduce((a, o) => a + o.qty, 0)
  }), [filteredOrders]);

  const kpis = useMemo(() => {
    const actifs = orders.filter(o => o.status !== 'ANNULEE');
    const totalCA = actifs.reduce((a, o) => a + o.total, 0);
    const totalPaye = orders.filter(o => o.status === 'PAYEE').reduce((a, o) => a + o.total, 0);
    const totalAttente = orders.filter(o => o.status === 'EN_ATTENTE').reduce((a, o) => a + o.total, 0);
    const totalPieces = actifs.reduce((a, o) => a + o.qty, 0);
    const totalLancements = orders.length;
    const smallBatchCount = orders.filter(o => o.qty <= settings.seuilCalage).length;
    return { totalCA, totalPaye, totalAttente, totalPieces, totalLancements, smallBatchCount };
  }, [orders, settings]);

  const monthly = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''), ca: 0 });
    }
    orders.forEach(o => {
      if (o.status === 'ANNULEE') return;
      const [y, m] = o.date.split('-').map(Number);
      const mo = months.find(x => x.key === `${y}-${m - 1}`);
      if (mo) mo.ca += o.total;
    });
    return months;
  }, [orders]);
  const maxMonthly = Math.max(...monthly.map(m => m.ca), 1);

  const topClients = useMemo(() => {
    const m = {};
    orders.forEach(o => {
      if (o.status === 'ANNULEE') return;
      if (!m[o.client]) m[o.client] = { ca: 0, pcs: 0, count: 0 };
      m[o.client].ca += o.total;
      m[o.client].pcs += o.qty;
      m[o.client].count += 1;
    });
    return Object.entries(m).map(([client, v]) => ({ client, ...v })).sort((a, b) => b.ca - a.ca).slice(0, 5);
  }, [orders]);

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />
      <ConfirmModal state={confirmState} onCancel={() => setConfirmState(null)} />

      {/* TOP NAV */}
      <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-amber-600 to-amber-400 p-2.5 rounded-xl shadow-lg">
            <Scissors className="w-6 h-6 text-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white flex items-center gap-2">
              {settings.atelierNom} <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">PRO v4.3</span>
            </h1>
            <p className="text-xs text-slate-400">Gestion, Facturation & Calcul de Prix Avancé</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center bg-slate-900 p-1.5 rounded-xl border border-slate-800 gap-1">
          {[
            ['dashboard', 'Tableau de Bord', BarChart3],
            ['deviseur', 'Calculateur & Devis', Calculator],
            ['commandes', `Registre (${orders.length})`, Database],
            ['parametres', 'Paramètres', Settings]
          ].map(([key, label, Icon]) => (
            <button key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === key ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">

        {/* ================= DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Chiffre d'Affaires (actif)</p>
                    <h3 className="text-3xl font-extrabold text-white mt-1">{fmt(kpis.totalCA)} <span className="text-sm font-normal text-amber-400">{settings.devise}</span></h3>
                  </div>
                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-400"><DollarSign className="w-6 h-6" /></div>
                </div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CA Encaissé (payé)</p>
                    <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">{fmt(kpis.totalPaye)} <span className="text-sm font-normal">{settings.devise}</span></h3>
                  </div>
                  <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 text-emerald-400"><CheckCircle2 className="w-6 h-6" /></div>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">{kpis.totalCA > 0 ? `${Math.round(kpis.totalPaye / kpis.totalCA * 100)} % du CA encaissé` : '—'}</div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">En Attente de Paiement</p>
                    <h3 className="text-2xl font-extrabold text-amber-300 mt-1">{fmt(kpis.totalAttente)} <span className="text-sm font-normal">{settings.devise}</span></h3>
                  </div>
                  <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-300"><Clock className="w-6 h-6" /></div>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">{orders.filter(o => o.status === 'EN_ATTENTE').length} factures en attente</div>
              </div>

              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pièces Brodées</p>
                    <h3 className="text-3xl font-extrabold text-white mt-1">{fmtInt(kpis.totalPieces)} <span className="text-sm font-normal text-slate-400">pcs</span></h3>
                  </div>
                  <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20 text-blue-400"><Layers className="w-6 h-6" /></div>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">Moyenne : {fmt(kpis.totalPieces / (kpis.totalLancements || 1))} pcs / commande</div>
              </div>
            </div>

            {/* KPI Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Monthly chart */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-emerald-400" /> Revenus — 6 derniers mois</h3>
                <div className="flex items-end justify-between gap-2 h-32">
                  {monthly.map(m => (
                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[10px] font-bold text-emerald-300 opacity-0 group-hover:opacity-100 transition">{m.ca > 0 ? fmt(m.ca) : ''}</span>
                      <div
                        className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600/40 to-emerald-400 hover:from-emerald-500/60 transition-all min-h-[3px]"
                        style={{ height: `${Math.max((m.ca / maxMonthly) * 100, m.ca > 0 ? 6 : 2)}%` }}
                        title={`${m.ca.toFixed(2)} ${settings.devise}`}
                      />
                      <span className="text-[10px] text-slate-400 capitalize">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top clients */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-blue-400" /> Top Clients (CA)</h3>
                {topClients.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Aucune donnée client pour l'instant.</p>
                ) : (
                  <ul className="space-y-2.5">
                    {topClients.map((c, i) => (
                      <li key={c.client}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-200 truncate mr-2"><span className="text-slate-500 mr-1 font-mono">#{i + 1}</span>{c.client}</span>
                          <span className="font-mono text-amber-300 shrink-0">{fmt(c.ca)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400/70 rounded-full" style={{ width: `${Math.max((c.ca / (topClients[0].ca || 1)) * 100, 3)}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{c.count} commande(s) — {fmtInt(c.pcs)} pcs</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Performance + backup */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
                <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4 text-purple-400" /> Atelier & Base de Données</h3>
                <ul className="space-y-2 text-xs text-slate-300 mb-4">
                  <li className="flex justify-between"><span>Lancements</span><span className="font-bold text-white">{kpis.totalLancements}</span></li>
                  <li className="flex justify-between"><span>Petites séries (≤ {settings.seuilCalage} pcs)</span><span className="font-bold text-white">{kpis.smallBatchCount}</span></li>
                  <li className="flex justify-between"><span>Panier moyen</span><span className="font-bold text-white">{fmt(kpis.totalCA / (kpis.totalLancements || 1))} {settings.devise}</span></li>
                  <li className="flex justify-between"><span>Facture suivante</span><span className="font-mono font-bold text-amber-300">{nextInvoiceNumber()}</span></li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleExportJSON} className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg text-slate-200 transition flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Backup JSON</button>
                  <button onClick={handleExportCSV} className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg text-slate-200 transition flex items-center gap-1"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel CSV</button>
                  <button onClick={() => importInputRef.current?.click()} className="text-xs bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg text-slate-200 transition flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Restauration</button>
                  <input ref={importInputRef} type="file" accept=".json,application/json" onChange={handleImportJSON} className="hidden" />
                </div>
              </div>
            </div>

            {/* Quick action */}
            <div className="bg-gradient-to-r from-amber-600/20 via-slate-800 to-slate-800 border border-amber-500/30 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Prêt à calculer un nouveau devis ?</h3>
                <p className="text-xs text-slate-300 mt-1">Grille à {fmt(settings.tarifBase)} {settings.devise} / 1000 pts • Minimum {fmt(settings.prixMinPce)} {settings.devise} • Calage {fmt(settings.fraisCalage)} {settings.devise} (≤ {settings.seuilCalage} pcs)</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setActiveTab('commandes')} className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold px-5 py-3 rounded-xl shadow transition flex items-center gap-2 text-sm"><Database className="w-4 h-4" /> Registre</button>
                <button onClick={() => setActiveTab('deviseur')} className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg transition flex items-center gap-2 text-sm"><Calculator className="w-4 h-4" /> Ouvrir le Calculateur</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= DEVISEUR ================= */}
        {activeTab === 'deviseur' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-6 lg:col-span-2 space-y-5 shadow-xl">
              <div className="border-b border-slate-700 pb-3 flex justify-between items-center">
                <h2 className="font-bold text-white text-md flex items-center gap-2"><Calculator className="w-5 h-5 text-amber-400" /> Saisie Rapide de Commande & Devis</h2>
                <span className="text-xs font-mono bg-slate-900 px-2.5 py-1 rounded text-slate-400">{fmt(settings.tarifBase)} {settings.devise}/k pts</span>
              </div>

              {editing && (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-3 flex justify-between items-center">
                  <p className="text-xs text-amber-300 font-semibold flex items-center gap-2"><Pencil className="w-4 h-4" /> Modification de <span className="font-mono">{editing.inv || editing.client}</span> — {editing.client}</p>
                  <button onClick={resetForm} className="text-xs font-bold text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1"><X className="w-3.5 h-3.5" /> Annuler</button>
                </div>
              )}

              <form onSubmit={handleAddOrder} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Nom du Client / Modèle *</label>
                    <input type="text" value={formClient} onChange={(e) => setFormClient(e.target.value)} placeholder="Ex : Villa Orangers / Ch 51" required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Quantité (Pièces)</label>
                    <input type="number" min="1" value={formQty} onChange={(e) => setFormQty(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:border-amber-500 outline-none transition" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre de Points (par pièce)</label>
                    <input type="number" step="100" min="0" value={formPts} onChange={(e) => setFormPts(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:border-amber-500 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Support / Viseline</label>
                    <select value={formVis} onChange={(e) => setFormVis(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition">
                      <option value="NON">NON (Standard sans supp.)</option>
                      <option value="OUI">OUI (Standard +{fmt(settings.viselineStd)} {settings.devise})</option>
                      <option value="LOURDE">LOURDE (+{fmt(settings.viselineLourd)} {settings.devise})</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Notes (optionnel — réapparaissent sur la facture)</label>
                  <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows="2" placeholder="Ex : fil doré commandé par le client, livraison vendredi…"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition resize-none" />
                </div>

                {/* LIVE PREVIEW */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-inner">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex justify-between flex-wrap gap-2">
                    <span>Détail du Calcul Instantané</span>
                    <span className="text-amber-400 font-mono normal-case">Min {fmt(settings.prixMinPce)} | Calage {fmt(settings.fraisCalage)} ≤{settings.seuilCalage} pcs</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-center">
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Prix Base / Pce</span>
                      <span className="text-base font-bold text-slate-200">{fmt(currentCalculation.basePrice)}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Suppl. Viseline</span>
                      <span className="text-base font-bold text-slate-200">{fmt(currentCalculation.visSupp)}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Prix Final / Pce</span>
                      <span className="text-base font-bold text-amber-400">{fmt(currentCalculation.unitPrice)}</span>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 block">Frais Calage</span>
                      <span className="text-base font-bold text-emerald-400">{currentCalculation.calageFee > 0 ? fmt(currentCalculation.calageFee) : '—'}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                      <span className="text-xs text-slate-400 block">Montant Total de la Commande</span>
                      <span className="text-3xl font-extrabold text-emerald-400">{fmt(currentCalculation.totalLine)} <span className="text-lg font-normal">{settings.devise}</span></span>
                      <span className="text-[10px] text-slate-500 block mt-1 font-mono"><Printer className="w-3 h-3 inline mr-1" />N° facture : {nextInvoiceNumber()}</span>
                    </div>
                    <button type="submit"
                      className={`w-full sm:w-auto font-bold px-8 py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-sm ${editing ? 'bg-blue-600 hover:bg-blue-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white`}>
                      {editing ? <Pencil className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                      {editing ? `Mettre à jour ${editing.inv}` : 'Enregistrer dans la Base'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Side info */}
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-6 space-y-4 shadow-xl">
              <h3 className="font-bold text-white text-md border-b border-slate-700 pb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-400" /> Règles de l'Atelier</h3>
              <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2"><span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">1</span><span><strong>Prix Minimum :</strong> aucune pièce ne sort en dessous de {fmt(settings.prixMinPce)} {settings.devise} pour couvrir la manipulation et la viseline.</span></li>
                <li className="flex items-start gap-2"><span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">2</span><span><strong>Frais de Calage :</strong> forfait de {fmt(settings.fraisCalage)} {settings.devise} ajouté aux commandes de {settings.seuilCalage} pièces ou moins.</span></li>
                <li className="flex items-start gap-2"><span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">3</span><span><strong>Facturation :</strong> chaque commande reçoit un numéro unique <span className="font-mono text-amber-300">FAC-{new Date().getFullYear()}-XXXX</span> imprimable.</span></li>
                <li className="flex items-start gap-2"><span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">4</span><span><strong>Suivi Paiement :</strong> dans le registre, cliquez sur le badge de statut pour basculer En attente → Payée → Annulée.</span></li>
                <li className="flex items-start gap-2"><span className="bg-amber-500/20 text-amber-400 font-bold px-1.5 py-0.5 rounded">5</span><span><strong>Stockage :</strong> données conservées localement dans le navigateur, exportables en JSON / CSV.</span></li>
              </ul>
            </div>
          </div>
        )}

        {/* ================= REGISTRE ================= */}
        {activeTab === 'commandes' && (
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700 pb-4">
              <div>
                <h2 className="font-bold text-white text-md flex items-center gap-2"><Database className="w-5 h-5 text-amber-400" /> Registre Général des Commandes</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {filteredOrders.length} / {orders.length} commande(s) affichée(s) • Volume : {fmtInt(filteredTotals.qty)} pcs • Total : <span className="font-bold text-emerald-400">{fmt(filteredTotals.total)} {settings.devise}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleExportCSV} className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5"><FileSpreadsheet className="w-4 h-4" /> Exporter CSV</button>
                <button onClick={handleExportJSON} className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center gap-1.5"><Download className="w-4 h-4" /> Backup JSON</button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input type="text" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Client, facture, notes…"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:border-amber-500 outline-none" />
              </div>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 outline-none">
                <option value="ALL">Tous les statuts</option>
                <option value="EN_ATTENTE">En attente</option>
                <option value="PAYEE">Payées</option>
                <option value="ANNULEE">Annulées</option>
              </select>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Date début"
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 outline-none" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Date fin"
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 outline-none" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-amber-500 outline-none">
                <option value="date_desc">Trier : Date ↓ (récent)</option>
                <option value="date_asc">Trier : Date ↑ (ancien)</option>
                <option value="total_desc">Trier : Montant ↓</option>
                <option value="total_asc">Trier : Montant ↑</option>
                <option value="qty_desc">Trier : Quantité ↓</option>
                <option value="client_asc">Trier : Client A→Z</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Facture</th>
                    <th className="p-3">Client / Modèle</th>
                    <th className="p-3 text-center">Qté</th>
                    <th className="p-3 text-center">Points</th>
                    <th className="p-3 text-center">Viseline</th>
                    <th className="p-3 text-right">Prix/Pce</th>
                    <th className="p-3 text-right">Calage</th>
                    <th className="p-3 text-right font-bold">Total ({settings.devise})</th>
                    <th className="p-3 text-center">Statut</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan="11" className="text-center py-10 text-slate-500">Aucune commande ne correspond aux filtres.</td></tr>
                  ) : filteredOrders.map((order) => (
                    <tr key={order.id} className={`hover:bg-slate-700/40 transition ${order.status === 'ANNULEE' ? 'opacity-50' : ''}`}>
                      <td className="p-3 text-slate-400 whitespace-nowrap">{fmtDate(order.date)}</td>
                      <td className="p-3 font-mono text-amber-300/90 whitespace-nowrap">{order.inv || '—'}</td>
                      <td className="p-3 font-bold text-white">
                        {order.client}
                        {order.notes && <span title={order.notes} className="ml-1.5 cursor-help">📝</span>}
                      </td>
                      <td className="p-3 text-center font-semibold">{fmtInt(order.qty)}</td>
                      <td className="p-3 text-center">{fmtInt(order.pts)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${order.vis === 'OUI' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : order.vis === 'LOURDE' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-slate-700 text-slate-300'}`}>{order.vis}</span>
                      </td>
                      <td className="p-3 text-right font-mono">{fmt(order.unitPrice)}</td>
                      <td className="p-3 text-right font-mono text-emerald-400">{order.calage > 0 ? fmt(order.calage) : '—'}</td>
                      <td className="p-3 text-right font-extrabold font-mono text-white text-sm">{fmt(order.total)}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => cycleStatus(order)} title="Cliquer pour changer le statut" className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition hover:scale-105 ${STATUTS[order.status].cls}`}>
                          {STATUTS[order.status].label}
                        </button>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => loadForEdit(order)} title="Modifier" className="text-blue-400 hover:text-blue-300 p-1.5 rounded-lg hover:bg-blue-500/10 transition"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => handleDuplicateOrder(order)} title="Dupliquer" className="text-purple-400 hover:text-purple-300 p-1.5 rounded-lg hover:bg-purple-500/10 transition"><Copy className="w-4 h-4" /></button>
                          <button onClick={() => handlePrintInvoice(order)} title="Imprimer la facture" className="text-amber-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-amber-500/10 transition"><Printer className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteOrder(order)} title="Supprimer" className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredOrders.length > 0 && (
                  <tfoot className="bg-slate-900">
                    <tr>
                      <td colSpan="3" className="p-3 text-slate-400 font-bold uppercase text-[10px]">Total de la vue filtrée</td>
                      <td className="p-3 text-center font-bold text-white">{fmtInt(filteredTotals.qty)}</td>
                      <td colSpan="5"></td>
                      <td className="p-3 text-right font-extrabold font-mono text-emerald-400 text-sm">{fmt(filteredTotals.total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ================= PARAMETRES ================= */}
        {activeTab === 'parametres' && (
          <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-6 shadow-xl max-w-2xl mx-auto space-y-6">
            <div className="border-b border-slate-700 pb-3">
              <h2 className="font-bold text-white text-md flex items-center gap-2"><Settings className="w-5 h-5 text-amber-400" /> Configuration de la Grille Tarifaire</h2>
              <p className="text-xs text-slate-400">Les modifications sont appliquées instantanément dans toute l'application</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nom de l'Atelier</label>
                  <input type="text" value={settings.atelierNom} onChange={(e) => setSettings({ ...settings, atelierNom: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Devise (symbole)</label>
                  <input type="text" value={settings.devise} onChange={(e) => setSettings({ ...settings, devise: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tarif de Base / 1000 points ({settings.devise})</label>
                <input type="number" step="0.05" value={settings.tarifBase} onChange={(e) => setSettings({ ...settings, tarifBase: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-bold text-amber-400 focus:border-amber-500 outline-none" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplément Viseline Standard ({settings.devise})</label>
                  <input type="number" step="0.10" value={settings.viselineStd} onChange={(e) => setSettings({ ...settings, viselineStd: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplément Viseline Lourde ({settings.devise})</label>
                  <input type="number" step="0.10" value={settings.viselineLourd} onChange={(e) => setSettings({ ...settings, viselineLourd: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Frais de Calage Petites Séries ({settings.devise})</label>
                  <input type="number" step="5.00" value={settings.fraisCalage} onChange={(e) => setSettings({ ...settings, fraisCalage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Seuil Petites Séries (pièces max)</label>
                  <input type="number" value={settings.seuilCalage} onChange={(e) => setSettings({ ...settings, seuilCalage: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Prix Minimum / Pièce ({settings.devise})</label>
                  <input type="number" step="0.50" value={settings.prixMinPce} onChange={(e) => setSettings({ ...settings, prixMinPce: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">TVA sur Facture (%)</label>
                  <input type="number" step="0.5" min="0" value={settings.tva} onChange={(e) => setSettings({ ...settings, tva: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
                  <p className="text-[10px] text-slate-500 mt-1">0 = facture sans TVA</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Prochaine Facture N°</label>
                  <input type="text" value={nextInvoiceNumber()} readOnly
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono text-amber-300 opacity-90" />
                  <button type="button" onClick={() => { const seq = parseInt(String(settings.invoiceSeq).match(/\d+/)?.[0] || '0') + 1; setSettings({ ...settings, invoiceSeq: seq }); toast(`Compteur avancé : prochaine facture ${nextInvoiceNumber(seq)}`, 'info'); }}
                    className="mt-1 text-[10px] text-slate-500 hover:text-amber-400 underline">avancer le compteur</button>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 flex flex-wrap justify-between items-center gap-2">
                <p className="text-[10px] text-slate-500">Utilisez Backup JSON du Tableau de Bord pour sauvegarder avant de vider la base.</p>
                <button onClick={() => toast("Paramètres enregistrés et appliqués instantanément.")}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl transition text-sm flex items-center gap-2"><Save className="w-4 h-4" /> Enregistrer les modifications</button>
              </div>

              {/* Danger zone */}
              <div className="pt-4 border-t border-rose-900/40">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Zone de Maintenance</h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleResetOrders} className="text-xs font-semibold px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 transition flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Vider le registre des commandes</button>
                  <button onClick={handleResetAll} className="text-xs font-semibold px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-300 hover:bg-rose-500/20 transition flex items-center gap-1.5"><RotateCcw className="w-4 h-4" /> Réinitialisation d'usine</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 text-center">
        <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1.5">
          <FileText className="w-3 h-3" /> {settings.atelierNom} — Données stockées localement. Migration des données : utilisez <span className="text-slate-500 font-semibold">Backup JSON</span> puis <span className="text-slate-500 font-semibold">Restauration</span>.
        </p>
      </footer>
    </div>
  );
}
