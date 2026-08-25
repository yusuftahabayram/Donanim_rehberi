/**
 * Local REST API & Web Dashboard Server for PC Parts Datasets
 * Runs zero-dependency Node.js HTTP server.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function ensureIndexesExist() {
  const summaryPath = path.join(DATA_DIR, 'summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.log('⚡ Index files missing. Running indexer script first...');
    try {
      require(path.join(ROOT_DIR, 'scripts', 'indexer.js'));
    } catch (err) {
      console.error('Error building indexes:', err.message);
    }
  }
}

const server = http.createServer((req, res) => {
  // Enable CORS for custom web projects
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --- API Endpoints ---
  
  // GET /api/summary
  if (pathname === '/api/summary' && req.method === 'GET') {
    const summaryFile = path.join(DATA_DIR, 'summary.json');
    if (fs.existsSync(summaryFile)) {
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.json'] });
      fs.createReadStream(summaryFile).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Summary index not found. Run npm run build-index.' }));
    }
    return;
  }

  // GET /api/index/:datasetName
  if (pathname.startsWith('/api/index/') && req.method === 'GET') {
    const dsName = pathname.replace('/api/index/', '');
    let targetFile = '';
    if (dsName === 'buildcores') targetFile = path.join(DATA_DIR, 'buildcores-index.json');
    if (dsName === 'pcpart') targetFile = path.join(DATA_DIR, 'pcpart-index.json');
    if (dsName === 'techfuel') targetFile = path.join(DATA_DIR, 'techfuel-index.json');

    if (targetFile && fs.existsSync(targetFile)) {
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.json'] });
      fs.createReadStream(targetFile).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Index file for dataset '${dsName}' not found.` }));
    }
    return;
  }

  // POST /api/save-item - Save edited item back to disk
  if (pathname === '/api/save-item' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { relPath, itemIndex, updatedData, dataset } = payload;

        if (!relPath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'relPath is required' }));
          return;
        }

        const absPath = path.join(ROOT_DIR, relPath);

        if (!fs.existsSync(absPath)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target file on disk not found' }));
          return;
        }

        // Case 1: BuildCores - Individual JSON File
        if (dataset === 'buildcores' || typeof itemIndex === 'undefined') {
          fs.writeFileSync(absPath, JSON.stringify(updatedData, null, 2), 'utf8');
        } 
        // Case 2: PC Part Dataset - Category Array JSON File
        else if (dataset === 'pcpart' && typeof itemIndex === 'number') {
          const raw = fs.readFileSync(absPath, 'utf8');
          const array = JSON.parse(raw);
          if (Array.isArray(array) && itemIndex >= 0 && itemIndex < array.length) {
            array[itemIndex] = updatedData;
            fs.writeFileSync(absPath, JSON.stringify(array, null, 2), 'utf8');
          }
        }
        // Case 3: TechFuel - Object with category array keys
        else if (dataset === 'techfuel' && payload.categoryKey && typeof itemIndex === 'number') {
          const raw = fs.readFileSync(absPath, 'utf8');
          const rootObj = JSON.parse(raw);
          if (rootObj[payload.categoryKey] && Array.isArray(rootObj[payload.categoryKey])) {
            rootObj[payload.categoryKey][itemIndex] = updatedData;
            fs.writeFileSync(absPath, JSON.stringify(rootObj, null, 2), 'utf8');
          }
        }

        // Trigger background index update
        setTimeout(() => {
          try {
            require(path.join(ROOT_DIR, 'scripts', 'indexer.js'));
          } catch(e){}
        }, 100);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Item saved successfully to disk.' }));

      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // POST /api/reindex
  if (pathname === '/api/reindex' && req.method === 'POST') {
    try {
      require(path.join(ROOT_DIR, 'scripts', 'indexer.js'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Datasets re-indexed successfully.' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // POST /api/chat
  if (pathname === '/api/chat' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const { spawn } = require('child_process');
      const pyScript = path.join(ROOT_DIR, 'scripts', 'query_chat.py');
      const pyProc = spawn('python', ['-u', pyScript], { cwd: ROOT_DIR });

      let stdoutData = '';
      let stderrData = '';

      pyProc.stdout.on('data', data => stdoutData += data.toString('utf8'));
      pyProc.stderr.on('data', data => stderrData += data.toString('utf8'));

      pyProc.on('close', code => {
        let cleanJson = stdoutData.trim();
        const jsonStart = cleanJson.indexOf('{');
        const jsonEnd = cleanJson.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1);
        }

        try {
          const parsed = JSON.parse(cleanJson);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(parsed));
        } catch (err) {
          console.error('[SERVER] Failed to parse Python stdout JSON:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ 
            error: `Yapay zeka yanıtı işlenirken hata oluştu: ${err.message}`, 
            raw: stdoutData.substring(0, 200) 
          }));
        }
      });

      pyProc.stdin.write(body);
      pyProc.stdin.end();
    });
    return;
  }

  // Catch-all 404 for unhandled /api/ endpoints
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `API endpoint '${pathname}' Node sunucusunda desteklenmiyor.` }));
    return;
  }

  // --- Static Files Server ---
  let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

ensureIndexesExist();

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 STAJ PROJE JSON DATA MANAGEMENT SERVER RUNNING`);
  console.log(`📡 Local URL:  http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
