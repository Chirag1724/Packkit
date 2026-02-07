const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');   

//yha se import services;

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



//Database idhar se:

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/codecache';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

mongoose.connect(MONGO_URL)
  .then(async () => {
    console.log(' MongoDB Connected');
    console.log(` Using MongoDB: ${MONGO_URL}`);
    console.log(` Using Ollama: ${OLLAMA_HOST}`);
    // Initialize vector indices for optimization
    try {
      await initializeVectorIndices();
    } catch (err) {
      console.warn('  Index initialization warning (safe to ignore):', err.message);
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
