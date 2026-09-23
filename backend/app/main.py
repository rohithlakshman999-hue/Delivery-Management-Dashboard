from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.models import models  # ensure all models registered
from app.routers import auth, agents, orders, dispatch, ml, analytics, tracking, misc

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="RouteMind AI",
    description="Intelligent Delivery Operations & Smart Dispatch Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(orders.router)
app.include_router(dispatch.router)
app.include_router(ml.router)
app.include_router(analytics.router)
app.include_router(tracking.router)
app.include_router(misc.router)


@app.get("/")
def root():
    return {"message": "RouteMind AI API", "version": "1.0.0", "status": "running"}


@app.get("/health")
def health():
    return {"status": "healthy"}
