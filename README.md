# PackKit

A private npm package registry with AI-powered documentation assistant.

## Features

- **NPM Proxy**: Cache packages locally with integrity verification
- **AI Chatbot**: Ask questions about package documentation
- **RAG System**: Vector search with semantic embeddings
- **Security**: SHA-512 checksum verification against npm registry
- **Admin Dashboard**: Monitor system stats and health

## Requirements

- Node.js 18+
- MongoDB
- Ollama with models: `llama3.2:latest`, `nomic-embed-text`

## Quick Start

```bash
# Start everything (Windows)
.\start.bat

# Or manually:
cd backend && npm install && node server.js
cd frontend && npm install && npm run dev
```

## URLs

| Service | URL |
|---------|-----|
| Chat | http://localhost:5174 |
| Admin | http://localhost:5174/admin |
| API | http://localhost:4873 |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Ask the AI assistant |
| GET | `/api/stats` | RAG statistics |
| GET | `/api/security-stats` | Security stats |
| GET | `/force-scrape/:name` | Index package docs |

## License

MIT