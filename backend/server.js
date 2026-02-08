const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const https = require('https');

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
const { verifyPackageIntegrity, getSecurityStats } = require('./services/security');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4873;
const UPSTREAM_URL = 'https://registry.npmjs.org';
const CACHE_DIR = path.join(__dirname, 'storage');

const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2'
});

// Download lock to prevent race conditions when multiple users request the same file
const downloadLocks = new Map();

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

mongoose.connect('mongodb://localhost:27017/Packkit')
  .then(async () => {
    console.log('MongoDB connected');
    try {
      await initializeVectorIndices();
    } catch (err) {
      console.warn('Index initialization warning:', err.message);
    }
  })
  .catch(err => console.error('DB Error:', err));

const PackageSchema = new mongoose.Schema({
  name: String,
  version: String,
  integrity: String,
  cachedPath: String,
  verified: { type: Boolean, default: false },
  verificationDate: Date,
  checksumAlgorithm: { type: String, default: 'sha512' }
});
const Package = mongoose.model('Package', PackageSchema);

const DocumentationSchema = new mongoose.Schema({
  packageName: String,
  content: String
});
DocumentationSchema.index({ content: 'text', packageName: 'text' });
const Documentation = mongoose.model('Documentation', DocumentationSchema);

fs.ensureDirSync(CACHE_DIR);

// API Routes

app.get('/force-scrape/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const content = await scrapeDocs(name);
    if (content) {
      await Documentation.deleteMany({ packageName: name });
      await Documentation.create({ packageName: name, content });
      await storeDocumentWithEmbeddings(name, content);
      return res.json({ success: true, chars: content.length, package: name });
    }
    return res.status(500).json({ error: 'Scraper returned null' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  const { question } = req.body;
  try {
    const startTime = Date.now();
    const cached = await getCachedResponse(question);
    if (cached) {
      return res.json({
        answer: cached,
        source: 'cache',
        responseTime: Date.now() - startTime
      });
    }

    const relevantChunks = await findRelevantChunks(question, 3);
    if (relevantChunks.length === 0) {
      return res.json({
        answer: 'No relevant documentation found. Try scraping a package first.',
        source: null,
        responseTime: Date.now() - startTime
      });
    }

    const context = relevantChunks
      .map((chunk, i) => `[Source: ${chunk.packageName} | Chunk ${i + 1}]\n${chunk.text}`)
      .join('\n\n');

    const answer = await askOllama(question, context);
    await cacheResponse(question, answer);

    res.json({
      answer,
      source: relevantChunks[0]?.packageName || null,
      responseTime: Date.now() - startTime
    });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ answer: 'Error processing your question.', source: null });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    res.json(await getRAGStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vector-stats', async (req, res) => {
  try {
    res.json(await getVectorOptimizationStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hybrid-search', async (req, res) => {
  try {
    const startTime = Date.now();
    const results = await hybridSearch(req.body.query, 5);
    res.json({
      query: req.body.query,
      results: results.map(r => ({
        packageName: r.packageName,
        text: r.text?.substring(0, 150) + '...',
        vectorScore: r.vectorScore?.toFixed(3),
        combinedScore: r.combinedScore?.toFixed(3)
      })),
      responseTime: Date.now() - startTime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rebuild-embeddings/:packageName', async (req, res) => {
  try {
    const { rebuildEmbeddings } = require('./services/rag');
    res.json(await rebuildEmbeddings(req.params.packageName));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/security-stats', async (req, res) => {
  try {
    res.json(await getSecurityStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NPM Proxy Routes

app.get('/:name', async (req, res) => {
  const { name } = req.params;
  const metadataPath = path.join(CACHE_DIR, `${name}.json`);

  try {
    const response = await axios.get(`${UPSTREAM_URL}/${name}`, { httpsAgent, timeout: 5000 });
    const data = response.data;

    // Rewrite tarball URLs to point to this proxy
    Object.keys(data.versions).forEach(v => {
      data.versions[v].dist.tarball = data.versions[v].dist.tarball.replace(
        UPSTREAM_URL,
        `http://${req.headers.host}`
      );
    });

    // Cache the metadata for offline use
    await fs.writeJson(metadataPath, data);
    res.json(data);
  } catch (e) {
    // OFFLINE FALLBACK: Serve from cache if available
    if (fs.existsSync(metadataPath)) {
      console.log(`[Offline] Serving cached metadata for ${name}`);
      const cachedData = await fs.readJson(metadataPath);
      // Still need to update the host in case the IP changed since last online run
      Object.keys(cachedData.versions).forEach(v => {
        const dist = cachedData.versions[v].dist;
        const currentHost = `http://${req.headers.host}`;
        // Detect if the tarball URL needs updating (if it doesn't already match the current host)
        if (!dist.tarball.includes(currentHost)) {
          dist.tarball = dist.tarball.replace(/http:\/\/[^\/]+/, currentHost);
        }
      });
      return res.json(cachedData);
    }
    res.status(502).send(`Upstream registry unreachable and no local cache for ${name}`);
  }
});

app.get('/:name/-/:filename', async (req, res) => {
  const { name, filename } = req.params;
  const filePath = path.join(CACHE_DIR, filename);
  const versionMatch = filename.match(/-[\d.]+(?:-[\w.]+)?\.tgz$/);
  const version = versionMatch ? versionMatch[1] : null;

  // If file already exists, serve it immediately
  if (fs.existsSync(filePath)) {
    return fs.createReadStream(filePath).pipe(res);
  }

  // Check if another request is already downloading this file
  if (downloadLocks.has(filename)) {
    // Wait for the existing download to complete
    try {
      await downloadLocks.get(filename);
      if (fs.existsSync(filePath)) {
        return fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      // Original download failed, we'll try again below
    }
  }

  // Create a promise that resolves when download completes
  let resolveDownload, rejectDownload;
  const downloadPromise = new Promise((resolve, reject) => {
    resolveDownload = resolve;
    rejectDownload = reject;
  });
  downloadLocks.set(filename, downloadPromise);

  try {
    const upstream = await axios({
      method: 'get',
      url: `${UPSTREAM_URL}/${name}/-/${filename}`,
      responseType: 'stream',
      httpsAgent
    });
    const fileWriter = fs.createWriteStream(filePath);
    upstream.data.pipe(res);
    upstream.data.pipe(fileWriter);

    fileWriter.on('finish', async () => {
      downloadLocks.delete(filename);
      resolveDownload();

      if (version) {
        const verification = await verifyPackageIntegrity(name, version, filePath);
        if (!verification.verified) return;
        await Package.create({
          name,
          version,
          cachedPath: filePath,
          integrity: verification.checksum,
          verified: true,
          verificationDate: new Date(),
          checksumAlgorithm: 'sha512'
        });
      } else {
        await Package.create({ name, cachedPath: filePath, integrity: 'unknown', verified: false });
      }

      const hasDocs = await Documentation.exists({ packageName: name });
      if (!hasDocs) {
        scrapeDocs(name).then(content => {
          if (content) {
            Documentation.create({ packageName: name, content });
            storeDocumentWithEmbeddings(name, content);
          }
        }).catch(() => { });
      }
    });

    fileWriter.on('error', (err) => {
      downloadLocks.delete(filename);
      rejectDownload(err);
    });
  } catch (e) {
    downloadLocks.delete(filename);
    rejectDownload(e);
    if (!res.headersSent) res.status(500).send('Download error');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let networkIP = 'localhost';
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  // Prioritize LAN IPs (192.168.x.x or 10.x.x.x) over WSL/Virtual (172.x.x.x)
  networkIP = ips.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.')) || ips[0] || 'localhost';
  console.log(`PackKit server running on port ${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${networkIP}:${PORT}`);
});