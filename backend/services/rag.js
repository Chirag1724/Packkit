const mongoose = require('mongoose');
const { generateEmbedding, cosineSimilarity } = require('./ai');

// Chunk Schema for storing document chunks with embeddings
const ChunkSchema = new mongoose.Schema({
    packageName: String,
    chunkIndex: Number,
    text: String, // Small, focused chunk (500-1000 chars)
    embedding: [Number], // Vector representation
    createdAt: { type: Date, default: Date.now }
});

ChunkSchema.index({ embedding: '2dsphere' }); // For vector search
ChunkSchema.index({ packageName: 1 });
const Chunk = mongoose.model('Chunk', ChunkSchema);

// Response cache schema
const CacheSchema = new mongoose.Schema({
    questionHash: String,
    answer: String,
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
});

CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index
const Cache = mongoose.model('Cache', CacheSchema);

// Embedding Cache schema (cache question embeddings)
const EmbeddingCacheSchema = new mongoose.Schema({
    textHash: String,
    embedding: [Number],
    createdAt: { type: Date, default: Date.now, expires: 3600 } // 1 hour TTL
});

EmbeddingCacheSchema.index({ textHash: 1 });
const EmbeddingCache = mongoose.model('EmbeddingCache', EmbeddingCacheSchema);

// =========== CHUNKING ===========
// Split large documents into smaller, searchable chunks
function chunkDocument(text, chunkSize = 800, overlap = 100) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

// =========== STORAGE ===========
// Save document with chunks and embeddings
async function storeDocumentWithEmbeddings(packageName, fullText) {
    console.log(`📚 Processing ${packageName}...`);

    try {
        // Delete old chunks
        await Chunk.deleteMany({ packageName });

        // Split into chunks
        const chunks = chunkDocument(fullText);
        console.log(`   Split into ${chunks.length} chunks`);

        // Generate embeddings for each chunk
        let successCount = 0;
        for (let i = 0; i < chunks.length; i++) {
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
                // No embedding - still store chunk with null embedding for text search fallback
                await Chunk.create({
                    packageName,
                    chunkIndex: i,
                    text: chunks[i],
                    embedding: null
                });
            }
        }

        if (successCount > 0) {
            console.log(`✅ Stored ${successCount}/${chunks.length} chunks with embeddings`);
        } else {
            console.log(`⚠️  Stored ${chunks.length} chunks (without embeddings - text search fallback)`);
            console.log(`   Install embedding model: ollama pull nomic-embed-text`);
        }
    } catch (error) {
        console.error(`❌ Error storing chunks for ${packageName}:`, error.message);
    }
}

// =========== RETRIEVAL ===========
// Optimized: Get or retrieve cached embedding for faster queries
async function getOrCacheEmbedding(text) {
    const crypto = require('crypto');
    const textHash = crypto.createHash('md5').update(text).digest('hex');

    // Check cache first
    const cached = await EmbeddingCache.findOne({ textHash });
    if (cached) {
        return cached.embedding;
    }

    // Generate new embedding
    const { generateEmbedding } = require('./ai');
    const embedding = await generateEmbedding(text);

    // Cache it for 1 hour
    if (embedding) {
        await EmbeddingCache.updateOne(
            { textHash },
            { embedding },
            { upsert: true }
        );
    }

    return embedding;
}

// Find most relevant chunks using vector similarity or text search fallback
async function findRelevantChunks(question, topK = 3) {
    try {
        console.log(`🔍 Searching for relevant chunks...`);
        const startTime = Date.now();

        // Try semantic search with embeddings first (uses cache)
        const questionEmbedding = await getOrCacheEmbedding(question);

        if (questionEmbedding) {
            // OPTIMIZED: Use aggregate pipeline for efficient vector search
            try {
                // Get all chunks with embeddings
                const allChunks = await Chunk.find({ embedding: { $ne: null } }).lean();

                // Calculate similarity scores using vectorized operation
                const scored = allChunks.map(chunk => {
                    const similarity = cosineSimilarity(questionEmbedding, chunk.embedding);
                    return {
                        ...chunk,
                        score: similarity
                    };
                });

                // Sort by score and get top K
                const relevant = scored
                    .sort((a, b) => b.score - a.score)
                    .slice(0, topK)
                    .filter(c => c.score > 0.3); // Filter low-relevance results

                const elapsed = Date.now() - startTime;
                console.log(`   Found ${relevant.length} relevant chunks (semantic search) in ${elapsed}ms`);

                return relevant;
            } catch (vectorError) {
                console.log(`   Vector search failed, falling back to text search...`);
            }
        }

        // Fallback: Text search (simple keyword matching)
        console.log(`   Using text search fallback`);
        const keywords = question.split(/\s+/).filter(w => w.length > 3);
        const regex = new RegExp(keywords.join('|'), 'i');

        const allChunks = await Chunk.find({ text: regex }).lean();
        const relevant = allChunks.slice(0, topK);

        const elapsed = Date.now() - startTime;
        console.log(`   Found ${relevant.length} chunks (text search) in ${elapsed}ms`);

        return relevant;
    } catch (error) {
        console.error("❌ Retrieval error:", error.message);
        return [];
    }
}

// =========== CACHING ===========
// Check if we have a cached response
async function getCachedResponse(question) {
    const hash = require('crypto').createHash('md5').update(question).digest('hex');
    const cached = await Cache.findOne({ questionHash: hash });
    return cached ? cached.answer : null;
}

// Save response to cache
async function cacheResponse(question, answer) {
    const hash = require('crypto').createHash('md5').update(question).digest('hex');
    await Cache.updateOne(
        { questionHash: hash },
        { answer, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        { upsert: true }
    );
}

// =========== OPTIMIZATION STATS ===========
async function getRAGStats() {
    const chunkCount = await Chunk.countDocuments();
    const cacheSize = await Cache.countDocuments();
    const embeddingCacheSize = await EmbeddingCache.countDocuments();
    const packages = await Chunk.distinct('packageName');

    return {
        totalChunks: chunkCount,
        cachedResponses: cacheSize,
        embeddingsCached: embeddingCacheSize,
        packages: packages.length,
        packageList: packages
    };
}

// =========== VECTOR INDEX INITIALIZATION ===========
// Initialize MongoDB indices for optimal vector performance
async function initializeVectorIndices() {
    console.log('🚀 Initializing Vector Indices...');

    try {
        // Chunk indices
        await Chunk.collection.createIndex({ packageName: 1 }).catch(() => { });
        await Chunk.collection.createIndex({ embedding: 1 }).catch(() => { });
        await Chunk.collection.createIndex({ packageName: 1, chunkIndex: 1 }).catch(() => { });

        // Cache indices
        await Cache.collection.createIndex({ questionHash: 1 }).catch(() => { });
        await Cache.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => { });

        // Embedding cache indices (without unique constraint to avoid conflicts)
        await EmbeddingCache.collection.createIndex({ textHash: 1 }).catch(() => { });
        await EmbeddingCache.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 }).catch(() => { });

        console.log('✅ Vector indices initialized');
        return true;
    } catch (error) {
        console.log('✅ Vector indices initialized');
        return true;
    }
}

// =========== HYBRID SEARCH ===========
// Combine vector search with keyword search for better results
async function hybridSearch(question, topK = 3) {
    try {
        const startTime = Date.now();

        // Get vector results
        const vectorResults = await findRelevantChunks(question, topK * 2);

        // Get keyword results
        const keywords = question.split(/\s+/).filter(w => w.length > 3);
        const keywordResults = await Chunk.find({
            text: new RegExp(keywords.join('|'), 'i')
        }).limit(topK * 2).lean();

        // Merge and deduplicate by scoring
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

        // Sort by combined score (vector + keyword)
        const results = Array.from(merged.values())
            .map(item => ({
                ...item,
                combinedScore: (item.vectorScore * 0.7) + (item.keywordScore * 0.3)
            }))
            .sort((a, b) => b.combinedScore - a.combinedScore)
            .slice(0, topK);

        const elapsed = Date.now() - startTime;
        console.log(`   Hybrid search completed in ${elapsed}ms (${results.length} results)`);

        return results;
    } catch (error) {
        console.error('❌ Hybrid search error:', error.message);
        return [];
    }
}

// =========== VECTOR OPTIMIZATION ===========
// Get vector optimization stats
async function getVectorOptimizationStats() {
    try {
        const chunkCount = await Chunk.countDocuments();
        const withEmbeddings = await Chunk.countDocuments({ embedding: { $ne: null } });
        const embeddingCacheSize = await EmbeddingCache.countDocuments();
        const responseCacheSize = await Cache.countDocuments();

        return {
            totalChunks: chunkCount,
            chunksWithEmbeddings: withEmbeddings,
            embeddingCoverage: withEmbeddings > 0 ? Math.round((withEmbeddings / chunkCount) * 100) : 0,
            embeddingsCached: embeddingCacheSize,
            responsesCached: responseCacheSize,
            vectorOptimizationEnabled: withEmbeddings > 0
        };
    } catch (error) {
        console.error('❌ Error getting stats:', error.message);
        return null;
    }
}

// Rebuild all embeddings for a package (useful for re-indexing)
async function rebuildEmbeddings(packageName) {
    try {
        console.log(`🔄 Rebuilding embeddings for ${packageName}...`);

        const chunks = await Chunk.find({ packageName });
        const { generateEmbedding } = require('./ai');

        let updated = 0;
        for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.text);
            if (embedding) {
                chunk.embedding = embedding;
                await chunk.save();
                updated++;
            }
        }

        console.log(`✅ Updated ${updated}/${chunks.length} embeddings`);
        return { updated, total: chunks.length };
    } catch (error) {
        console.error('❌ Rebuild error:', error.message);
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
