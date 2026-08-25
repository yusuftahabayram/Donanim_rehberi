import os
import json
import gzip
import sys
import http.server
import socketserver
import subprocess
from urllib.parse import urlparse, parse_qs

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

PORT = 3000
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT_DIR, "data")

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon"
}

def load_env():
    env_path = os.path.join(ROOT_DIR, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k:
                            os.environ[k] = v
        except Exception as e:
            print("[SERVER] Warning reading .env:", e)

load_env()

# Global ChromaDB client cache
_CHROMA_CLIENT = None
_CHROMA_COLLECTION = None

def get_chroma_collection():
    global _CHROMA_CLIENT, _CHROMA_COLLECTION
    if _CHROMA_COLLECTION is not None:
        return _CHROMA_COLLECTION

    chroma_dir = os.path.join(ROOT_DIR, "chroma_db")
    if not os.path.exists(chroma_dir):
        return None

    try:
        import chromadb
        _CHROMA_CLIENT = chromadb.PersistentClient(path=chroma_dir)
        _CHROMA_COLLECTION = _CHROMA_CLIENT.get_collection(name="pc_hardware")
        return _CHROMA_COLLECTION
    except Exception as e:
        print("[SERVER] Error initializing ChromaDB collection:", e)
        return None

import urllib.request
import urllib.error

def detect_category_intent(msg):
    if not msg:
        return None
    msg_lower = msg.lower().strip()
    cat_keywords = {
        'CPUCooler': ['işlemci soğutucu', 'islemci sogutucu', 'sıvı soğutma', 'sivi sogutma', 'hava soğutma', 'soğutucu', 'sogutucu', 'cooler', 'aio'],
        'GPU': ['ekran kart', 'ekrankart', 'gpu', 'graphics card', 'video card', 'rtx', 'gtx', 'radeon', 'geforce', 'vram'],
        'CPU': ['işlemci', 'islemci', 'cpu', 'processor', 'ryzen', 'intel core', 'i3', 'i5', 'i7', 'i9', 'threadripper'],
        'RAM': ['ram', 'bellek', 'memory', 'ddr4', 'ddr5'],
        'Motherboard': ['anakart', 'motherboard', 'mainboard'],
        'PSU': ['psu', 'güç kaynağı', 'guc kaynagi', 'power supply'],
        'PCCase': ['kasa', 'pc kasa', 'chassis', 'tower'],
        'Storage': ['ssd', 'm2', 'm.2', 'nvme', 'hdd', 'harddisk', 'depolama'],
        'Chair': ['koltuk', 'oyuncu koltuğu', 'oyuncu koltugu', 'gaming chair'],
        'keyboard': ['klavye', 'keyboard'],
        'mouse': ['mouse', 'fare'],
        'headphones': ['kulaklık', 'kulaklik', 'headphone', 'headset']
    }
    for cat, kws in cat_keywords.items():
        if any(kw in msg_lower for kw in kws):
            return cat
    return None

def query_rag_context(user_message, limit=5):
    collection = get_chroma_collection()
    if collection is None:
        return "", []
    try:
        msg_lower = user_message.lower()
        
        is_system_build = any(w in msg_lower for w in [
            'sistem topla', 'sistem öner', 'sistem oner', 'sistem tavsiye',
            'pc topla', 'pc öner', 'pc oner', 'pc tavsiye',
            'bilgisayar topla', 'bilgisayar öner', 'bilgisayar oner',
            'kasa topla', 'kasa dizayn', 'kasa öner', 'oyun bilgisayarı',
            'oyun bilgisayari', 'sistem kur', 'pc kur', 'sistem diz'
        ])

        has_gpu = any(w in msg_lower for w in ['ekran kart', 'ekrankart', 'gpu', 'rtx', 'gtx', 'radeon', 'geforce'])
        has_cpu = any(w in msg_lower for w in ['işlemci', 'islemci', 'cpu', 'processor', 'ryzen', 'intel core'])

        combined_items = []

        if is_system_build:
            # Query top modern components across main PC Hardware categories
            comp_queries = [
                ("GPU", user_message + " RTX 4070 SUPER RTX 4080 RX 7800 XT GeForce"),
                ("CPU", user_message + " Ryzen 7 7800X3D Ryzen 7 9700X Core i7-14700K"),
                ("RAM", user_message + " DDR5 32GB 6000MHz"),
                ("Motherboard", user_message + " B650 X670 Z790 ATX Motherboard"),
                ("Storage", user_message + " 1TB 2TB NVMe M.2 SSD"),
                ("PSU", user_message + " 750W 850W Gold Power Supply"),
                ("PCCase", user_message + " ATX Mid Tower Glass Mesh Gaming Case")
            ]
            for cat, q_text in comp_queries:
                res_c = collection.query(
                    query_texts=[q_text],
                    n_results=4,
                    where={"category": cat}
                )
                docs = res_c.get("documents", [[]])[0] if res_c.get("documents") else []
                metas = res_c.get("metadatas", [[]])[0] if res_c.get("metadatas") else []
                item_ids = res_c.get("ids", [[]])[0] if res_c.get("ids") else []
                dists = res_c.get("distances", [[]])[0] if res_c.get("distances") else []

                cat_items = []
                for doc, meta, item_id, dist in zip(docs, metas, item_ids, dists):
                    meta = meta or {}
                    sim = round(1 - dist, 4) if dist <= 1.0 else round(1 / (1 + dist), 4)
                    year = int(meta.get("releaseYear") or 0)
                    name_u = str(meta.get("name") or "").upper()
                    cat_items.append({
                        "doc": doc, "meta": meta, "item_id": item_id, "sim": sim,
                        "releaseYear": year, "name": name_u
                    })

                cat_items.sort(key=lambda m: (m["releaseYear"], m["sim"]), reverse=True)
                if cat_items:
                    combined_items.append(cat_items[0])

            combined = combined_items[:7]
        elif has_gpu and has_cpu:
            # Multi-category query: Fetch top GPUs and top CPUs
            res_gpu = collection.query(
                query_texts=[user_message + " RTX 4080 4070 RX 7800 7900"],
                n_results=6,
                where={"category": "GPU"}
            )
            res_cpu = collection.query(
                query_texts=[user_message + " Ryzen 7 7800X3D Ryzen 7 9700X Core i7 Core i5"],
                n_results=6,
                where={"category": "CPU"}
            )

            for res_data in (res_gpu, res_cpu):
                docs = res_data.get("documents", [[]])[0] if res_data.get("documents") else []
                metas = res_data.get("metadatas", [[]])[0] if res_data.get("metadatas") else []
                item_ids = res_data.get("ids", [[]])[0] if res_data.get("ids") else []
                dists = res_data.get("distances", [[]])[0] if res_data.get("distances") else []
                for doc, meta, item_id, dist in zip(docs, metas, item_ids, dists):
                    meta = meta or {}
                    sim = round(1 - dist, 4) if dist <= 1.0 else round(1 / (1 + dist), 4)
                    combined_items.append({
                        "doc": doc, "meta": meta, "item_id": item_id, "sim": sim,
                        "releaseYear": int(meta.get("releaseYear") or 0),
                        "name": str(meta.get("name") or "").upper()
                    })

            gpus = [i for i in combined_items if i["meta"].get("category") == "GPU"]
            cpus = [i for i in combined_items if i["meta"].get("category") == "CPU"]

            gpus.sort(key=lambda m: (m["releaseYear"], 1 if any(x in m["name"] for x in ['RTX 40', 'RTX 30', 'RX 7', 'RX 6']) else 0, m["sim"]), reverse=True)
            cpus.sort(key=lambda m: (m["releaseYear"], 1 if any(x in m["name"] for x in ['7800X3D', '9700X', '9900X', '14700K', '13600K', '7600X']) else 0, m["sim"]), reverse=True)

            final_items = []
            max_len = max(len(gpus), len(cpus))
            for idx in range(max_len):
                if idx < len(gpus): final_items.append(gpus[idx])
                if idx < len(cpus): final_items.append(cpus[idx])
            combined = final_items[:limit]
        else:
            detected_cat = detect_category_intent(user_message)
            query_text = user_message
            if detected_cat == 'GPU' and any(w in msg_lower for w in ['güçlü', 'en iyi', 'performans', 'oyun', 'üst seviye', 'tavsiye', 'öneri', 'high', 'hızlı']):
                query_text = user_message + ' RTX 4090 RTX 4080 SUPER RTX 4070 Ti RX 7900 XTX RX 7800 XT GeForce'
            elif detected_cat == 'CPU' and any(w in msg_lower for w in ['güçlü', 'en iyi', 'performans', 'oyun', 'üst seviye', 'tavsiye', 'öneri', 'high', 'hızlı']):
                query_text = user_message + ' Ryzen 7 7800X3D Ryzen 9 7950X3D Core i9-14900K Core i7-14700K'

            where_clause = {"category": detected_cat} if detected_cat else None
            n_search = limit * 4 if detected_cat else limit

            res = collection.query(
                query_texts=[query_text],
                n_results=n_search,
                where=where_clause
            )
            documents = res.get("documents", [[]])[0] if res.get("documents") else []
            metadatas = res.get("metadatas", [[]])[0] if res.get("metadatas") else []
            ids = res.get("ids", [[]])[0] if res.get("ids") else []
            distances = res.get("distances", [[]])[0] if res.get("distances") else []
            
            combined = []
            for doc, meta, item_id, dist in zip(documents, metadatas, ids, distances):
                meta = meta or {}
                sim = 0.5
                if isinstance(dist, (int, float)):
                    sim = round(1 - dist, 4) if dist <= 1.0 else round(1 / (1 + dist), 4)

                name_upper = str(meta.get("name") or "").upper()
                year = int(meta.get("releaseYear") or 0)

                combined.append({
                    "doc": doc,
                    "meta": meta,
                    "item_id": item_id,
                    "sim": sim,
                    "releaseYear": year,
                    "name": name_upper
                })

            if detected_cat == 'GPU':
                combined.sort(key=lambda m: (m["releaseYear"], 1 if any(x in m["name"] for x in ['RTX 40', 'RTX 30', 'RX 7', 'RX 6']) else 0, m["sim"]), reverse=True)
            elif detected_cat == 'CPU':
                combined.sort(key=lambda m: (m["releaseYear"], 1 if any(x in m["name"] for x in ['7800X3D', '9950X', '14900K', '14700K', '7950X']) else 0, m["sim"]), reverse=True)

            combined = combined[:limit]

        context_parts = []
        rec_products = []
        for item in combined:
            meta = item["meta"]
            if item["doc"]:
                context_parts.append(str(item["doc"]))
            
            rec_products.append({
                "id": str(item["item_id"] or ""),
                "name": str(meta.get("name") or "Bilinmeyen Ürün"),
                "category": str(meta.get("category") or ""),
                "manufacturer": str(meta.get("manufacturer") or "Generic"),
                "price": float(meta.get("price") or 0),
                "relPath": str(meta.get("relPath") or ""),
                "releaseYear": int(meta.get("releaseYear") or 0),
                "similarity": item["sim"]
            })
        return "\n".join(context_parts), rec_products
    except Exception as e:
        print("[SERVER] RAG Query Error:", e)
        return "", []

def call_gemini_chat(user_message, history, rag_context):
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "YOUR_GEMINI_API_KEY":
        return {
            "answer": "⚠️ **Gemini API Anahtarı Bulunamadı!**\n\nLütfen projenin kök dizinindeki `.env` dosyasına geçerli `GEMINI_API_KEY=your_key_here` bilginizi ekleyin.\n\n*(Aşağıda ChromaDB RAG veritabanından çekilen ilgili ürünler listelenmiştir:)*",
            "noApiKey": True
        }

    msg_lower = user_message.lower()
    is_system_build = any(w in msg_lower for w in [
        'sistem topla', 'sistem öner', 'sistem oner', 'sistem tavsiye',
        'pc topla', 'pc öner', 'pc oner', 'pc tavsiye',
        'bilgisayar topla', 'bilgisayar öner', 'bilgisayar oner',
        'kasa topla', 'kasa dizayn', 'kasa öner', 'oyun bilgisayarı',
        'oyun bilgisayari', 'sistem kur', 'pc kur', 'sistem diz'
    ])
    
    system_prompt = (
        "Sen PC Donanım ve Bilgisayar Toplama uzmanı bir yapay zeka asistanısın. "
        "Kullanıcıların donanım (CPU, GPU, RAM, Anakart, PSU vb.) sorularını yanıtlar, "
        "bütçe ve ihtiyaçlarına göre ürün tavsiye eder ve donanım ürünlerini teknik/fiyat açısından karşılaştırırsın.\n\n"
        "Aşağıda veritabanımızdan (ChromaDB RAG) çekilen güncel ve gerçek ürün bilgileri (Context) bulunmaktadır:\n"
        "--- VERİTABANI BAĞLAMI (RAG CONTEXT) ---\n"
        f"{rag_context if rag_context else 'Alakalı özel ürün kaydı bulunamadı.'}\n"
        "-----------------------------------------\n\n"
        "TALİMATLAR:\n"
        "1. Kullanıcıya Türkçe, nazik, anlaşılır ve profesyonel yanıt ver.\n"
        "2. YANITINI YARIDA KESME. Başladığın tüm liste maddelerini, başlıkları ve açıklamaları sonuna kadar eksiksiz ve eksiksiz bir cümle ile bitir.\n"
        "3. KESİNLİKLE koltuk, oyuncu koltuğu, kulaklık veya klavye gibi çevresel aksesuarlar ÖNERME. Sadece PC İç Donanım Kasa Bileşenlerine odaklan.\n"
    )

    if is_system_build:
        system_prompt += (
            "4. Kullanıcı tam bir PC Kasa dizaynı / Sistem toplama talebinde bulundu. "
            "Yanıtında kullanıcı için uyumlu, performanslı ve dengeli tam bir PC Kasa Toplama Rehberi hazırla:\n"
            "   - 🎯 **Ekran Kartı (GPU)**: Önerilen model ve neden seçildiği.\n"
            "   - ⚡ **İşlemci (CPU)**: Önerilen model ve performansı.\n"
            "   - 🧩 **Anakart (Motherboard)**: Soket ve çipset uyumu.\n"
            "   - 🧠 **RAM (Bellek)**: Kapasite (örn: 32GB DDR5) ve hız.\n"
            "   - 💾 **Depolama (SSD)**: Hızlı NVMe M.2 SSD önerisi.\n"
            "   - 🔌 **Güç Kaynağı (PSU)**: Watt değeri ve 80+ sertifikası.\n"
            "   - 📦 **Kasa (PC Case)**: Mesh havalandırma ve tasarım özellikleri."
        )

    contents = []
    if isinstance(history, list):
        for h in history[-6:]:
            role = "user" if h.get("role") == "user" else "model"
            text = h.get("content") or h.get("text") or ""
            if text:
                contents.append({"role": role, "parts": [{"text": text}]})

    contents.append({"role": "user", "parts": [{"text": user_message}]})

    payload = {
        "contents": contents,
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 4096
        }
    }

    candidate_models = [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-pro-preview",
        "gemini-flash-latest"
    ]
    last_error_msg = ""
    is_rate_limit = False

    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                resp_bytes = resp.read()
                resp_json = json.loads(resp_bytes.decode("utf-8"))
                
                candidates = resp_json.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        answer_text = parts[0].get("text", "")
                        return {"answer": answer_text}
                return {"answer": "Gemini API yanıt üretemedi."}
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8', errors='ignore')
            print(f"[SERVER] Gemini API HTTP Error ({model_name} - {e.code}):", err_msg, flush=True)
            last_error_msg = f"HTTP {e.code} ({model_name}): {err_msg[:100]}"
            if e.code == 429:
                is_rate_limit = True
                continue
            if e.code in (404, 400, 503, 500):
                continue
            return {"answer": f"Gemini API Hatası ({e.code}): Lütfen .env dosyasındaki API key'inizi kontrol edin. (Detay: {err_msg[:150]})"}
        except Exception as e:
            print(f"[SERVER] Gemini API Exception ({model_name}):", e, flush=True)
            last_error_msg = str(e)
            continue

    if is_rate_limit:
        return {
            "answer": "⏱️ **API Kota / Hız Sınırı Aşıldı (HTTP 429)**\n\nGoogle Gemini ücretsiz API kotasında anlık sınır aşıldı. Lütfen **15-20 saniye bekledikten sonra** sorunuzu tekrar gönderin veya `.env` dosyasında yeni bir Google AI Studio API Key kullanın.\n\n*(Aşağıda ChromaDB veritabanınızdan çekilen ilgili donanım ürünleri listelenmiştir:)*"
        }

    return {
        "answer": f"⚠️ **Gemini API Bağlantı Uyarısı**\n\nGoogle Gemini servislerine ulaşılamadı veya sunucu yoğunluğu yaşanıyor (Son Hata: `{last_error_msg}`).\n\n💡 **İpucu:** Lütfen `https://aistudio.google.com/app/apikey` adresinden **`AIzaSy...`** ile başlayan ücretsiz bir Google AI Studio API Key alıp `.env` dosyasına kaydedin."
    }


def ensure_indexes():
    summary_path = os.path.join(DATA_DIR, "summary.json")
    if not os.path.exists(summary_path):
        print("[SERVER] Index files missing. Running indexer script...")
        try:
            indexer_path = os.path.join(ROOT_DIR, "scripts", "indexer.py")
            subprocess.run(["python", indexer_path], check=True)
        except Exception as e:
            print("[SERVER] Error building indexes:", e)

class DataServerHandler(http.server.BaseHTTPRequestHandler):
    close_connection = True

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        pathname = parsed.path
        query_params = parse_qs(parsed.query)

        # GET /api/vector-search?q=...&category=...&limit=10
        if pathname == "/api/vector-search":
            q_list = query_params.get("q", [])
            query_str = q_list[0] if q_list else ""
            cat_list = query_params.get("category", [])
            raw_cat = cat_list[0] if cat_list else None
            
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
            category_filter = CATEGORY_NORM_MAP.get(raw_cat.lower().strip(), raw_cat) if raw_cat else detect_category_intent(query_str)

            limit_list = query_params.get("limit", [10])
            try:
                limit_val = int(limit_list[0])
            except (ValueError, TypeError):
                limit_val = 10

            if not query_str:
                self._send_json({"error": "Query parameter 'q' is required."}, 400)
                return

            collection = get_chroma_collection()
            if collection is None:
                self._send_json({"error": "Vector database (chroma_db) not initialized or failed to load. Run scripts/build_vector_db.py first."}, 404)
                return

            try:
                where_clause = {"category": category_filter} if category_filter else None
                search_q = query_str
                if category_filter == 'GPU' and any(w in query_str.lower() for w in ['güçlü', 'en iyi', 'performans', 'oyun', 'üst seviye', 'tavsiye', 'öneri', 'high', 'hızlı']):
                    search_q = query_str + ' RTX 4090 RTX 4080 SUPER RTX 4070 Ti RX 7900 XTX RX 7800 XT GeForce'

                res = collection.query(
                    query_texts=[search_q],
                    n_results=limit_val * 3 if category_filter else limit_val,
                    where=where_clause
                )

                ids = res.get("ids", [[]])[0]
                distances = res.get("distances", [[]])[0]
                metadatas = res.get("metadatas", [[]])[0]
                documents = res.get("documents", [[]])[0]

                items = []
                for item_id, dist, meta, doc in zip(ids, distances, metadatas, documents):
                    sim = round(1 - dist, 4) if dist <= 1.0 else round(1 / (1 + dist), 4)
                    items.append({
                        "id": item_id,
                        "name": meta.get("name"),
                        "category": meta.get("category"),
                        "manufacturer": meta.get("manufacturer"),
                        "price": meta.get("price", 0),
                        "relPath": meta.get("relPath"),
                        "releaseYear": int(meta.get("releaseYear") or 0),
                        "similarity": sim,
                        "distance": dist,
                        "document": doc
                    })

                if category_filter == 'GPU':
                    items.sort(key=lambda m: (m["releaseYear"], 1 if any(x in (m["name"] or "").upper() for x in ['RTX 40', 'RTX 30', 'RX 7', 'RX 6']) else 0, m["similarity"]), reverse=True)

                items = items[:limit_val]

                self._send_json({
                    "query": query_str,
                    "category": category_filter,
                    "count": len(items),
                    "results": items
                })
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return

        # GET /api/summary
        if pathname == "/api/summary":
            summary_file = os.path.join(DATA_DIR, "summary.json")
            if os.path.exists(summary_file):
                self._send_file(summary_file, "application/json; charset=utf-8")
            else:
                self._send_json({"error": "Summary index not found."}, 404)
            return

        # GET /api/index/<ds>
        if pathname.startswith("/api/index/"):
            ds_name = pathname.replace("/api/index/", "")
            target_map = {
                "buildcores": os.path.join(DATA_DIR, "buildcores-index.json"),
                "pcpart": os.path.join(DATA_DIR, "pcpart-index.json"),
                "techfuel": os.path.join(DATA_DIR, "techfuel-index.json"),
                "unified": os.path.join(DATA_DIR, "unified-index.json")
            }
            target_file = target_map.get(ds_name)
            if target_file and os.path.exists(target_file):
                self._send_file(target_file, "application/json; charset=utf-8")
            else:
                self._send_json({"error": f"Dataset index '{ds_name}' not found."}, 404)
            return

        # Serve Static Files (with path traversal security check)
        rel_path = pathname.lstrip("/")
        if not rel_path or rel_path == "/":
            rel_path = "index.html"
        
        file_path = os.path.abspath(os.path.join(ROOT_DIR, rel_path))
        if not file_path.startswith(ROOT_DIR):
            self._send_json({"error": "Access denied"}, 403)
            return

        if not os.path.exists(file_path) or os.path.isdir(file_path):
            file_path = os.path.join(ROOT_DIR, "index.html")

        ext = os.path.splitext(file_path)[1].lower()
        mime = MIME_TYPES.get(ext, "application/octet-stream")
        self._send_file(file_path, mime)

    def do_POST(self):
        parsed = urlparse(self.path)
        pathname = parsed.path

        # POST /api/chat
        if pathname == "/api/chat":
            try:
                length_header = self.headers.get("Content-Length") or self.headers.get("content-length") or "0"
                content_length = int(length_header)
                body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
                
                payload = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
                user_message = payload.get("message", "").strip()
                history = payload.get("history", [])

                if not user_message:
                    self._send_json({"error": "Message parameter is required"}, 400)
                    return

                rag_context, rec_products = query_rag_context(user_message, limit=5)
                gemini_res = call_gemini_chat(user_message, history, rag_context)

                response_payload = {
                    "answer": gemini_res.get("answer", ""),
                    "recommendedProducts": rec_products,
                    "noApiKey": gemini_res.get("noApiKey", False)
                }

                self._send_json(response_payload)
            except Exception as e:
                import traceback
                print("[SERVER] Error handling POST /api/chat:", e, flush=True)
                traceback.print_exc()
                self._send_json({"error": str(e)}, 500)
            return

        # POST /api/save-item
        if pathname == "/api/save-item":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)
            try:
                payload = json.loads(body_bytes.decode("utf-8"))
                rel_path = payload.get("relPath")
                item_index = payload.get("itemIndex")
                updated_data = payload.get("updatedData")
                dataset = payload.get("dataset")

                if not rel_path:
                    self._send_json({"error": "relPath required"}, 400)
                    return

                abs_path = os.path.abspath(os.path.join(ROOT_DIR, rel_path))
                if not abs_path.startswith(ROOT_DIR):
                    self._send_json({"error": "Access denied"}, 403)
                    return

                if not os.path.exists(abs_path):
                    self._send_json({"error": "File not found on disk"}, 404)
                    return

                if dataset == "buildcores" or item_index is None:
                    with open(abs_path, "w", encoding="utf-8") as f:
                        json.dump(updated_data, f, indent=2, ensure_ascii=False)
                elif dataset == "pcpart" and isinstance(item_index, int):
                    with open(abs_path, "r", encoding="utf-8") as f:
                        arr = json.load(f)
                    if isinstance(arr, list) and 0 <= item_index < len(arr):
                        arr[item_index] = updated_data
                        with open(abs_path, "w", encoding="utf-8") as f:
                            json.dump(arr, f, indent=2, ensure_ascii=False)
                elif dataset == "techfuel" and payload.get("categoryKey") and isinstance(item_index, int):
                    with open(abs_path, "r", encoding="utf-8") as f:
                        root_obj = json.load(f)
                    cat_key = payload.get("categoryKey")
                    if cat_key in root_obj and isinstance(root_obj[cat_key], list):
                        root_obj[cat_key][item_index] = updated_data
                        with open(abs_path, "w", encoding="utf-8") as f:
                            json.dump(root_obj, f, indent=2, ensure_ascii=False)

                self._send_json({"success": True, "message": "Item saved successfully."})
            except Exception as e:
                self._send_json({"error": str(e)}, 500)
            return

        self._send_json({"error": f"POST endpoint '{pathname}' not found"}, 404)

    def _send_file(self, filepath, mime):
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            
            accept_encoding = str(self.headers.get("Accept-Encoding") or "") if self.headers else ""
            if "gzip" in accept_encoding and len(content) > 1000:
                compressed = gzip.compress(content)
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(compressed)))
                self.send_header("Cache-Control", "no-cache, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(compressed)
            else:
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Cache-Control", "no-cache, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(content)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as e:
            print("[SERVER] Error serving file:", e)
            try:
                self.send_response(404)
                self.end_headers()
            except Exception:
                pass

    def _send_json(self, data, code=200):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            accept_encoding = str(self.headers.get("Accept-Encoding") or "") if self.headers else ""
            
            if "gzip" in accept_encoding and len(body) > 1000:
                compressed = gzip.compress(body)
                self.send_response(code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", str(len(compressed)))
                self.send_header("Cache-Control", "no-cache, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(compressed)
            else:
                self.send_response(code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-cache, must-revalidate")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        except Exception as e:
            print("[SERVER] Error sending json:", e)

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

def main():
    ensure_indexes()
    server_address = ("0.0.0.0", PORT)
    httpd = ThreadedHTTPServer(server_address, DataServerHandler)
    print("==================================================")
    print("🚀 STAJ PROJE RAG & GEMINI SERVER RUNNING")
    print(f"📡 Local URL: http://localhost:{PORT}")
    print("==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Server shutting down.")
        httpd.server_close()

if __name__ == "__main__":
    main()
