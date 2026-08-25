import os
import json
import time
import argparse
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT_DIR, "data")
CHROMA_DIR = os.path.join(ROOT_DIR, "chroma_db")
UNIFIED_FILE = os.path.join(DATA_DIR, "unified-index.json")

CATEGORY_NORM_MAP = {
    "gpu": "GPU", "video-card": "GPU",
    "cpu": "CPU",
    "ram": "RAM", "memory": "RAM",
    "psu": "PSU", "power-supply": "PSU",
    "case": "PCCase", "pccase": "PCCase",
    "cpucooler": "CPUCooler", "cpu-cooler": "CPUCooler",
    "motherboard": "Motherboard",
    "storage": "Storage", "internal-hard-drive": "Storage", "external-hard-drive": "Storage"
}

def normalize_category(cat_str):
    if not cat_str:
        return "Other"
    cat_lower = str(cat_str).lower().strip()
    return CATEGORY_NORM_MAP.get(cat_lower, cat_str)

def format_document(category, item):
    name = item.get("name") or "Unknown Product"
    mfg = item.get("manufacturer") or "Generic"
    price = item.get("price") or 0
    
    spec_parts = []
    data_obj = item.get("data") or {}
    
    if isinstance(data_obj, dict):
        meta = data_obj.get("metadata") or {}
        if isinstance(meta, dict):
            for k, v in meta.items():
                if k not in ["name", "manufacturer", "part_numbers"] and v:
                    spec_parts.append(f"{k}: {v}")
        
        for k, v in data_obj.items():
            if k not in ["metadata", "opendb_id", "general_product_information", "sources"] and v is not None:
                if isinstance(v, (str, int, float, bool)):
                    spec_parts.append(f"{k}: {v}")
                elif isinstance(v, list) and len(v) <= 5:
                    spec_parts.append(f"{k}: {', '.join(map(str, v))}")
    
    specs_str = " | ".join(spec_parts[:12])
    
    doc = f"Category: {category} | Product Name: {name} | Manufacturer: {mfg}"
    if price and float(price) > 0:
        doc += f" | Price: ${price}"
    if specs_str:
        doc += f" | Details: {specs_str}"
        
    return doc

def build_vector_db(limit=None, category_filter=None, reset=False, batch_size=500):
    import chromadb

    print("🚀 Starting ChromaDB Vector Database Builder...", flush=True)
    start_time = time.time()
    
    os.makedirs(CHROMA_DIR, exist_ok=True)
    client = chromadb.PersistentClient(path=CHROMA_DIR)
    
    collection_name = "pc_hardware"
    
    if reset:
        try:
            client.delete_collection(name=collection_name)
            print(f"🗑️ Deleted existing collection '{collection_name}'", flush=True)
        except Exception:
            pass

    collection = client.get_or_create_collection(
        name=collection_name,
        metadata={"hnsw:space": "cosine"}
    )

    if not os.path.exists(UNIFIED_FILE):
        print(f"❌ Unified index file not found: {UNIFIED_FILE}", flush=True)
        print("Please run python scripts/indexer.py first.", flush=True)
        return

    print(f"📖 Loading data from {UNIFIED_FILE}...", flush=True)
    with open(UNIFIED_FILE, "r", encoding="utf-8") as f:
        unified_data = json.load(f)

    total_indexed = 0
    batch_ids = []
    batch_docs = []
    batch_metas = []

    all_categories = list(unified_data.keys())
    print(f"📦 Found {len(all_categories)} raw categories in unified index.", flush=True)

    for raw_cat in sorted(all_categories):
        norm_cat = normalize_category(raw_cat)
        
        if category_filter:
            target_norm = normalize_category(category_filter).lower()
            if norm_cat.lower() != target_norm and raw_cat.lower() != category_filter.lower():
                continue

        items = unified_data[raw_cat]
        print(f"  └─ Indexing category '{raw_cat}' -> Normalized: '{norm_cat}' ({len(items)} items)...", flush=True)

        for idx, item in enumerate(items):
            if limit and total_indexed >= limit:
                break

            item_id = str(item.get("id") or f"{raw_cat}_{idx}")
            doc_text = format_document(norm_cat, item)
            
            price_val = 0.0
            try:
                if item.get("price"):
                    price_val = float(item.get("price"))
            except (ValueError, TypeError):
                price_val = 0.0

            metadata = {
                "name": str(item.get("name") or "Unknown"),
                "category": str(norm_cat),
                "rawCategory": str(raw_cat),
                "manufacturer": str(item.get("manufacturer") or "Generic"),
                "price": price_val,
                "relPath": str(item.get("relPath") or ""),
                "releaseYear": int(item.get("releaseYear") or 0)
            }

            batch_ids.append(item_id)
            batch_docs.append(doc_text)
            batch_metas.append(metadata)
            total_indexed += 1

            if len(batch_ids) >= batch_size:
                collection.upsert(
                    ids=batch_ids,
                    documents=batch_docs,
                    metadatas=batch_metas
                )
                print(f"     Uploaded batch of {len(batch_ids)} items (Total indexed: {total_indexed})", flush=True)
                batch_ids.clear()
                batch_docs.clear()
                batch_metas.clear()

        if limit and total_indexed >= limit:
            print(f"⚠️ Reached requested limit of {limit} items.", flush=True)
            break

    if batch_ids:
        collection.upsert(
            ids=batch_ids,
            documents=batch_docs,
            metadatas=batch_metas
        )
        print(f"     Uploaded final batch of {len(batch_ids)} items.", flush=True)

    elapsed = round(time.time() - start_time, 2)
    final_count = collection.count()
    print("==================================================", flush=True)
    print("🎉 ChromaDB Vector Database Indexing Completed!", flush=True)
    print(f"⏱️ Total Time: {elapsed} seconds", flush=True)
    print(f"📊 Total Items in Collection '{collection_name}': {final_count}", flush=True)
    print(f"📁 Database Location: {CHROMA_DIR}", flush=True)
    print("==================================================", flush=True)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build ChromaDB vector database for PC parts.")
    parser.add_argument("--limit", type=int, default=None, help="Limit total items to index (for fast testing).")
    parser.add_argument("--category", type=str, default=None, help="Index a specific category only.")
    parser.add_argument("--reset", action="store_true", help="Reset existing collection before indexing.")
    parser.add_argument("--batch-size", type=int, default=500, help="Batch size for vector indexing.")
    
    args = parser.parse_args()
    build_vector_db(
        limit=args.limit,
        category_filter=args.category,
        reset=args.reset,
        batch_size=args.batch_size
    )
