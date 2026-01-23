# ⚡ BoltEx: High-Performance Order Matching Engine

BoltEx is a full-stack, real-time trading exchange platform built with a modular architecture. It features a high-throughput matching engine, a real-time WebSocket server for market updates, and a persistent database processor to ensure data integrity across the system.

---

## 🏗️ Architecture Overview

The project is designed as a distributed system, separated into four core microservices:

- **Engine:** The core logic written in TypeScript that manages the order book, processes limit/market orders, and executes matches.  
- **API Server:** An Express-based gateway that handles user authentication, RESTful interactions, and order placement.  
- **WS Server:** A high-concurrency WebSocket server that manages real-time subscriptions and broadcasts market data (tickers, depth, and trades).  
- **DB Processor:** A dedicated background worker that pulls execution data from Redis queues and persists it to a PostgreSQL database via Prisma.

---

## 🛠️ Tech Stack

- **Languages:** TypeScript (Primary), JavaScript  
- **Backend:** Node.js, Express.js 
- **Real-time:** WebSockets (`ws`), Redis (Pub/Sub & Queues)  
- **Database:** PostgreSQL, Redis  
- **DevOps:** Docker, Docker Compose  

---

## 🚀 Local Setup & Deployment

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed  
- [Node.js](https://nodejs.org/) (v18+) and `npm`

---

### 1. Clone the Repository

```bash
git clone https://github.com/VarunThisSide/boltex.git
cd boltex
```

### 2. Configure Environment Variables

Create a .env file in the root directory:

```env
# Database (e.g., Neon, Supabase, or Local)
DATABASE_URL="postgresql://user:password@localhost:5432/boltex"

# Redis Configuration
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# Ports
API_PORT=3000
WS_PORT=3001
```

### 3. Run with Docker Compose

The most efficient way to run the entire stack (including the database and Redis) is via Docker Compose:

```bash
docker-compose up --build
```
This command builds the images for the Engine, API, WS Server, and DB Processor, while pulling the official images for PostgreSQL and Redis.

---

### Manual Component Execution

If you prefer to run services individually for debugging purposes:

### 1. Start Infrastructure

```bash
docker run -p 6379:6379 -d redis
docker run --name boltex-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
```

### 2. Run the Engine

```bash
cd engine
npm install
npm run dev
```


### 3. Run the API / WS Server

```bash
cd api  # or cd ws
npm install
npm run dev
```

---

## 📡 API & WebSocket Usage

### REST API

- `POST /api/v1/order` — Place a Limit or Market order  
- `GET /api/v1/depth` — Retrieve the current order book depth for a specific pair  

---

### WebSockets

Connect to receive live market updates:

```text
ws://localhost:3001
