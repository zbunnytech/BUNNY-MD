const fs = require('fs');
const path = require('path');

/**
 * Advanced Memory Optimization and Garbage Collection Cache Engine
 * CommonJS Version: Architected for Render/Railway Free-Tier environments
 */
class FreeTierCacheEngine {
    constructor() {
        // Volatile memory storage with dynamic sizing metrics
        this.volatileStorage = new Map();
        
        // System thresholds to protect the Node.js process from leaking RAM
        this.MAX_CACHE_ENTRIES = 150;
        this.SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes sweep
        
        // Target directory: Using standard pathing for filesystem swap
        this.swapDiskDirectory = path.join(__dirname, '..', 'tmp', 'cache_swap');
        this.initializeSwapDisk();
        this.activateAutonomousGarbageCollector();
    }

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

    set(cacheKey, dataPayload, individualTtlMs = 15 * 60 * 1000) {
        try {
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

    get(cacheKey) {
        if (this.volatileStorage.has(cacheKey)) {
            const memoryRecord = this.volatileStorage.get(cacheKey);
            
            if (Date.now() > memoryRecord.expiresAt) {
                this.volatileStorage.delete(cacheKey);
                return null;
            }

            memoryRecord.lastAccessed = Date.now();
            return memoryRecord.payload;
        }

        return this.readFromDiskSwap(cacheKey);
    }

    invalidate(cacheKey) {
        this.volatileStorage.delete(cacheKey);
        const swapFilePath = path.join(this.swapDiskDirectory, `${Buffer.from(cacheKey).toString('hex')}.json`);
        if (fs.existsSync(swapFilePath)) {
            try {
                fs.unlinkSync(swapFilePath);
            } catch (unlinkErr) {}
        }
    }

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

                this.set(cacheKey, parsedDiskRecord.payload, parsedDiskRecord.expiresAt - Date.now());
                return parsedDiskRecord.payload;
            }
        } catch (diskReadError) {
            console.error(`[Cache Warning] Disk swap recovery faulted for key: ${cacheKey}`, diskReadError.message);
        }
        return null;
    }

    activateAutonomousGarbageCollector() {
        setInterval(() => {
            const baselineCurrentTime = Date.now();
            
            for (const [key, record] of this.volatileStorage.entries()) {
                if (baselineCurrentTime > record.expiresAt) {
                    this.volatileStorage.delete(key);
                }
            }

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
                console.error('[Cache Garbage Collector] Pipeline exception:', garbageCollectorError.message);
            }

        }, this.SWEEP_INTERVAL_MS);
    }
}

// Export a unified singular execution interface controller
module.exports = new FreeTierCacheEngine();
