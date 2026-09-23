import math
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models.models import Agent, Order, OrderStatus


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate great-circle distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


PRIORITY_WEIGHTS = {"low": 0.6, "medium": 0.8, "high": 1.0, "urgent": 1.2}
VEHICLE_CAPACITY = {"bike": "low", "car": "medium", "van": "high", "truck": "urgent"}
VEHICLE_PRIORITY_SCORES = {"bike": {"low": 1.0, "medium": 0.9, "high": 0.6, "urgent": 0.3},
                            "car": {"low": 0.9, "medium": 1.0, "high": 0.9, "urgent": 0.7},
                            "van": {"low": 0.8, "medium": 0.9, "high": 1.0, "urgent": 0.95},
                            "truck": {"low": 0.6, "medium": 0.8, "high": 0.95, "urgent": 1.0}}


def score_agent(agent: Agent, order: Order, active_orders: int, db: Session) -> Dict:
    """
    Score an agent for a given order using weighted criteria:
      Distance       30%
      Workload       25%
      Availability   20%
      Performance    15%
      Priority fit   10%
    Returns a dict with total score and component breakdown.
    """
    # 1. Distance score (closer = higher)
    if agent.current_lat and agent.current_lng:
        dist_km = haversine_distance(
            agent.current_lat, agent.current_lng,
            order.delivery_lat, order.delivery_lng
        )
    else:
        # Default to warehouse-to-delivery distance
        dist_km = haversine_distance(
            order.pickup_lat, order.pickup_lng,
            order.delivery_lat, order.delivery_lng
        )

    max_dist = 30.0  # km cap
    dist_score = max(0.0, 1.0 - (dist_km / max_dist)) * 100

    # 2. Workload score (fewer active = higher)
    max_load = 10
    workload_score = max(0.0, 1.0 - (active_orders / max_load)) * 100

    # 3. Availability score
    availability_score = 100.0 if agent.is_available else 20.0

    # 4. Performance score (based on on-time rate + rating)
    if agent.total_deliveries > 0:
        on_time_rate = (agent.completed_deliveries - agent.delayed_deliveries) / max(agent.total_deliveries, 1)
        perf_score = (on_time_rate * 0.7 + (agent.rating / 5.0) * 0.3) * 100
    else:
        perf_score = 70.0  # new agent default

    # 5. Priority fit score (vehicle type suits priority)
    priority = order.priority if order.priority else "medium"
    vehicle = agent.vehicle_type if agent.vehicle_type else "bike"
    vp_scores = VEHICLE_PRIORITY_SCORES.get(vehicle, {"low": 0.8, "medium": 0.8, "high": 0.8, "urgent": 0.8})
    priority_score = vp_scores.get(priority, 0.8) * 100

    # Weighted total
    total = (
        dist_score * 0.30 +
        workload_score * 0.25 +
        availability_score * 0.20 +
        perf_score * 0.15 +
        priority_score * 0.10
    )

    return {
        "total": round(total, 1),
        "distance_km": round(dist_km, 2),
        "distance_score": round(dist_score, 1),
        "workload_score": round(workload_score, 1),
        "availability_score": round(availability_score, 1),
        "performance_score": round(perf_score, 1),
        "priority_fit_score": round(priority_score, 1),
        "active_orders": active_orders,
    }


def get_agent_active_orders(agent_id: int, db: Session) -> int:
    """Count active (non-terminal) orders for an agent."""
    active_statuses = [
        OrderStatus.assigned, OrderStatus.accepted,
        OrderStatus.picked_up, OrderStatus.out_for_delivery
    ]
    return db.query(Order).filter(
        Order.assigned_agent_id == agent_id,
        Order.status.in_([s.value for s in active_statuses])
    ).count()


def recommend_agents(order: Order, db: Session, top_n: int = 5) -> List[Dict]:
    """Return top_n agents ranked by dispatch score for a given order."""
    agents = db.query(Agent).filter(Agent.is_available == True).all()

    scored = []
    for agent in agents:
        active = get_agent_active_orders(agent.id, db)
        score_data = score_agent(agent, order, active, db)
        scored.append({"agent": agent, "score_data": score_data})

    scored.sort(key=lambda x: x["score_data"]["total"], reverse=True)
    return scored[:top_n]
