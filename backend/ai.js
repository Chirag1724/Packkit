/*
====================================================================================
This is the module that requests the Ai (Ollama) for  context aware  answers. The ai 
is fed the context via fullPrompt
====================================================================================
*/
const axios = require('axios');

const OLLAMA_URL = `${process.env.OLLAMA_HOST || 'http://localhost:11434'}/api`

async function askOllama(question, context) {
  const fullPrompt = `You are an expert coding assistant. Answer the following question using ONLY the provided documentation. Be concise.

DOCUMENTATION:
${context}

QUESTION: ${question}

Answer`;
  
  try {
    console.log("Querying AI right now...");
    const response = await axios.post(`${OLLAMA_URL}/generate`, {
      model: "llama3.2:3b",
      prompt: fullPrompt,
      stream: false,
    });
    
    return response.data.response;
  } catch (error) {
    console.error("AI Error:", error.message);
    return "Error: Is Ollama running? (Run 'ollama serve')";
  }
}

module.exports = { 
  askOllama,
};
