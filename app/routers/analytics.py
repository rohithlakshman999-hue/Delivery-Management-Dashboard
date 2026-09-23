from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.models import Order, Agent, DeliveryStatusHistory, User
from app.services.auth_service import require_roles
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    total = db.query(func.count(Order.id)).scalar()
    delivered = db.query(Order).filter(Order.status == "delivered").count()
    active = db.query(Order).filter(Order.status == "out_for_delivery").count()
    pending = db.query(Order).filter(Order.status == "pending").count()
    assigned = db.query(Order).filter(Order.status.in_(["assigned", "accepted", "picked_up"])).count()
    failed = db.query(Order).filter(Order.status == "failed").count()
    total_agents = db.query(Agent).count()
    available_agents = db.query(Agent).filter(Agent.is_available == True).count()

    on_time_rate = round((delivered / max(total, 1)) * 100, 1)

    return {
        "total_orders": total,
        "delivered": delivered,
        "active": active,
        "pending": pending,
        "assigned": assigned,
        "failed": failed,
        "total_agents": total_agents,
        "available_agents": available_agents,
        "on_time_rate": on_time_rate,
    }


@router.get("/volume-by-day")
def volume_by_day(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    """Delivery volume for each day of the last 7 days."""
    days = []
    now = datetime.utcnow()
    for i in range(6, -1, -1):
        day = now - timedelta(days=i)
        start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        count = db.query(Order).filter(
            Order.created_at >= start,
            Order.created_at < end
        ).count()
        days.append({"date": start.strftime("%a %d %b"), "count": count})
    return {"data": days}


@router.get("/agent-performance")
def agent_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    agents = db.query(Agent).all()
    result = []
    for agent in agents:
        if agent.total_deliveries == 0:
            continue
        on_time = agent.completed_deliveries - agent.delayed_deliveries
        rate = round((on_time / max(agent.completed_deliveries, 1)) * 100, 1)
        result.append({
            "agent_id": agent.id,
            "agent_code": agent.agent_code,
            "name": agent.user.name if agent.user else "Unknown",
            "total_deliveries": agent.total_deliveries,
            "completed": agent.completed_deliveries,
            "delayed": agent.delayed_deliveries,
            "failed": agent.failed_deliveries,
            "on_time_rate": rate,
            "rating": agent.rating,
        })
    result.sort(key=lambda x: x["on_time_rate"], reverse=True)
    return {"data": result}


@router.get("/delivery-times")
def delivery_times(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    """Stats on delivery duration for completed orders."""
    completed = db.query(Order).filter(
        Order.status == "delivered",
        Order.delivered_at.isnot(None)
    ).all()

    durations = []
    for o in completed:
        delta = (o.delivered_at - o.created_at).total_seconds() / 60  # minutes
        if delta > 0:
            durations.append(delta)

    if not durations:
        return {"average": 0, "minimum": 0, "maximum": 0, "median": 0, "count": 0}

    durations.sort()
    n = len(durations)
    median = durations[n // 2] if n % 2 == 1 else (durations[n // 2 - 1] + durations[n // 2]) / 2

    return {
        "average": round(sum(durations) / n, 1),
        "minimum": round(min(durations), 1),
        "maximum": round(max(durations), 1),
        "median": round(median, 1),
        "count": n,
    }


@router.get("/priority-distribution")
def priority_distribution(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    data = db.query(Order.priority, func.count(Order.id)).group_by(Order.priority).all()
    return {"data": {p: c for p, c in data}}
