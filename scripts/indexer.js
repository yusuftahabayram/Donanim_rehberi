/**
 * PC Parts Dataset Indexer
 * Scans all JSON files across all 3 sub-projects and compiles optimized data bundles.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'data');

const BUILDCORES_DIR = path.join(ROOT_DIR, 'buildcores-open-db-main', 'buildcores-open-db-main', 'open-db');
const PC_PART_DATASET_DIR = path.join(ROOT_DIR, 'pc-part-dataset-main', 'pc-part-dataset-main', 'data', 'json');
const TECHFUEL_FILE = path.join(ROOT_DIR, 'pc-builder-parts-main', 'pc-builder-parts-main', 'pc-builder-parts.json');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('🚀 Starting Dataset Indexer...');

// Index 1: BuildCores Open DB
function indexBuildCores() {
  console.log('📦 Indexing BuildCores Open DB...');
  const categories = {};
  let totalItems = 0;

  if (!fs.existsSync(BUILDCORES_DIR)) {
    console.warn(`Warning: Path not found: ${BUILDCORES_DIR}`);
    return { categories: {}, totalItems: 0 };
  }

  const categoryDirs = fs.readdirSync(BUILDCORES_DIR, { withFileTypes: true });

  for (const catDir of categoryDirs) {
    if (!catDir.isDirectory()) continue;
    const catName = catDir.name;
    const catPath = path.join(BUILDCORES_DIR, catName);
    const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'));

    const items = [];
    for (const file of files) {
      const filePath = path.join(catPath, file);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const json = JSON.parse(raw);
        
        // Extract key search attributes
        const id = json.opendb_id || path.basename(file, '.json');
        const name = json.metadata?.name || json.name || 'Unknown Item';
        const manufacturer = json.metadata?.manufacturer || json.manufacturer || json.vendor || 'Generic';
        const price = json.price || json.price_usd || 0;
        
        items.push({
          id,
          name,
          manufacturer,
          price,
          relPath: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
          data: json
        });
      } catch (err) {
        console.error(`Error reading ${filePath}:`, err.message);
      }
    }

    categories[catName] = items;
    totalItems += items.length;
    console.log(`  └─ Category: ${catName} (${items.length} items)`);
  }

  return { categories, totalItems };
}

// Index 2: PC Part Dataset
function indexPCPartDataset() {
  console.log('📦 Indexing PC Part Dataset...');
  const categories = {};
  let totalItems = 0;

  if (!fs.existsSync(PC_PART_DATASET_DIR)) {
    console.warn(`Warning: Path not found: ${PC_PART_DATASET_DIR}`);
    return { categories: {}, totalItems: 0 };
  }

  const files = fs.readdirSync(PC_PART_DATASET_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const catName = path.basename(file, '.json');
    const filePath = path.join(PC_PART_DATASET_DIR, file);

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const itemsRaw = JSON.parse(raw);
      
      const items = (Array.isArray(itemsRaw) ? itemsRaw : []).map((item, idx) => ({
        id: `pcpart-${catName}-${idx}`,
        name: item.name || `${catName} #${idx + 1}`,
        manufacturer: item.name ? item.name.split(' ')[0] : 'Unknown',
        price: item.price || 0,
        relPath: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
        itemIndex: idx,
        data: item
      }));

      categories[catName] = items;
      totalItems += items.length;
      console.log(`  └─ Category: ${catName} (${items.length} items)`);
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err.message);
    }
  }

  return { categories, totalItems };
}

// Index 3: TechFuel HQ PC Builder Parts
function indexTechFuel() {
  console.log('📦 Indexing TechFuel HQ Dataset...');
  if (!fs.existsSync(TECHFUEL_FILE)) {
    console.warn(`Warning: Path not found: ${TECHFUEL_FILE}`);
    return { meta: {}, performance_tiers: {}, categories: {}, totalItems: 0 };
  }

  try {
    const raw = fs.readFileSync(TECHFUEL_FILE, 'utf8');
    const json = JSON.parse(raw);
    const meta = json._meta || {};
    const performance_tiers = json.performance_tiers || {};
    const categories = {};
    let totalItems = 0;

    for (const key of Object.keys(json)) {
      if (key === '_meta' || key === 'performance_tiers') continue;
      
      const itemsRaw = json[key];
      if (Array.isArray(itemsRaw)) {
        categories[key] = itemsRaw.map((item, idx) => ({
          id: item.id || `tf-${key}-${idx}`,
          name: item.model ? `${item.vendor || ''} ${item.model}` : item.name || `${key} #${idx}`,
          manufacturer: item.vendor || 'Unknown',
          price: item.price_usd || item.price || 0,
          relPath: path.relative(ROOT_DIR, TECHFUEL_FILE).replace(/\\/g, '/'),
          categoryKey: key,
          itemIndex: idx,
          data: item
        }));
        totalItems += categories[key].length;
        console.log(`  └─ Category: ${key} (${categories[key].length} items)`);
      }
    }

    return { meta, performance_tiers, categories, totalItems };
  } catch (err) {
    console.error(`Error reading TechFuel file:`, err.message);
    return { meta: {}, performance_tiers: {}, categories: {}, totalItems: 0 };
  }
}

// Run Indexer
function run() {
  const buildCores = indexBuildCores();
  const pcPartDataset = indexPCPartDataset();
  const techFuel = indexTechFuel();

  const summary = {
    generatedAt: new Date().toISOString(),
    datasets: {
      buildcores: {
        name: "BuildCores Open DB",
        categoryCount: Object.keys(buildCores.categories).length,
        itemCount: buildCores.totalItems,
        categories: Object.keys(buildCores.categories)
      },
      pcPartDataset: {
        name: "PC Part Dataset",
        categoryCount: Object.keys(pcPartDataset.categories).length,
        itemCount: pcPartDataset.totalItems,
        categories: Object.keys(pcPartDataset.categories)
      },
      techFuel: {
        name: "TechFuel HQ PC Builder",
        meta: techFuel.meta,
        performanceTiers: techFuel.performance_tiers,
        categoryCount: Object.keys(techFuel.categories).length,
        itemCount: techFuel.totalItems,
        categories: Object.keys(techFuel.categories)
      }
    },
    totalFilesIndexed: buildCores.totalItems + pcPartDataset.totalItems + techFuel.totalItems
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'buildcores-index.json'), JSON.stringify(buildCores.categories));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'pcpart-index.json'), JSON.stringify(pcPartDataset.categories));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'techfuel-index.json'), JSON.stringify(techFuel.categories));

  console.log(`\n🎉 Indexing Complete! Total Parts Indexed: ${summary.totalFilesIndexed}`);
  console.log(`📁 Files written to: ${OUTPUT_DIR}`);
}

run();
