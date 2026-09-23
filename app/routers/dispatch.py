from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import Order, Agent, Assignment, DeliveryStatusHistory, User, Notification
from app.schemas.schemas import AssignmentCreate, AssignmentOut, AgentScore
from app.services.auth_service import get_current_user, require_roles
from app.services.dispatch import recommend_agents, get_agent_active_orders

router = APIRouter(prefix="/api/dispatch", tags=["dispatch"])


@router.post("/recommend/{order_id}")
def recommend(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    results = recommend_agents(order, db, top_n=5)
    if not results:
        raise HTTPException(status_code=404, detail="No available agents found")

    response = []
    for r in results:
        agent = r["agent"]
        sd = r["score_data"]
        response.append({
            "agent": {
                "id": agent.id,
                "agent_code": agent.agent_code,
                "name": agent.user.name if agent.user else "Unknown",
                "vehicle_type": agent.vehicle_type,
                "zone": agent.zone,
                "rating": agent.rating,
                "is_available": agent.is_available,
                "current_lat": agent.current_lat,
                "current_lng": agent.current_lng,
            },
            "score": sd["total"],
            "distance_km": sd["distance_km"],
            "active_orders": sd["active_orders"],
            "score_breakdown": {
                "distance": sd["distance_score"],
                "workload": sd["workload_score"],
                "availability": sd["availability_score"],
                "performance": sd["performance_score"],
                "priority_fit": sd["priority_fit_score"],
            }
        })

    return {"order_id": order_id, "recommendations": response}


@router.post("/assign")
def assign_order(
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    order = db.query(Order).filter(Order.id == assignment_in.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    agent = db.query(Agent).filter(Agent.id == assignment_in.agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Remove existing assignment if any
    existing = db.query(Assignment).filter(Assignment.order_id == assignment_in.order_id).first()
    if existing:
        db.delete(existing)

    assignment = Assignment(
        order_id=assignment_in.order_id,
        agent_id=assignment_in.agent_id,
        assigned_by=current_user.id,
        ai_score=assignment_in.ai_score,
        ai_recommended=assignment_in.ai_recommended,
        notes=assignment_in.notes,
    )
    db.add(assignment)

    order.status = "assigned"
    order.assigned_agent_id = assignment_in.agent_id

    # Status history
    history = DeliveryStatusHistory(
        order_id=order.id,
        status="assigned",
        note=f"Assigned to agent {agent.agent_code}" + (" (AI recommended)" if assignment_in.ai_recommended else ""),
        updated_by=current_user.id
    )
    db.add(history)

    # Notify agent
    if agent.user_id:
        notif = Notification(
            user_id=agent.user_id,
            title="New Delivery Assigned",
            message=f"Order {order.order_code} has been assigned to you. Delivery to: {order.delivery_address}",
            type="info",
            order_id=order.id
        )
        db.add(notif)

    db.commit()
    return {"status": "assigned", "order_id": order.id, "agent_id": agent.id, "agent_code": agent.agent_code}


@router.post("/reassign")
def reassign_order(
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    """Reassign an already-assigned order to a different agent."""
    order = db.query(Order).filter(Order.id == assignment_in.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_agent_id = order.assigned_agent_id
    return assign_order(assignment_in, db, current_user)


@router.get("/ai-operations")
def ai_operations(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    """AI operations center: at-risk deliveries and overloaded agents."""
    from app.services.ml_service import get_delay_prediction, generate_explanation
    from app.services.dispatch import haversine_distance
    import math

    active_orders = db.query(Order).filter(
        Order.status.in_(["assigned", "accepted", "picked_up", "out_for_delivery"])
    ).all()

    at_risk = []
    for order in active_orders:
        agent = db.query(Agent).filter(Agent.id == order.assigned_agent_id).first() if order.assigned_agent_id else None
        if not agent:
            continue

        active_count = get_agent_active_orders(agent.id, db)
        dist_km = haversine_distance(
            order.pickup_lat, order.pickup_lng,
            order.delivery_lat, order.delivery_lng
        )

        from datetime import datetime
        hour = datetime.utcnow().hour
        day = datetime.utcnow().weekday()

        traffic = 2.0 if 7 <= hour <= 9 or 17 <= hour <= 20 else 1.0

        prediction = get_delay_prediction(
            distance_km=dist_km, hour_of_day=hour, day_of_week=day,
            package_weight=order.package_weight or 1.0,
            agent_workload=active_count, traffic_level=traffic,
            priority=order.priority or "medium"
        )
        explanation = generate_explanation(
            prediction["risk"], prediction["probability"],
            dist_km, active_count, traffic, hour
        )

        if prediction["risk"] in ["medium", "high"]:
            # Get best alternative agent
            recs = recommend_agents(order, db, top_n=3)
            alt_agent = None
            for r in recs:
                if r["agent"].id != agent.id:
                    alt_agent = {
                        "id": r["agent"].id,
                        "agent_code": r["agent"].agent_code,
                        "name": r["agent"].user.name if r["agent"].user else "Unknown",
                        "score": r["score_data"]["total"],
                    }
                    break

            at_risk.append({
                "order_id": order.id,
                "order_code": order.order_code,
                "customer_name": order.customer_name,
                "status": order.status,
                "priority": order.priority,
                "delay_risk": prediction["risk"],
                "delay_probability": prediction["probability"],
                "explanation": explanation,
                "agent": {
                    "id": agent.id,
                    "agent_code": agent.agent_code,
                    "name": agent.user.name if agent.user else "Unknown",
                    "active_orders": active_count,
                },
                "recommended_reassignment": alt_agent,
            })

    # Overloaded agents
    all_agents = db.query(Agent).all()
    overloaded = []
    for agent in all_agents:
        active = get_agent_active_orders(agent.id, db)
        if active >= 6:
            overloaded.append({
                "agent_id": agent.id,
                "agent_code": agent.agent_code,
                "name": agent.user.name if agent.user else "Unknown",
                "active_orders": active,
            })

    high_risk = [o for o in at_risk if o["delay_risk"] == "high"]
    medium_risk = [o for o in at_risk if o["delay_risk"] == "medium"]

    return {
        "total_active_orders": len(active_orders),
        "at_risk_count": len(at_risk),
        "high_risk_count": len(high_risk),
        "medium_risk_count": len(medium_risk),
        "overloaded_agents": overloaded,
        "at_risk_deliveries": sorted(at_risk, key=lambda x: x["delay_probability"], reverse=True),
        "recommended_reassignments": len([o for o in at_risk if o["recommended_reassignment"]]),
    }
