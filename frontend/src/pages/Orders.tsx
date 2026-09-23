import { useEffect, useState } from 'react';
import { ordersApi, dispatchApi, mlApi } from '../services/api';
import toast from 'react-hot-toast';

interface Order {
  id: number; order_code: string; customer_name: string; customer_phone: string;
  delivery_address: string; priority: string; status: string;
  package_weight: number; package_description: string; created_at: string;
  assigned_agent_id: number | null;
  pickup_address: string; pickup_lat: number; pickup_lng: number;
  delivery_lat: number; delivery_lng: number;
}

function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    delivery_address: '', delivery_lat: '11.0041', delivery_lng: '77.0179',
    package_description: '', package_weight: '1.0', priority: 'medium', notes: '',
    pickup_address: 'Main Warehouse, Coimbatore', pickup_lat: '11.0168', pickup_lng: '76.9558',
  });
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await ordersApi.create({
        ...form,
        delivery_lat: parseFloat(form.delivery_lat),
        delivery_lng: parseFloat(form.delivery_lng),
        pickup_lat: parseFloat(form.pickup_lat),
        pickup_lng: parseFloat(form.pickup_lng),
        package_weight: parseFloat(form.package_weight),
      });
      toast.success('Order created successfully!');
      onCreated(); onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to create order');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">📦 New Order</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Customer Name *</label>
              <input className="input" value={form.customer_name} onChange={e => set('customer_name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input className="input" value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="input" type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Delivery Address *</label>
            <input className="input" value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} required />
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Delivery Lat</label>
              <input className="input" value={form.delivery_lat} onChange={e => set('delivery_lat', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Delivery Lng</label>
              <input className="input" value={form.delivery_lng} onChange={e => set('delivery_lng', e.target.value)} />
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Package Description</label>
              <input className="input" value={form.package_description} onChange={e => set('package_description', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Weight (kg)</label>
              <input className="input" type="number" step="0.1" value={form.package_weight} onChange={e => set('package_weight', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Priority</label>
            <select className="select" value={form.priority} onChange={e => set('priority', e.target.value)}>
              {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="textarea input" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : '➕ Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DispatchModal({ order, onClose, onAssigned }: { order: Order; onClose: () => void; onAssigned: () => void }) {
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [prediction, setPrediction] = useState<any>(null);

  useEffect(() => {
    dispatchApi.recommend(order.id).then(r => setRecs(r.data.recommendations)).finally(() => setLoading(false));
    mlApi.predictOrder(order.id).then(r => setPrediction(r.data)).catch(() => {});
  }, [order.id]);

  const assign = async (agentId: number, score: number, aiRec: boolean) => {
    setAssigning(agentId);
    try {
      await dispatchApi.assign({ order_id: order.id, agent_id: agentId, ai_score: score, ai_recommended: aiRec });
      toast.success('Order assigned successfully!');
      onAssigned(); onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Assignment failed');
    } finally { setAssigning(null); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <h2 className="modal-title">⚡ Smart Dispatch — {order.order_code}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {prediction && (
          <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10,
            background: prediction.delay_risk === 'high' ? 'rgba(244,63,94,0.08)' : prediction.delay_risk === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${prediction.delay_risk === 'high' ? 'rgba(244,63,94,0.3)' : prediction.delay_risk === 'medium' ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>🤖 AI Prediction</span>
              <span className={`risk-pill risk-pill-${prediction.delay_risk}`}>
                {prediction.delay_risk.toUpperCase()} RISK {(prediction.delay_probability * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              ETA: <strong style={{ color: 'var(--text-primary)' }}>{prediction.predicted_eta_minutes} min</strong> &nbsp;·&nbsp;
              Distance: <strong style={{ color: 'var(--text-primary)' }}>{prediction.distance_km} km</strong>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{prediction.explanation}</div>
          </div>
        )}

        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <div>
            <p className="section-title">🏆 Recommended Agents (Ranked by Score)</p>
            {recs.map((r, i) => (
              <div key={r.agent.id} style={{
                background: i === 0 ? 'rgba(59,130,246,0.06)' : 'var(--bg-surface)',
                border: `1px solid ${i === 0 ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                borderRadius: 10, padding: 14, marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    {i === 0 && <span className="badge badge-assigned" style={{ marginBottom: 4 }}>⭐ AI Recommended</span>}
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{r.agent.name} <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>({r.agent.agent_code})</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.agent.vehicle_type} · {r.distance_km.toFixed(1)} km away · {r.active_orders} active orders
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: r.score > 75 ? 'var(--accent-emerald)' : r.score > 50 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                      {r.score.toFixed(0)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>score</div>
                  </div>
                </div>
                {/* Score breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 10 }}>
                  {Object.entries(r.score_breakdown).map(([k, v]: any) => (
                    <div key={k} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'capitalize' }}>
                        {k.replace('_', ' ')}
                      </div>
                      <div className="score-bar" style={{ marginBottom: 2 }}>
                        <div className="score-bar-fill" style={{ width: `${v}%` }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>{v.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
                <button className={`btn ${i === 0 ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  disabled={assigning === r.agent.id}
                  onClick={() => assign(r.agent.id, r.score, i === 0)}>
                  {assigning === r.agent.id ? 'Assigning...' : i === 0 ? '✅ Assign (Recommended)' : 'Assign'}
                </button>
              </div>
            ))}
            {recs.length === 0 && <div className="empty-state"><div className="empty-state-icon">😕</div><h3>No available agents</h3></div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [dispatchOrder, setDispatchOrder] = useState<Order | null>(null);
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);

  const load = () => {
    setLoading(true);
    ordersApi.list({ status: filters.status || undefined, priority: filters.priority || undefined, limit: 100 })
      .then(r => setOrders(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const updateStatus = async (id: number, status: string) => {
    try {
      await ordersApi.update(id, { status });
      toast.success(`Status updated to ${status}`);
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Status update failed'); }
  };

  const importCsv = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    try {
      const result = await ordersApi.importCsv(file);
      toast.success(`${result.data.imported} orders imported${result.data.errors.length ? `, ${result.data.errors.length} skipped` : ''}`);
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'CSV import failed'); }
    finally { setImporting(false); }
  };

  const filtered = orders.filter(o =>
    o.order_code.toLowerCase().includes(search.toLowerCase()) ||
    o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    o.delivery_address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Order Management</h1>
          <p className="page-subtitle">{orders.length} total orders</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="btn btn-secondary" style={{ cursor: importing ? 'wait' : 'pointer' }}>
            {importing ? 'Importing...' : '↥ Import CSV'}
            <input type="file" accept=".csv,text/csv" hidden disabled={importing} onChange={e => { importCsv(e.target.files?.[0]); e.currentTarget.value = ''; }} />
          </label>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>➕ New Order</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input className="input search-input" placeholder="Search orders, customers..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 150 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          {['pending','assigned','accepted','picked_up','out_for_delivery','delivered','failed','cancelled'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          ))}
        </select>
        <select className="select" style={{ width: 140 }} value={filters.priority} onChange={e => setFilters(f => ({ ...f, priority: e.target.value }))}>
          <option value="">All Priority</option>
          {['low','medium','high','urgent'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="table-container">
        {loading ? <div className="loading-center"><div className="spinner" /></div> : (
          <table>
            <thead>
              <tr>
                <th>Order</th><th>Customer</th><th>Priority</th><th>Status</th>
                <th>Weight</th><th>Delivery Address</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr key={order.id}>
                  <td><span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)', fontWeight: 600 }}>{order.order_code}</span></td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{order.customer_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{order.customer_phone}</div>
                  </td>
                  <td><span className={`badge badge-${order.priority}`}>{order.priority}</span></td>
                  <td><span className={`badge badge-${order.status}`}>{order.status.replace(/_/g,' ')}</span></td>
                  <td style={{ fontSize: 12 }}>{order.package_weight}kg</td>
                  <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{order.delivery_address}</td>
                  <td style={{ fontSize: 12 }}>{new Date(order.created_at).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {order.status === 'pending' && (
                        <button className="btn btn-primary btn-sm" onClick={() => setDispatchOrder(order)}>⚡ Dispatch</button>
                      )}
                      {order.status === 'assigned' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setDispatchOrder(order)}>↩ Reassign</button>
                      )}
                      {['assigned','accepted'].includes(order.status) && (
                        <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(order.id, 'picked_up')}>
                          📦 Picked Up
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state"><div className="empty-state-icon">📭</div><h3>No orders found</h3></div>
        )}
      </div>

      {showCreate && <CreateOrderModal onClose={() => setShowCreate(false)} onCreated={load} />}
      {dispatchOrder && <DispatchModal order={dispatchOrder} onClose={() => setDispatchOrder(null)} onAssigned={load} />}
    </div>
  );
}
