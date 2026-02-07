const mongoose = require('mongoose');
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
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
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
  console.log(`    Split into ${chunks.length} chunks (size: ${chunkSize}, overlap: ${overlap})`);
  return chunks;
}


async function storeDocumentWithEmbeddings(packageName, fullText) {
  console.log(`\n Processing ${packageName}...`);
  
  try {
    
    const deletedCount = await Chunk.deleteMany({ packageName });
    if (deletedCount.deletedCount > 0) {
      console.log(`     Deleted ${deletedCount.deletedCount} old chunks`);
    }
    
    
    const chunks = chunkDocument(fullText);
    
    
    let successCount = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`    Processing chunk ${i + 1}/${chunks.length}...`);
      const embedding = await generateEmbedding(chunks[i]);
      
      if (embedding) {
        await Chunk.create({
          packageName,
          chunkIndex: i,
          text: chunks[i],
          embedding
        });
        successCount++;
      } else {
       
        await Chunk.create({
          packageName,
          chunkIndex: i,
          text: chunks[i],
          embedding: null
        });
      }
    }
    
    const elapsed = Date.now() - startTime;
    
    if (successCount > 0) {
      console.log(`    Stored ${successCount}/${chunks.length} chunks with embeddings in ${elapsed}ms`);
      console.log(`    Vector coverage: ${Math.round((successCount / chunks.length) * 100)}%`);
    } else {
      console.log(`     Stored ${chunks.length} chunks (without embeddings - text search fallback)`);
      console.log(`    Install embedding model: ollama pull nomic-embed-text`);
    }
  } catch (error) {
    console.error(`Error storing chunks for ${packageName}:`, error.message);
  }
}

async function getOrCacheEmbedding(text) {
  const crypto = require('crypto');
  const textHash = crypto.createHash('md5').update(text).digest('hex');
  
  
  const cached = await EmbeddingCache.findOne({ textHash });
  if (cached) {
    console.log(`   Using cached embedding`);
    return cached.embedding;
  }
  
  console.log(`   Generating new embedding...`);
  const embedding = await generateEmbedding(text);
  
  if (embedding) {
    await EmbeddingCache.updateOne(
      { textHash },
      { embedding },
      { upsert: true }
    );
  }
  
  return embedding;
}

async function findRelevantChunks(question, topK = 3) {
  try {
    console.log(`\nSearching for relevant chunks...`);
    const startTime = Date.now();
    
    const questionEmbedding = await getOrCacheEmbedding(question);
    
    if (questionEmbedding) {
      try {
        const allChunks = await Chunk.find({ embedding: { $ne: null } }).lean();
        console.log(`   Found ${allChunks.length} chunks with embeddings`);
        
        const scored = allChunks.map(chunk => {
          const similarity = cosineSimilarity(questionEmbedding, chunk.embedding);
          return {
            ...chunk,
            score: similarity
          };
        });

        const relevant = scored
          .sort((a, b) => b.score - a.score)
          .slice(0, topK)
          .filter(c => c.score > 0.3); 
        
        const elapsed = Date.now() - startTime;
        console.log(`   Found ${relevant.length} relevant chunks (semantic search) in ${elapsed}ms`);
        
        if (relevant.length > 0) {
          console.log(`    Top similarity scores: ${relevant.map(r => r.score.toFixed(3)).join(', ')}`);
        }
        
        return relevant;
      } catch (vectorError) {
        console.log(`    Vector search failed, falling back to text search...`);
      }
    }
    
    console.log(`   Using text search fallback`);
    const keywords = question.split(/\s+/).filter(w => w.length > 3);
    const regex = new RegExp(keywords.join('|'), 'i');
    
    const allChunks = await Chunk.find({ text: regex }).lean();
    const relevant = allChunks.slice(0, topK);
    
    const elapsed = Date.now() - startTime;
    console.log(`   Found ${relevant.length} chunks (text search) in ${elapsed}ms`);
    
    return relevant;
  } catch (error) {
    console.error("Retrieval error:", error.message);
    return [];
  }
}

async function getCachedResponse(question) {
  const hash = require('crypto').createHash('md5').update(question).digest('hex');
  const cached = await Cache.findOne({ questionHash: hash });
  
  if (cached) {
    console.log(`    Using cached response`);
  }
  
  return cached ? cached.answer : null;
}

async function cacheResponse(question, answer) {
  const hash = require('crypto').createHash('md5').update(question).digest('hex');
  await Cache.updateOne(
    { questionHash: hash },
    { answer, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    { upsert: true }
  );
  console.log(`    Response cached`);
}


async function getRAGStats() {
  const chunkCount = await Chunk.countDocuments();
  const cacheSize = await Cache.countDocuments();
  const embeddingCacheSize = await EmbeddingCache.countDocuments();
  const packages = await Chunk.distinct('packageName');
  
  const stats = {
    totalChunks: chunkCount,
    cachedResponses: cacheSize,
    embeddingsCached: embeddingCacheSize,
    packages: packages.length,
    packageList: packages
  };
  
  console.log(`\n RAG Statistics:`);
  console.log(`   Total chunks: ${stats.totalChunks}`);
  console.log(`   Cached responses: ${stats.cachedResponses}`);
  console.log(`   Embeddings cached: ${stats.embeddingsCached}`);
  console.log(`   Packages indexed: ${stats.packages}`);
  
  return stats;
}

async function initializeVectorIndices() {
  console.log('\n Initializing vector indices...');
  
  try {
    await Chunk.collection.createIndex({ packageName: 1 }).catch(() => {});
    await Chunk.collection.createIndex({ embedding: 1 }).catch(() => {});
    await Chunk.collection.createIndex({ packageName: 1, chunkIndex: 1 }).catch(() => {});
    
    await Cache.collection.createIndex({ questionHash: 1 }).catch(() => {});
    await Cache.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    
    await EmbeddingCache.collection.createIndex({ textHash: 1 }).catch(() => {});
    await EmbeddingCache.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }).catch(() => {});
    
    console.log(' Vector indices initialized');
    return true;
  } catch (error) {
    console.log('  Vector indices initialization completed with warnings');
    return true;
  }
}


async function hybridSearch(question, topK = 3) {
  try {
    console.log(`\n Starting hybrid search...`);
    const startTime = Date.now();
   
    const vectorResults = await findRelevantChunks(question, topK * 2);
   
    const keywords = question.split(/\s+/).filter(w => w.length > 3);
    const keywordResults = await Chunk.find({
      text: new RegExp(keywords.join('|'), 'i')
    }).limit(topK * 2).lean();
    
    console.log(`    Vector results: ${vectorResults.length}, Keyword results: ${keywordResults.length}`);

    const merged = new Map();
    
    vectorResults.forEach((result, idx) => {
      const id = result._id.toString();
      merged.set(id, {
        ...result,
        vectorScore: result.score || 0,
        vectorRank: idx,
        keywordScore: 0,
        keywordRank: 999
      });
    });
    
    keywordResults.forEach((result, idx) => {
      const id = result._id.toString();
      if (merged.has(id)) {
        const item = merged.get(id);
        item.keywordScore = 1;
        item.keywordRank = idx;
      } else {
        merged.set(id, {
          ...result,
          vectorScore: 0,
          vectorRank: 999,
          keywordScore: 1,
          keywordRank: idx
        });
      }
    });
    

    const results = Array.from(merged.values())
      .map(item => ({
        ...item,
        combinedScore: (item.vectorScore * 0.7) + (item.keywordScore * 0.3)
      }))
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK);
    
    const elapsed = Date.now() - startTime;
    console.log(`    Hybrid search completed in ${elapsed}ms (${results.length} results)`);
    console.log(`    Combined scores: ${results.map(r => r.combinedScore.toFixed(3)).join(', ')}`);
    
    return results;
  } catch (error) {
    console.error(' Hybrid search error:', error.message);
    return [];
  }
}

async function getVectorOptimizationStats() {
  try {
    const chunkCount = await Chunk.countDocuments();
    const withEmbeddings = await Chunk.countDocuments({ embedding: { $ne: null } });
    const embeddingCacheSize = await EmbeddingCache.countDocuments();
    const responseCacheSize = await Cache.countDocuments();
    
    const stats = {
      totalChunks: chunkCount,
      chunksWithEmbeddings: withEmbeddings,
      embeddingCoverage: withEmbeddings > 0 ? Math.round((withEmbeddings / chunkCount) * 100) : 0,
      embeddingsCached: embeddingCacheSize,
      responsesCached: responseCacheSize,
      vectorOptimizationEnabled: withEmbeddings > 0
    };
    
    console.log(`\n Vector Optimization Stats:`);
    console.log(`   Total chunks: ${stats.totalChunks}`);
    console.log(`   Chunks with embeddings: ${stats.chunksWithEmbeddings}`);
    console.log(`   Embedding coverage: ${stats.embeddingCoverage}%`);
    console.log(`   Embeddings cached: ${stats.embeddingsCached}`);
    console.log(`   Responses cached: ${stats.responsesCached}`);
    console.log(`   Vector optimization: ${stats.vectorOptimizationEnabled ? ' ENABLED' : ' DISABLED'}`);
    
    return stats;
  } catch (error) {
    console.error(' error getting stats:', error.message);
    return null;
  }
}

async function rebuildEmbeddings(packageName) {
  try {
    console.log(`\n rebuilding embeddings for ${packageName}...`);
    
    const chunks = await Chunk.find({ packageName });
    console.log(`    found ${chunks.length} chunks to process`);
    
    const { generateEmbedding } = require('./ai');
    
    let updated = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`    processing chunk ${i + 1}/${chunks.length}...`);
      
      const embedding = await generateEmbedding(chunk.text);
      if (embedding) {
        chunk.embedding = embedding;
        await chunk.save();
        updated++;
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`   updated ${updated}/${chunks.length} embeddings in ${elapsed}ms`);
    console.log(`   Success rate: ${Math.round((updated / chunks.length) * 100)}%`);
    
    return { updated, total: chunks.length };
  } catch (error) {
    console.error(' rebuild error:', error.message);
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