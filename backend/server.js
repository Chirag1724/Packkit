const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');

const { scrapeDocs } = require('./services/scraper');
const { askOllama } = require('./services/ai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4873;
const UPSTREAM_URL = 'https://registry.npmjs.org';
const CACHE_DIR = path.join(__dirname, 'storage');

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
//database connect
mongoose.connect('mongodb://localhost:27017/codecache')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('DB error:', err));

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
app.get('/force-scrape/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const content = await scrapeDocs(name);
    if (!content) return res.status(500).send('Scrape failed');
    await Documentation.deleteMany({ packageName: name });
    await Documentation.create({ packageName: name, content });
    return res.send(`Scraped ${content.length} chars for ${name}`);
  } catch (err) {
    return res.status(500).send(err.message);
  }
});
//chat routess
app.post('/api/chat', async (req, res) => {
  const { question } = req.body;
  try {
    const relevantDoc = await Documentation.findOne({ $text: { $search: question } });
    const context = relevantDoc ? relevantDoc.content : null;
    const answer = await askOllama(question, context);
    res.json({ answer, source: relevantDoc ? relevantDoc.packageName : null });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ answer: 'Error processing request', source: null });
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
  if (fs.existsSync(filePath)) return fs.createReadStream(filePath).pipe(res);
  try {
    const upstream = await axios({ method: 'get', url: `${UPSTREAM_URL}/${name}/-/${filename}`, responseType: 'stream' });
    const fileWriter = fs.createWriteStream(filePath);
    upstream.data.pipe(res);
    upstream.data.pipe(fileWriter);
    fileWriter.on('finish', async () => {
      await Package.create({ name, cachedPath: filePath, integrity: 'sha512-placeholder' });
      const hasDocs = await Documentation.exists({ packageName: name });
      if (!hasDocs) {
        try {
          const content = await scrapeDocs(name);
          if (content) await Documentation.create({ packageName: name, content });
        } catch (err) {
          console.error('Scrape error:', err.message);
        }
      }
    });
  } catch (e) {
    console.error('Download error:', e.message);
    if (!res.headersSent) res.status(500).send('Download error');
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));