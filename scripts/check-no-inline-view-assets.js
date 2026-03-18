const fs = require('fs');
const path = require('path');

const viewsRoot = path.join(__dirname, '..', 'views');
const violations = [];

function recordViolation(filePath, type, snippet) {
    violations.push({
        file: path.relative(path.join(__dirname, '..'), filePath),
        type,
        snippet: snippet.trim().slice(0, 160)
    });
}

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');

    const styleBlockMatches = content.match(/<style\b[\s\S]*?<\/style>/gi) || [];
    styleBlockMatches.forEach((match) => recordViolation(filePath, 'style-block', match));

    for (const match of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const attrs = match[1] || '';
        const body = match[2] || '';
        const isExternal = /\bsrc\s*=/.test(attrs);
        const isJsonBootstrap = /\btype\s*=\s*["']application\/json["']/.test(attrs);
        if (!isExternal && !isJsonBootstrap && body.trim()) {
            recordViolation(filePath, 'inline-script', match[0]);
        }
    }

    const handlerMatches = content.match(/\son[a-z]+\s*=\s*["'][^"']*["']/gi) || [];
    handlerMatches.forEach((match) => recordViolation(filePath, 'inline-handler', match));

    const styleAttrMatches = content.match(/\sstyle\s*=\s*["'][^"']*["']/gi) || [];
    styleAttrMatches.forEach((match) => recordViolation(filePath, 'style-attr', match));
}

function walk(dirPath) {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
            continue;
        }

        if (entry.name.endsWith('.ejs')) {
            scanFile(fullPath);
        }
    }
}

walk(viewsRoot);

if (violations.length > 0) {
    console.error('Inline asset guard failed. Remove inline CSS/JS from EJS views.');
    violations.forEach((violation) => {
        console.error(`- ${violation.file} [${violation.type}] ${violation.snippet}`);
    });
    process.exit(1);
}

console.log('Inline asset guard passed.');
