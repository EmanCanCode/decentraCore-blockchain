# DecentraCore — Blockchain Module

DecentraCore is a full-stack blockchain platform I engineered from scratch.  
It demonstrates how **Solidity smart contracts**, **event-driven listeners**, and a **TypeScript API** come together with a modern **Angular frontend**, all orchestrated with **Docker** and deployed securely via **Cloudflare Tunnel**.

This module contains the **blockchain layer** of DecentraCore:
- Smart contracts (AMMs, escrow, provenance, inventory)
- Deployment and seed scripts
- Off-chain listeners for events → MongoDB
- Hardhat tasks and tests

---

## 📌 Features

- **Finance**
  - Constant Product AMM (`x * y = k`)
  - Constant Sum AMM (stable swaps)
  - Experimental On-chain Order Book (OBMM)
  - Fungible ERC-20 test tokens

- **Real Estate**
  - Escrow contracts with role-based approvals
  - EscrowFactory for scalable deployments
  - ERC-1155 property tokens
  - Finance contract for lender workflows

- **Supply Chain**
  - Provenance records (immutable history per item)
  - Inventory management (stock, transfers, reorders)
  - Automated process integration

- **Infrastructure**
  - Hardhat + TypeScript
  - Event listeners with ethers.js + MongoDB
  - Dockerized for reproducibility (x86_64 & arm64)
  - Cloudflare Tunnel for HTTPS at [emancancode.online](https://emancancode.online)

---

## 🗂️ Repository Structure

```
contracts/       # Solidity contracts (Finance, Real Estate, Supply Chain)
listeners/       # Event listeners (TypeScript)
scripts/         # Deployment & seed scripts
tasks/           # Hardhat tasks (keygen, env update, gas migrate)
logs/            # Deploy logs (per domain)
test/            # Hardhat tests per contract
hardhat.config.ts
docker-compose.yml
Dockerfile
package.json
```

---

## ⚙️ Architecture Overview

```
┌──────────────┐      WebSocket Events      ┌──────────────┐
│  Solidity    │  ───────────────────────▶  │  Listeners   │
│  Contracts   │                            │  (TS/Ethers) │
└─────┬────────┘                            └──────┬───────┘
      │  on-chain state                           │  aggregate & transform
      ▼                                           ▼
  (Hardhat / RPC)                           ┌──────────────┐
                                           │  MongoDB     │
                                           │  (metrics)   │
                                           └──────┬───────┘
                                                  │ REST/Graph
                                                  ▼
                                            ┌──────────────┐
                                            │   API        │
                                            │ (Express/TS) │
                                            └──────┬───────┘
                                                  │ JSON
                                                  ▼
                                            ┌──────────────┐
                                            │  Frontend    │
                                            │ (Angular)    │
                                            └──────────────┘
```

---

## 🔎 Deep Dive: Smart Contracts

### 1. Finance (AMMs)
- **Constant Product AMM** implements the invariant `x * y = k`.  
  - Enforces slippage-aware pricing for volatile token pairs.
  - Applies a 0.3% fee on every trade (configurable).
  - Protects liquidity provision with ratio checks (tolerance enforced).
- **Constant Sum AMM** implements a linear invariant `x + y = C`.  
  - Suitable for stable assets (e.g., stablecoin-to-stablecoin).
  - Also charges a 0.3% fee, collected in reserves.
- **ERC-20 Tokens** are bundled for test liquidity and swaps.
- **Order Book Market Maker (OBMM)** (experimental).  
  - Inspired by traditional exchange mechanics.
  - Allows users to place, fill, and cancel limit orders at specified prices.
  - Deferred for now, but the scaffolding demonstrates bridging AMM math with central-limit-order logic.

**Event Listeners**:  
- Subscribe to `Swapped`, `AddedLiquidity`, and `RemovedLiquidity`.  
- Calculate aggregate metrics (total swaps, total volume, total fees).  
- Update MongoDB’s `finance` collection with cumulative state.

---

### 2. Real Estate (EscrowFactory + NFTs)
- **Escrow** contracts manage real-world style property sales:
  - Tracks states (`Created → Active → Completed/Cancelled`).
  - Requires multi-party approvals (buyer, seller, inspector, appraiser, lender).
  - Enforces earnest deposit and final settlement rules.
  - Distributes fees (1%) back to the factory/owner.
  - Transfers ERC-1155 property NFTs upon completion.
- **EscrowFactory**:
  - Deploys new escrows with validated parameters.
  - Emits `EscrowCreated` event.
  - Links each escrow with a `Finance` contract if lender financing is required.
- **ERC-1155 NFTs**:
  - Represent unique property assets.
  - Metadata includes category (Single-Family, Multi-Family, Luxury).
  - **Metadata Hosting**: NFT metadata is served via a local Express/MongoDB service.  
    - Metadata JSON is written during seeding/deployment.  
    - Example:  
      ```json
      {
        "name": "Luxury Villa",
        "description": "On-chain escrowed real estate asset",
        "image": "https://emancancode.online/assets/nfts/luxury_villa.png",
        "attributes": [
          {"trait_type": "Category", "value": "Luxury"},
          {"trait_type": "EscrowState", "value": "Created"}
        ]
      }
      ```

**Event Listeners**:  
- EscrowFactory listener subscribes to `EscrowCreated`.  
  - Inserts buyer/escrowId into MongoDB.  
  - Calls `setFinanceContract()` automatically for new escrows.  
- Escrow listener updates MongoDB on completion → removes the escrow record.

---

### 3. Supply Chain (Provenance + Inventory)
- **Provenance Contract**:
  - Appends lifecycle events to immutable product histories.
  - Uses `creator + nonce` scheme for globally unique IDs.
  - Emits `CreatedRecord` and `UpdatedRecord` with product details.
- **InventoryManagement Contract**:
  - Tracks stock movements (`Inbound`, `Outbound`).
  - Enforces sufficient stock before outbound transactions.
  - Logs structured transactions with metadata (`location`, `note`, `user`).
  - Supports reorder thresholds through `AutomatedProcess`.
- **AutomatedProcess**:
  - Manages escrowed value for automated supply chain events.
  - Integrates with Provenance and InventoryManagement when payments are required.

**Event Listeners**:  
- Provenance listener subscribes to `CreatedRecord`.  
  - Updates `supplyChain` collection in MongoDB with record counts and value processed.  
- Inventory listener subscribes to `StockUpdated`.  
  - Updates stock totals, outbound counts, and potential reorder triggers.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 22.x (or use Docker)
- Docker & Docker Compose
- MongoDB (local container or external)

### Install dependencies
```bash
npm install
```

### Compile contracts
```bash
npx hardhat compile
```

### Run tests
```bash
npx hardhat test
```

### Start a local chain
```bash
npx hardhat node
```

### Deploy contracts
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

### Seed contracts
```bash
npx hardhat run scripts/seed.ts --network localhost
```

### Run listeners
```bash
npm run listen-f      # Finance listeners
npm run listen-sc1    # Inventory listener
npm run listen-sc2    # Provenance listener
npm run listen-re     # Escrow factory listener
```

---

## 🐳 Docker Usage

Build and run everything (chain + listeners + MongoDB):

```bash
docker compose up --build
```

Example services (from `docker-compose.yml`):
- `hardhat` – blockchain node
- `deploy` – runs deploy scripts
- `listeners` – finance / supply chain / real estate event listeners
- `mongo` – database
- `frontend` – Angular build served by Nginx (in full stack)
- `api` – Express/TypeScript backend

---

## 🧪 Tests

Each domain has dedicated Hardhat tests:
- **Finance** – AMM invariants, slippage, fee accounting
- **Real Estate** – escrow state machine, role approvals, cancellations
- **Supply Chain** – provenance immutability, stock transfers, automated processes

Run all tests:
```bash
npx hardhat test
```

---

## 🔐 Security Notes

- Contracts use safe math and explicit state checks
- Listeners reconnect automatically on WebSocket drop
- MongoDB should not be exposed publicly (use Docker networking or VPN)
- Secrets (.env, keys) are not committed to git

---

## 📈 Roadmap

- [ ] Runtime config for frontend (fetch from `assets/config.json`)
- [ ] More granular escrow events (`ApprovalUpdated`, deadlines)
- [ ] Geospatial encoding in supply chain events
- [ ] TWAP/price oracle for AMMs
- [ ] Backup/restore container for MongoDB

---

## 📚 Portfolio Context

This blockchain module is part of the larger **DecentraCore** project, which also includes:
- A **backend API** (Express/TS)
- A **frontend app** (Angular)
- Infrastructure for deployment on both **PC** and **Raspberry Pi (arm64)** with Docker Buildx

**Live demo:** [https://emancancode.online](https://emancancode.online)  
**Author:** [EmanCanCode](https://github.com/EmanCanCode)
**License:** MIT