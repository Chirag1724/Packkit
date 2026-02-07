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
  const prompt = `You are an expert coding assistant. Answer using ONLY the provided documentation. Be concise.

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
      num_predict: 300
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