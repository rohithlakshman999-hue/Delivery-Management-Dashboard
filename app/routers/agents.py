from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import random
import string
from app.database import get_db
from app.models.models import Agent, User, Order, OrderStatus
from app.schemas.schemas import AgentCreate, AgentOut, AgentUpdate, AgentLocationUpdate
from app.services.auth_service import hash_password, get_current_user, require_roles
from app.services.dispatch import get_agent_active_orders

router = APIRouter(prefix="/api/agents", tags=["agents"])


def generate_agent_code():
    return "A" + "".join(random.choices(string.digits, k=4))


@router.post("/", response_model=AgentOut, status_code=201)
def create_agent(
    agent_in: AgentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    existing = db.query(User).filter(User.email == agent_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user account
    user = User(
        email=agent_in.email,
        name=agent_in.name,
        hashed_password=hash_password(agent_in.password),
        role="agent",
    )
    db.add(user)
    db.flush()

    code = generate_agent_code()
    while db.query(Agent).filter(Agent.agent_code == code).first():
        code = generate_agent_code()

    agent = Agent(
        user_id=user.id,
        agent_code=code,
        phone=agent_in.phone,
        vehicle_type=agent_in.vehicle_type,
        zone=agent_in.zone,
        # Default location: Coimbatore warehouse
        current_lat=11.0168 + random.uniform(-0.05, 0.05),
        current_lng=76.9558 + random.uniform(-0.05, 0.05),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return agent


@router.get("/", response_model=List[AgentOut])
def list_agents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Agent).all()


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int,
    updates: AgentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Agents can only update their own availability
    if current_user.role == "agent" and agent.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot modify another agent's profile")

    for field, value in updates.model_dump(exclude_none=True).items():
        setattr(agent, field, value)
    db.commit()
    db.refresh(agent)
    return agent


@router.post("/{agent_id}/location")
def update_agent_location(
    agent_id: int,
    loc: AgentLocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    agent.current_lat = loc.lat
    agent.current_lng = loc.lng
    db.commit()
    return {"status": "ok"}


@router.get("/{agent_id}/stats")
def get_agent_stats(
    agent_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    active_orders = get_agent_active_orders(agent_id, db)
    on_time = agent.completed_deliveries - agent.delayed_deliveries
    on_time_rate = round((on_time / max(agent.completed_deliveries, 1)) * 100, 1)

    return {
        "agent_id": agent_id,
        "agent_code": agent.agent_code,
        "total_deliveries": agent.total_deliveries,
        "completed_deliveries": agent.completed_deliveries,
        "delayed_deliveries": agent.delayed_deliveries,
        "failed_deliveries": agent.failed_deliveries,
        "on_time_rate": on_time_rate,
        "active_orders": active_orders,
        "rating": agent.rating,
        "is_available": agent.is_available,
    }
