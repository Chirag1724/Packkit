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
    const startTime = Date.now(); 
    
    const response = await axios.post(OLLAMA_URL, {
      model: "llama3.2:3b", 
      prompt: fullPrompt,
      stream: true 
    }, {
      responseType: 'stream' 
    });
    
    let fullResponse = '';
    let tokenCount = 0;
    let lastLogTime = startTime;
    
    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          try { 
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullResponse += parsed.response;
              tokenCount++;
              
              // logs
              const now = Date.now();
              const timeSinceStart = now - startTime;
              const timeSinceLast = now - lastLogTime;
              
              process.stdout.write(`\r tokens: ${tokenCount} | Time: ${timeSinceStart}ms | Last token: ${timeSinceLast}ms`);
              
              lastLogTime = now;
            }
            
            if (parsed.done) {
              const totalTime = Date.now() - startTime;
              console.log(`\n generation complete!`);
              console.log(` stats: ${tokenCount} tokens in ${totalTime}ms (${(tokenCount / (totalTime / 1000)).toFixed(2)} tokens/sec)`);
              resolve(fullResponse);
            }
          } catch (e) {
            
          }
        });
      });
      
      response.data.on('error', (error) => {
        console.error("\n stream error:", error.message);
        reject(error);
      });
    });
    
  } catch (error) {
    console.error(" ai error:", error.message);
    return "i can't think right now. is Ollama running? (Run 'ollama serve')";
  }
}

module.exports = { askOllama };