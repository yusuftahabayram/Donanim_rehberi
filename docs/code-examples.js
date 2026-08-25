/**
 * STAJ PROJE - PC PARTS JSON DATASET INTEGRATION EXAMPLES
 * Copy-paste these code snippets into your HTML / React / Node.js web site project.
 */

// ============================================================================
// 1. VANILLA JAVASCRIPT (BROWSER)
// ============================================================================
/*
  Include in your HTML:
  <script src="./pcDataEngine.js"></script>

  Then write your code:
*/
async function vanillaJSExample() {
  const engine = new PCPartsDataEngine();
  
  // Initialize dataset
  await engine.init();
  console.log('Available Datasets Summary:', engine.summary);

  // Search CPUs from BuildCores Open DB
  const cpus = await engine.getItems('buildcores', 'CPU', {
    search: 'Ryzen 7',
    minPrice: 100,
    maxPrice: 500,
    sortBy: 'price',
    sortOrder: 'asc',
    page: 1,
    limit: 10
  });

  console.log(`Found ${cpus.totalCount} matching CPUs:`, cpus.items);

  // Edit/Update a component's spec
  if (cpus.items.length > 0) {
    const itemToEdit = cpus.items[0];
    await engine.updateItem('buildcores', 'CPU', itemToEdit.id, {
      ...itemToEdit.data,
      price: 299.99
    });
    console.log('Updated item price!');
  }
}


// ============================================================================
// 2. REACT / NEXT.JS INTEGRATION (HOOK EXAMPLE)
// ============================================================================
/*
import React, { useState, useEffect } from 'react';
import PCPartsDataEngine from './pcDataEngine';

export function PCPartCatalog() {
  const [engine] = useState(() => new PCPartsDataEngine());
  const [category, setCategory] = useState('CPU');
  const [parts, setParts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      await engine.init();
      const res = await engine.getItems('buildcores', category, { search });
      setParts(res.items);
      setLoading(false);
    }
    loadData();
  }, [category, search]);

  return (
    <div style={{ padding: '20px', background: '#0f172a', color: '#fff' }}>
      <h2>💻 PC Hardware Catalog ({category})</h2>

      <input
        type="text"
        placeholder="Search parts (e.g. RTX 4080, Ryzen)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ padding: '10px', width: '100%', marginBottom: '20px', borderRadius: '8px' }}
      />

      {loading ? (
        <p>Loading components...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {parts.map(part => (
            <div key={part.id} style={{ border: '1px solid #334155', padding: '16px', borderRadius: '12px' }}>
              <h4>{part.name}</h4>
              <p>Manufacturer: {part.manufacturer}</p>
              <p>Price: ${part.price || 'N/A'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
*/


// ============================================================================
// 3. NODE.JS / EXPRESS BACKEND API INTEGRATION
// ============================================================================
/*
const express = require('express');
const PCPartsDataEngine = require('./pcDataEngine');

const app = express();
const engine = new PCPartsDataEngine();

engine.init().then(() => {
  console.log('JSON Data Engine initialized in Node.js!');
});

// Endpoint: Search PC parts
app.get('/api/parts', async (req, res) => {
  const { dataset = 'buildcores', category = 'CPU', search = '', limit = 20 } = req.query;
  try {
    const result = await engine.getItems(dataset, category, {
      search,
      limit: parseInt(limit)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Edit part JSON
app.post('/api/parts/edit', express.json(), async (req, res) => {
  const { dataset, category, id, updatedData } = req.body;
  try {
    const updated = await engine.updateItem(dataset, category, id, updatedData);
    res.json({ success: true, item: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
*/
