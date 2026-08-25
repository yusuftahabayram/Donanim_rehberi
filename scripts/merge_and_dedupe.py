"""
Master Deduplication & Dataset Merger Script for PC Hardware Hub
Merges BuildCores, PC Part Dataset, and TechFuel HQ into a single consolidated master dataset
with smart normalization, schema enrichment, and duplicate removal.
"""

import os
import json
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")

CATEGORY_MAP = {
    'case-accessory': 'case-accessory',
    'case-fan': 'case-fan',
    'cpu': 'CPU',
    'cpu-cooler': 'CPUCooler',
    'external-hard-drive': 'storage',
    'fan-controller': 'fan-controller',
    'headphones': 'headphones',
    'internal-hard-drive': 'storage',
    'keyboard': 'keyboard',
    'memory': 'RAM',
    'monitor': 'monitor',
    'motherboard': 'Motherboard',
    'mouse': 'mouse',
    'optical-drive': 'optical-drive',
    'os': 'os',
    'power-supply': 'PSU',
    'sound-card': 'sound-card',
    'speakers': 'speakers',
    'thermal-paste': 'thermal-paste',
    'ups': 'ups',
    'video-card': 'GPU',
    'webcam': 'webcam',
    'wired-network-card': 'NetworkCard',
    'wireless-network-card': 'NetworkCard',

    # BuildCores mappings
    'CPU': 'CPU',
    'GPU': 'GPU',
    'Motherboard': 'Motherboard',
    'RAM': 'RAM',
    'Storage': 'storage',
    'PCCase': 'case',
    'case': 'case',
    'PSU': 'PSU',
    'CPUCooler': 'CPUCooler',
    'CaseFan': 'case-fan',
    'Headphones': 'headphones',
    'Keyboard': 'keyboard',
    'Mouse': 'mouse',
    'Monitor': 'monitor',
    'Laptop': 'Laptop',
    'PrebuiltDesktop': 'PrebuiltDesktop',
    'Desk': 'Desk',
    'Chair': 'Chair',
    'Webcam': 'webcam',
    'Microphone': 'Microphone',
    'NetworkCard': 'NetworkCard',
    'SoundCard': 'sound-card',
    'Speaker': 'speakers',
    'CaptureCard': 'CaptureCard',
    'ThermalCompound': 'thermal-paste',
    'Lighting': 'Lighting',
    'VRHeadset': 'VRHeadset',
    'Accessory': 'case-accessory',
    'Stand': 'Stand',
    'OS': 'os'
}

def normalize_name(name):
    if not name:
        return ""
    # Convert to lowercase, remove punctuation except alphanumeric
    clean = name.lower()
    clean = re.sub(r'[^\w\s]', '', clean)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def merge_item_data(target_data, new_data):
    """Recursively merges non-null fields from new_data into target_data"""
    for key, val in new_data.items():
        if val is None or val == "":
            continue
        if key not in target_data or target_data[key] is None or target_data[key] == "":
            target_data[key] = val
        elif isinstance(val, dict) and isinstance(target_data.get(key), dict):
            merge_item_data(target_data[key], val)
        elif isinstance(val, list) and isinstance(target_data.get(key), list):
            # Combine lists without duplicates
            combined = list(target_data[key])
            for item in val:
                if item not in combined:
                    combined.append(item)
            target_data[key] = combined

def run_merger():
    print("[MERGER] Deduplication & Merger Process Started...")
    
    buildcores_index_path = os.path.join(DATA_DIR, "buildcores-index.json")
    pcpart_index_path = os.path.join(DATA_DIR, "pcpart-index.json")
    techfuel_index_path = os.path.join(DATA_DIR, "techfuel-index.json")

    with open(buildcores_index_path, "r", encoding="utf-8") as f:
        bc_data = json.load(f)

    with open(pcpart_index_path, "r", encoding="utf-8") as f:
        pc_data = json.load(f)

    with open(techfuel_index_path, "r", encoding="utf-8") as f:
        tf_data = json.load(f)

    unified_catalog = {}

    total_raw_count = 0
    total_deduped_count = 0

    # Helper to insert & deduplicate item into category
    def insert_item(cat_key, raw_item, source_dataset):
        nonlocal total_raw_count, total_deduped_count
        total_raw_count += 1

        if cat_key not in unified_catalog:
            unified_catalog[cat_key] = {
                'items_map': {}, # norm_name -> item
                'items_list': []
            }

        cat_store = unified_catalog[cat_key]

        name = raw_item.get('name') or raw_item.get('data', {}).get('name') or raw_item.get('data', {}).get('metadata', {}).get('name') or "Bilinmeyen Ürün"
        mfg = raw_item.get('manufacturer') or raw_item.get('data', {}).get('manufacturer') or raw_item.get('data', {}).get('vendor') or "Unknown"
        
        norm_key = f"{normalize_name(mfg)}::{normalize_name(name)}"

        if norm_key in cat_store['items_map']:
            # Duplicate found -> Merge specs & update sources!
            existing = cat_store['items_map'][norm_key]
            if source_dataset not in existing['sources']:
                existing['sources'].append(source_dataset)
            
            # Merge spec details
            if raw_item.get('data'):
                merge_item_data(existing['data'], raw_item['data'])
        else:
            # New unique item
            total_deduped_count += 1
            new_item = {
                'id': f"unified_{total_deduped_count}",
                'name': name,
                'manufacturer': mfg,
                'relPath': raw_item.get('relPath', ''),
                'sources': [source_dataset],
                'data': raw_item.get('data', {})
            }
            cat_store['items_map'][norm_key] = new_item
            cat_store['items_list'].append(new_item)

    # Process 1: BuildCores
    print("[1/3] Processing BuildCores items...")
    for cat, items in bc_data.items():
        unified_cat = CATEGORY_MAP.get(cat, cat)
        for item in items:
            insert_item(unified_cat, item, 'buildcores')

    # Process 2: PC Part Dataset
    print("[2/3] Processing PC Part Dataset items...")
    for cat, items in pc_data.items():
        unified_cat = CATEGORY_MAP.get(cat, cat)
        for item in items:
            insert_item(unified_cat, item, 'pcpart')

    # Process 3: TechFuel
    print("[3/3] Processing TechFuel HQ items...")
    for cat, items in tf_data.items():
        unified_cat = CATEGORY_MAP.get(cat, cat)
        for item in items:
            insert_item(unified_cat, item, 'techfuel')

    # Output master unified dataset
    master_index = {}
    cat_summary = {}

    for cat_key, store in unified_catalog.items():
        master_index[cat_key] = store['items_list']
        cat_summary[cat_key] = len(store['items_list'])

    master_path = os.path.join(DATA_DIR, "unified-index.json")
    with open(master_path, "w", encoding="utf-8") as f:
        json.dump(master_index, f, indent=2, ensure_ascii=False)

    # Update summary.json
    summary_path = os.path.join(DATA_DIR, "summary.json")
    with open(summary_path, "r", encoding="utf-8") as f:
        summary_data = json.load(f)

    summary_data['datasets']['unified'] = {
        'name': 'Birleştirilmiş & Tekilleştirilmiş Master Veri Seti',
        'itemCount': total_deduped_count,
        'categoryCount': len(master_index),
        'categories': cat_summary
    }

    summary_data['totalUniqueItems'] = total_deduped_count
    summary_data['totalRawItemsBeforeDeduplication'] = total_raw_count
    summary_data['duplicatesRemoved'] = total_raw_count - total_deduped_count

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary_data, f, indent=2, ensure_ascii=False)

    print("==================================================")
    print("DEDUPLICATION & MERGER SUCCESSFUL!")
    print(f"Total Raw Items Scanned: {total_raw_count:,}")
    print(f"Total Unique Items After Deduplication: {total_deduped_count:,}")
    print(f"Duplicates Removed: {total_raw_count - total_deduped_count:,}")
    print(f"Master Dataset Saved To: {master_path}")
    print("==================================================")

if __name__ == "__main__":
    run_merger()
