import { useEffect, useState } from 'react';
import { ordersApi, analyticsApi } from '../services/api';

interface Stats {
  total_orders: number;
  delivered: number;
  active: number;
  pending: number;
  assigned: number;
  failed: number;
  total_agents: number;
  available_agents: number;
  on_time_rate: number;
}

export default function ManagerDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([analyticsApi.overview(), ordersApi.list({ limit: 8 })])
      .then(([s, o]) => { setStats(s.data); setRecentOrders(o.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-center"><div className="spinner" style={{ width: 32, height: 32 }} /><p>Loading dashboard...</p></div>
  );

  const statCards = [
    { label: 'Total Orders', value: stats?.total_orders ?? 0, icon: '📦', color: 'var(--accent-blue)', gradient: 'linear-gradient(135deg, #fff, var(--accent-blue))' },
    { label: 'Active Deliveries', value: stats?.active ?? 0, icon: '🚚', color: 'var(--accent-cyan)', gradient: 'linear-gradient(135deg, #fff, var(--accent-cyan))' },
    { label: 'Pending', value: stats?.pending ?? 0, icon: '⏳', color: 'var(--accent-amber)', gradient: 'linear-gradient(135deg, #fff, var(--accent-amber))' },
    { label: 'Delivered', value: stats?.delivered ?? 0, icon: '✅', color: 'var(--accent-emerald)', gradient: 'linear-gradient(135deg, #fff, var(--accent-emerald))' },
    { label: 'On-Time Rate', value: `${stats?.on_time_rate ?? 0}%`, icon: '⏱️', color: '#a78bfa', gradient: 'linear-gradient(135deg, #fff, var(--accent-violet))' },
    { label: 'Active Agents', value: stats?.available_agents ?? 0, icon: '🛵', color: 'var(--accent-violet)', gradient: 'linear-gradient(135deg, #fff, var(--accent-violet))' },
    { label: 'Assigned', value: stats?.assigned ?? 0, icon: '📋', color: '#60a5fa', gradient: 'linear-gradient(135deg, #fff, #60a5fa)' },
    { label: 'Failed', value: stats?.failed ?? 0, icon: '⚠️', color: 'var(--accent-rose)', gradient: 'linear-gradient(135deg, #fff, var(--accent-rose))' },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">Real-time delivery intelligence &amp; metrics</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pulse-dot pulse-green" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        {statCards.map((s) => (
          <div key={s.label} className="stat-card" style={{ '--stat-color': s.color, '--stat-gradient': s.gradient } as any}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="table-container">
        <div className="table-header">
          <span className="section-title" style={{ margin: 0 }}>📋 Recent Orders</span>
          <a href="/orders" className="btn btn-secondary btn-sm">View All →</a>
        </div>
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Delivery Address</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map(order => (
              <tr key={order.id}>
                <td><span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)', fontWeight: 600 }}>{order.order_code}</span></td>
                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{order.customer_name}</td>
                <td><span className={`badge badge-${order.priority}`}>{order.priority}</span></td>
                <td><span className={`badge badge-${order.status}`}>{order.status.replace(/_/g, ' ')}</span></td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.delivery_address}</td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentOrders.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No orders yet</h3>
            <p>Create your first order to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
