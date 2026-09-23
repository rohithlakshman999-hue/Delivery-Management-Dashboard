# RouteMind AI

RouteMind AI is an intelligent delivery operations and smart dispatch platform. It combines order management, delivery-agent operations, AI-assisted dispatch, real-time tracking, ETA prediction, delay-risk prediction, proof of delivery, and analytics in one full-stack application.

This project is built as a hackathon-ready demo with a React frontend, FastAPI backend, SQLite database, synthetic ML training data, and OpenStreetMap-powered maps.

## Product Screenshots

Screenshots below were captured from the working application.

### Login and role-based access

<img src="frontend/public/screenshots/login.png" alt="RouteMind AI login screen" width="900" />

### Manager dashboard

<img src="frontend/public/screenshots/dashboard.png" alt="Operations dashboard" width="900" />

### Order management and smart dispatch

<img src="frontend/public/screenshots/orders.png" alt="Order management screen" width="900" />

### Delivery agent management

<img src="frontend/public/screenshots/agents.png" alt="Delivery agents screen" width="900" />

### Live tracking map

<img src="frontend/public/screenshots/live-tracking.png" alt="Live delivery tracking map" width="900" />

### AI operations center

<img src="frontend/public/screenshots/ai-operations.png" alt="AI operations screen" width="900" />

### Analytics dashboard

<img src="frontend/public/screenshots/analytics.png" alt="Analytics dashboard" width="900" />

## Features

- JWT authentication with Manager, Admin, Agent, and Customer roles.
- Frontend protected routes and backend role-based authorization.
- Order create, list, update, delete, search, filtering, history, and CSV import.
- Delivery-agent creation, availability, zones, vehicles, performance, and ratings.
- Weighted smart dispatch recommendations with score breakdown and manager override.
- ETA prediction and delay-risk classification using Random Forest models.
- AI Operations view for at-risk deliveries, overloaded agents, and reassignment suggestions.
- Leaflet maps with OpenStreetMap tiles, agent markers, delivery markers, and route lines.
- Live location polling and a FastAPI WebSocket broadcast endpoint.
- Analytics for order volume, priorities, delivery times, and agent performance.
- Notifications, exception reporting, and proof-of-delivery metadata.
- Persistent light and dark themes.

## Architecture

```text
React + TypeScript + Vite
        |
        | Axios REST API and WebSocket
        v
FastAPI + Uvicorn
        |
        | SQLAlchemy ORM
        v
SQLite (routemind.db)
        |
        +-- JWT / bcrypt authentication
        +-- Dispatch scoring service
        +-- Scikit-learn ML service
        +-- Analytics queries
```

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Axios
- Leaflet and React Leaflet
- OpenStreetMap
- Recharts
- React Hot Toast
- CSS variables for light and dark themes

### Backend

- Python
- FastAPI
- Uvicorn
- SQLAlchemy ORM
- SQLite
- Pydantic
- `python-jose` for JWT
- bcrypt for password hashing
- FastAPI WebSockets

### Machine Learning

- Scikit-learn
- Pandas
- NumPy
- Joblib
- Random Forest Regressor for ETA
- Random Forest Classifier for delay risk

## Project Structure

```text
full_stack/
├── README.md
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models/models.py
│   │   ├── schemas/schemas.py
│   │   ├── routers/
│   │   ├── services/
│   │   └── ml/
│   ├── requirements.txt
│   └── seed.py
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── contexts/
    │   ├── pages/
    │   └── services/api.ts
    ├── public/screenshots/
    ├── package.json
    └── vite.config.ts
```

## Frontend Implementation

`frontend/src/App.tsx` configures React Router and the authenticated application layout. `AuthContext` stores the current user and JWT. `Sidebar` renders role-specific navigation and the theme switcher.

The Axios client in `frontend/src/services/api.ts` provides API functions for authentication, orders, agents, dispatch, ML, analytics, tracking, notifications, exceptions, and proof of delivery. It automatically sends the JWT as a Bearer token and redirects expired sessions to `/login`.

Main frontend pages:

| Page | Purpose |
| --- | --- |
| Login | Login and demo role selection |
| Manager Dashboard | Operational counts and recent orders |
| Orders | CRUD, CSV import, filtering, dispatch, and status actions |
| Agents | Agent creation and availability management |
| Smart Dispatch | Ranked agents and score breakdown |
| AI Operations | Delay-risk monitoring and reassignment |
| Tracking | Fleet map with agent and delivery routes |
| Analytics | Charts and performance leaderboard |
| My Deliveries | Agent delivery status progression |
| Route Map | Agent-focused live map |
| Notifications | Read and unread alerts |
| Exceptions | Manager exception review |
| Profile | Current account information |

## Backend Implementation

FastAPI registers the routers from `backend/app/main.py`. SQLAlchemy models represent users, agents, orders, assignments, status history, locations, predictions, proof of delivery, exceptions, and notifications.

Important endpoints:

```text
POST  /api/auth/login
GET   /api/auth/me
POST  /api/orders/
GET   /api/orders/
POST  /api/orders/import
PATCH /api/orders/{order_id}
GET   /api/orders/{order_id}/history
POST  /api/dispatch/recommend/{order_id}
POST  /api/dispatch/assign
POST  /api/dispatch/reassign
GET   /api/dispatch/ai-operations
POST  /api/ml/predict-eta
POST  /api/ml/predict-delay
POST  /api/ml/predict-order/{order_id}
GET   /api/analytics/overview
GET   /api/tracking/agents/live
WS    /api/tracking/ws
POST  /api/misc/exceptions
POST  /api/misc/proof
```

## Authentication and Authorization

Passwords are hashed with bcrypt and never stored as plain text. After login, the backend creates a JWT containing the user ID, role, and expiry time. The frontend stores it in browser storage and sends:

```text
Authorization: Bearer <token>
```

Authorization is enforced in both frontend and backend:

- Managers and admins can operate the fleet.
- Agents can view and update their assigned deliveries.
- Customers can only list and view their own orders.
- Agents cannot update another agent's location.
- Agents cannot submit proof or exceptions for another agent's order.

## Order Workflow

Orders follow this delivery pipeline:

```text
pending -> assigned -> accepted -> picked_up -> out_for_delivery -> delivered
```

Other supported states include `cancelled`, `failed`, and `rescheduled`. Every status update is saved in `delivery_status_history`.

Managers can create orders manually or import them through CSV. CSV rows are validated individually, so valid rows can be imported while invalid rows are returned with line-level errors.

## Smart Dispatch Algorithm

Each eligible agent receives a weighted score:

```text
Distance       30%
Workload       25%
Availability   20%
Performance    15%
Priority fit   10%
```

The recommendation response includes the total score, distance, active-order count, and each score contribution. Managers can accept the AI recommendation or manually assign another agent.

## Machine Learning

The ETA model predicts delivery time in minutes using distance, hour of day, day of week, package weight, agent workload, and traffic level.

The delay classifier returns:

```text
LOW / MEDIUM / HIGH
```

It also returns a probability and a rule-based explanation mentioning factors such as route distance, traffic, workload, peak hours, and priority.

The repository uses synthetic training data because real delivery history is not available for the hackathon. Models are loaded by the ML service and exposed through FastAPI endpoints.

## Maps and Tracking

Leaflet renders OpenStreetMap tiles. The manager map shows the warehouse, fleet agent positions, active deliveries, and route lines. The agent route map shows the agent position, delivery markers, and routes to assigned customers.

The frontend refreshes location snapshots every eight seconds. The backend stores current locations and location history and also exposes a WebSocket endpoint for broadcasting location updates.

## Analytics

The analytics dashboard provides:

- Total orders and active deliveries.
- Delivered, pending, assigned, and failed counts.
- On-time delivery rate.
- Seven-day order volume.
- Priority distribution.
- Average, minimum, maximum, and median delivery time.
- Agent performance leaderboard.

## Notifications, Exceptions, and Proof of Delivery

Notifications are created for assignments and delivery exceptions. Users can mark individual notifications or all notifications as read.

Agents can report delivery exceptions, such as customer unavailability or vehicle breakdown. Managers can review the exception list.

Proof of delivery supports OTP, recipient name, delivery coordinates, notes, and timestamp. The backend validates that the order is delivered, assigned to the submitting agent, and does not already have proof.

## Database Model

Primary tables:

- `users`
- `agents`
- `orders`
- `assignments`
- `delivery_status_history`
- `agent_locations`
- `ml_predictions`
- `delivery_proofs`
- `delivery_exceptions`
- `notifications`

SQLite is used for the hackathon because it requires no separate database server. SQLAlchemy keeps the database layer portable to PostgreSQL later.

## Demo Credentials

```text
Manager: manager@routemind.ai / manager123
Admin:   admin@routemind.ai   / admin123
Agent:   ravi@routemind.ai    / agent123
```

Seed realistic demo data with:

```powershell
cd backend
python seed.py
```

## Running Locally

### 1. Install backend dependencies

```powershell
cd backend
pip install -r requirements.txt
```

### 2. Start the backend

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URLs:

- API: `http://localhost:8000`
- Swagger documentation: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

### 3. Install and start the frontend

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Verification

Compile the backend:

```powershell
cd backend
python -m compileall app
```

Build the frontend:

```powershell
cd ..\frontend
npm run build
```

## Current Scope and Future Improvements

The working demo uses SQLite, seeded synthetic data, polling for the primary map refresh, and proof-of-delivery metadata rather than binary photo storage. Production extensions could add PostgreSQL, Docker Compose, Alembic migrations, real mobile GPS updates, object storage for photos, full SHAP explanations, automated tests, and CI/CD.
