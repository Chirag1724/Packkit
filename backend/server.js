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


app.post('/api/precache', async (req, res) => {
  const { packageName, version } = req.body;
  if (!packageName) {
    return res.status(400).json({ error: 'Package name is required' });
  }

  try {

    const metaRes = await axios.get(`${UPSTREAM_URL}/${packageName}`, { httpsAgent, timeout: 10000 });
    const meta = metaRes.data;


    const targetVersion = version || meta['dist-tags']?.latest;
    if (!targetVersion || !meta.versions[targetVersion]) {
      return res.status(404).json({ error: `Version ${version || 'latest'} not found for ${packageName}` });
    }

    const versionData = meta.versions[targetVersion];
    const tarballUrl = versionData.dist.tarball;
    const filename = tarballUrl.split('/').pop();
    const filePath = path.join(CACHE_DIR, filename);


    if (fs.existsSync(filePath)) {
      return res.json({
        success: true,
        message: `${packageName}@${targetVersion} already cached`,
        cached: true,
        version: targetVersion
      });
    }


    const tarballRes = await axios({
      method: 'get',
      url: tarballUrl,
      responseType: 'stream',
      httpsAgent,
      timeout: 60000
    });

    const writer = fs.createWriteStream(filePath);
    tarballRes.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });


    const metadataPath = path.join(CACHE_DIR, `${packageName}.json`);

    Object.keys(meta.versions).forEach(v => {
      if (meta.versions[v].dist && meta.versions[v].dist.tarball) {
        meta.versions[v].dist.tarball = meta.versions[v].dist.tarball.replace(
          UPSTREAM_URL,
          `http://localhost:${PORT}`
        );
      }
    });
    await fs.writeJson(metadataPath, meta);


    const verification = await verifyPackageIntegrity(packageName, targetVersion, filePath);
    await Package.create({
      name: packageName,
      version: targetVersion,
      cachedPath: filePath,
      integrity: verification.checksum || 'unknown',
      verified: verification.verified,
      verificationDate: new Date(),
      checksumAlgorithm: 'sha512'
    });

    res.json({
      success: true,
      message: `Cached ${packageName}@${targetVersion}`,
      version: targetVersion,
      size: (await fs.stat(filePath)).size
    });
  } catch (err) {
    console.error('Pre-cache error:', err.message);
    res.status(500).json({ error: err.message });
  }
});



app.get('/:name', async (req, res) => {
  const { name } = req.params;
  const metadataPath = path.join(CACHE_DIR, `${name}.json`);

  try {
    const response = await axios.get(`${UPSTREAM_URL}/${name}`, { httpsAgent, timeout: 5000 });
    const data = response.data;


    Object.keys(data.versions).forEach(v => {
      data.versions[v].dist.tarball = data.versions[v].dist.tarball.replace(
        UPSTREAM_URL,
        `http://${req.headers.host}`
      );
    });

    await fs.writeJson(metadataPath, data);
    res.json(data);
  } catch (e) {
    if (fs.existsSync(metadataPath)) {
      console.log(`[Offline] Serving cached metadata for ${name}`);
      const cachedData = await fs.readJson(metadataPath);
      Object.keys(cachedData.versions).forEach(v => {
        const dist = cachedData.versions[v].dist;
        const currentHost = `http://${req.headers.host}`;
        dist.tarball = dist.tarball.replace(/https?:\/\/[^\/]+/, currentHost);
      });
      return res.json(cachedData);
    }
    res.status(502).send(`Upstream registry unreachable and no local cache for ${name}`);
  }
});

app.get('/:name/-/:filename', async (req, res) => {
  const { name, filename } = req.params;
  const filePath = path.join(CACHE_DIR, filename);
  const versionMatch = filename.match(/-([\d.]+(?:-[\w.]+)?)\.tgz$/);
  const version = versionMatch ? versionMatch[1] : null;

  if (fs.existsSync(filePath)) {
    return fs.createReadStream(filePath).pipe(res);
  }

  if (downloadLocks.has(filename)) {
    try {
      await downloadLocks.get(filename);
      if (fs.existsSync(filePath)) {
        return fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
    }
  }

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
  networkIP = ips.find(ip => ip.startsWith('192.168.') || ip.startsWith('10.')) || ips[0] || 'localhost';
  console.log(`PackKit server running on port ${PORT}`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${networkIP}:${PORT}`);
});