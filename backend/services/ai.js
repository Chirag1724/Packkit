const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api';

// Generate embeddings using Ollama (fast, semantic search)
async function generateEmbedding(text) {
  try {
    // Try the standard embeddings endpoint
    const response = await axios.post(`${OLLAMA_URL}/embeddings`, {
      model: "nomic-embed-text",
      prompt: text
    });
    return response.data.embedding || response.data.embeddings?.[0] || null;
  } catch (error) {
    // Fallback: Check if model is available and provide helpful error
    if (error.response?.status === 404) {
      console.error(`⚠️  Embedding model not found. Ensure 'nomic-embed-text' is installed.`);
      console.error(`   Run: ollama pull nomic-embed-text`);
    }
    return null;
  }
}

// Optimized Ollama query with smaller context
async function askOllama(question, context) {
  const fullPrompt = `You are an expert coding assistant. Answer the following question using ONLY the provided documentation. Be concise.

DOCUMENTATION:
${context}

QUESTION: ${question}

Answer (max 300 tokens):`;

  try {
    console.log("🧠 Querying AI...");
    const response = await axios.post(`${OLLAMA_URL}/generate`, {
      model: "llama3.2:3b",
      prompt: fullPrompt,
      stream: false,
      num_predict: 300 // Limit response tokens for faster inference
    });

    return response.data.response;
  } catch (error) {
    console.error("❌ AI Error:", error.message);
    return "Error: Is Ollama running? (Run 'ollama serve')";
  }
}

// Cosine similarity for semantic search
function cosineSimilarity(a, b) {
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
  askOllama,
  generateEmbedding,
  cosineSimilarity
};
