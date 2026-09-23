import { useEffect, useState } from 'react';
import { analyticsApi } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
         PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
        padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
        <p style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [volume, setVolume] = useState<any[]>([]);
  const [agentPerf, setAgentPerf] = useState<any[]>([]);
  const [deliveryTimes, setDeliveryTimes] = useState<any>(null);
  const [priorityDist, setPriorityDist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.overview(),
      analyticsApi.volumeByDay(),
      analyticsApi.agentPerformance(),
      analyticsApi.deliveryTimes(),
      analyticsApi.priorityDistribution(),
    ]).then(([o, v, ap, dt, pd]) => {
      setOverview(o.data);
      setVolume(v.data.data);
      setAgentPerf(ap.data.data.slice(0, 8));
      setDeliveryTimes(dt.data);
      setPriorityDist(Object.entries(pd.data.data).map(([name, value]) => ({ name, value })));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-center"><div className="spinner" style={{ width: 32, height: 32 }} /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📈 Analytics</h1>
          <p className="page-subtitle">Operational insights &amp; performance metrics</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-emerald)' } as any}>
          <div className="stat-icon">🎯</div>
          <div className="stat-value" style={{ fontSize: 28 }}>{overview?.on_time_rate ?? 0}%</div>
          <div className="stat-label">On-Time Rate</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-blue)' } as any}>
          <div className="stat-icon">⏱️</div>
          <div className="stat-value" style={{ fontSize: 28 }}>{deliveryTimes?.average ?? 0}</div>
          <div className="stat-label">Avg Delivery (min)</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-cyan)' } as any}>
          <div className="stat-icon">⚡</div>
          <div className="stat-value" style={{ fontSize: 28 }}>{deliveryTimes?.minimum ?? 0}</div>
          <div className="stat-label">Fastest (min)</div>
        </div>
        <div className="stat-card" style={{ '--stat-color': 'var(--accent-violet)' } as any}>
          <div className="stat-icon">📊</div>
          <div className="stat-value" style={{ fontSize: 28 }}>{deliveryTimes?.count ?? 0}</div>
          <div className="stat-label">Completed Deliveries</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Volume by day */}
        <div className="card">
          <p className="section-title">📅 Orders — Last 7 Days</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={volume}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="url(#blueGradient)" radius={[4,4,0,0]} name="Orders" />
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" /><stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority distribution */}
        <div className="card">
          <p className="section-title">🎯 Priority Distribution</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <ResponsiveContainer width="55%" height={220}>
              <PieChart>
                <Pie data={priorityDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {priorityDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {priorityDist.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize', flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.value as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Agent performance leaderboard */}
      <div className="card">
        <p className="section-title">🏆 Agent Performance Leaderboard</p>
        {agentPerf.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">📊</div><h3>No delivery data yet</h3></div>
        ) : (
          <div>
            <div style={{ marginBottom: 20 }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={agentPerf} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="agent_code" tick={{ fill: '#94a3b8', fontSize: 11 }} width={45} />
                  <Tooltip content={<CustomTooltip />} formatter={(v: any) => [`${v}%`, 'On-time Rate']} />
                  <Bar dataKey="on_time_rate" name="On-time Rate" radius={[0,4,4,0]}>
                    {agentPerf.map((entry, i) => (
                      <Cell key={i} fill={entry.on_time_rate > 90 ? '#10b981' : entry.on_time_rate > 75 ? '#f59e0b' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Rank</th><th>Agent</th><th>Total</th><th>Completed</th>
                  <th>Delayed</th><th>On-Time Rate</th><th>Rating</th>
                </tr>
              </thead>
              <tbody>
                {agentPerf.map((a, i) => (
                  <tr key={a.agent_id}>
                    <td><strong style={{ color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c2f' : 'var(--text-muted)' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                    </strong></td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{a.agent_code}</div>
                    </td>
                    <td>{a.total_deliveries}</td>
                    <td style={{ color: 'var(--accent-emerald)' }}>{a.completed}</td>
                    <td style={{ color: 'var(--accent-amber)' }}>{a.delayed}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="score-bar" style={{ width: 60 }}>
                          <div className="score-bar-fill" style={{ width: `${a.on_time_rate}%` }} />
                        </div>
                        <strong style={{ color: a.on_time_rate > 90 ? 'var(--accent-emerald)' : a.on_time_rate > 75 ? 'var(--accent-amber)' : 'var(--accent-rose)' }}>
                          {a.on_time_rate}%
                        </strong>
                      </div>
                    </td>
                    <td>⭐ {a.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
