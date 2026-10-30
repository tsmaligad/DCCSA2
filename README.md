# DCCSA2

DCCSA2 is a web-based transit route planning project for the Davao City bus network.

This repository contains the implementation used for the Connection Scan Algorithm (CSA) side of the project, including route planning, walking connections, transfer handling, and the frontend route-planning interface.

## Project Structure

- `backend/` — routing logic, route data loading, API server, and CSA implementation
- `frontend/` — React-based route planner interface

## Main Features

- Origin and destination route planning
- Nearby stop detection
- Walking connections between nearby stops
- Bus route transfers
- Route visualization
- Estimated travel duration
- Connection-based transit routing

## Running the Project

### Backend

```bash
cd backend
npm install
node src/server.js
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the local URL shown by Vite, usually:

```text
http://localhost:5173
```

## Repository

This repository contains the working CSA implementation for the Davao transit routing project.
