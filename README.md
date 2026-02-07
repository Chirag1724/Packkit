# Packkit

An AI-powered NPM package registry cache with intelligent documentation retrieval and smart caching mechanisms.

## Features

- **NPM Registry Proxy**: Efficient caching layer for NPM packages
- **AI-Powered Search**: Intelligent package documentation retrieval using Ollama LLM
- **Vector Embeddings**: RAG (Retrieval-Augmented Generation) with semantic search
- **Real-time Caching**: Smart cache optimization and statistics
- **Web Scraping**: Automated documentation scraping and indexing
- **Responsive UI**: React + Vite frontend with analytics dashboard

## Tech Stack

**Backend:**
- Node.js + Express
- MongoDB for data persistence
- Ollama for embeddings & LLM inference
- Axios for HTTP requests

**Frontend:**
- React 18 + Vite
- Recharts for data visualization
- Axios for API integration

## Prerequisites

- Node.js v14+
- MongoDB Community Edition
- Ollama
- npm

## Quick Start

### Backend Setup
```bash
cd backend
npm install
npm start
```

**Ollama Models Required:**
```bash
ollama pull nomic-embed-text
ollama pull llama3.2:3b
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

**Access the app at:** `http://localhost:5173`

**API Server runs at:** `http://localhost:4873`

## Project Structure

```
codecache/
├── backend/              # Express server, AI services, RAG
│   ├── services/        # ai.js, rag.js, scraper.js
│   └── storage/         # Data persistence
├── frontend/            # Main React app
│   ├── src/            # Components & pages
│   ├── admin/          # Admin dashboard
│   └── public/         # Public docs site
└── docker-compose.yml  # Docker setup
```

## Teammates

Big thanks to my amazing hackathon teammates!

<div align="left">

[![Contributors](https://contrib.rocks/image?repo=Chirag1724/Packkit)](https://github.com/Chirag1724/Packkit/graphs/contributors)

</div>