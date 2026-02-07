const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api';

async function generateEmbedding(text) {
  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${OLLAMA_URL}/embeddings`, {
      model: "nomic-embed-text",
      prompt: text
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`    Embedding generated in ${elapsed}ms`);
    
    return response.data.embedding || response.data.embeddings?.[0] || null;
  } catch (error) {
    if (error.response?.status === 404) {
      console.error(` Embedding model not found. Ensure 'nomic-embed-text' is installed.`);
      console.error(`   Run: ollama pull nomic-embed-text`);
    } else {
      console.error(` Embedding error: ${error.message}`);
    }
    return null;
  }
}

async function askOllama(question, context) {
  const fullPrompt = `You are an expert coding assistant. Answer the following question using ONLY the provided documentation. Be concise.

DOCUMENTATION:
${context}

QUESTION: ${question}

Answer (max 300 tokens):`;
  
  try {
    console.log("querying AI...");
    const startTime = Date.now();
    
    const response = await axios.post(`${OLLAMA_URL}/generate`, {
      model: "llama3.2:3b",
      prompt: fullPrompt,
      stream: false,
      num_predict: 300 
    });
    
    const elapsed = Date.now() - startTime;
    const responseText = response.data.response;
    const tokenCount = responseText.split(/\s+/).length; // Approximate token count
    const tokensPerSec = ((tokenCount / elapsed) * 1000).toFixed(2);
    
    console.log(`   tokens: ${tokenCount} | Time: ${elapsed}ms | Last token: ${Math.round(elapsed / tokenCount)}ms`);
    console.log(`   generation complete!`);
    console.log(`   stats: ${tokenCount} tokens in ${elapsed}ms (${tokensPerSec} tokens/sec)`);
    
    return responseText;
  } catch (error) {
    console.error(`AI error: ${error.message}`);
    return "Error: Is Ollama running? (Run 'ollama serve')";
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    return 0;
  }
  
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return isNaN(similarity) ? 0 : similarity;
}

module.exports = { 
  askOllama, 
  generateEmbedding,
  cosineSimilarity
};