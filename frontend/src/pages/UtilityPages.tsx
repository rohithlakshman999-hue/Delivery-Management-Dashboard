import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { miscApi, ordersApi, trackingApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const routeAgentIcon = L.divIcon({
  className: '',
  html: '<div style="background:#10b981;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">🛵</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const routeDeliveryIcon = L.divIcon({
  className: '',
  html: '<div style="background:#f59e0b;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">📦</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

export function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const load = () => miscApi.notifications().then(r => setItems(r.data));
  useEffect(() => { load(); }, []);

  const markRead = async (id: number) => {
    await miscApi.markRead(id);
    setItems(items.map(item => item.id === id ? { ...item, is_read: true } : item));
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1 className="page-title">Notifications</h1><p className="page-subtitle">Operational updates and delivery alerts</p></div>
        <button className="btn btn-secondary" onClick={() => miscApi.markAllRead().then(load)}>Mark all read</button>
      </div>
      <div className="card">
        {items.length === 0 ? <div className="empty-state"><div className="empty-state-icon">🔔</div><h3>No notifications</h3></div> : items.map(item => (
          <button key={item.id} className="notification-row" onClick={() => markRead(item.id)} style={{ opacity: item.is_read ? 0.65 : 1 }}>
            <span className={`pulse-dot ${item.type === 'warning' || item.type === 'alert' ? 'pulse-red' : 'pulse-green'}`} />
            <span style={{ flex: 1, textAlign: 'left' }}><strong>{item.title}</strong><small>{item.message}</small></span>
            <time>{new Date(item.created_at).toLocaleString()}</time>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user, logout } = useAuth();
  return (
    <div className="fade-in">
      <div className="page-header"><div><h1 className="page-title">Profile</h1><p className="page-subtitle">Your RouteMind account</p></div></div>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="user-avatar" style={{ width: 56, height: 56, fontSize: 22, marginBottom: 16 }}>{user?.name.charAt(0).toUpperCase()}</div>
        <div className="form-group"><label className="form-label">Name</label><div className="input" aria-readonly="true">{user?.name}</div></div>
        <div className="form-group"><label className="form-label">Email</label><div className="input" aria-readonly="true">{user?.email}</div></div>
        <div className="form-group"><label className="form-label">Role</label><div className="input" aria-readonly="true" style={{ textTransform: 'capitalize' }}>{user?.role}</div></div>
        <button className="btn btn-secondary" onClick={logout}>Sign out</button>
      </div>
    </div>
  );
}

export function ExceptionsPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { miscApi.exceptions().then(r => setItems(r.data)); }, []);
  return (
    <div className="fade-in">
      <div className="page-header"><div><h1 className="page-title">Exceptions</h1><p className="page-subtitle">Resolve delivery issues before they become escalations</p></div></div>
      <div className="table-container"><table><thead><tr><th>Order</th><th>Reason</th><th>Action</th><th>Status</th><th>Reported</th></tr></thead><tbody>
        {items.map(item => <tr key={item.id}><td>#{item.order_id}</td><td>{item.reason}</td><td>{item.action_taken || 'Pending review'}</td><td><span className={`badge ${item.resolved ? 'badge-delivered' : 'badge-failed'}`}>{item.resolved ? 'resolved' : 'open'}</span></td><td>{new Date(item.created_at).toLocaleString()}</td></tr>)}
      </tbody></table>{items.length === 0 && <div className="empty-state"><div className="empty-state-icon">✅</div><h3>No active exceptions</h3></div>}</div>
    </div>
  );
}

export function AgentMapPage() {
  const [agents, setAgents] = useState<any[]>([]);
  useEffect(() => {
    const load = () => trackingApi.liveAgents().then(r => setAgents(r.data.agents));
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);
  const agent = agents[0];
  const center: [number, number] = agent ? [agent.lat, agent.lng] : [11.0168, 76.9558];
  return (
    <div className="fade-in">
      <div className="page-header"><div><h1 className="page-title">Route Map</h1><p className="page-subtitle">Live delivery locations</p></div></div>
      <div className="map-container" style={{ height: 520, marginBottom: 20 }}>
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {agent && <>
            <Marker position={[agent.lat, agent.lng]} icon={routeAgentIcon}>
              <Popup><strong>{agent.name}</strong><br />{agent.active_orders} active deliveries</Popup>
            </Marker>
            {agent.deliveries.slice(0, 5).map((delivery: any) => <span key={delivery.order_id}>
              <Polyline positions={[[agent.lat, agent.lng], [delivery.delivery_lat, delivery.delivery_lng]]} pathOptions={{ color: delivery.priority === 'urgent' ? '#f43f5e' : '#3b82f6', weight: 3, dashArray: '7, 6' }} />
              <Marker position={[delivery.delivery_lat, delivery.delivery_lng]} icon={routeDeliveryIcon}>
                <Popup><strong>{delivery.order_code}</strong><br />{delivery.delivery_address}<br />{delivery.status.replace(/_/g, ' ')}</Popup>
              </Marker>
            </span>)}
          </>}
        </MapContainer>
      </div>
      <div className="card"><div className="section-title">Current position and deliveries</div>{agents.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No live location available yet.</p> : agents.map(agent => <div key={agent.agent_id} className="notification-row"><span className="pulse-dot pulse-green" /><span style={{ flex: 1 }}><strong>{agent.name}</strong><small>{agent.active_orders} active deliveries</small></span><span>{agent.lat.toFixed(4)}, {agent.lng.toFixed(4)}</span></div>)}</div>
    </div>
  );
}

export function AgentDashboardPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => ordersApi.list().then(r => setOrders(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const advance = async (order: any) => {
    const next: Record<string, string> = { assigned: 'accepted', accepted: 'picked_up', picked_up: 'out_for_delivery', out_for_delivery: 'delivered' };
    if (!next[order.status]) return;
    try { await ordersApi.update(order.id, { status: next[order.status] }); toast.success(`Order ${order.order_code} updated`); load(); } catch (e: any) { toast.error(e.response?.data?.detail || 'Unable to update order'); }
  };
  return <div className="fade-in"><div className="page-header"><div><h1 className="page-title">My Deliveries</h1><p className="page-subtitle">{orders.length} assigned deliveries</p></div></div><div className="table-container">{loading ? <div className="loading-center"><div className="spinner" /></div> : <table><thead><tr><th>Order</th><th>Customer</th><th>Address</th><th>Status</th><th /></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td>{order.order_code}</td><td>{order.customer_name}</td><td>{order.delivery_address}</td><td><span className={`badge badge-${order.status}`}>{order.status.replace(/_/g, ' ')}</span></td><td>{order.status !== 'delivered' && <button className="btn btn-primary btn-sm" onClick={() => advance(order)}>Update status</button>}</td></tr>)}</tbody></table>}</div></div>;
}
