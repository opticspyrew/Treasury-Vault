import { useState, useEffect, useRef, createContext, useContext } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { api, getToken, setToken, clearToken, fetchKycPhotoUrl, downloadKycPhoto, type Client, type ServiceRequest, type Activity, type User, type WalletConfig, type CoinSectionOrder, type KycSubmission } from "@/lib/api";
import ReceiptModal from "@/components/receipt-modal";

interface AuthCtx { token: string | null; login: (t: string) => void; logout: () => void; }
const AuthContext = createContext<AuthCtx>({ token: null, login: () => {}, logout: () => {} });
function useAuth() { return useContext(AuthContext); }

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTok] = useState<string | null>(getToken);
  const login = (t: string) => { setToken(t); setTok(t); };
  const logout = () => {
    // Best-effort server-side revocation. Clear local state regardless so a
    // network error during sign-out can't strand the operator in a logged-in
    // browser.
    void api.logout().catch(() => undefined);
    clearToken();
    setTok(null);
  };
  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token } = useAuth();
  return token ? <Component /> : <Redirect to="/login" />;
}

function cn(...c: (string | undefined | null | false)[]) { return c.filter(Boolean).join(" "); }

function Badge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
    denied: "bg-red-100 text-red-800 border-red-200",
    processing: "bg-cyan-100 text-cyan-800 border-cyan-200",
    out_of_bound: "bg-rose-100 text-rose-900 border-rose-300",
    active: "bg-blue-100 text-blue-800 border-blue-200",
    withdrawal: "bg-purple-100 text-purple-800 border-purple-200",
    payment: "bg-blue-100 text-blue-800 border-blue-200",
    other: "bg-gray-100 text-gray-800 border-gray-200",
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs font-semibold rounded-full border", styles[status] || styles.other)}>
      {status === "out_of_bound" ? "OUT OF BOUND" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-card-border rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}{required && <span className="text-destructive ml-0.5">*</span>}</label>
      <input className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" {...props} />
    </div>
  );
}

function Select({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      <select className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary" {...props}>{children}</select>
    </div>
  );
}

function Textarea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground mb-1">{label}</label>
      <textarea className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none" rows={3} {...props} />
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const [, nav] = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { token } = await api.login(form.username, form.password);
      login(token);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-md shadow-indigo-200">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Firm Admin Portal</h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Internal dashboard — authorized access only</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-7 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.08)] border border-slate-100 space-y-4">
          {error && <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl text-sm text-rose-700 font-medium">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Admin Username</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Enter admin username" required className="w-full px-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Enter password" required className="w-full px-4 py-2.5 bg-slate-50/60 border border-slate-200 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 transition" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-2.5 bg-gradient-to-br from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-2xl font-bold text-sm transition-opacity disabled:opacity-60 shadow-md shadow-indigo-200">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="text-center text-xs text-slate-500 mt-5 font-medium">© 2026 Firm Admin System. All rights reserved.</p>
      </div>
    </div>
  );
}

const STAT_THEMES = [
  { border: "border-emerald-100", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
  { border: "border-orange-100", iconBg: "bg-orange-100", iconColor: "text-orange-500" },
  { border: "border-indigo-100", iconBg: "bg-indigo-100", iconColor: "text-indigo-500" },
  { border: "border-rose-100", iconBg: "bg-rose-100", iconColor: "text-rose-500" },
];

function getActivityTone(type: string) {
  if (type.includes("client")) return "border-l-emerald-300 bg-emerald-50/40";
  if (type.includes("flagged") || type.includes("denied") || type.includes("out_of_bound")) return "border-l-rose-300 bg-rose-50/40";
  if (type.includes("request")) return "border-l-indigo-300 bg-indigo-50/40";
  return "border-l-slate-300 bg-slate-50/40";
}

function StatCard({ label, value, theme, icon }: { label: string; value: number; theme: typeof STAT_THEMES[number]; icon: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden bg-white rounded-3xl p-6 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] border transition-transform hover:-translate-y-1 duration-300", theme.border)}>
      <div className="flex flex-col gap-5">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner", theme.iconBg, theme.iconColor)}>{icon}</div>
        <div>
          <p className="text-4xl font-extrabold text-slate-800 tracking-tight">{value}</p>
          <p className="text-sm font-semibold text-slate-500 mt-1">{label}</p>
        </div>
      </div>
    </div>
  );
}

function OverviewPage() {
  const [stats, setStats] = useState<{ totalClients: number; pendingClients: number; totalRequests: number; pendingRequests: number; recentActivity: Activity[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  function eventIcon(type: string) {
    if (type.includes("client")) return "👤";
    if (type.includes("request")) return "📋";
    return "📌";
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-slate-500 text-sm">Loading...</div>;

  return (
    <div className="space-y-10">
      <div className="pt-4">
        <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Overview</h2>
        <p className="text-base text-slate-500 font-medium mt-1">Dashboard summary and recent activity</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Clients" value={stats?.totalClients || 0} theme={STAT_THEMES[0]} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatCard label="Pending Clients" value={stats?.pendingClients || 0} theme={STAT_THEMES[1]} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
        <StatCard label="Total Requests" value={stats?.totalRequests || 0} theme={STAT_THEMES[2]} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
        <StatCard label="Pending Requests" value={stats?.pendingRequests || 0} theme={STAT_THEMES[3]} icon={<svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>} />
      </div>
      <div className="bg-white rounded-3xl p-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.06)] border border-slate-100">
        <div className="px-6 py-6 border-b border-slate-100/80">
          <h3 className="font-bold text-lg text-slate-800">Recent Activity</h3>
        </div>
        <div className="p-4 space-y-3">
          {(stats?.recentActivity || []).length === 0 ? (
            <p className="p-6 text-center text-slate-400 text-sm font-medium">No activity yet</p>
          ) : stats?.recentActivity.map(a => (
            <div key={a.id} className={cn("group flex items-center gap-4 p-4 rounded-2xl border-l-4 transition-colors hover:bg-slate-50", getActivityTone(a.eventType))}>
              <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-105 transition-transform">
                {eventIcon(a.eventType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-slate-700">{a.description}</p>
                <p className="text-xs font-semibold text-slate-400 mt-1">{new Date(a.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState<Client | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", notes: "" });
  const [editStatus, setEditStatus] = useState("pending");
  const [editNotes, setEditNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.getClients().then(r => setClients(r.clients)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg("");
    try {
      const r = await api.createClient(form);
      setMsg(r.emailSent ? "✓ Client added. Notification email sent." : "✓ Client added. (Email not configured — check SMTP_USER & SMTP_PASS env vars)");
      setShowAdd(false); setForm({ name: "", email: "", phone: "", company: "", notes: "" });
      load();
    } catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setSaving(false); }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!showEdit) return;
    setSaving(true);
    try {
      await api.updateClient(showEdit.id, { status: editStatus, notes: editNotes });
      setShowEdit(null); load();
    } catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Clients</h2>
          <p className="text-sm text-muted-foreground">Manage registered firm clients</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Client
        </button>
      </div>
      {msg && <div className={cn("p-3 rounded-lg text-sm border", msg.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>{msg}</div>}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                {["Name", "Email", "Phone", "Company", "Status", "Registered", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No clients yet. Add your first client above.</td></tr>
              ) : clients.map(c => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">{c.name.charAt(0).toUpperCase()}</div><span className="text-sm font-medium text-foreground">{c.name}</span></div></td>
                  <td className="px-4 py-3 text-sm text-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.phone || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.company || "—"}</td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setShowEdit(c); setEditStatus(c.status); setEditNotes(c.notes || ""); }} className="text-xs font-medium text-primary hover:underline">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Client">
        <form onSubmit={handleAdd} className="space-y-4">
          <Input label="Full Name" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. John Smith" />
          <Input label="Email Address" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 555-0000" />
            <Input label="Company" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Corp" />
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
          <p className="text-xs text-muted-foreground">An approval notification will be sent to Opticspycyber@gmail.com automatically.</p>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60">{saving ? "Adding..." : "Add Client"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!showEdit} onClose={() => setShowEdit(null)} title={`Edit Client — ${showEdit?.name}`}>
        <form onSubmit={handleEdit} className="space-y-4">
          <Select label="Status" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="out_of_bound">Out of Bound</option>
            <option value="active">Active</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
          </Select>
          <Textarea label="Admin Notes" value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Internal notes..." />
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowEdit(null)} className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60">{saving ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function RequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ clientId: "", type: "withdrawal", amount: "", currency: "USD", notes: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [receiptRequest, setReceiptRequest] = useState<ServiceRequest | null>(null);

  const load = () => {
    Promise.all([api.getRequests(), api.getClients()])
      .then(([r, c]) => { setRequests(r.requests); setClients(c.clients); })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    const id = window.setInterval(load, 10_000);
    return () => window.clearInterval(id);
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMsg("");
    try {
      const r = await api.createRequest({ clientId: parseInt(form.clientId), type: form.type, amount: form.amount, currency: form.currency, notes: form.notes });
      setMsg(r.emailSent ? "✓ Request submitted. Notification email sent." : "✓ Request submitted. (Email not configured — check SMTP_USER & SMTP_PASS env vars)");
      setShowAdd(false); setForm({ clientId: "", type: "withdrawal", amount: "", currency: "USD", notes: "" });
      load();
    } catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id: number, status: string) => {
    try { await api.updateRequest(id, { status }); load(); }
    catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  };

  return (
    <div className="space-y-5">
      {receiptRequest && (
        <ReceiptModal request={receiptRequest} onClose={() => setReceiptRequest(null)} />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Service Requests</h2>
          <p className="text-sm text-muted-foreground">Manage withdrawal, payment, and other requests</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Request
        </button>
      </div>
      {msg && <div className={cn("p-3 rounded-lg text-sm border", msg.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>{msg}</div>}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                {["Client", "Type", "Amount", "Notes", "Status", "Submitted", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">No requests yet.</td></tr>
              ) : requests.map(r => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3"><div className="text-sm font-medium text-foreground">{r.clientName || "—"}</div><div className="text-xs text-muted-foreground">{r.clientEmail || ""}</div></td>
                  <td className="px-4 py-3"><Badge status={r.type} /></td>
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{r.amount ? `${r.currency} ${Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate">{r.notes || "—"}</td>
                  <td className="px-4 py-3"><Badge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {r.status === "pending" && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(r.id, "approved")} className="text-xs font-semibold text-emerald-600 hover:underline">Approve</button>
                          <button onClick={() => updateStatus(r.id, "denied")} className="text-xs font-semibold text-red-600 hover:underline">Deny</button>
                          <button onClick={() => updateStatus(r.id, "out_of_bound")} className="text-xs font-semibold text-rose-700 hover:underline">Out of Bound</button>
                        </div>
                      )}
                      {r.status !== "pending" && <span className="text-xs text-muted-foreground">{r.status === "out_of_bound" ? "OUT OF BOUND" : r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>}
                      <button
                        onClick={() => setReceiptRequest(r)}
                        className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Receipt
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Service Request">
        <form onSubmit={handleAdd} className="space-y-4">
          <Select label="Client" required value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
            <option value="">Select a client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
          </Select>
          <Select label="Request Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="withdrawal">Withdrawal</option>
            <option value="payment">Payment</option>
            <option value="other">Other</option>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Amount" type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
            <Select label="Currency" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
              {["USD","EUR","GBP","CAD","AUD","CHF","JPY","CNY","AED","SGD","NGN","GHS","KES","ZAR"].map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Request details..." />
          <p className="text-xs text-muted-foreground">A notification email will be sent to Opticspycyber@gmail.com automatically.</p>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
            <button type="submit" disabled={saving || !form.clientId} className="px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60">{saving ? "Submitting..." : "Submit Request"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ActivityPage() {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getActivity().then(r => setActivity(r.activity)).finally(() => setLoading(false)); }, []);

  const typeColor: Record<string, string> = {
    client_registered: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    client_status_changed: "bg-indigo-50 text-indigo-700 border border-indigo-100",
    service_request_submitted: "bg-orange-50 text-orange-700 border border-orange-100",
    request_status_changed: "bg-rose-50 text-rose-700 border border-rose-100",
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Activity Log</h2>
        <p className="text-sm text-muted-foreground">Chronological record of all events</p>
      </div>
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="px-5 py-8 text-center text-muted-foreground text-sm">Loading...</p>
        ) : activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted-foreground text-sm">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {activity.map(a => (
              <div key={a.id} className="px-5 py-4 flex items-start gap-4">
                <div className={cn("px-2 py-0.5 text-xs font-semibold rounded-md flex-shrink-0 mt-0.5", typeColor[a.eventType] || "bg-gray-100 text-gray-700")}>
                  {a.eventType.replace(/_/g, " ")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{a.description}</p>
                  {a.clientName && <p className="text-xs text-muted-foreground mt-0.5">Client: {a.clientName}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const ADMIN_BTC_PRICE_USD = 27000;
const fmtUsd = (usd: number) => `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function formatLockoutRemaining(ms: number): string {
  if (ms <= 0) return "<1m left";
  const totalSec = Math.ceil(ms / 1000);
  if (totalSec < 60) return `${totalSec}s left`;
  const totalMin = Math.ceil(totalSec / 60);
  return `${totalMin}m left`;
}

function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [lockedCount, setLockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ amountUsd: "" });
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [unlockMsg, setUnlockMsg] = useState("");
  const [recovering, setRecovering] = useState<User | null>(null);
  const [recoveryForm, setRecoveryForm] = useState({ amountUsd: "" });
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMsg, setRecoveryMsg] = useState("");
  // Drives a 1s re-render so the "Xm left" countdown ticks down between
  // polls without needing another network round-trip.
  const [, setNowTick] = useState(0);

  const unlockLogin = async (u: User) => {
    setUnlockingId(u.id); setUnlockMsg("");
    try {
      await api.unlockUserLogin(u.id);
      setUnlockMsg(`✓ Sign-in unlocked for ${u.email}. They can retry immediately.`);
      load();
    } catch (err) {
      setUnlockMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUnlockingId(null);
    }
  };

  const load = () => {
    api.getUsers()
      .then(r => { setUsers(r.users); setLockedCount(r.lockedCount ?? 0); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // Refresh lockout state in the background so admins see locked accounts
    // appear/disappear without manually reloading.
    const poll = window.setInterval(load, 15_000);
    const tick = window.setInterval(() => setNowTick(t => t + 1), 1_000);
    return () => { window.clearInterval(poll); window.clearInterval(tick); };
  }, []);

  const openEdit = (u: User) => {
    const usd = (u.balanceBtc ?? 0) * ADMIN_BTC_PRICE_USD;
    setEditForm({ amountUsd: usd.toFixed(2) });
    setEditMsg("");
    setEditing(u);
  };

  const openRecovery = (u: User) => {
    setRecoveryForm({ amountUsd: "" });
    setRecoveryMsg("");
    setRecovering(u);
  };

  const submitRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recovering) return;
    const usd = Number(recoveryForm.amountUsd);
    if (!Number.isFinite(usd) || usd <= 0) {
      setRecoveryMsg("Error: enter a positive amount");
      return;
    }
    setRecoverySaving(true); setRecoveryMsg("");
    try {
      await api.recordUserRecovery(recovering.id, { amountUsd: usd });
      setRecovering(null);
      load();
    } catch (err) {
      setRecoveryMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setRecoverySaving(false); }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const usd = Number(editForm.amountUsd);
    if (!Number.isFinite(usd) || usd < 0) {
      setEditMsg("Error: enter a non-negative number");
      return;
    }
    setSaving(true); setEditMsg("");
    try {
      await api.setUserBalance(editing.id, { amountUsd: usd });
      setEditing(null);
      load();
    } catch (err) {
      setEditMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-foreground">Registered Users</h2>
          {lockedCount > 0 && (
            <span
              title={`${lockedCount} account${lockedCount === 1 ? " is" : "s are"} currently locked from too many failed sign-in attempts. They appear at the top of the list.`}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200"
              data-testid="users-locked-count"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              {lockedCount} locked
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          All Treasury Vault accounts. Password material is never sent to the browser.
          {lockedCount > 0 && " Locked accounts are listed first."}
        </p>
      </div>
      {unlockMsg && (
        <div className={cn("p-3 rounded-lg text-sm border flex items-start gap-2", unlockMsg.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
          <span className="flex-1">{unlockMsg}</span>
          <button onClick={() => setUnlockMsg("")} className="opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
        </div>
      )}
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        {loading ? (
          <p className="px-5 py-8 text-center text-muted-foreground text-sm">Loading...</p>
        ) : error ? (
          <p className="px-5 py-8 text-center text-destructive text-sm">{error}</p>
        ) : users.length === 0 ? (
          <p className="px-5 py-8 text-center text-muted-foreground text-sm">No registered users yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {users.map(u => {
              const balanceUsd = (u.balanceBtc ?? 0) * ADMIN_BTC_PRICE_USD;
              const throttle = u.loginThrottle;
              const isLocked = !!throttle?.locked;
              const hasFailures = (throttle?.failureCount ?? 0) > 0;
              return (
                <div key={u.id} className="px-5 py-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="w-6 text-xs text-muted-foreground font-mono">#{u.id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                        {isLocked && (
                          <span
                            title={`Account is locked after ${throttle?.failureCount ?? 0} failed sign-in attempts. Auto-unlocks in ${formatLockoutRemaining(throttle?.retryAfterMs ?? 0)}.`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                            Locked — {formatLockoutRemaining(throttle?.retryAfterMs ?? 0)}
                          </span>
                        )}
                        {!isLocked && hasFailures && (
                          <span
                            title={`${throttle?.failureCount} recent failed sign-in attempt(s) in the rolling window`}
                            className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                          >
                            {throttle?.failureCount}/{throttle?.maxFailures} failed attempts
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{fmtUsd(balanceUsd)}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{(u.balanceBtc ?? 0).toFixed(8)} BTC</p>
                    </div>
                    <p className="text-xs text-muted-foreground hidden sm:block">{new Date(u.createdAt).toLocaleString()}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                      >
                        Set balance
                      </button>
                      <button
                        onClick={() => openRecovery(u)}
                        disabled={u.reportedLossUsd == null || (u.reportedLossUsd - (u.recoveredUsd ?? 0)) <= 0}
                        title={u.reportedLossUsd == null
                          ? "This user has no documented reported loss yet."
                          : (u.reportedLossUsd - (u.recoveredUsd ?? 0)) <= 0
                            ? "Fully recovered — nothing left at risk."
                            : "Credit an amount recovered to the vault. It is deducted from the user's at-risk balance."}
                        className="text-xs px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid={`record-recovery-${u.id}`}
                      >
                        Record recovery
                      </button>
                      <button
                        onClick={() => void unlockLogin(u)}
                        disabled={unlockingId === u.id || !isLocked}
                        title={isLocked
                          ? "Clear this account's sign-in failure counter so the user can retry immediately"
                          : "This account is not currently locked. The unlock action is only needed after too many failed sign-in attempts."}
                        className={cn(
                          "text-xs px-2 py-1 rounded-md border transition-colors disabled:cursor-not-allowed",
                          isLocked
                            ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700 shadow-sm font-semibold animate-pulse disabled:opacity-70 disabled:animate-none"
                            : "bg-muted text-muted-foreground border-input opacity-60 hover:opacity-80",
                        )}
                      >
                        {unlockingId === u.id ? "Unlocking…" : "Unlock sign-in"}
                      </button>
                      <button
                        onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                        className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors border border-input"
                      >
                        {expanded === u.id ? "Hide details" : "Details"}
                      </button>
                    </div>
                  </div>
                  {expanded === u.id && (
                    <div className="mt-4 space-y-3 bg-muted/40 rounded-lg p-4 border border-input text-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">ID</p>
                          <p className="font-mono text-foreground">{u.id}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Name</p>
                          <p className="text-foreground">{u.name}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Email</p>
                          <p className="text-foreground">{u.email}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Available balance</p>
                          <p className="text-foreground">{fmtUsd(balanceUsd)} <span className="text-muted-foreground text-xs font-mono">({(u.balanceBtc ?? 0).toFixed(8)} BTC)</span></p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Reported loss</p>
                          <p className="text-foreground">{u.reportedLossUsd != null ? fmtUsd(u.reportedLossUsd) : "Not documented"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Recovered to vault</p>
                          <p className="text-emerald-700 font-medium">{fmtUsd(u.recoveredUsd ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">At-risk balance</p>
                          <p className="text-amber-700 font-medium">{u.reportedLossUsd != null ? fmtUsd(Math.max(0, u.reportedLossUsd - (u.recoveredUsd ?? 0))) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Scammed via</p>
                          <p className="text-foreground">{u.scammedVia || "Not provided"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Registered</p>
                          <p className="text-foreground">{new Date(u.createdAt).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Last updated</p>
                          <p className="text-foreground">{new Date(u.updatedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Set balance — ${editing.name}` : "Set balance"}>
        {editing && (
          <form onSubmit={submitEdit} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Sets the user's available balance. USD is converted to BTC at the ${ADMIN_BTC_PRICE_USD.toLocaleString("en-US")} display price used by the dashboard.
            </p>
            <Input
              label="Available balance (USD)"
              type="number"
              min="0"
              step="0.01"
              value={editForm.amountUsd}
              onChange={e => setEditForm({ amountUsd: e.target.value })}
              placeholder="0.00"
              required
            />
            {editMsg && <p className={cn("text-xs", editMsg.startsWith("Error") ? "text-red-600" : "text-emerald-600")}>{editMsg}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60">{saving ? "Saving..." : "Save balance"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={recovering !== null} onClose={() => setRecovering(null)} title={recovering ? `Record recovery — ${recovering.name}` : "Record recovery"}>
        {recovering && (
          <form onSubmit={submitRecovery} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Credits an amount recovered to the vault for this user. Their at-risk balance decreases by the same amount on the Recovery Portal.
            </p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted border border-border">
                <p className="text-muted-foreground">Reported loss</p>
                <p className="font-semibold text-foreground">{fmtUsd(recovering.reportedLossUsd ?? 0)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted border border-border">
                <p className="text-muted-foreground">Recovered</p>
                <p className="font-semibold text-emerald-700">{fmtUsd(recovering.recoveredUsd ?? 0)}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted border border-border">
                <p className="text-muted-foreground">At risk</p>
                <p className="font-semibold text-amber-700">{fmtUsd(Math.max(0, (recovering.reportedLossUsd ?? 0) - (recovering.recoveredUsd ?? 0)))}</p>
              </div>
            </div>
            <Input
              label="Amount recovered (USD)"
              type="number"
              min="0.01"
              step="0.01"
              value={recoveryForm.amountUsd}
              onChange={e => setRecoveryForm({ amountUsd: e.target.value })}
              placeholder="0.00"
              required
            />
            {recoveryMsg && <p className={cn("text-xs", recoveryMsg.startsWith("Error") ? "text-red-600" : "text-emerald-600")}>{recoveryMsg}</p>}
            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => setRecovering(null)} className="px-4 py-2 text-sm font-medium text-foreground bg-muted border border-border rounded-lg hover:bg-secondary transition-colors">Cancel</button>
              <button type="submit" disabled={recoverySaving} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60">{recoverySaving ? "Saving..." : "Record recovery"}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

const SUPPORTED_COINS = ["BTC", "USDT", "USDC", "ETH", "SOL", "XRP", "BNB"];

function WalletsPage() {
  const [configs, setConfigs] = useState<WalletConfig[]>([]);
  const [sectionOrders, setSectionOrders] = useState<CoinSectionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ address: "", network: "", label: "", isActive: true });
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ network: "", address: "", label: "" });
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [sectionDragSym, setSectionDragSym] = useState<string | null>(null);
  const [sectionDragOverSym, setSectionDragOverSym] = useState<string | null>(null);
  const [sectionReordering, setSectionReordering] = useState(false);
  const sectionDragSymRef = useRef<string | null>(null);

  const load = () => {
    Promise.all([api.getWalletConfigs(), api.getCoinSectionOrders()])
      .then(([w, s]) => { setConfigs(w.configs); setSectionOrders(s.orders); })
      .catch(e => setMsg(`Error: ${e.message}`))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const orderedCoinSymbols = (() => {
    if (sectionOrders.length === 0) return SUPPORTED_COINS;
    const orderMap = new Map(sectionOrders.map(o => [o.symbol, o.sortOrder]));
    return [...SUPPORTED_COINS].sort((a, b) => {
      const ai = orderMap.has(a) ? (orderMap.get(a) as number) : Number.MAX_SAFE_INTEGER;
      const bi = orderMap.has(b) ? (orderMap.get(b) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return SUPPORTED_COINS.indexOf(a) - SUPPORTED_COINS.indexOf(b);
    });
  })();

  const handleSectionReorder = async (draggedSym: string, targetSym: string) => {
    if (draggedSym === targetSym) return;
    const list = [...orderedCoinSymbols];
    const fromIdx = list.indexOf(draggedSym);
    const toIdx = list.indexOf(targetSym);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);

    const newOrders = list.map((sym, i) => ({ symbol: sym, sortOrder: (i + 1) * 10 }));
    setSectionOrders(newOrders.map((o, i) => ({
      id: sectionOrders.find(s => s.symbol === o.symbol)?.id ?? -(i + 1),
      symbol: o.symbol,
      sortOrder: o.sortOrder,
      createdAt: sectionOrders.find(s => s.symbol === o.symbol)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })));

    setSectionReordering(true);
    try {
      const res = await api.setCoinSectionOrders(newOrders);
      setSectionOrders(res.orders);
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
      load();
    } finally {
      setSectionReordering(false);
    }
  };

  const bySymbol = (sym: string) => configs.filter(c => c.symbol === sym).sort((a, b) => a.sortOrder - b.sortOrder);

  const handleReorder = async (sym: string, draggedId: number, targetId: number) => {
    if (draggedId === targetId) return;
    const entries = bySymbol(sym);
    const fromIdx = entries.findIndex(e => e.id === draggedId);
    const toIdx = entries.findIndex(e => e.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const reordered = [...entries];
    const [moved] = reordered.splice(fromIdx, 1);
    const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
    reordered.splice(insertIdx, 0, moved);

    const baseSortOrder = entries.reduce((min, e) => Math.min(min, e.sortOrder), entries[0]?.sortOrder ?? 0);
    const updates = reordered.map((e, i) => ({ id: e.id, sortOrder: baseSortOrder + i }));

    setConfigs(prev => prev.map(c => {
      const upd = updates.find(u => u.id === c.id);
      return upd ? { ...c, sortOrder: upd.sortOrder } : c;
    }));

    setReordering(true);
    try {
      const changed = updates.filter(u => {
        const orig = entries.find(e => e.id === u.id);
        return orig && orig.sortOrder !== u.sortOrder;
      });
      await Promise.all(changed.map(u => api.updateWalletConfig(u.id, { sortOrder: u.sortOrder })));
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
      load();
    } finally {
      setReordering(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);
    try {
      await api.updateWalletConfig(editingId, {
        address: editForm.address,
        network: editForm.network,
        label: editForm.label,
        isActive: editForm.isActive,
      });
      setEditingId(null);
      load();
    } catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setSaving(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingFor) return;
    setSaving(true);
    try {
      const existingForCoin = configs.filter(c => c.symbol === addingFor);
      await api.createWalletConfig({
        symbol: addingFor,
        network: addForm.network,
        address: addForm.address,
        label: addForm.label || undefined,
        sortOrder: existingForCoin.length > 0
          ? Math.max(...existingForCoin.map(c => c.sortOrder)) + 1
          : SUPPORTED_COINS.indexOf(addingFor) * 10,
      });
      setAddingFor(null);
      setAddForm({ network: "", address: "", label: "" });
      load();
    } catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this wallet address?")) return;
    try {
      await api.deleteWalletConfig(id);
      load();
    } catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      await api.updateWalletConfig(id, { isActive: !isActive });
      load();
    } catch (err) { setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Wallet Addresses</h2>
        <p className="text-sm text-muted-foreground">Configure crypto wallet addresses shown on the invoice payment page. Drag a coin section header to reorder coins, or drag rows inside a section to reorder networks.</p>
      </div>
      {msg && (
        <div className={cn("p-3 rounded-lg text-sm border", msg.startsWith("Error") ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
          {msg}
          <button onClick={() => setMsg("")} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="space-y-4">
          {orderedCoinSymbols.map(sym => {
            const entries = bySymbol(sym);
            const sectionDraggable = orderedCoinSymbols.length > 1 && !sectionReordering && editingId === null && addingFor === null;
            const isBeingDragged = sectionDragSym === sym;
            const isDropTarget = sectionDragOverSym === sym && sectionDragSym !== null && sectionDragSym !== sym;
            return (
              <div
                key={sym}
                className={cn(
                  "bg-card border border-card-border rounded-xl overflow-hidden transition-colors",
                  isBeingDragged && "opacity-40",
                  isDropTarget && "border-t-4 border-t-primary",
                )}
              >
                <div
                  draggable={sectionDraggable}
                  onDragStart={(e) => {
                    if (!sectionDraggable) return;
                    sectionDragSymRef.current = sym;
                    setSectionDragSym(sym);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", `section:${sym}`);
                  }}
                  onDragOver={(e) => {
                    const dragged = sectionDragSymRef.current;
                    if (dragged === null || dragged === sym) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (sectionDragOverSym !== sym) setSectionDragOverSym(sym);
                  }}
                  onDragEnter={(e) => {
                    const dragged = sectionDragSymRef.current;
                    if (dragged === null || dragged === sym) return;
                    e.preventDefault();
                  }}
                  onDragLeave={() => {
                    if (sectionDragOverSym === sym) setSectionDragOverSym(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dragged = sectionDragSymRef.current;
                    if (dragged !== null && dragged !== sym) {
                      handleSectionReorder(dragged, sym);
                    }
                    sectionDragSymRef.current = null;
                    setSectionDragSym(null);
                    setSectionDragOverSym(null);
                  }}
                  onDragEnd={() => {
                    sectionDragSymRef.current = null;
                    setSectionDragSym(null);
                    setSectionDragOverSym(null);
                  }}
                  className={cn(
                    "flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30",
                    sectionDraggable && "cursor-grab active:cursor-grabbing",
                  )}
                  title={sectionDraggable ? "Drag to reorder coin sections" : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "select-none",
                        sectionDraggable ? "text-muted-foreground" : "opacity-30",
                      )}
                      aria-label="Section drag handle"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <circle cx="7" cy="5" r="1.4" />
                        <circle cx="13" cy="5" r="1.4" />
                        <circle cx="7" cy="10" r="1.4" />
                        <circle cx="13" cy="10" r="1.4" />
                        <circle cx="7" cy="15" r="1.4" />
                        <circle cx="13" cy="15" r="1.4" />
                      </svg>
                    </span>
                    <span className="font-bold text-foreground">{sym}</span>
                    <span className="text-xs text-muted-foreground">({entries.length} network{entries.length !== 1 ? "s" : ""})</span>
                  </div>
                  <button
                    onClick={() => { setAddingFor(sym); setAddForm({ network: "", address: "", label: "" }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Network
                  </button>
                </div>

                {addingFor === sym && (
                  <form onSubmit={handleAdd} className="px-5 py-4 bg-blue-50/50 border-b border-border space-y-3">
                    <p className="text-xs font-semibold text-foreground">Add new {sym} network</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input label="Network Name *" required value={addForm.network} onChange={e => setAddForm(f => ({ ...f, network: e.target.value }))} placeholder="e.g. TRC20" />
                      <Input label="Wallet Address *" required value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))} placeholder="Wallet address..." />
                      <Input label="Label (optional)" value={addForm.label} onChange={e => setAddForm(f => ({ ...f, label: e.target.value }))} placeholder="Display label..." />
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={saving} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
                      <button type="button" onClick={() => setAddingFor(null)} className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-medium text-foreground">Cancel</button>
                    </div>
                  </form>
                )}

                {entries.length === 0 && addingFor !== sym ? (
                  <p className="px-5 py-4 text-sm text-muted-foreground italic">No addresses configured yet. Click "Add Network" to set one up.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {entries.map(cfg => (
                      <div
                        key={cfg.id}
                        draggable={editingId !== cfg.id && !reordering && entries.length > 1}
                        onDragStart={(e) => {
                          if (editingId === cfg.id) return;
                          setDragId(cfg.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", String(cfg.id));
                        }}
                        onDragOver={(e) => {
                          if (dragId === null || dragId === cfg.id) return;
                          const draggedCfg = configs.find(c => c.id === dragId);
                          if (!draggedCfg || draggedCfg.symbol !== sym) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverId !== cfg.id) setDragOverId(cfg.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverId === cfg.id) setDragOverId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragId !== null && dragId !== cfg.id) {
                            const draggedCfg = configs.find(c => c.id === dragId);
                            if (draggedCfg && draggedCfg.symbol === sym) {
                              handleReorder(sym, dragId, cfg.id);
                            }
                          }
                          setDragId(null);
                          setDragOverId(null);
                        }}
                        onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                        className={cn(
                          "px-5 py-3.5 transition-colors",
                          dragId === cfg.id && "opacity-40",
                          dragOverId === cfg.id && dragId !== cfg.id && "bg-blue-50 border-t-2 border-t-primary",
                        )}
                      >
                        {editingId === cfg.id ? (
                          <form onSubmit={handleEdit} className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Input label="Network" required value={editForm.network} onChange={e => setEditForm(f => ({ ...f, network: e.target.value }))} />
                              <Input label="Wallet Address" required value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                              <Input label="Label" value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))} />
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4" />
                                <span className="text-foreground">Active</span>
                              </label>
                              <button type="submit" disabled={saving} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:opacity-90 disabled:opacity-60">{saving ? "Saving..." : "Save"}</button>
                              <button type="button" onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-medium text-foreground">Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div className="flex items-start gap-3 flex-wrap">
                            <div
                              className={cn(
                                "flex-shrink-0 mt-0.5 px-1 py-1 text-muted-foreground select-none",
                                entries.length > 1 ? "cursor-grab active:cursor-grabbing hover:text-foreground" : "opacity-30 cursor-not-allowed",
                              )}
                              title={entries.length > 1 ? "Drag to reorder" : "Add another network to enable reordering"}
                              aria-label="Drag handle"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <circle cx="7" cy="5" r="1.4" />
                                <circle cx="13" cy="5" r="1.4" />
                                <circle cx="7" cy="10" r="1.4" />
                                <circle cx="13" cy="10" r="1.4" />
                                <circle cx="7" cy="15" r="1.4" />
                                <circle cx="13" cy="15" r="1.4" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">{cfg.network}</span>
                                {cfg.label && <span className="text-xs text-muted-foreground">{cfg.label}</span>}
                                <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", cfg.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                                  {cfg.isActive ? "Active" : "Inactive"}
                                </span>
                              </div>
                              <p className="text-xs font-mono text-foreground break-all">{cfg.address}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => handleToggleActive(cfg.id, cfg.isActive)}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                title={cfg.isActive ? "Deactivate" : "Activate"}
                              >
                                {cfg.isActive ? "Deactivate" : "Activate"}
                              </button>
                              <span className="text-muted-foreground">·</span>
                              <button
                                onClick={() => { setEditingId(cfg.id); setEditForm({ address: cfg.address, network: cfg.network, label: cfg.label ?? "", isActive: cfg.isActive }); }}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                Edit
                              </button>
                              <span className="text-muted-foreground">·</span>
                              <button
                                onClick={() => handleDelete(cfg.id)}
                                className="text-xs font-medium text-red-600 hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { id: "overview", label: "Overview", path: "/", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: "clients", label: "Clients", path: "/clients", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
  { id: "requests", label: "Requests", path: "/requests", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
  { id: "kyc", label: "KYC", path: "/kyc", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
  { id: "activity", label: "Activity Log", path: "/activity", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { id: "users", label: "Users", path: "/users", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
  { id: "wallets", label: "Wallets", path: "/wallets", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
];

function KycPage() {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { submissions } = await api.getKycSubmissions(filter);
      setSubmissions(submissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filter]);

  const decide = async (id: number, decision: "approve" | "reject") => {
    const note = (notes[id] ?? "").trim();
    // Rejections require a reason so the user knows what to fix.
    if (decision === "reject" && !note) {
      alert("Please enter a rejection reason before rejecting this submission.");
      return;
    }
    setBusyId(id);
    try {
      if (decision === "approve") await api.approveKyc(id, note || undefined);
      else await api.rejectKyc(id, note);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : `Failed to ${decision}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">KYC Verification</h1>
        <p className="text-sm text-slate-500 mt-1">Review identity verification submissions. Approving a user enables Send and Withdraw on their account.</p>
      </div>

      <div className="flex items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors capitalize",
              filter === f ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}>
            {f}
          </button>
        ))}
        <button onClick={() => void load()} className="ml-auto px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">Refresh</button>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : submissions.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-sm text-slate-500">
          No {filter === "all" ? "" : filter} submissions.
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map(s => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewId(s.id)}
                    className="w-28 h-28 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden hover:ring-2 hover:ring-indigo-400 transition"
                    title="Click to enlarge"
                  >
                    <KycPhoto id={s.id} alt={`ID for ${s.fullName}`} className="w-full h-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadKycPhoto(s.id)}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700"
                  >
                    Download
                  </button>
                </div>
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900">{s.fullName}</h3>
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-semibold rounded-full",
                      s.status === "pending" && "bg-amber-100 text-amber-700",
                      s.status === "approved" && "bg-emerald-100 text-emerald-700",
                      s.status === "rejected" && "bg-rose-100 text-rose-700",
                    )}>
                      {s.status}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">#{s.id}</span>
                    {s.totalAttempts > 1 && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                        Attempt {s.attemptNumber} of {s.totalAttempts}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Account: {s.userName} &lt;{s.userEmail}&gt;</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs mt-3">
                    <Info label="Date of birth" value={s.dateOfBirth} />
                    <Info label="ID type" value={s.idType} />
                    <Info label="ID number" value={s.idNumber} mono />
                    <Info label="Address" value={s.address} />
                    <Info label="City" value={s.city} />
                    <Info label="Country" value={s.country} />
                    <Info label="Submitted" value={new Date(s.createdAt).toLocaleString()} />
                    {s.reviewedAt && <Info label="Reviewed" value={new Date(s.reviewedAt).toLocaleString()} />}
                  </div>
                  {s.reviewerNotes && (
                    <p className="mt-3 text-xs text-slate-600 italic">Notes: {s.reviewerNotes}</p>
                  )}
                  {s.attempts.length > 1 && (
                    <details className="mt-3 group">
                      <summary className="text-xs font-semibold text-indigo-600 cursor-pointer hover:text-indigo-700 select-none">
                        Show prior attempts ({s.attempts.length - 1})
                      </summary>
                      <ul className="mt-2 space-y-1.5">
                        {s.attempts
                          .filter(a => a.id !== s.id)
                          .map(a => (
                            <li key={a.id} className="text-xs text-slate-600 p-2 rounded-lg bg-slate-50 border border-slate-100">
                              <div className="flex items-start gap-3">
                                <div className="shrink-0 flex flex-col items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewId(a.id)}
                                    className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:ring-2 hover:ring-indigo-400 transition"
                                    title="Open full photo"
                                    aria-label={`Open ID photo for attempt ${a.id}`}
                                  >
                                    <KycPhoto id={a.id} alt={`ID for attempt ${a.id}`} className="w-full h-full object-cover" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void downloadKycPhoto(a.id)}
                                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-700"
                                    aria-label={`Download ID photo for attempt ${a.id}`}
                                  >
                                    Download
                                  </button>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-slate-400">#{a.id}</span>
                                    <span className={cn(
                                      "px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize",
                                      a.status === "pending" && "bg-amber-100 text-amber-700",
                                      a.status === "approved" && "bg-emerald-100 text-emerald-700",
                                      a.status === "rejected" && "bg-rose-100 text-rose-700",
                                    )}>
                                      {a.status}
                                    </span>
                                    <span className="text-slate-500">Submitted {new Date(a.createdAt).toLocaleString()}</span>
                                    {a.reviewedAt && (
                                      <span className="text-slate-400">· Reviewed {new Date(a.reviewedAt).toLocaleString()}</span>
                                    )}
                                  </div>
                                  {a.reviewerNotes && (
                                    <p className="mt-1 italic text-slate-500">Notes: {a.reviewerNotes}</p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                </div>
              </div>

              {s.status === "pending" && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Optional notes (visible to user on rejection)"
                    value={notes[s.id] ?? ""}
                    onChange={e => setNotes(n => ({ ...n, [s.id]: e.target.value }))}
                    className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-400"
                  />
                  <button
                    onClick={() => void decide(s.id, "approve")}
                    disabled={busyId === s.id}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {busyId === s.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => void decide(s.id, "reject")}
                    disabled={busyId === s.id}
                    className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busyId === s.id ? "…" : "Reject"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {previewId !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setPreviewId(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <KycPhoto id={previewId} alt="ID full view" className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl" />
            <button
              type="button"
              onClick={() => void downloadKycPhoto(previewId)}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-white/95 text-slate-800 text-xs font-semibold shadow hover:bg-white"
            >
              Download
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KycPhoto({ id, alt, className }: { id: number; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoked = false;
    let current: string | null = null;
    void fetchKycPhotoUrl(id).then(u => {
      if (revoked) {
        if (u) URL.revokeObjectURL(u);
        return;
      }
      current = u;
      setUrl(u);
    });
    return () => {
      revoked = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [id]);
  if (!url) return <div className={cn("bg-slate-100 animate-pulse", className)} />;
  return <img src={url} alt={alt} className={className} />;
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{label}</p>
      <p className={cn("text-slate-800", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const [location, nav] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50/50 text-slate-800 overflow-hidden relative">
      {/* Soft background gradient washes */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-100/40 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-indigo-100/40 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {mobileOpen && <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-20 lg:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={cn(
        "fixed lg:relative inset-y-0 left-0 z-30 w-[260px] bg-white/60 backdrop-blur-md border-r border-slate-200/60 flex flex-col transition-transform duration-300 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center gap-3 px-8 py-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <div>
            <p className="text-base font-bold text-slate-800 tracking-tight">Admin Portal</p>
            <p className="text-xs font-medium text-slate-500">Firm Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const isActive = location === item.path;
            return (
              <button key={item.id} onClick={() => { nav(item.path); setMobileOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-all duration-200 text-left",
                  isActive
                    ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                    : "text-slate-500 hover:bg-white/50 hover:text-slate-700 border border-transparent"
                )}>
                <div className={cn("transition-transform duration-200 flex-shrink-0", isActive && "scale-110")}>{item.icon}</div>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 mb-4">
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-[15px] font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 z-10 relative">
        <header className="flex items-center justify-between px-8 md:px-12 h-20 flex-shrink-0">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="ml-auto">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-100">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </div>
              <span className="text-xs font-bold tracking-wide text-slate-600 uppercase">Monitoring Active</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-8 md:px-12 pb-12">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function DashboardRouter() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={OverviewPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/requests" component={RequestsPage} />
        <Route path="/activity" component={ActivityPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/wallets" component={WalletsPage} />
        <Route path="/kyc" component={KycPage} />
        <Route component={OverviewPage} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route component={() => <ProtectedRoute component={DashboardRouter} />} />
    </Switch>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </AuthProvider>
  );
}
