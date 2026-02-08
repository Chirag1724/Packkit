const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api';

async function generateEmbedding(text) {
  try {
    const startTime = Date.now();
    const response = await axios.post(`${OLLAMA_URL}/embeddings`, {
      model: 'nomic-embed-text',
      prompt: text
    });
    console.log(`Embedding generated in ${Date.now() - startTime}ms`);
    return response.data.embedding || response.data.embeddings?.[0] || null;
  } catch (error) {
    if (error.response?.status === 404) {
      console.error('Embedding model not found. Run: ollama pull nomic-embed-text');
    }
    return null;
  }
}

async function askOllama(question, context) {
  const prompt = `You are PackKit AI, an expert specialized in npm packages and Node.js.
Your goal is to explain packages based on the provided DOCUMENTATION.

GUIDELINES:
1. Use the provided DOCUMENTATION as your primary source of truth.
2. If the documentation doesn't specifically answer the question, you may use your general knowledge of npm and the package to provide a helpful response.
3. If the user asks about an npm command (like 'npm install' or 'npm create'), explain it clearly even if it's not in the documentation.
4. If you are unsure, admit it instead of giving a generic response.
5. Be concise and technical.

DOCUMENTATION:
${context}

QUESTION: ${question}

Answer:`;

  try {
    const startTime = Date.now();
    const response = await axios.post(`${OLLAMA_URL}/generate`, {
      model: 'llama3.2:latest',
      prompt,
      stream: false,
      num_predict: 500
    });
    console.log(`AI response in ${Date.now() - startTime}ms`);
    return response.data.response;
  } catch (error) {
    console.error('AI error:', error.message);
    return 'Error: Is Ollama running? (Run "ollama serve")';
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return isNaN(similarity) ? 0 : similarity;
}

module.exports = { askOllama, generateEmbedding, cosineSimilarity };