import { useEffect, useState } from 'react';
import { agentsApi } from '../services/api';
import toast from 'react-hot-toast';

function CreateAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: 'agent123', phone: '', vehicle_type: 'bike', zone: 'Central' });
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await agentsApi.create(form);
      toast.success('Agent created!');
      onCreated(); onClose();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Failed'); } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h2 className="modal-title">🛵 New Delivery Agent</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Full Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Email *</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Phone *</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} required /></div>
            <div className="form-group"><label className="form-label">Password</label><input className="input" value={form.password} onChange={e => set('password', e.target.value)} /></div>
            <div className="form-group">
              <label className="form-label">Vehicle Type</label>
              <select className="select" value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)}>
                {['bike','car','van','truck'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Zone</label>
              <select className="select" value={form.zone} onChange={e => set('zone', e.target.value)}>
                {['North','South','East','West','Central'].map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : '➕ Create Agent'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AgentCard({ agent, onToggle }: { agent: any; onToggle: () => void }) {
  const onTime = agent.completed_deliveries > 0
    ? Math.round(((agent.completed_deliveries - agent.delayed_deliveries) / agent.completed_deliveries) * 100)
    : 0;

  const vehicleIcon: Record<string, string> = { bike: '🛵', car: '🚗', van: '🚐', truck: '🚛' };

  return (
    <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: agent.is_available ? 'var(--accent-emerald)' : 'var(--text-muted)'
      }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
          }}>{vehicleIcon[agent.vehicle_type] || '🛵'}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{agent.user?.name}</div>
            <div style={{ fontFamily: 'monospace', color: 'var(--accent-blue)', fontSize: 12 }}>{agent.agent_code}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agent.zone} Zone · {agent.vehicle_type}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`pulse-dot ${agent.is_available ? 'pulse-green' : 'pulse-red'}`} />
          <span style={{ fontSize: 11, color: agent.is_available ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600 }}>
            {agent.is_available ? 'Available' : 'Busy'}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total', value: agent.total_deliveries, color: 'var(--accent-blue)' },
          { label: 'Done', value: agent.completed_deliveries, color: 'var(--accent-emerald)' },
          { label: 'Delayed', value: agent.delayed_deliveries, color: 'var(--accent-amber)' },
          { label: 'Failed', value: agent.failed_deliveries, color: 'var(--accent-rose)' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* On-time rate */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>On-time Rate</span>
          <span style={{ fontWeight: 700, color: onTime > 90 ? 'var(--accent-emerald)' : onTime > 75 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
            {onTime}%
          </span>
        </div>
        <div className="score-bar">
          <div className="score-bar-fill" style={{ width: `${onTime}%` }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12 }}>
          ⭐ <strong style={{ color: 'var(--text-primary)' }}>{agent.rating}</strong>
          <span style={{ color: 'var(--text-muted)' }}> rating</span>
        </div>
        <button
          className={`btn btn-sm ${agent.is_available ? 'btn-secondary' : 'btn-success'}`}
          onClick={onToggle}>
          {agent.is_available ? '⏸ Set Busy' : '▶ Set Available'}
        </button>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = () => {
    setLoading(true);
    agentsApi.list().then(r => setAgents(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleAvailability = async (agent: any) => {
    await agentsApi.update(agent.id, { is_available: !agent.is_available });
    toast.success(`${agent.user?.name} marked as ${agent.is_available ? 'busy' : 'available'}`);
    load();
  };

  const filtered = agents.filter(a => {
    if (filter === 'available') return a.is_available;
    if (filter === 'busy') return !a.is_available;
    return true;
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🛵 Delivery Agents</h1>
          <p className="page-subtitle">{agents.length} agents · {agents.filter(a => a.is_available).length} available</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>➕ Add Agent</button>
      </div>

      <div className="tabs" style={{ maxWidth: 300, marginBottom: 20 }}>
        {['all','available','busy'].map(f => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-center"><div className="spinner" style={{ width: 32, height: 32 }} /></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filtered.map(agent => (
            <AgentCard key={agent.id} agent={agent} onToggle={() => toggleAvailability(agent)} />
          ))}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="empty-state"><div className="empty-state-icon">🛵</div><h3>No agents found</h3></div>
      )}
      {showCreate && <CreateAgentModal onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}
