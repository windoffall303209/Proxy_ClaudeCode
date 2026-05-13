const crypto = require('crypto');
const fs = require('fs');
const { importProductsFromWorkbook } = require('./productBulkImportService');

const JOB_TTL_MS = 12 * 60 * 60 * 1000;
const RESULT_SAMPLE_LIMIT = 100;

const jobs = new Map();

function createJobId() {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return crypto.randomBytes(16).toString('hex');
}

function toIsoString(value = new Date()) {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function cleanupFiles(paths = []) {
    paths
        .filter(Boolean)
        .forEach((filePath) => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (error) {
                console.warn('Product import upload cleanup warning:', error.message);
            }
        });
}

function pruneOldJobs() {
    const now = Date.now();

    for (const [jobId, job] of jobs.entries()) {
        const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : 0;
        const createdAt = job.createdAt ? new Date(job.createdAt).getTime() : now;
        const referenceTime = completedAt || createdAt;

        if (now - referenceTime > JOB_TTL_MS) {
            jobs.delete(jobId);
        }
    }
}

function summarizeResult(result = {}) {
    return {
        totalProducts: Number(result.totalProducts || 0),
        createdCount: Number(result.createdCount || 0),
        failedCount: Number(result.failedCount || 0),
        createdProducts: Array.isArray(result.createdProducts)
            ? result.createdProducts.slice(0, RESULT_SAMPLE_LIMIT)
            : [],
        errors: Array.isArray(result.errors)
            ? result.errors.slice(0, RESULT_SAMPLE_LIMIT)
            : [],
        truncatedCreatedProducts: Math.max(0, Number(result.createdCount || 0) - RESULT_SAMPLE_LIMIT),
        truncatedErrors: Math.max(0, Number(result.failedCount || 0) - RESULT_SAMPLE_LIMIT)
    };
}

function serializeJob(job) {
    if (!job) {
        return null;
    }

    return {
        id: job.id,
        status: job.status,
        message: job.message,
        progress: job.progress,
        totalProducts: job.totalProducts,
        processedCount: job.processedCount,
        createdCount: job.createdCount,
        failedCount: job.failedCount,
        latestResult: job.latestResult,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
    };
}

function updateJobProgress(job, progress = {}) {
    const totalProducts = Number(progress.totalProducts || job.totalProducts || 0);
    const processedCount = Number(progress.processedCount || 0);

    job.totalProducts = totalProducts;
    job.processedCount = processedCount;
    job.createdCount = Number(progress.createdCount || 0);
    job.failedCount = Number(progress.failedCount || 0);
    job.progress = totalProducts > 0
        ? Math.min(99, Math.round((processedCount / totalProducts) * 100))
        : 0;

    if (progress.latestResult) {
        job.latestResult = progress.latestResult;
    }

    job.message = totalProducts > 0
        ? `Đang import ${processedCount}/${totalProducts} sản phẩm...`
        : 'Đang đọc file Excel...';
}

async function runProductImportJob(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
        return;
    }

    job.status = 'running';
    job.startedAt = toIsoString();
    job.message = 'Đang chuẩn bị import sản phẩm...';

    try {
        const result = await importProductsFromWorkbook({
            workbookPath: job.workbookPath,
            zipPath: job.zipPath,
            onProgress: (progress) => updateJobProgress(job, progress),
            yieldEvery: 5
        });

        job.status = result.failedCount > 0 ? 'completed_with_errors' : 'completed';
        job.progress = 100;
        job.totalProducts = Number(result.totalProducts || 0);
        job.processedCount = Number(result.totalProducts || 0);
        job.createdCount = Number(result.createdCount || 0);
        job.failedCount = Number(result.failedCount || 0);
        job.result = summarizeResult(result);
        job.message = result.failedCount > 0
            ? `Đã import ${result.createdCount}/${result.totalProducts} sản phẩm. Có ${result.failedCount} sản phẩm lỗi.`
            : `Đã import thành công ${result.createdCount} sản phẩm.`;
    } catch (error) {
        job.status = 'failed';
        job.progress = 100;
        job.error = error.message || 'Không thể import sản phẩm từ file Excel.';
        job.message = job.error;
        job.result = summarizeResult({
            totalProducts: job.totalProducts || 0,
            createdCount: job.createdCount || 0,
            failedCount: Math.max(1, job.failedCount || 0),
            createdProducts: [],
            errors: [{ message: job.error }]
        });
    } finally {
        job.completedAt = toIsoString();
        cleanupFiles([job.workbookPath, job.zipPath]);
        delete job.workbookPath;
        delete job.zipPath;
    }
}

function startProductImportJob({ workbookPath, zipPath = null, requestedBy = null } = {}) {
    pruneOldJobs();

    if (!workbookPath) {
        throw new Error('Vui lòng tải lên file Excel sản phẩm.');
    }

    const job = {
        id: createJobId(),
        status: 'queued',
        message: 'Đã nhận file, đang chờ bắt đầu import...',
        progress: 0,
        totalProducts: 0,
        processedCount: 0,
        createdCount: 0,
        failedCount: 0,
        latestResult: null,
        result: null,
        error: null,
        requestedBy,
        workbookPath,
        zipPath,
        createdAt: toIsoString(),
        startedAt: null,
        completedAt: null
    };

    jobs.set(job.id, job);
    setImmediate(() => {
        runProductImportJob(job.id).catch((error) => {
            const currentJob = jobs.get(job.id);
            if (currentJob) {
                currentJob.status = 'failed';
                currentJob.progress = 100;
                currentJob.error = error.message || 'Không thể chạy job import sản phẩm.';
                currentJob.message = currentJob.error;
                currentJob.completedAt = toIsoString();
            }
        });
    });

    return serializeJob(job);
}

function getProductImportJob(jobId) {
    pruneOldJobs();
    return serializeJob(jobs.get(String(jobId || '')));
}

module.exports = {
    startProductImportJob,
    getProductImportJob
};
