# PackKit - Installation & Running Guide

A private npm package registry with AI-powered documentation assistant.

---

## Prerequisites

Before running PackKit, ensure you have the following installed:

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| **Node.js** | 18+ | `node --version` |
| **MongoDB** | 6+ | `mongod --version` |
| **Ollama** | Latest | `ollama --version` |

### Installing Ollama Models

PackKit requires two AI models. Pull them before starting:

```bash
ollama pull llama3.2:latest
ollama pull nomic-embed-text
```

---

## Quick Start (Windows)

### Option 1: One-Click Start

```bash
cd c:\Users\nilay\OneDrive\Desktop\Packkit
.\REPAIR_AND_START.bat
```

This script will:
1. Detect your LAN IP address
2. Configure your local npm to use PackKit
3. Start all services (Ollama, Backend, Frontend)
4. Open the dashboard in your browser

### Option 2: Manual Start

```bash
# Terminal 1 - Start Ollama
ollama serve

# Terminal 2 - Start Backend
cd backend
npm install
node server.js

# Terminal 3 - Start Frontend
cd frontend
npm install
npm run dev
```

---

## Accessing PackKit

| Service | Local URL | Network URL |
|---------|-----------|-------------|
| **Chat Interface** | http://localhost:5174 | http://YOUR_IP:5174 |
| **Admin Dashboard** | http://localhost:5174/admin | http://YOUR_IP:5174/admin |
| **NPM Registry** | http://localhost:4873 | http://YOUR_IP:4873 |

---

## Connecting Other PCs (LAN Demo)

### On the Client PCs

Run this command to point their npm to your PackKit server:

```bash
npm config set registry http://YOUR_SERVER_IP:4873
```

Replace `YOUR_SERVER_IP` with the IP shown in your backend terminal (e.g., `192.168.137.131`).

### Verify Connection

```bash
npm install express
```

If successful, you'll see the package download in your PackKit backend logs.

### Reverting to Public NPM

```bash
npm config set registry https://registry.npmjs.org/
```

---

## Preparing for Offline Demo

PackKit can work completely offline if you pre-cache packages while connected:

### Step 1: Cache Packages (While Online)

```bash
npm install express lodash axios mongoose
```

### Step 2: Index Documentation

1. Go to Admin Dashboard: http://localhost:5174/admin
2. In "Index Package Documentation", enter package name (e.g., `express`)
3. Click "Index Docs"
4. Repeat for each package you want the AI to know about

### Step 3: Go Offline

1. Disconnect from internet
2. Run `.\REPAIR_AND_START.bat`
3. All cached packages and AI features work without internet!

---

## Troubleshooting

### "EHOSTUNREACH" Error

**Cause**: Your IP address changed since last run.

**Fix**: Run `.\REPAIR_AND_START.bat` to auto-detect new IP.

### "No relevant documentation found"

**Cause**: Package docs haven't been indexed.

**Fix**: Go to Admin Dashboard → "Index Package Documentation" → Enter package name → Click "Index Docs"

### AI Answers are Slow

**Cause**: First request loads the model into GPU/RAM.

**Fix**: Before demo, ask one question to "warm up" the model.

### MongoDB Connection Error

**Cause**: MongoDB service not running.

**Fix (Windows)**:
```bash
net start MongoDB
```

### Ollama Not Responding

**Cause**: Ollama server not running.

**Fix**:
```bash
ollama serve
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Ask the AI assistant |
| GET | `/api/stats` | RAG system statistics |
| GET | `/api/security-stats` | Security verification stats |
| GET | `/api/vector-stats` | Vector search statistics |
| GET | `/force-scrape/:name` | Index a package's documentation |
| POST | `/api/hybrid-search` | Advanced search with combined scoring |

---

## Project Structure

```
Packkit/
├── backend/
│   ├── server.js          # Main Express server & npm proxy
│   ├── services/
│   │   ├── ai.js          # Ollama integration
│   │   ├── rag.js         # Vector search & caching
│   │   ├── scraper.js     # Documentation scraper
│   │   └── security.js    # Checksum verification
│   └── storage/           # Cached packages & metadata
├── frontend/
│   └── src/
│       ├── Chatbot.jsx    # AI chat interface
│       └── AdminDashboard.jsx # Admin stats & controls
├── start.bat              # Windows startup script
└── REPAIR_AND_START.bat   # IP repair & startup script
```

---

## License

MIT