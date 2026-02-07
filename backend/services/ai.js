/*
====================================================================================
This is the module that requests the Ai (Ollama) for  context aware  answers. The ai 
is fed the context via fullPrompt
====================================================================================
*/
const axios = require('axios');

const OLLAMA_URL = 'http://localhost:11434/api/generate';

async function askOllama(question, context) {
  
  const fullPrompt = `
    You are an expert offline coding assistant. 
    Use the following documentation to answer the user's question concisely.
    
    DOCUMENTATION CONTEXT:
    ${context}
    
    USER QUESTION:
    ${question}
    
    answer with code example if possible:
  `;
  
  try {
    console.log(" sending to ollama...");
    const response = await axios.post(OLLAMA_URL, {
      model: "llama3.2:3b", 
      prompt: fullPrompt,
      stream: false 
    });
    
    return response.data.response;
  } catch (error) {
    console.error("AI Error:", error.message);
    return "I cannot think right now. Is Ollama running? (Run 'ollama serve')";
  }
}

module.exports = { askOllama };