from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    manager = "manager"
    agent = "agent"
    customer = "customer"
    admin = "admin"


class OrderStatus(str, Enum):
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


class Priority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


# ── Auth ──────────────────────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: str
    name: str
    password: str
    role: UserRole = UserRole.customer


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# ── Agent ─────────────────────────────────────────────────────────────────────
class AgentCreate(BaseModel):
    email: str
    name: str
    password: str
    phone: str
    vehicle_type: str = "bike"
    zone: str


class AgentUpdate(BaseModel):
    phone: Optional[str] = None
    vehicle_type: Optional[str] = None
    zone: Optional[str] = None
    is_available: Optional[bool] = None


class AgentOut(BaseModel):
    id: int
    agent_code: str
    phone: Optional[str]
    vehicle_type: str
    zone: Optional[str]
    is_available: bool
    current_lat: Optional[float]
    current_lng: Optional[float]
    total_deliveries: int
    completed_deliveries: int
    delayed_deliveries: int
    failed_deliveries: int
    rating: float
    created_at: datetime
    user: UserOut
    model_config = {"from_attributes": True}


class AgentLocationUpdate(BaseModel):
    lat: float
    lng: float


# ── Order ─────────────────────────────────────────────────────────────────────
class OrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    pickup_address: str = "Main Warehouse, Coimbatore"
    pickup_lat: float = 11.0168
    pickup_lng: float = 76.9558
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    package_description: Optional[str] = None
    package_weight: float = 1.0
    priority: Priority = Priority.medium
    notes: Optional[str] = None
    expected_delivery_at: Optional[datetime] = None


class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    priority: Optional[Priority] = None
    notes: Optional[str] = None
    expected_delivery_at: Optional[datetime] = None


class OrderOut(BaseModel):
    id: int
    order_code: str
    customer_name: str
    customer_phone: Optional[str]
    customer_email: Optional[str]
    pickup_address: Optional[str]
    pickup_lat: float
    pickup_lng: float
    delivery_address: str
    delivery_lat: float
    delivery_lng: float
    package_description: Optional[str]
    package_weight: float
    priority: str
    status: str
    notes: Optional[str]
    created_at: datetime
    expected_delivery_at: Optional[datetime]
    delivered_at: Optional[datetime]
    assigned_agent_id: Optional[int]
    model_config = {"from_attributes": True}


class StatusHistoryOut(BaseModel):
    id: int
    order_id: int
    status: str
    note: Optional[str]
    timestamp: datetime
    model_config = {"from_attributes": True}


# ── Assignment ────────────────────────────────────────────────────────────────
class AssignmentCreate(BaseModel):
    order_id: int
    agent_id: int
    ai_score: Optional[float] = None
    ai_recommended: bool = False
    notes: Optional[str] = None


class AssignmentOut(BaseModel):
    id: int
    order_id: int
    agent_id: int
    assigned_at: datetime
    ai_score: Optional[float]
    ai_recommended: bool
    notes: Optional[str]
    agent: AgentOut
    model_config = {"from_attributes": True}


# ── ML ────────────────────────────────────────────────────────────────────────
class ETARequest(BaseModel):
    distance_km: float
    hour_of_day: int
    day_of_week: int
    package_weight: float
    agent_workload: int
    traffic_level: float = 1.0  # 1=low, 2=medium, 3=high


class DelayRequest(BaseModel):
    distance_km: float
    hour_of_day: int
    day_of_week: int
    package_weight: float
    agent_workload: int
    traffic_level: float = 1.0
    priority: str = "medium"


class MLPredictionOut(BaseModel):
    order_id: Optional[int]
    predicted_eta_minutes: Optional[float]
    delay_risk: Optional[str]
    delay_probability: Optional[float]
    explanation: Optional[str]
    model_config = {"from_attributes": True}


# ── Dispatch ──────────────────────────────────────────────────────────────────
class DispatchRecommendRequest(BaseModel):
    order_id: int


class AgentScore(BaseModel):
    agent: AgentOut
    score: float
    distance_km: float
    active_orders: int
    score_breakdown: dict


# ── Notification ──────────────────────────────────────────────────────────────
class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    order_id: Optional[int]
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Exception ─────────────────────────────────────────────────────────────────
class ExceptionCreate(BaseModel):
    order_id: int
    reason: str
    description: Optional[str] = None
    action_taken: Optional[str] = None


class ExceptionOut(BaseModel):
    id: int
    order_id: int
    agent_id: Optional[int]
    reason: str
    description: Optional[str]
    action_taken: Optional[str]
    resolved: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Proof of Delivery ─────────────────────────────────────────────────────────
class ProofCreate(BaseModel):
    order_id: int
    otp: Optional[str] = None
    recipient_name: Optional[str] = None
    delivered_lat: Optional[float] = None
    delivered_lng: Optional[float] = None
    notes: Optional[str] = None


class ProofOut(BaseModel):
    id: int
    order_id: int
    agent_id: int
    otp: Optional[str]
    recipient_name: Optional[str]
    delivered_lat: Optional[float]
    delivered_lng: Optional[float]
    timestamp: datetime
    notes: Optional[str]
    model_config = {"from_attributes": True}
