import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Advanced Memory Optimization and Garbage Collection Cache Engine
 * Explicitly architected for Render Free-Tier environments to prevent high RAM consumption crashes
 */
class FreeTierCacheEngine {
    constructor() {
        // Volatile memory storage with dynamic sizing metrics
        this.volatileStorage = new Map();
        
        // System thresholds to protect the Node.js cluster process from leaking RAM
        this.MAX_CACHE_ENTRIES = 150;
        this.SWEEP_INTERVAL_MS = 5 * 60 * 1000; // Automatic garbage cleanup sweep every 5 minutes
        
        // Target directory on storage disk for safe file caching swap operations
        this.swapDiskDirectory = path.join(__dirname, '..', 'tmp', 'cache_swap');
        this.initializeSwapDisk();
        this.activateAutonomousGarbageCollector();
    }

    /**
     * Build non-volatile swap infrastructure blocks safely on disk rows
     */
    initializeSwapDisk() {
        try {
            if (!fs.existsSync(this.swapDiskDirectory)) {
                fs.mkdirSync(this.swapDiskDirectory, { recursive: true });
                console.log('[Cache Infrastructure] Safe disk swap directory verified.');
            }
        } catch (dirError) {
            console.error('[Cache Warning] Failed to initialize file-system swap blocks:', dirError.message);
        }
    }

    /**
     * Write data into volatile cache and allocate tracking timestamps
     */
    set(cacheKey, dataPayload, individualTtlMs = 15 * 60 * 1000) {
        try {
            // Memory balancing guard: If memory map overflows, offload oldest records to disk swap storage
            if (this.volatileStorage.size >= this.MAX_CACHE_ENTRIES) {
                this.enforceMemorySwapEviction();
            }

            const computationExpirationTimestamp = Date.now() + individualTtlMs;
            this.volatileStorage.set(cacheKey, {
                payload: dataPayload,
                expiresAt: computationExpirationTimestamp,
                lastAccessed: Date.now()
            });
        } catch (setException) {
            console.error(`[Cache Error] Secure write sequence rejected for key: ${cacheKey}`, setException.message);
        }
    }

    /**
     * Retrieve cache data array with dynamic fallback scanning across disk blocks
     */
    get(cacheKey) {
        // Look inside RAM storage channels first
        if (this.volatileStorage.has(cacheKey)) {
            const memoryRecord = this.volatileStorage.get(cacheKey);
            
            if (Date.now() > memoryRecord.expiresAt) {
                this.volatileStorage.delete(cacheKey);
                return null;
            }

            memoryRecord.lastAccessed = Date.now();
            return memoryRecord.payload;
        }

        // Fallback: Check if the required data array was swapped out onto disk storage
        return this.readFromDiskSwap(cacheKey);
    }

    /**
     * Delete active entries instantly from RAM records and disk segments
     */
    invalidate(cacheKey) {
        this.volatileStorage.delete(cacheKey);
        const swapFilePath = path.join(this.swapDiskDirectory, `${Buffer.from(cacheKey).toString('hex')}.json`);
        if (fs.existsSync(swapFilePath)) {
            try {
                fs.unlinkSync(swapFilePath);
            } catch (unlinkErr) {
                // Suppress background file unlink exception flags safely
            }
        }
    }

    /**
     * Evict Least Recently Used (LRU) keys out of RAM allocations and drop them down onto file swap disk arrays
     */
    enforceMemorySwapEviction() {
        let oldestAccessedTimestamp = Infinity;
        let targetedEvictionKey = null;

        for (const [key, record] of this.volatileStorage.entries()) {
            if (record.lastAccessed < oldestAccessedTimestamp) {
                oldestAccessedTimestamp = record.lastAccessed;
                targetedEvictionKey = key;
            }
        }

        if (targetedEvictionKey) {
            const evictionRecord = this.volatileStorage.get(targetedEvictionKey);
            
            // Swap record onto temporary disk block before erasing it out of volatile RAM memory spaces
            try {
                const serializedHexFileName = `${Buffer.from(targetedEvictionKey).toString('hex')}.json`;
                const targetSwapPath = path.join(this.swapDiskDirectory, serializedHexFileName);
                
                fs.writeFileSync(targetSwapPath, JSON.stringify({
                    payload: evictionRecord.payload,
                    expiresAt: evictionRecord.expiresAt
                }), 'utf8');
            } catch (swapWriteError) {
                console.error(`[Cache Critical] Disk swap operations failed for key: ${targetedEvictionKey}`, swapWriteError.message);
            }

            this.volatileStorage.delete(targetedEvictionKey);
        }
    }

    /**
     * Pull serialized records directly from temporary file rows back into processing pipelines
     */
    readFromDiskSwap(cacheKey) {
        try {
            const targetHexFileName = `${Buffer.from(cacheKey).toString('hex')}.json`;
            const expectedDiskPath = path.join(this.swapDiskDirectory, targetHexFileName);

            if (fs.existsSync(expectedDiskPath)) {
                const rawDiskData = fs.readFileSync(expectedDiskPath, 'utf8');
                const parsedDiskRecord = JSON.parse(rawDiskData);

                if (Date.now() > parsedDiskRecord.expiresAt) {
                    fs.unlinkSync(expectedDiskPath);
                    return null;
                }

                // Hot reload the entry back into active RAM allocation boundaries
                this.set(cacheKey, parsedDiskRecord.payload, parsedDiskRecord.expiresAt - Date.now());
                return parsedDiskRecord.payload;
            }
        } catch (diskReadError) {
            console.error(`[Cache Warning] Disk swap recovery faulted for key identity string: ${cacheKey}`, diskReadError.message);
        }
        return null;
    }

    /**
     * Continuous background loop executing active sweeps to strip dead objects out of server runtimes
     */
    activateAutonomousGarbageCollector() {
        setInterval(() => {
            const baselineCurrentTime = Date.now();
            
            // 1. Vacuum stale objects out of volatile RAM states
            for (const [key, record] of this.volatileStorage.entries()) {
                if (baselineCurrentTime > record.expiresAt) {
                    this.volatileStorage.delete(key);
                }
            }

            // 2. Clear out expired JSON configuration maps stored inside the temporary disk segments
            try {
                if (fs.existsSync(this.swapDiskDirectory)) {
                    const activeSwapFiles = fs.readdirSync(this.swapDiskDirectory);
                    for (const targetFile of activeSwapFiles) {
                        const directFilePath = path.join(this.swapDiskDirectory, targetFile);
                        const rawFileContent = fs.readFileSync(directFilePath, 'utf8');
                        const parsedFileRecord = JSON.parse(rawFileContent);

                        if (baselineCurrentTime > parsedFileRecord.expiresAt) {
                            fs.unlinkSync(directFilePath);
                        }
                    }
                }
            } catch (garbageCollectorError) {
                console.error('[Cache Garbage Collector] Active sweeping pipeline caught exception:', garbageCollectorError.message);
            }

        }, this.SWEEP_INTERVAL_MS);
    }
}

// Instantiate and export a unified singular execution interface controller context
export const clusterCacheController = new FreeTierCacheEngine();
