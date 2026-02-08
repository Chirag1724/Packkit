const mongoose = require('mongoose');
const crypto = require('crypto');
const { generateEmbedding, cosineSimilarity } = require('./ai');

const ChunkSchema = new mongoose.Schema({
  packageName: String,
  chunkIndex: Number,
  text: String,
  embedding: [Number],
  createdAt: { type: Date, default: Date.now }
});
ChunkSchema.index({ embedding: '2dsphere' });
ChunkSchema.index({ packageName: 1 });
const Chunk = mongoose.model('chunk', ChunkSchema);

const CacheSchema = new mongoose.Schema({
  questionHash: String,
  answer: String,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 86400000) }
});
CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Cache = mongoose.model('cache', CacheSchema);

const EmbeddingCacheSchema = new mongoose.Schema({
  textHash: String,
  embedding: [Number],
  createdAt: { type: Date, default: Date.now, expires: 3600 }
});
EmbeddingCacheSchema.index({ textHash: 1 });
const EmbeddingCache = mongoose.model('embeddingCache', EmbeddingCacheSchema);

function chunkDocument(text, chunkSize = 800, overlap = 100) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

async function storeDocumentWithEmbeddings(packageName, fullText) {
  try {
    await Chunk.deleteMany({ packageName });
    const chunks = chunkDocument(fullText);
    let successCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await generateEmbedding(chunks[i]);
      await Chunk.create({
        packageName,
        chunkIndex: i,
        text: chunks[i],
        embedding: embedding || null
      });
      if (embedding) successCount++;
    }
    console.log(`Stored ${successCount}/${chunks.length} chunks for ${packageName}`);
  } catch (error) {
    console.error(`Error storing chunks for ${packageName}:`, error.message);
  }
}

async function getOrCacheEmbedding(text) {
  const textHash = crypto.createHash('md5').update(text).digest('hex');
  const cached = await EmbeddingCache.findOne({ textHash });
  if (cached) return cached.embedding;

  const embedding = await generateEmbedding(text);
  if (embedding) {
    await EmbeddingCache.updateOne({ textHash }, { embedding }, { upsert: true });
  }
  return embedding;
}

async function findRelevantChunks(question, topK = 3) {
  try {
    const questionEmbedding = await getOrCacheEmbedding(question);

    if (questionEmbedding) {
      const allChunks = await Chunk.find({ embedding: { $ne: null } }).lean();
      const scored = allChunks.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(questionEmbedding, chunk.embedding)
      }));
      return scored.sort((a, b) => b.score - a.score).slice(0, topK).filter(c => c.score > 0.3);
    }

    // Text search fallback
    const keywords = question.split(/\s+/).filter(w => w.length > 3);
    const regex = new RegExp(keywords.join('|'), 'i');
    return await Chunk.find({ text: regex }).limit(topK).lean();
  } catch (error) {
    console.error('Retrieval error:', error.message);
    return [];
  }
}

async function getCachedResponse(question) {
  const hash = crypto.createHash('md5').update(question).digest('hex');
  const cached = await Cache.findOne({ questionHash: hash });
  return cached ? cached.answer : null;
}

async function cacheResponse(question, answer) {
  const hash = crypto.createHash('md5').update(question).digest('hex');
  await Cache.updateOne(
    { questionHash: hash },
    { answer, expiresAt: new Date(Date.now() + 86400000) },
    { upsert: true }
  );
}

async function getRAGStats() {
  const [chunkCount, cacheSize, embeddingCacheSize, packages] = await Promise.all([
    Chunk.countDocuments(),
    Cache.countDocuments(),
    EmbeddingCache.countDocuments(),
    Chunk.distinct('packageName')
  ]);
  return {
    totalChunks: chunkCount,
    cachedResponses: cacheSize,
    embeddingsCached: embeddingCacheSize,
    packages: packages.length,
    packageList: packages
  };
}

async function initializeVectorIndices() {
  try {
    await Chunk.collection.createIndex({ packageName: 1 }).catch(() => { });
    await Chunk.collection.createIndex({ embedding: 1 }).catch(() => { });
    await Cache.collection.createIndex({ questionHash: 1 }).catch(() => { });
    await EmbeddingCache.collection.createIndex({ textHash: 1 }).catch(() => { });
    console.log('Vector indices initialized');
  } catch (error) {
    console.log('Index initialization completed');
  }
}

async function hybridSearch(question, topK = 3) {
  try {
    const vectorResults = await findRelevantChunks(question, topK * 2);
    const keywords = question.split(/\s+/).filter(w => w.length > 3);
    const keywordResults = await Chunk.find({
      text: new RegExp(keywords.join('|'), 'i')
    }).limit(topK * 2).lean();

    const merged = new Map();

    vectorResults.forEach((result, idx) => {
      merged.set(result._id.toString(), {
        ...result,
        vectorScore: result.score || 0,
        keywordScore: 0
      });
    });

    keywordResults.forEach(result => {
      const id = result._id.toString();
      if (merged.has(id)) {
        merged.get(id).keywordScore = 1;
      } else {
        merged.set(id, { ...result, vectorScore: 0, keywordScore: 1 });
      }
    });

    return Array.from(merged.values())
      .map(item => ({ ...item, combinedScore: (item.vectorScore * 0.7) + (item.keywordScore * 0.3) }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK);
  } catch (error) {
    console.error('Hybrid search error:', error.message);
    return [];
  }
}

async function getVectorOptimizationStats() {
  const [chunkCount, withEmbeddings, embeddingCacheSize, responseCacheSize] = await Promise.all([
    Chunk.countDocuments(),
    Chunk.countDocuments({ embedding: { $ne: null } }),
    EmbeddingCache.countDocuments(),
    Cache.countDocuments()
  ]);

  return {
    totalChunks: chunkCount,
    chunksWithEmbeddings: withEmbeddings,
    embeddingCoverage: withEmbeddings > 0 ? Math.round((withEmbeddings / chunkCount) * 100) : 0,
    embeddingsCached: embeddingCacheSize,
    responsesCached: responseCacheSize,
    vectorOptimizationEnabled: withEmbeddings > 0
  };
}

async function rebuildEmbeddings(packageName) {
  try {
    const chunks = await Chunk.find({ packageName });
    let updated = 0;

    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);
      if (embedding) {
        chunk.embedding = embedding;
        await chunk.save();
        updated++;
      }
    }
    return { updated, total: chunks.length };
  } catch (error) {
    return { updated: 0, total: 0 };
  }
}

module.exports = {
  Chunk,
  Cache,
  EmbeddingCache,
  chunkDocument,
  storeDocumentWithEmbeddings,
  findRelevantChunks,
  getCachedResponse,
  cacheResponse,
  getRAGStats,
  getOrCacheEmbedding,
  initializeVectorIndices,
  hybridSearch,
  getVectorOptimizationStats,
  rebuildEmbeddings
};