import os
import json
import time

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(ROOT_DIR, "data")

BUILDCORES_DIR = os.path.join(ROOT_DIR, "buildcores-open-db-main", "buildcores-open-db-main", "open-db")
PC_PART_DATASET_DIR = os.path.join(ROOT_DIR, "pc-part-dataset-main", "pc-part-dataset-main", "data", "json")
TECHFUEL_FILE = os.path.join(ROOT_DIR, "pc-builder-parts-main", "pc-builder-parts-main", "pc-builder-parts.json")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("🚀 Starting Python Dataset Indexer...")
start_time = time.time()

# 1. BuildCores
def index_buildcores():
    print("📦 Indexing BuildCores Open DB...")
    categories = {}
    total_items = 0

    if os.path.exists(BUILDCORES_DIR):
        for cat_name in sorted(os.listdir(BUILDCORES_DIR)):
            cat_path = os.path.join(BUILDCORES_DIR, cat_name)
            if not os.path.isdir(cat_path):
                continue
            
            items = []
            for file_name in os.listdir(cat_path):
                if file_name.endswith('.json'):
                    file_path = os.path.join(cat_path, file_name)
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            item_id = data.get('opendb_id') or os.path.splitext(file_name)[0]
                            meta = data.get('metadata') or {}
                            name = meta.get('name') or data.get('name') or 'Unknown'
                            mfg = meta.get('manufacturer') or data.get('manufacturer') or data.get('vendor') or 'Generic'
                            price = data.get('price') or data.get('price_usd') or 0
                            
                            rel_path = os.path.relpath(file_path, ROOT_DIR).replace('\\', '/')
                            items.append({
                                'id': item_id,
                                'name': name,
                                'manufacturer': mfg,
                                'price': price,
                                'relPath': rel_path,
                                'data': data
                            })
                    except Exception as e:
                        pass
            
            categories[cat_name] = items
            total_items += len(items)
            print(f"  └─ Category: {cat_name} ({len(items)} items)")

    return categories, total_items

# 2. PC Part Dataset
def index_pcpart():
    print("📦 Indexing PC Part Dataset...")
    categories = {}
    total_items = 0

    if os.path.exists(PC_PART_DATASET_DIR):
        for file_name in sorted(os.listdir(PC_PART_DATASET_DIR)):
            if file_name.endswith('.json'):
                cat_name = os.path.splitext(file_name)[0]
                file_path = os.path.join(PC_PART_DATASET_DIR, file_name)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data_array = json.load(f)
                        if isinstance(data_array, list):
                            items = []
                            for idx, item in enumerate(data_array):
                                name = item.get('name') or f"{cat_name} #{idx+1}"
                                mfg = name.split(' ')[0] if name else 'Unknown'
                                price = item.get('price') or 0
                                rel_path = os.path.relpath(file_path, ROOT_DIR).replace('\\', '/')
                                items.append({
                                    'id': f"pcpart-{cat_name}-{idx}",
                                    'name': name,
                                    'manufacturer': mfg,
                                    'price': price,
                                    'relPath': rel_path,
                                    'itemIndex': idx,
                                    'data': item
                                })
                            categories[cat_name] = items
                            total_items += len(items)
                            print(f"  └─ Category: {cat_name} ({len(items)} items)")
                except Exception as e:
                    pass

    return categories, total_items

# 3. TechFuel
def index_techfuel():
    print("📦 Indexing TechFuel HQ Dataset...")
    categories = {}
    total_items = 0
    meta = {}
    performance_tiers = {}

    if os.path.exists(TECHFUEL_FILE):
        try:
            with open(TECHFUEL_FILE, 'r', encoding='utf-8') as f:
                root_obj = json.load(f)
                meta = root_obj.get('_meta', {})
                performance_tiers = root_obj.get('performance_tiers', {})
                
                for key, val in root_obj.items():
                    if key in ('_meta', 'performance_tiers'):
                        continue
                    if isinstance(val, list):
                        items = []
                        for idx, item in enumerate(val):
                            name = f"{item.get('vendor', '')} {item.get('model', '')}".strip() or item.get('name') or f"{key} #{idx}"
                            mfg = item.get('vendor') or 'Unknown'
                            price = item.get('price_usd') or item.get('price') or 0
                            rel_path = os.path.relpath(TECHFUEL_FILE, ROOT_DIR).replace('\\', '/')
                            items.append({
                                'id': item.get('id') or f"tf-{key}-{idx}",
                                'name': name,
                                'manufacturer': mfg,
                                'price': price,
                                'relPath': rel_path,
                                'categoryKey': key,
                                'itemIndex': idx,
                                'data': item
                            })
                        categories[key] = items
                        total_items += len(items)
                        print(f"  └─ Category: {key} ({len(items)} items)")
        except Exception as e:
            pass

    return meta, performance_tiers, categories, total_items

def main():
    bc_cats, bc_total = index_buildcores()
    pc_cats, pc_total = index_pcpart()
    tf_meta, tf_tiers, tf_cats, tf_total = index_techfuel()

    summary = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "datasets": {
            "buildcores": {
                "name": "BuildCores Open DB",
                "categoryCount": len(bc_cats),
                "itemCount": bc_total,
                "categories": list(bc_cats.keys())
            },
            "pcPartDataset": {
                "name": "PC Part Dataset",
                "categoryCount": len(pc_cats),
                "itemCount": pc_total,
                "categories": list(pc_cats.keys())
            },
            "techFuel": {
                "name": "TechFuel HQ PC Builder",
                "meta": tf_meta,
                "performanceTiers": tf_tiers,
                "categoryCount": len(tf_cats),
                "itemCount": tf_total,
                "categories": list(tf_cats.keys())
            }
        },
        "totalFilesIndexed": bc_total + pc_total + tf_total
    }

    with open(os.path.join(OUTPUT_DIR, "summary.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    with open(os.path.join(OUTPUT_DIR, "buildcores-index.json"), "w", encoding="utf-8") as f:
        json.dump(bc_cats, f, ensure_ascii=False)

    with open(os.path.join(OUTPUT_DIR, "pcpart-index.json"), "w", encoding="utf-8") as f:
        json.dump(pc_cats, f, ensure_ascii=False)

    with open(os.path.join(OUTPUT_DIR, "techfuel-index.json"), "w", encoding="utf-8") as f:
        json.dump(tf_cats, f, ensure_ascii=False)

    elapsed = time.time() - start_time
    print(f"\n🎉 Done in {elapsed:.2f} seconds! Total Parts Indexed: {summary['totalFilesIndexed']}")

if __name__ == "__main__":
    main()
