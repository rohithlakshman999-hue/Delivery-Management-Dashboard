import { useEffect, useState } from 'react';
import { dispatchApi } from '../services/api';
import toast from 'react-hot-toast';

export default function AIOperationsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reassigning, setReassigning] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    dispatchApi.aiOps().then(r => setData(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleReassign = async (orderId: number, agentId: number) => {
    setReassigning(orderId);
    try {
      await dispatchApi.assign({ order_id: orderId, agent_id: agentId, ai_recommended: true });
      toast.success('Order reassigned successfully!');
      load();
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Reassignment failed'); }
    finally { setReassigning(null); }
  };

  if (loading) return <div className="loading-center"><div className="spinner" style={{ width: 32, height: 32 }} /><p>Loading AI Operations...</p></div>;

  const summary = [
    { label: 'Active Orders', value: data?.total_active_orders ?? 0, icon: '🚚', color: 'var(--accent-blue)' },
    { label: 'At Risk', value: data?.at_risk_count ?? 0, icon: '⚠️', color: 'var(--accent-amber)' },
    { label: 'High Risk', value: data?.high_risk_count ?? 0, icon: '🔴', color: 'var(--accent-rose)' },
    { label: 'Recommendations', value: data?.recommended_reassignments ?? 0, icon: '🤖', color: 'var(--accent-violet)' },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 AI Operations Center</h1>
          <p className="page-subtitle">Proactive delay detection &amp; intelligent recommendations</p>
        </div>
        <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
      </div>

      {/* Summary row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {summary.map(s => (
          <div key={s.label} className="stat-card" style={{ '--stat-color': s.color } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ fontSize: 32 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* At-risk deliveries */}
        <div>
          <p className="section-title">⚠️ At-Risk Deliveries</p>
          {data?.at_risk_deliveries?.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <h3 style={{ color: 'var(--accent-emerald)' }}>All Deliveries On Schedule</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No at-risk deliveries detected</p>
            </div>
          ) : data?.at_risk_deliveries?.map((item: any) => (
            <div key={item.order_id} className={`at-risk-item ${item.delay_risk === 'medium' ? 'risk-medium' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)', fontWeight: 700 }}>{item.order_code}</span>
                    <span className={`badge badge-${item.priority}`}>{item.priority}</span>
                    <span className={`badge badge-${item.status}`}>{item.status.replace(/_/g,' ')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.customer_name}</div>
                </div>
                <span className={`risk-pill risk-pill-${item.delay_risk}`}>
                  {item.delay_risk.toUpperCase()} {(item.delay_probability * 100).toFixed(0)}%
                </span>
              </div>

              {/* Agent info */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Current Agent</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {item.agent?.name} <span style={{ color: 'var(--accent-blue)', fontFamily: 'monospace' }}>({item.agent?.agent_code})</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>· {item.agent?.active_orders} active orders</span>
                </div>
              </div>

              {/* Explanation */}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, padding: '6px 10px',
                background: item.delay_risk === 'high' ? 'rgba(244,63,94,0.06)' : 'rgba(245,158,11,0.06)',
                borderRadius: 6, borderLeft: `2px solid ${item.delay_risk === 'high' ? 'var(--accent-rose)' : 'var(--accent-amber)'}` }}>
                {item.explanation}
              </div>

              {/* Recommendation */}
              {item.recommended_reassignment && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(59,130,246,0.06)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Recommended: </span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>{item.recommended_reassignment.name}</strong>
                    <span style={{ color: 'var(--text-muted)' }}> (score: {item.recommended_reassignment.score.toFixed(0)})</span>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={reassigning === item.order_id}
                    onClick={() => handleReassign(item.order_id, item.recommended_reassignment.id)}>
                    {reassigning === item.order_id ? '...' : '↩ Reassign'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Overloaded agents sidebar */}
        <div>
          <p className="section-title">⚡ Overloaded Agents</p>
          {data?.overloaded_agents?.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👍</div>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No overloaded agents</p>
            </div>
          ) : data?.overloaded_agents?.map((a: any) => (
            <div key={a.agent_id} className="card" style={{ marginBottom: 10, borderColor: 'rgba(244,63,94,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{a.agent_code}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-rose)' }}>{a.active_orders}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>active</div>
                </div>
              </div>
              <div className="score-bar" style={{ marginTop: 10 }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(a.active_orders * 10, 100)}%`,
                  background: 'linear-gradient(90deg, var(--accent-amber), var(--accent-rose))' }} />
              </div>
            </div>
          ))}

          <div style={{ marginTop: 20 }}>
            <p className="section-title">📊 AI Summary</p>
            <div className="ai-ops-card">
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {data?.at_risk_count === 0 ? (
                    <><span className="risk-low">✓</span> All {data?.total_active_orders} active deliveries are on schedule.</>
                  ) : (
                    <>
                      <span className="risk-high">⚠</span> {data?.high_risk_count} deliveries at <strong>HIGH RISK</strong>
                      <br/><span className="risk-medium">⚠</span> {data?.medium_risk_count} at <strong>MEDIUM RISK</strong>
                      <br/><span className="risk-low">✓</span> {(data?.total_active_orders ?? 0) - (data?.at_risk_count ?? 0)} on schedule
                    </>
                  )}
                </div>
                {data?.recommended_reassignments > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--accent-cyan)', background: 'rgba(6,182,212,0.1)',
                    padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(6,182,212,0.2)' }}>
                    🤖 {data.recommended_reassignments} reassignment{data.recommended_reassignments > 1 ? 's' : ''} recommended
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
