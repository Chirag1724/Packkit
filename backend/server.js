const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const { scrapeDocs } = require('./services/scraper');
const { askOllama } = require('./services/ai');
const { 
  storeDocumentWithEmbeddings, 
  findRelevantChunks, 
  getCachedResponse, 
  cacheResponse,
  getRAGStats,
  initializeVectorIndices,
  hybridSearch,
  getVectorOptimizationStats
} = require('./services/rag');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4873;
const UPSTREAM_URL = 'https://registry.npmjs.org';
const CACHE_DIR = path.join(__dirname, 'storage');
app.use((req, res, next) => {
  console.log(` [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});
//database
mongoose.connect('mongodb://localhost:27017/codecache')
  .then(async () => {
    console.log(' MongoDB Connected');
    // Initialize vector indices for optimization
    try {
      await initializeVectorIndices();
    } catch (err) {
      console.warn('index initialization warning (safe to ignore):', err.message);
    }
  })
  .catch(err => console.error(' DB Error:', err));

const PackageSchema = new mongoose.Schema({
  name: String, 
  version: String, 
  integrity: String, 
  cachedPath: String
});
const Package = mongoose.model('Package', PackageSchema);

const DocumentationSchema = new mongoose.Schema({
  packageName: String, 
  content: String
});
DocumentationSchema.index({ content: 'text', packageName: 'text' });
const Documentation = mongoose.model('Documentation', DocumentationSchema);

fs.ensureDirSync(CACHE_DIR);
//routes
//froce sracpe route
app.get('/force-scrape/:name', async (req, res) => {
  const { name } = req.params;
  console.log(` manually triggering scrape for: ${name}`);
  
  try {
    
    const content = await scrapeDocs(name);
    
    if (content) {
  
      await Documentation.deleteMany({ packageName: name });
     
      await Documentation.create({ packageName: name, content });
      
      await storeDocumentWithEmbeddings(name, content);
      
      console.log(` MANUALLY SAVED DOCS FOR: ${name}`);
      return res.send(`<h1>Success!</h1><p>Scraped ${content.length} chars for <b>${name}</b>. Embeddings generated. Check Compass now.</p>`);
    } else {
      return res.status(500).send(`<h1>Failed</h1><p>Scraper returned null. Check terminal for error.</p>`);
    }
  } catch (err) {
    return res.status(500).send(`Error: ${err.message}`);
  }
});

app.post('/api/chat', async (req, res) => {
  const { question } = req.body;
  console.log(` User asked: ${question}`);
  
  try {
    const startTime = Date.now();
    
   
    const cached = await getCachedResponse(question);
    if (cached) {
      console.log(`⚡ Cache HIT! Response in ${Date.now() - startTime}ms`);
      return res.json({ 
        answer: cached, 
        source: 'cache',
        responseTime: Date.now() - startTime
      });
    }
    
    
    const relevantChunks = await findRelevantChunks(question, 3);
    
    if (relevantChunks.length === 0) {
      return res.json({ 
        answer: "No relevant documentation found. Try scraping a package first.", 
        source: null,
        responseTime: Date.now() - startTime
      });
    }
    
    const context = relevantChunks
      .map((chunk, i) => `[Chunk ${i+1}]\n${chunk.text}`)
      .join('\n\n');
    
    console.log(` Using ${relevantChunks.length} chunks (${context.length} chars total)`);
    
    
    const answer = await askOllama(question, context);
    
    
    await cacheResponse(question, answer);
    
    const elapsed = Date.now() - startTime;
    console.log(`response ready in ${elapsed}ms`);
    
    res.json({ 
      answer, 
      source: relevantChunks[0]?.packageName || null,
      responseTime: elapsed,
      context_length: context.length
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ 
      answer: "Error processing your question.", 
      source: null 
    });
  }
});
//proxy routes
app.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const response = await axios.get(`${UPSTREAM_URL}/${name}`);
    const data = response.data;
    Object.keys(data.versions).forEach(v => {
      data.versions[v].dist.tarball = data.versions[v].dist.tarball.replace(UPSTREAM_URL, `http://localhost:${PORT}`);
    });
    res.json(data);
  } catch (e) { 
    console.error('Proxy error:', e.message);
    res.status(500).send(e.message); 
  }
});

app.get('/:name/-/:filename', async (req, res) => {
  const { name, filename } = req.params;
  const filePath = path.join(CACHE_DIR, filename);
  
  if (fs.existsSync(filePath)) {
    console.log(` HIT: ${filename}`);
    return fs.createReadStream(filePath).pipe(res);
  }
  
  console.log(` MISS: Downloading ${filename}...`);
  try {
    const upstream = await axios({ 
      method: 'get', 
      url: `${UPSTREAM_URL}/${name}/-/${filename}`, 
      responseType: 'stream' 
    });
    const fileWriter = fs.createWriteStream(filePath);
    
    upstream.data.pipe(res);
    upstream.data.pipe(fileWriter);
    
    fileWriter.on('finish', async () => {
      console.log(`file saved: ${filename}`);
      await Package.create({ name, cachedPath: filePath, integrity: 'sha512-placeholder' });
      
      // Auto-trigger scrape if no docs exist
      const hasDocs = await Documentation.exists({ packageName: name });
      if (!hasDocs) {
        console.log(` auto-scraping docs for: ${name}`);
        scrapeDocs(name).then(content => {
          if (content) {
            Documentation.create({ packageName: name, content });
           
            storeDocumentWithEmbeddings(name, content);
            console.log(`auto-saved docs for: ${name}`);
          }
        }).catch(err => {
          console.error(`scrape error for ${name}:`, err.message);
        });
      }
    });
  } catch (e) {
    console.error('Download error:', e.message);
    if (!res.headersSent) {
      res.status(500).send("DL Error"); 
    }
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getRAGStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vector-stats', async (req, res) => {
  try {
    const stats = await getVectorOptimizationStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/hybrid-search', async (req, res) => {
  const { query } = req.body;
  console.log(` hybrid search: ${query}`);
  
  try {
    const startTime = Date.now();
    const results = await hybridSearch(query, 5);
    const elapsed = Date.now() - startTime;
    
    res.json({
      query,
      results: results.map(r => ({
        packageName: r.packageName,
        text: r.text?.substring(0, 150) + '...',
        vectorScore: r.vectorScore?.toFixed(3),
        keywordScore: r.keywordScore,
        combinedScore: r.combinedScore?.toFixed(3)
      })),
      responseTime: elapsed
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rebuild-embeddings/:packageName', async (req, res) => {
  const { packageName } = req.params;
  console.log(` rebuilding embeddings for ${packageName}`);
  
  try {
    const { rebuildEmbeddings } = require('./services/rag');
    const result = await rebuildEmbeddings(packageName);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`NEW_SERVER_ACTIVE on ${PORT} (Wait for MongoDB...)`));