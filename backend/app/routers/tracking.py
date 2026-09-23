from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List
import json
import asyncio
from app.database import get_db
from app.models.models import Agent, AgentLocation, User
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/api/tracking", tags=["tracking"])

# In-memory WebSocket connections: {agent_id: [WebSocket]}
_manager_connections: List[WebSocket] = []


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for managers to receive live location updates."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; actual data pushed via broadcast
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.post("/agent/{agent_id}/location")
async def update_location(
    agent_id: int,
    lat: float,
    lng: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Agent posts their location; broadcasts to all connected managers."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if current_user.role == "agent" and agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot update another agent's location")
    if current_user.role not in ("agent", "manager", "admin"):
        raise HTTPException(status_code=403, detail="Only agents and managers can update locations")

    agent.current_lat = lat
    agent.current_lng = lng
    loc = AgentLocation(agent_id=agent_id, lat=lat, lng=lng)
    db.add(loc)
    db.commit()

    payload = {
        "type": "location_update",
        "agent_id": agent_id,
        "lat": lat,
        "lng": lng,
    }
    await manager.broadcast(payload)
    return {"status": "ok"}


@router.get("/agents/live")
def get_live_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Snapshot of all agent current locations."""
    query = db.query(Agent).filter(Agent.current_lat.isnot(None))
    if current_user.role == "agent":
        query = query.filter(Agent.user_id == current_user.id)
    elif current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Only agents and managers can view live locations")
    agents = query.all()

    result = []
    for agent in agents:
        from app.services.dispatch import get_agent_active_orders
        active = get_agent_active_orders(agent.id, db)

        # Get current assigned orders
        from app.models.models import Order
        orders = db.query(Order).filter(
            Order.assigned_agent_id == agent.id,
            Order.status.in_(["assigned", "accepted", "picked_up", "out_for_delivery"])
        ).all()

        result.append({
            "agent_id": agent.id,
            "agent_code": agent.agent_code,
            "name": agent.user.name if agent.user else "Unknown",
            "lat": agent.current_lat,
            "lng": agent.current_lng,
            "is_available": agent.is_available,
            "active_orders": active,
            "vehicle_type": agent.vehicle_type,
            "deliveries": [
                {
                    "order_id": o.id,
                    "order_code": o.order_code,
                    "status": o.status,
                    "delivery_lat": o.delivery_lat,
                    "delivery_lng": o.delivery_lng,
                    "delivery_address": o.delivery_address,
                    "priority": o.priority,
                }
                for o in orders
            ]
        })
    return {"agents": result}
