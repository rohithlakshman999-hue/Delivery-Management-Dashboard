"""
Seed the database with realistic demo data.
Run: python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine
from app.models.models import Base, User, Agent, Order, Assignment, DeliveryStatusHistory, MLPrediction
from app.services.auth_service import hash_password
from datetime import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)
db = SessionLocal()

ZONES = ["North", "South", "East", "West", "Central"]
VEHICLES = ["bike", "car", "van"]
PRIORITIES = ["low", "medium", "high", "urgent"]
STATUSES = ["pending", "assigned", "accepted", "picked_up", "out_for_delivery", "delivered", "failed"]

COIMBATORE_AREAS = [
    ("RS Puram", 11.0130, 76.9635),
    ("Gandhipuram", 11.0168, 76.9558),
    ("Peelamedu", 11.0262, 77.0173),
    ("Singanallur", 11.0041, 77.0179),
    ("Saibaba Colony", 11.0247, 76.9517),
    ("Ramanathapuram", 10.9831, 76.9628),
    ("Ondipudur", 11.0002, 77.0330),
    ("Vadavalli", 11.0454, 76.9167),
    ("Kuniyamuthur", 10.9720, 76.9720),
    ("Kovaipudur", 10.9590, 76.9480),
    ("Kalapatti", 11.0590, 77.0280),
    ("Thudiyalur", 11.0703, 76.9703),
]

print("🌱 Seeding RouteMind AI demo data...")

# Clear existing
for model in [MLPrediction, DeliveryStatusHistory, Assignment, Order, Agent, User]:
    db.query(model).delete()
db.commit()

# 1. Create manager
manager = User(email="manager@routemind.ai", name="Arjun Sharma",
               hashed_password=hash_password("manager123"), role="manager")
db.add(manager)

# 2. Create admin
admin = User(email="admin@routemind.ai", name="Priya Nair",
             hashed_password=hash_password("admin123"), role="admin")
db.add(admin)
db.flush()

# 3. Create agents
agents_data = [
    ("Ravi Kumar", "ravi@routemind.ai", "9876543210", "bike", "North"),
    ("Anitha Raj", "anitha@routemind.ai", "9876543211", "car", "South"),
    ("Suresh Babu", "suresh@routemind.ai", "9876543212", "bike", "East"),
    ("Deepa Mani", "deepa@routemind.ai", "9876543213", "van", "West"),
    ("Karthik V", "karthik@routemind.ai", "9876543214", "car", "Central"),
    ("Meena S", "meena@routemind.ai", "9876543215", "bike", "North"),
    ("Vijay R", "vijay@routemind.ai", "9876543216", "car", "South"),
    ("Lakshmi P", "lakshmi@routemind.ai", "9876543217", "van", "East"),
    ("Mani K", "mani@routemind.ai", "9876543218", "bike", "West"),
    ("Siva T", "siva@routemind.ai", "9876543219", "car", "Central"),
]

agent_objects = []
for i, (name, email, phone, vehicle, zone) in enumerate(agents_data):
    user = User(email=email, name=name,
                hashed_password=hash_password("agent123"), role="agent")
    db.add(user)
    db.flush()

    total = random.randint(50, 200)
    completed = int(total * random.uniform(0.85, 0.97))
    delayed = int(completed * random.uniform(0.02, 0.12))
    failed = total - completed

    area = random.choice(COIMBATORE_AREAS)
    agent = Agent(
        user_id=user.id,
        agent_code=f"A{i+1:03d}",
        phone=phone,
        vehicle_type=vehicle,
        zone=zone,
        is_available=random.choice([True, True, True, False]),
        current_lat=area[1] + random.uniform(-0.02, 0.02),
        current_lng=area[2] + random.uniform(-0.02, 0.02),
        total_deliveries=total,
        completed_deliveries=completed,
        delayed_deliveries=delayed,
        failed_deliveries=failed,
        rating=round(random.uniform(3.8, 5.0), 1),
    )
    db.add(agent)
    db.flush()
    agent_objects.append(agent)

db.commit()
print(f"  ✅ Created {len(agent_objects)} agents")

# 4. Create orders
CUSTOMER_NAMES = [
    "Arun Prakash", "Kavitha R", "Senthil Kumar", "Divya M", "Ramesh N",
    "Geetha V", "Vinoth S", "Preethi K", "Balaji T", "Uma D",
    "Harish P", "Saranya M", "Dinesh R", "Nithya S", "Bala K",
]

orders_created = []
for i in range(80):
    pickup = COIMBATORE_AREAS[0]
    delivery = random.choice(COIMBATORE_AREAS[1:])
    priority = random.choices(PRIORITIES, weights=[30, 40, 20, 10])[0]
    status = random.choices(
        ["pending", "assigned", "picked_up", "out_for_delivery", "delivered", "failed"],
        weights=[15, 20, 10, 15, 30, 10]
    )[0]

    created_at = datetime.utcnow() - timedelta(
        days=random.randint(0, 14),
        hours=random.randint(0, 23)
    )

    order = Order(
        order_code=f"#{random.randint(10000, 99999)}",
        customer_name=random.choice(CUSTOMER_NAMES),
        customer_phone=f"98{random.randint(10000000, 99999999)}",
        customer_email=f"customer{i}@example.com",
        pickup_address=pickup[0] + ", Coimbatore",
        pickup_lat=pickup[1],
        pickup_lng=pickup[2],
        delivery_address=delivery[0] + ", Coimbatore",
        delivery_lat=delivery[1] + random.uniform(-0.005, 0.005),
        delivery_lng=delivery[2] + random.uniform(-0.005, 0.005),
        package_description=random.choice(["Electronics", "Clothing", "Documents", "Food", "Medicine", "Books"]),
        package_weight=round(random.uniform(0.2, 15.0), 2),
        priority=priority,
        status=status,
        created_at=created_at,
    )

    if status in ["assigned", "picked_up", "out_for_delivery", "delivered", "failed"]:
        agent = random.choice(agent_objects)
        order.assigned_agent_id = agent.id
        if status == "delivered":
            order.delivered_at = created_at + timedelta(minutes=random.randint(20, 90))

    db.add(order)
    db.flush()

    # Status history
    db.add(DeliveryStatusHistory(order_id=order.id, status="pending",
                                  timestamp=created_at, note="Order created"))
    if status != "pending":
        db.add(DeliveryStatusHistory(order_id=order.id, status="assigned",
                                      timestamp=created_at + timedelta(minutes=5),
                                      note="Assigned to agent"))
    if status in ["picked_up", "out_for_delivery", "delivered"]:
        db.add(DeliveryStatusHistory(order_id=order.id, status="picked_up",
                                      timestamp=created_at + timedelta(minutes=15)))
    if status in ["out_for_delivery", "delivered"]:
        db.add(DeliveryStatusHistory(order_id=order.id, status="out_for_delivery",
                                      timestamp=created_at + timedelta(minutes=20)))
    if status == "delivered":
        db.add(DeliveryStatusHistory(order_id=order.id, status="delivered",
                                      timestamp=order.delivered_at, note="Delivered successfully"))

    orders_created.append(order)

db.commit()
print(f"  ✅ Created {len(orders_created)} orders")
print("\n✅ Seeding complete!")
print("\n📋 Login credentials:")
print("  Manager:  manager@routemind.ai / manager123")
print("  Admin:    admin@routemind.ai / admin123")
print("  Agent:    ravi@routemind.ai / agent123")
