/**
 * PC Parts Data Engine (Reusable Web SDK / JS Module with Smart Compatibility Engine)
 * Compatible with Browser (Vanilla JS / React / Vue) and Node.js.
 */

class PCPartsDataEngine {
  constructor(options = {}) {
    let defaultBaseUrl = '';
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      defaultBaseUrl = 'http://localhost:3000';
    }
    this.baseUrl = options.baseUrl || defaultBaseUrl;
    this.summary = null;
    this.indexes = {
      buildcores: null,
      pcpart: null,
      techfuel: null
    };
    this.modifiedData = {};
  }

  /**
   * Initializes data indexes from backend or static path
   */
  async init() {
    try {
      if (typeof window !== 'undefined' && window.fetch) {
        const res = await fetch(`${this.baseUrl}/data/summary.json`);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status} while fetching summary.json`);
        }
        this.summary = await res.json();
      } else {
        const fs = require('fs');
        const path = require('path');
        const summaryRaw = fs.readFileSync(path.join(__dirname, 'data', 'summary.json'), 'utf8');
        this.summary = JSON.parse(summaryRaw);
      }
      return this.summary;
    } catch (err) {
      console.error('[PCPartsDataEngine] Failed to load dataset summary:', err);
      throw err;
    }
  }

  /**
   * Performs ChromaDB vector semantic search via backend API
   */
  async vectorSearch(query, options = {}) {
    const { category = '', limit = 10 } = options;
    try {
      const baseUrl = this.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const url = new URL('/api/vector-search', baseUrl);
      url.searchParams.append('q', query);
      if (category) url.searchParams.append('category', category);
      url.searchParams.append('limit', limit);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Vector search failed with status ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error('[PCPartsDataEngine] Vector search failed:', err);
      throw err;
    }
  }

  /**
   * Loads specific dataset index
   */
  async loadDataset(datasetName) {
    if (this.indexes[datasetName]) return this.indexes[datasetName];

    try {
      let data = null;
      if (typeof window !== 'undefined' && window.fetch) {
        const fileMap = {
          buildcores: '/data/buildcores-index.json',
          pcpart: '/data/pcpart-index.json',
          techfuel: '/data/techfuel-index.json',
          unified: '/data/unified-index.json'
        };
        const endpoint = fileMap[datasetName] || `/data/${datasetName}-index.json`;
        const res = await fetch(`${this.baseUrl}${endpoint}`);
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status} while fetching ${endpoint}`);
        }
        data = await res.json();
      } else {
        const fs = require('fs');
        const path = require('path');
        const fileMap = {
          buildcores: 'buildcores-index.json',
          pcpart: 'pcpart-index.json',
          techfuel: 'techfuel-index.json',
          unified: 'unified-index.json'
        };
        const fileName = fileMap[datasetName] || `${datasetName}-index.json`;
        const raw = fs.readFileSync(path.join(__dirname, 'data', fileName), 'utf8');
        data = JSON.parse(raw);
      }

      this.indexes[datasetName] = data;
      return data;
    } catch (err) {
      console.error(`[PCPartsDataEngine] Failed to load dataset index '${datasetName}':`, err);
      throw err;
    }
  }

  /**
   * Queries items with search, filters, sorting and pagination
   */
  async getItems(datasetName, categoryName, options = {}) {
    const dataset = await this.loadDataset(datasetName);
    let items = dataset[categoryName];

    if (!items || items.length === 0) {
      const targetLower = String(categoryName || '').toLowerCase();
      items = [];
      for (const k of Object.keys(dataset)) {
        if (k.toLowerCase() === targetLower) {
          items = items.concat(dataset[k]);
        }
      }
    }

    const {
      search = '',
      manufacturer = '',
      minPrice = 0,
      maxPrice = Infinity,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 50
    } = options;

    items = items.map(item => {
      const key = `${datasetName}:${categoryName}:${item.id}`;
      return this.modifiedData[key] ? { ...item, ...this.modifiedData[key] } : item;
    });

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        const mfg = (item.manufacturer || '').toLowerCase();
        const dataStr = JSON.stringify(item.data || {}).toLowerCase();
        return name.includes(q) || mfg.includes(q) || dataStr.includes(q);
      });
    }

    if (manufacturer) {
      const mfgLower = manufacturer.toLowerCase();
      items = items.filter(item => (item.manufacturer || '').toLowerCase() === mfgLower);
    }

    const getReleaseYear = (item) => {
      if (!item) return 0;
      const d = item.data || {};
      let yr = d.releaseYear || d.release_year || d.launch_year || d.year || item.releaseYear;
      if (yr && !isNaN(parseInt(yr))) return parseInt(yr);
      const str = JSON.stringify(d);
      const match = str.match(/(?:release_year|releaseYear|launch_year|year)":\s*"?(\d{4})"?/i) || str.match(/(20\d\d|19\d\d)/);
      if (match) return parseInt(match[1]);
      return 0;
    };

    items.sort((a, b) => {
      if (sortBy === 'releaseYear' || sortBy === 'release_date' || sortBy === 'date') {
        const yearA = getReleaseYear(a);
        const yearB = getReleaseYear(b);
        if (yearA !== yearB) {
          return sortOrder === 'desc' ? yearB - yearA : yearA - yearB;
        }
        return (a.name || '').localeCompare(b.name || '');
      }

      let valA = a[sortBy] ?? a.data?.[sortBy] ?? '';
      let valB = b[sortBy] ?? b.data?.[sortBy] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      totalCount,
      totalPages,
      currentPage: page,
      limit,
      items: paginatedItems
    };
  }

  /**
   * Smart Hardware Compatibility Checker
   * Checks compatibility of an item against the current PC build
   */
  checkCompatibility(item, targetCategory, buildCart = {}) {
    const data = item.data || {};
    const reasons = [];
    let isCompatible = true;

    // 1. Motherboard vs CPU (Socket Check)
    if (targetCategory === 'cpu' || targetCategory === 'CPU') {
      if (buildCart.motherboard) {
        const mbSocket = (buildCart.motherboard.data.socket || '').toLowerCase();
        const cpuSocket = (data.socket || '').toLowerCase();
        if (mbSocket && cpuSocket) {
          if (mbSocket === cpuSocket) {
            reasons.push(`✓ Uyumlu Soket (${data.socket})`);
          } else {
            isCompatible = false;
            reasons.push(`❌ Soket Uyumsuz! (Anakart: ${buildCart.motherboard.data.socket}, İşlemci: ${data.socket})`);
          }
        }
      }
    }

    // 2. CPU vs Motherboard (Socket Check inverse)
    if (targetCategory === 'motherboard' || targetCategory === 'Motherboard') {
      if (buildCart.cpu) {
        const cpuSocket = (buildCart.cpu.data.socket || '').toLowerCase();
        const mbSocket = (data.socket || '').toLowerCase();
        if (cpuSocket && mbSocket) {
          if (cpuSocket === mbSocket) {
            reasons.push(`✓ Uyumlu Soket (${data.socket})`);
          } else {
            isCompatible = false;
            reasons.push(`❌ Soket Uyumsuz! (İşlemci: ${buildCart.cpu.data.socket}, Anakart: ${data.socket})`);
          }
        }
      }
    }

    // 3. RAM vs Motherboard (DDR5 vs DDR4 Check)
    if (targetCategory === 'ram' || targetCategory === 'RAM' || targetCategory === 'memory') {
      if (buildCart.motherboard) {
        const mbRamType = JSON.stringify(buildCart.motherboard.data.memory || {}).toLowerCase();
        const itemStr = JSON.stringify(data).toLowerCase();

        if (mbRamType.includes('ddr5') && !itemStr.includes('ddr5')) {
          isCompatible = false;
          reasons.push('❌ Anakart DDR5 Destekliyor, bu RAM DDR4!');
        } else if (mbRamType.includes('ddr4') && !itemStr.includes('ddr4')) {
          isCompatible = false;
          reasons.push('❌ Anakart DDR4 Destekliyor, bu RAM DDR5!');
        } else {
          reasons.push('✓ Bellek Tipi Uyumlu');
        }
      }
    }

    // 4. PSU vs System TDP Wattage Check
    if (targetCategory === 'psu' || targetCategory === 'PSU' || targetCategory === 'power-supply') {
      const estimatedTdp = this.calculateEstimatedTdp(buildCart);
      const psuWatt = Number(data.wattage || data.watt || data.price_usd || 0); // PSU watt

      if (psuWatt > 0 && estimatedTdp > 0) {
        if (psuWatt >= estimatedTdp) {
          reasons.push(`✓ Yeterli Güç Cap (${psuWatt}W >= ${estimatedTdp}W İhtiyaç)`);
        } else {
          isCompatible = false;
          reasons.push(`❌ Yetersiz Güç! (Sistem İhtiyacı: ${estimatedTdp}W, PSU: ${psuWatt}W)`);
        }
      }
    }

    // 5. Storage vs Motherboard M.2 Check
    if (targetCategory === 'storage' || targetCategory === 'Storage' || targetCategory === 'internal-hard-drive') {
      if (buildCart.motherboard) {
        const mbData = buildCart.motherboard.data || {};
        const m2Slots = mbData.m2_slots || (mbData.storage_devices ? mbData.storage_devices.m2_slots : null);
        
        let hasM2 = false;
        if (Array.isArray(m2Slots)) {
          hasM2 = m2Slots.length > 0;
        } else if (typeof m2Slots === 'number') {
          hasM2 = m2Slots > 0;
        } else if (m2Slots) {
          hasM2 = true;
        } else {
          const mbStr = JSON.stringify(mbData).toLowerCase();
          hasM2 = mbStr.includes('m.2') || mbStr.includes('nvme');
        }

        const formFactor = String(data.form_factor || '').toLowerCase();
        const iface = String(data.interface || '').toLowerCase();
        const type = String(data.type || '').toLowerCase();
        const storageType = String(data.storage_type || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();

        const isM2 = formFactor.includes('m.2') || 
                     iface.includes('m.2') || 
                     iface.includes('nvme') || 
                     type.includes('m.2') || 
                     storageType.includes('m.2') || 
                     name.includes('m.2') || 
                     name.includes('nvme') || 
                     data.nvme === true;

        if (isM2 && !hasM2) {
          isCompatible = false;
          reasons.push('❌ Anakart Üzerinde M.2 Slotu Bulunmuyor! (Yalnızca SATA SSD / HDD Takılabilir)');
        } else if (isM2 && hasM2) {
          reasons.push('✓ M.2 NVMe SSD Uyumlu (Anakart M.2 Destekliyor)');
        } else {
          reasons.push('✓ SATA SSD / HDD Uyumlu');
        }
      }
    }

    return {
      isCompatible,
      reasons: reasons.length ? reasons : ['✓ Genel Uyumlu Parça']
    };
  }

  /**
   * Calculate Estimated Total System TDP in Watts
   */
  calculateEstimatedTdp(buildCart) {
    let cpuTdp = 65;
    let gpuTdp = 0;
    const baseSystemOverhead = 100;

    if (buildCart.cpu) {
      cpuTdp = Number(buildCart.cpu.data.tdp || buildCart.cpu.data.specifications?.tdp || 65);
    }
    if (buildCart.gpu) {
      gpuTdp = Number(buildCart.gpu.data.tdp || buildCart.gpu.data.tgp || 200);
    }

    return cpuTdp + gpuTdp + baseSystemOverhead;
  }

  /**
   * Updates an item's fields
   */
  async updateItem(datasetName, categoryName, itemId, updatedData) {
    const key = `${datasetName}:${categoryName}:${itemId}`;

    const dataset = await this.loadDataset(datasetName);
    const categoryItems = dataset[categoryName] || [];
    const itemIndex = categoryItems.findIndex(i => i.id === itemId);

    if (itemIndex === -1) {
      throw new Error(`Item '${itemId}' not found in category '${categoryName}'`);
    }

    const targetItem = categoryItems[itemIndex];
    targetItem.data = { ...targetItem.data, ...updatedData };
    targetItem.name = updatedData.name || updatedData.metadata?.name || updatedData.model || targetItem.name;
    targetItem.manufacturer = updatedData.manufacturer || updatedData.vendor || updatedData.metadata?.manufacturer || targetItem.manufacturer;

    this.modifiedData[key] = targetItem;
    return targetItem;
  }

  /**
   * Exports formatted JSON string for a given category
   */
  async exportCategory(datasetName, categoryName) {
    const dataset = await this.loadDataset(datasetName);
    const items = (dataset[categoryName] || []).map(i => i.data);
    return JSON.stringify(items, null, 2);
  }

  /**
   * Sends user message to RAG + Gemini AI Chatbot backend API
   */
  async sendChatMessage(message, history = []) {
    try {
      const baseUrl = this.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
      const url = new URL('/api/chat', baseUrl);

      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history })
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        throw new Error(`Sunucudan geçersiz yanıt alındı (JSON beklenirken HTML döndü). Lütfen RAG & Gemini sunucusunun çalıştığından emin olun (python server.py).`);
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Chat isteği başarısız oldu (Hata Kodu: ${res.status})`);
      }

      return await res.json();
    } catch (err) {
      console.error('[PCPartsDataEngine] Chat request error:', err);
      throw err;
    }
  }
}

// Export module for browser & Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PCPartsDataEngine;
} else if (typeof window !== 'undefined') {
  window.PCPartsDataEngine = PCPartsDataEngine;
}
