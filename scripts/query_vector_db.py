import os
import json
import argparse
import sys

import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROMA_DIR = os.path.join(ROOT_DIR, "chroma_db")

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
        return None
    cat_lower = str(cat_str).lower().strip()
    return CATEGORY_NORM_MAP.get(cat_lower, cat_str)

def search_vector_db(query, n_results=5, category=None):
    import chromadb

    if not os.path.exists(CHROMA_DIR):
        print(f"❌ ChromaDB directory not found at: {CHROMA_DIR}")
        print("Please run python scripts/build_vector_db.py first.")
        return []

    client = chromadb.PersistentClient(path=CHROMA_DIR)
    
    try:
        collection = client.get_collection(name="pc_hardware")
    except Exception as e:
        print(f"❌ Could not access 'pc_hardware' collection: {e}")
        return []

    where_clause = None
    if category:
        norm_cat = normalize_category(category)
        where_clause = {"category": norm_cat}

    print(f"\n🔍 Searching for: '{query}' (Results: {n_results})")
    if where_clause:
        print(f"🎯 Category filter: {where_clause}")

    results = collection.query(
        query_texts=[query],
        n_results=n_results,
        where=where_clause
    )

    ids = results.get("ids", [[]])[0]
    distances = results.get("distances", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    documents = results.get("documents", [[]])[0]

    output_list = []
    print("\n" + "="*70)
    for idx, (item_id, dist, meta, doc) in enumerate(zip(ids, distances, metadatas, documents), start=1):
        similarity = round(1 - dist, 4) if dist <= 1.0 else round(1 / (1 + dist), 4)
        print(f"[{idx}] {meta.get('name')} | Category: {meta.get('category')} | Brand: {meta.get('manufacturer')}")
        print(f"    ID: {item_id} | Similarity Score: {similarity} (Distance: {round(dist, 4)})")
        print(f"    Price: ${meta.get('price', 0)} | Path: {meta.get('relPath')}")
        print(f"    Document Snippet: {doc[:120]}...")
        print("-" * 70)

        output_list.append({
            "id": item_id,
            "similarity": similarity,
            "distance": dist,
            "metadata": meta,
            "document": doc
        })

    return output_list

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Query ChromaDB PC Hardware Vector Database.")
    parser.add_argument("query", nargs="*", type=str, help="Search query string.")
    parser.add_argument("-n", "--results", type=int, default=5, help="Number of results to return.")
    parser.add_argument("-c", "--category", type=str, default=None, help="Filter by category (e.g. CPU, GPU, RAM).")
    
    args = parser.parse_args()
    
    query_str = " ".join(args.query) if args.query else "high performance gaming graphics card"
    search_vector_db(query_str, n_results=args.results, category=args.category)
