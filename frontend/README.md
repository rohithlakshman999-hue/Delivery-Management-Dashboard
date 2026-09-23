 # RouteMind AI

 RouteMind AI is an intelligent delivery operations platform for managing orders, agents, dispatch decisions, real-time locations, delivery risk, and operational analytics.

 This repository contains a React + TypeScript frontend and a FastAPI + SQLAlchemy backend. It is configured for a zero-configuration hackathon demo with SQLite, synthetic ML data, OpenStreetMap maps, and seeded demo accounts.

 ## Screenshots

 These screenshots were captured from the working application and stored in `public/screenshots`.

 ### Login and role-based access

<img src="public/screenshots/login.png" alt="RouteMind AI login screen" width="900" />

 ### Manager dashboard

<img src="public/screenshots/dashboard.png" alt="Operations dashboard" width="900" />

 ### Order management and smart dispatch

<img src="public/screenshots/orders.png" alt="Order management screen" width="900" />

 ### Delivery agent management

<img src="public/screenshots/agents.png" alt="Delivery agents screen" width="900" />

 ### Live tracking map

<img src="public/screenshots/live-tracking.png" alt="Live delivery tracking map" width="900" />

 ### AI operations center

<img src="public/screenshots/ai-operations.png" alt="AI operations screen" width="900" />

 ### Analytics dashboard

<img src="public/screenshots/analytics.png" alt="Analytics dashboard" width="900" />

 ## Core Features

 - JWT login with Manager, Admin, Agent, and Customer roles.
 - Protected frontend routes and backend role authorization.
 - Order CRUD, status history, priority filtering, search, and CSV import.
 - Agent creation, availability, performance statistics, and location updates.
 - Weighted smart dispatch recommendations with manager override.
 - ETA prediction and delay-risk classification using Random Forest models.
 - AI Operations view for at-risk orders, overloaded agents, and reassignment suggestions.
 - Leaflet maps with OpenStreetMap tiles, agent markers, delivery markers, and route lines.
 - Live location polling plus a FastAPI WebSocket broadcast endpoint.
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
 - CSS variables for themes and glassmorphism styling

 ### Backend

 - Python
 - FastAPI
 - Uvicorn
 - SQLAlchemy
 - SQLite
 - Pydantic
 - JWT using `python-jose`
 - bcrypt password hashing
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

 `App.tsx` owns React Router and the authenticated layout. `AuthContext` stores the logged-in user and JWT in browser storage. `Sidebar` renders navigation based on the current role.

 The API client in `src/services/api.ts` provides wrappers for authentication, orders, agents, dispatch, ML, analytics, tracking, notifications, exceptions, and proof of delivery. Its Axios interceptor adds the Bearer token and sends expired sessions to `/login`.

 | Page | Purpose |
 | --- | --- |
 | Login | Demo login and authentication |
 | Manager Dashboard | Operational counts and recent orders |
 | Orders | CRUD, CSV import, filtering, dispatch, and status actions |
 | Agents | Agent creation and availability management |
 | Smart Dispatch | Ranked agent recommendations and score breakdown |
 | AI Operations | Delay-risk monitoring and reassignment |
 | Tracking | Fleet map with agent and delivery routes |
 | Analytics | Charts and performance leaderboard |
 | My Deliveries | Agent status progression |
 | Route Map | Agent-focused live map |
 | Notifications | Read and unread operational messages |
 | Exceptions | Manager exception review |
 | Profile | Current account information |

 ## Backend Implementation

 FastAPI registers routers in `backend/app/main.py`. SQLAlchemy models represent users, agents, orders, assignments, status history, locations, predictions, delivery proof, exceptions, and notifications.

 Important endpoints:

 ```text
 POST  /api/auth/login
 GET   /api/auth/me
 POST  /api/orders/
 GET   /api/orders/
 POST  /api/orders/import
 PATCH /api/orders/{order_id}
 POST  /api/dispatch/recommend/{order_id}
 POST  /api/dispatch/assign
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

 Passwords are hashed with bcrypt. On login, the backend creates a JWT containing the user ID, role, and expiry time. The frontend sends it as:

 ```text
 Authorization: Bearer <token>
 ```

 Authorization is enforced in both layers:

 - Managers and admins can operate the fleet.
 - Agents can view and update their assigned deliveries.
 - Customers can only list and view their own orders.
 - Agents cannot update another agent's location.
 - Agents cannot submit proof or exceptions for another agent's order.

 ## Smart Dispatch Algorithm

 Every eligible agent receives a weighted score:

 ```text
 Distance       30%
 Workload       25%
 Availability   20%
 Performance    15%
 Priority fit   10%
 ```

 The response includes the total score, distance, active order count, and each score contribution. Managers can accept the recommendation or override it manually.

 ## ML and Explainability

 The ETA model predicts delivery minutes using distance, time, day, package weight, workload, and traffic. The delay classifier returns `low`, `medium`, or `high` risk with a probability.

 The repository uses synthetic training data because real delivery history is not available for the hackathon. The AI Operations page combines ML predictions with dispatch recommendations to surface risky deliveries and alternative agents.

 ## Maps and Tracking

 Leaflet renders OpenStreetMap tiles. The manager map displays agent locations, active deliveries, warehouse position, and route lines. The agent map displays the agent's current position and delivery destinations.

 The frontend refreshes location snapshots every eight seconds. The backend also exposes a WebSocket endpoint for broadcasting location updates.

 ## Database Model

 The primary tables are:

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

 ### Backend

 ```powershell
 cd backend
 pip install -r requirements.txt
 python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
 ```

 Backend URLs:

 - API: `http://localhost:8000`
 - Swagger documentation: `http://localhost:8000/docs`
 - Health check: `http://localhost:8000/health`

 ### Frontend

 Open a second terminal:

 ```powershell
 cd frontend
 npm install
 npm run dev
 ```

 Frontend URL: `http://localhost:5173`

 ## Verification

 ```powershell
 # Backend
 cd backend
 python -m compileall app

 # Frontend
 cd ..\frontend
 npm run build
 ```

 ## Current Scope and Future Improvements

 The working demo uses SQLite, seeded synthetic data, polling for the primary map refresh, and proof-of-delivery metadata rather than binary photo storage. Production extensions could add PostgreSQL, Docker Compose, Alembic migrations, real mobile GPS updates, object storage for photos, full SHAP explanations, automated tests, and CI/CD.
