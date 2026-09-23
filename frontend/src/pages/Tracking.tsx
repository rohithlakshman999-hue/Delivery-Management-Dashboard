import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { trackingApi } from '../services/api';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const agentIcon = (available: boolean) => L.divIcon({
  className: '',
  html: `<div style="
    background: ${available ? 'var(--accent-emerald, #10b981)' : '#f43f5e'};
    width: 28px; height: 28px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  ">🛵</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const deliveryIcon = L.divIcon({
  className: '',
  html: `<div style="
    background: #f59e0b; width: 22px; height: 22px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; border: 2px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  ">📦</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const WAREHOUSE = { lat: 11.0168, lng: 76.9558, name: 'Main Warehouse' };
const warehouseIcon = L.divIcon({
  className: '',
  html: `<div style="
    background: #3b82f6; width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; border: 2px solid white;
    box-shadow: 0 2px 12px rgba(59,130,246,0.5);
  ">🏭</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Simulate agent movement for demo
function useSimulatedMovement(agents: any[]) {
  const [positions, setPositions] = useState<Record<number, { lat: number; lng: number }>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    const initial: Record<number, { lat: number; lng: number }> = {};
    agents.forEach(a => { initial[a.agent_id] = { lat: a.lat, lng: a.lng }; });
    setPositions(initial);

    intervalRef.current = setInterval(() => {
      setPositions(prev => {
        const next = { ...prev };
        agents.forEach(a => {
          if (a.active_orders > 0 && a.deliveries.length > 0) {
            const target = a.deliveries[0];
            const cur = next[a.agent_id] || { lat: a.lat, lng: a.lng };
            const dlat = (target.delivery_lat - cur.lat) * 0.008;
            const dlng = (target.delivery_lng - cur.lng) * 0.008;
            next[a.agent_id] = {
              lat: cur.lat + dlat + (Math.random() - 0.5) * 0.001,
              lng: cur.lng + dlng + (Math.random() - 0.5) * 0.001,
            };
          }
        });
        return next;
      });
    }, 1500);

    return () => clearInterval(intervalRef.current);
  }, [agents]);

  return positions;
}

export default function TrackingPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    trackingApi.liveAgents().then(r => setAgents(r.data.agents)).finally(() => setLoading(false));
    const interval = setInterval(() => {
      trackingApi.liveAgents().then(r => setAgents(r.data.agents));
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const positions = useSimulatedMovement(agents);

  if (loading) return <div className="loading-center"><div className="spinner" style={{ width: 32, height: 32 }} /><p>Loading live map...</p></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">📍 Live Delivery Tracking</h1>
          <p className="page-subtitle">{agents.length} agents · {agents.filter(a => a.active_orders > 0).length} on delivery</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="pulse-dot pulse-green" />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live — Updates every 8s</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Map */}
        <div className="map-container" style={{ height: 560 }}>
          <MapContainer
            center={[11.0168, 76.9558]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {/* Warehouse */}
            <Marker position={[WAREHOUSE.lat, WAREHOUSE.lng]} icon={warehouseIcon}>
              <Popup><strong>🏭 {WAREHOUSE.name}</strong><br />Central distribution hub</Popup>
            </Marker>

            {/* Agents + their deliveries */}
            {agents.map(agent => {
              const pos = positions[agent.agent_id] || { lat: agent.lat, lng: agent.lng };
              return (
                <div key={agent.agent_id}>
                  <Marker
                    position={[pos.lat, pos.lng]}
                    icon={agentIcon(agent.is_available)}
                    eventHandlers={{ click: () => setSelected(agent) }}
                  >
                    <Popup>
                      <div style={{ fontFamily: 'sans-serif', minWidth: 140 }}>
                        <strong>{agent.name}</strong> ({agent.agent_code})<br />
                        {agent.vehicle_type} · {agent.active_orders} active orders
                      </div>
                    </Popup>
                  </Marker>

                  {/* Route lines from agent to each delivery */}
                  {agent.deliveries.slice(0, 1).map((d: any) => (
                    <div key={d.order_id}>
                      <Polyline
                        positions={[
                          [pos.lat, pos.lng],
                          [d.delivery_lat, d.delivery_lng]
                        ]}
                        pathOptions={{
                          color: d.priority === 'urgent' ? '#f43f5e' : d.priority === 'high' ? '#f59e0b' : '#3b82f6',
                          weight: 2, dashArray: '6,4', opacity: 0.8
                        }}
                      />
                      <Marker position={[d.delivery_lat, d.delivery_lng]} icon={deliveryIcon}>
                        <Popup>
                          <div style={{ fontFamily: 'sans-serif', minWidth: 150 }}>
                            <strong>{d.order_code}</strong><br />
                            {d.delivery_address}<br />
                            <span style={{ color: '#f59e0b' }}>{d.status.replace(/_/g,' ')}</span>
                          </div>
                        </Popup>
                      </Marker>
                    </div>
                  ))}
                </div>
              );
            })}
          </MapContainer>
        </div>

        {/* Agent list */}
        <div style={{ overflowY: 'auto', maxHeight: 560 }}>
          <p className="section-title">🛵 Active Agents</p>
          {agents.map(agent => (
            <div key={agent.agent_id}
              className="card"
              style={{
                marginBottom: 10, cursor: 'pointer',
                borderColor: selected?.agent_id === agent.agent_id ? 'var(--accent-blue)' : 'var(--border)'
              }}
              onClick={() => setSelected(agent)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{agent.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{agent.agent_code}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`pulse-dot ${agent.active_orders > 0 ? 'pulse-green' : 'pulse-amber'}`} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: agent.active_orders > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                    {agent.active_orders} active
                  </span>
                </div>
              </div>
              {agent.deliveries.slice(0, 2).map((d: any) => (
                <div key={d.order_id} style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 8px',
                  background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4 }}>
                  <span className={`badge badge-${d.priority}`} style={{ marginRight: 6 }}>{d.priority}</span>
                  {d.order_code} → {d.delivery_address.split(',')[0]}
                </div>
              ))}
            </div>
          ))}
          {agents.length === 0 && (
            <div className="empty-state"><div className="empty-state-icon">🗺️</div><h3>No agents with locations</h3></div>
          )}
        </div>
      </div>
    </div>
  );
}
