from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


class UserRole(str, enum.Enum):
    manager = "manager"
    agent = "agent"
    customer = "customer"
    admin = "admin"


class OrderStatus(str, enum.Enum):
    created = "created"
    pending = "pending"
    assigned = "assigned"
    accepted = "accepted"
    picked_up = "picked_up"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"
    failed = "failed"
    rescheduled = "rescheduled"


class Priority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class DelayRisk(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default=UserRole.customer)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")


class Agent(Base):
    __tablename__ = "agents"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    agent_code = Column(String, unique=True, index=True)
    phone = Column(String)
    vehicle_type = Column(String, default="bike")  # bike, car, van, truck
    zone = Column(String)
    is_available = Column(Boolean, default=True)
    current_lat = Column(Float, nullable=True)
    current_lng = Column(Float, nullable=True)
    total_deliveries = Column(Integer, default=0)
    completed_deliveries = Column(Integer, default=0)
    delayed_deliveries = Column(Integer, default=0)
    failed_deliveries = Column(Integer, default=0)
    rating = Column(Float, default=5.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="agent")
    assignments = relationship("Assignment", back_populates="agent")
    locations = relationship("AgentLocation", back_populates="agent")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String, unique=True, index=True)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String)
    customer_email = Column(String, nullable=True)

    pickup_address = Column(String)
    pickup_lat = Column(Float, default=11.0168)
    pickup_lng = Column(Float, default=76.9558)

    delivery_address = Column(String, nullable=False)
    delivery_lat = Column(Float, nullable=False)
    delivery_lng = Column(Float, nullable=False)

    package_description = Column(String)
    package_weight = Column(Float, default=1.0)  # kg
    priority = Column(String, default=Priority.medium)
    status = Column(String, default=OrderStatus.pending)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expected_delivery_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    assigned_agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)

    assignment = relationship("Assignment", back_populates="order", uselist=False)
    status_history = relationship("DeliveryStatusHistory", back_populates="order")
    ml_predictions = relationship("MLPrediction", back_populates="order")
    proof = relationship("DeliveryProof", back_populates="order", uselist=False)
    exception = relationship("DeliveryException", back_populates="order", uselist=False)


class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    assigned_by = Column(Integer, ForeignKey("users.id"))
    ai_score = Column(Float, nullable=True)
    ai_recommended = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="assignment")
    agent = relationship("Agent", back_populates="assignments")


class DeliveryStatusHistory(Base):
    __tablename__ = "delivery_status_history"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    status = Column(String)
    note = Column(Text, nullable=True)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="status_history")


class AgentLocation(Base):
    __tablename__ = "agent_locations"
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    lat = Column(Float)
    lng = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

    agent = relationship("Agent", back_populates="locations")


class MLPrediction(Base):
    __tablename__ = "ml_predictions"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    predicted_eta_minutes = Column(Float, nullable=True)
    delay_risk = Column(String, nullable=True)
    delay_probability = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="ml_predictions")


class DeliveryProof(Base):
    __tablename__ = "delivery_proofs"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    otp = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    signature_url = Column(String, nullable=True)
    recipient_name = Column(String, nullable=True)
    delivered_lat = Column(Float, nullable=True)
    delivered_lng = Column(Float, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)

    order = relationship("Order", back_populates="proof")


class DeliveryException(Base):
    __tablename__ = "delivery_exceptions"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True)
    agent_id = Column(Integer, ForeignKey("agents.id"))
    reason = Column(String)  # customer_unavailable, vehicle_breakdown, etc.
    description = Column(Text, nullable=True)
    action_taken = Column(String, nullable=True)  # reschedule, cancel, reassign
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    order = relationship("Order", back_populates="exception")


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(Text)
    type = Column(String, default="info")  # info, warning, alert, success
    is_read = Column(Boolean, default=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")
