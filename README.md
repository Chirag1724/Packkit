# PackKit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6%2B-brightgreen.svg)](https://www.mongodb.com/)

**A Private NPM Registry with AI-Powered Documentation Assistant**

PackKit transforms your team's development workflow by providing intelligent package caching, offline capabilities, and AI-driven documentation assistance—all running locally on your network.

---

## The Problem

Modern development teams face critical challenges:

- **Network Dependency**: npm registry outages halt entire teams
- **Bandwidth Waste**: Every developer downloads the same packages repeatedly
- **Documentation Fragmentation**: Developers waste time searching across multiple sources
- **Security Blindspots**: No local verification of package integrity
- **Offline Limitations**: Cannot work without internet connectivity

---

## The Solution

PackKit is an **intelligent, offline-first npm registry** that:

| Feature | Benefit |
|---------|---------|
| **Smart Caching** | Downloads packages once, shares across entire LAN |
| **AI Assistant** | Ask questions in plain English, get instant context-aware answers |
| **Security Verification** | SHA-512 integrity checks on every package |
| **Offline Mode** | Pre-cache packages and continue working without internet |
| **Performance** | HTTP keep-alive and connection pooling for faster downloads |

---

## Key Features

### 1. Transparent NPM Proxy
Simply point your npm client to PackKit:
```bash
npm config set registry http://YOUR_SERVER_IP:4873
npm install express  # Automatically cached and shared!
```

Any package installed by any team member becomes instantly available to everyone on the LAN.

### 2. RAG-Powered AI Assistant
Built with **Retrieval-Augmented Generation (RAG)**:
- **Local LLM**: Llama 3.2 via Ollama (100% private, 100% offline)
- **Vector Search**: nomic-embed-text for semantic search
- **Hybrid Search**: Combines semantic + keyword matching

Ask questions like:
> *"How do I set up middleware in Express?"*  
> *"What's the difference between findOne and findById in Mongoose?"*

### 3. Enterprise-Grade Security
- **Real-time Verification**: SHA-512 checksums on every download
- **Threat Detection**: Automatically deletes tampered packages
- **Audit Logs**: Complete security event tracking in MongoDB

### 4. Pre-Caching for Offline
Cache specific packages before going offline:
```bash
POST /api/precache
{ "packageName": "react", "version": "18.2.0" }
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       PACKKIT SYSTEM                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   React UI   │◄────►│   Express    │◄────►│   MongoDB    │  │
│  │  (Vite)      │      │   Backend    │      │   Database   │  │
│  └──────────────┘      └──────┬───────┘      └──────────────┘  │
│                               │                                 │
│         ┌─────────────────────┼─────────────────────┐          │
│         │                     │                     │          │
│         ▼                     ▼                     ▼          │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Package    │      │   Ollama     │      │   Security   │  │
│  │   Cache      │      │   (AI/RAG)   │      │   Service    │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Tech Stack**: React • Express • MongoDB • Ollama • Node.js

---

## Quick Start

### Prerequisites

| Software | Version | Download |
|----------|---------|----------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| MongoDB | 6+ | [mongodb.com](https://www.mongodb.com/try/download/community) |
| Ollama | Latest | [ollama.ai](https://ollama.ai) |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/packkit.git
cd packkit

# 2. Pull required AI models
ollama pull llama3.2:latest
ollama pull nomic-embed-text

# 3. Start services

# Terminal 1 - Ollama
ollama serve

# Terminal 2 - Backend
cd backend
npm install
node server.js

# Terminal 3 - Frontend
cd frontend
npm install
npm run dev
```

### Windows One-Click Start
```bash
.\REPAIR_AND_START.bat
```

---

## Network Setup (LAN Mode)

### Server Configuration
The backend displays your network IP on startup:
```
PackKit server running on port 4873
  Local:   http://localhost:4873
  Network: http://192.168.1.100:4873  ← Share this with your team
```

### Client Configuration
On team members' machines:
```bash
npm config set registry http://192.168.1.100:4873
```

Now all `npm install` commands go through PackKit!

### Reverting to Public NPM
```bash
npm config set registry https://registry.npmjs.org/
```

---

## User Interface

| Page | URL | Purpose |
|------|-----|---------|
| **Chat Interface** | `http://localhost:5174` | Ask AI questions about packages |
| **Admin Dashboard** | `http://localhost:5174/admin` | System stats, package indexing, pre-caching |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Query the AI assistant |
| `POST` | `/api/precache` | Pre-cache a specific package |
| `GET` | `/force-scrape/:name` | Index package documentation |
| `GET` | `/api/stats` | RAG system statistics |
| `GET` | `/api/security-stats` | Package verification stats |
| `GET` | `/api/vector-stats` | Vector embedding coverage |
| `POST` | `/api/hybrid-search` | Advanced semantic search |

---

## Project Structure

```
packkit/
├── backend/
│   ├── server.js              # Express server & npm proxy
│   ├── services/
│   │   ├── ai.js              # Ollama LLM integration
│   │   ├── rag.js             # Vector search & embeddings
│   │   ├── scraper.js         # Documentation scraper
│   │   └── security.js        # SHA-512 verification
│   └── storage/               # Cached packages & metadata
├── frontend/
│   └── src/
│       ├── Chatbot.jsx        # AI chat interface
│       └── AdminDashboard.jsx # Admin controls
├── start.bat                  # Quick start script
└── REPAIR_AND_START.bat       # Auto IP detection & start
```

---

## Demo Scenarios

### Scenario 1: Team Package Sharing
1. Developer A installs `lodash`
2. Developer B runs `npm install lodash` → instant from cache!
3. No duplicate downloads, no wasted bandwidth

### Scenario 2: Offline Development
1. Pre-cache critical packages while online
2. Disconnect from internet
3. Continue coding, installing packages, and asking AI questions

### Scenario 3: AI-Powered Learning
1. Index package documentation via Admin Dashboard
2. Ask complex questions in plain English
3. Get instant, context-aware answers without leaving the terminal

---

## Contributors

<a href="https://github.com/USERNAME/packkit/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=USERNAME/packkit" alt="Contributors" />
</a>

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Documentation

For detailed technical documentation, architecture deep-dives, and Q&A, see [DOCUMENTATION.md](DOCUMENTATION.md).

---

<p align="center">
  <b>Built with ❤️ by Tech Tonic...</b>
</p>