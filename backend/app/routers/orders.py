from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
import csv
import io
from sqlalchemy.orm import Session
from typing import List, Optional
import random
import string
from datetime import datetime
from app.database import get_db
from app.models.models import Order, DeliveryStatusHistory, User, Notification, Agent
from app.schemas.schemas import OrderCreate, OrderOut, OrderUpdate, StatusHistoryOut
from app.services.auth_service import get_current_user, require_roles

router = APIRouter(prefix="/api/orders", tags=["orders"])


def can_access_order(order: Order, current_user: User, db: Session) -> bool:
    if current_user.role in ("manager", "admin"):
        return True
    if current_user.role == "customer":
        return order.customer_email == current_user.email
    agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
    return bool(agent and order.assigned_agent_id == agent.id)


def generate_order_code():
    return "#" + "".join(random.choices(string.digits, k=5))


def add_status_history(db: Session, order_id: int, status: str, note: str = None, user_id: int = None):
    history = DeliveryStatusHistory(
        order_id=order_id,
        status=status,
        note=note,
        updated_by=user_id,
    )
    db.add(history)


def notify_users(db: Session, user_id: int, title: str, message: str, type_: str = "info", order_id: int = None):
    n = Notification(user_id=user_id, title=title, message=message, type=type_, order_id=order_id)
    db.add(n)


@router.post("/", response_model=OrderOut, status_code=201)
def create_order(
    order_in: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin", "customer"))
):
    code = generate_order_code()
    while db.query(Order).filter(Order.order_code == code).first():
        code = generate_order_code()

    order = Order(**order_in.model_dump(), order_code=code)
    db.add(order)
    db.flush()
    add_status_history(db, order.id, "pending", "Order created", current_user.id)
    db.commit()
    db.refresh(order)
    return order


@router.post("/import")
async def import_orders(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin")),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file")

    contents = await file.read()
    try:
        rows = csv.DictReader(io.StringIO(contents.decode("utf-8-sig")))
        imported = 0
        errors = []
        for line_number, row in enumerate(rows, start=2):
            try:
                required = ["customer_name", "customer_phone", "delivery_address", "delivery_lat", "delivery_lng"]
                missing = [field for field in required if not row.get(field)]
                if missing:
                    raise ValueError(f"missing {', '.join(missing)}")
                code = generate_order_code()
                while db.query(Order).filter(Order.order_code == code).first():
                    code = generate_order_code()
                order = Order(
                    order_code=code,
                    customer_name=row["customer_name"],
                    customer_phone=row["customer_phone"],
                    customer_email=row.get("customer_email") or None,
                    delivery_address=row["delivery_address"],
                    delivery_lat=float(row["delivery_lat"]),
                    delivery_lng=float(row["delivery_lng"]),
                    pickup_address=row.get("pickup_address") or "Main Warehouse, Coimbatore",
                    pickup_lat=float(row.get("pickup_lat") or 11.0168),
                    pickup_lng=float(row.get("pickup_lng") or 76.9558),
                    package_description=row.get("package_description") or None,
                    package_weight=float(row.get("package_weight") or 1.0),
                    priority=(row.get("priority") or "medium").lower(),
                    notes=row.get("notes") or None,
                )
                if order.priority not in {"low", "medium", "high", "urgent"}:
                    raise ValueError("priority must be low, medium, high, or urgent")
                db.add(order)
                db.flush()
                add_status_history(db, order.id, "pending", "Imported from CSV", current_user.id)
                imported += 1
            except (TypeError, ValueError) as exc:
                errors.append({"line": line_number, "error": str(exc)})
        db.commit()
        return {"imported": imported, "errors": errors}
    except UnicodeDecodeError:
        db.rollback()
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")


@router.get("/", response_model=List[OrderOut])
def list_orders(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    agent_id: Optional[int] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    q = db.query(Order)
    if current_user.role == "agent":
        # Agents see only their assigned orders
        agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
        if agent:
            q = q.filter(Order.assigned_agent_id == agent.id)
    elif current_user.role == "customer":
        q = q.filter(Order.customer_email == current_user.email)
    if status:
        q = q.filter(Order.status == status)
    if priority:
        q = q.filter(Order.priority == priority)
    if agent_id:
        q = q.filter(Order.assigned_agent_id == agent_id)
    return q.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/stats")
def order_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    from sqlalchemy import func
    total = db.query(func.count(Order.id)).scalar()
    by_status = db.query(Order.status, func.count(Order.id)).group_by(Order.status).all()
    by_priority = db.query(Order.priority, func.count(Order.id)).group_by(Order.priority).all()

    delivered = db.query(Order).filter(Order.status == "delivered").count()
    delayed = db.query(Order).filter(Order.status == "failed").count()

    return {
        "total": total,
        "by_status": {s: c for s, c in by_status},
        "by_priority": {p: c for p, c in by_priority},
        "delivered": delivered,
        "failed": delayed,
        "active": db.query(Order).filter(Order.status == "out_for_delivery").count(),
        "pending": db.query(Order).filter(Order.status == "pending").count(),
        "assigned": db.query(Order).filter(Order.status.in_(["assigned", "accepted", "picked_up"])).count(),
    }


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not can_access_order(order, current_user, db):
        raise HTTPException(status_code=403, detail="You cannot access this order")
    return order


@router.patch("/{order_id}", response_model=OrderOut)
def update_order(
    order_id: int,
    updates: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.role == "customer":
        raise HTTPException(status_code=403, detail="Customers cannot update orders")

    # Only agents can update status on their own orders
    if current_user.role == "agent":
        agent = db.query(Agent).filter(Agent.user_id == current_user.id).first()
        if not agent or order.assigned_agent_id != agent.id:
            raise HTTPException(status_code=403, detail="Not your order")
        # Agents can only update status
        if updates.status:
            old_status = order.status
            order.status = updates.status.value
            if updates.status.value == "delivered":
                order.delivered_at = datetime.utcnow()
                # Update agent stats
                agent.total_deliveries += 1
                agent.completed_deliveries += 1
            add_status_history(db, order.id, updates.status.value, user_id=current_user.id)
    else:
        for field, value in updates.model_dump(exclude_none=True).items():
            if field == "status":
                setattr(order, field, value.value if hasattr(value, 'value') else value)
                add_status_history(db, order.id, value.value if hasattr(value, 'value') else value,
                                    user_id=current_user.id)
            else:
                setattr(order, field, value)

    db.commit()
    db.refresh(order)
    return order


@router.delete("/{order_id}", status_code=204)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("manager", "admin"))
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    db.delete(order)
    db.commit()


@router.get("/{order_id}/history", response_model=List[StatusHistoryOut])
def get_order_history(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not can_access_order(order, current_user, db):
        raise HTTPException(status_code=403, detail="You cannot access this order")
    return db.query(DeliveryStatusHistory).filter(
        DeliveryStatusHistory.order_id == order_id
    ).order_by(DeliveryStatusHistory.timestamp).all()
