from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.models import Notification, User, DeliveryException, DeliveryProof, Order, Agent
from app.schemas.schemas import NotificationOut, ExceptionCreate, ExceptionOut, ProofCreate, ProofOut
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/api/misc", tags=["misc"])


# ── Notifications ──────────────────────────────────────────────────────────────
@router.get("/notifications", response_model=List[NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()


@router.patch("/notifications/{notif_id}/read")
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id
    ).first()
    if n:
        n.is_read = True
        db.commit()
    return {"status": "ok"}


@router.post("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


# ── Exceptions ─────────────────────────────────────────────────────────────────
@router.post("/exceptions", response_model=ExceptionOut, status_code=201)
def report_exception(
    exc_in: ExceptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == exc_in.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if current_user.role == "agent":
        if not agent or order.assigned_agent_id != agent.id:
            raise HTTPException(status_code=403, detail="Only the assigned agent can report this exception")
    elif current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Only agents and managers can report exceptions")
    agent_id = agent.id if agent else order.assigned_agent_id

    existing = db.query(DeliveryException).filter(DeliveryException.order_id == order.id).first()
    if existing and not existing.resolved:
        raise HTTPException(status_code=409, detail="An active exception already exists for this order")

    exc = DeliveryException(
        order_id=exc_in.order_id,
        agent_id=agent_id,
        reason=exc_in.reason,
        description=exc_in.description,
        action_taken=exc_in.action_taken,
    )
    db.add(exc)

    order.status = "failed"
    if agent:
        agent.failed_deliveries += 1

    # Notify managers
    managers = db.query(User).filter(User.role == "manager").all()
    for mgr in managers:
        n = Notification(
            user_id=mgr.id,
            title="Delivery Exception",
            message=f"Order {order.order_code}: {exc_in.reason}. Action: {exc_in.action_taken or 'None'}",
            type="warning",
            order_id=order.id
        )
        db.add(n)

    db.commit()
    db.refresh(exc)
    return exc


@router.get("/exceptions", response_model=List[ExceptionOut])
def list_exceptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    return db.query(DeliveryException).order_by(DeliveryException.created_at.desc()).all()


# ── Proof of Delivery ─────────────────────────────────────────────────────────
@router.post("/proof", response_model=ProofOut, status_code=201)
def submit_proof(
    proof_in: ProofCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == proof_in.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    if not agent:
        raise HTTPException(status_code=403, detail="Only agents can submit proof")
    if order.assigned_agent_id != agent.id:
        raise HTTPException(status_code=403, detail="Only the assigned agent can submit proof")
    if order.status != "delivered":
        raise HTTPException(status_code=409, detail="Proof can only be submitted after delivery")

    existing = db.query(DeliveryProof).filter(DeliveryProof.order_id == order.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Proof already submitted for this order")

    proof = DeliveryProof(
        order_id=proof_in.order_id,
        agent_id=agent.id,
        otp=proof_in.otp,
        recipient_name=proof_in.recipient_name,
        delivered_lat=proof_in.delivered_lat,
        delivered_lng=proof_in.delivered_lng,
        notes=proof_in.notes,
    )
    db.add(proof)
    db.commit()
    db.refresh(proof)
    return proof
