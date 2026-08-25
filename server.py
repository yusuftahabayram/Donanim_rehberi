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
                        if k and not os.environ.get(k):
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

def query_rag_context(user_message, limit=5):
    collection = get_chroma_collection()
    if collection is None:
        return "", []
    try:
        res = collection.query(
            query_texts=[user_message],
            n_results=limit
        )
        documents = res.get("documents", [[]])[0] if res.get("documents") else []
        metadatas = res.get("metadatas", [[]])[0] if res.get("metadatas") else []
        ids = res.get("ids", [[]])[0] if res.get("ids") else []
        distances = res.get("distances", [[]])[0] if res.get("distances") else []
        
        context_parts = []
        rec_products = []
        for doc, meta, item_id, dist in zip(documents, metadatas, ids, distances):
            meta = meta or {}
            if doc:
                context_parts.append(str(doc))
            
            sim = 0.5
            if isinstance(dist, (int, float)):
                sim = round(1 - dist, 4) if dist <= 1.0 else round(1 / (1 + dist), 4)

            rec_products.append({
                "id": str(item_id or ""),
                "name": str(meta.get("name") or "Bilinmeyen Ürün"),
                "category": str(meta.get("category") or ""),
                "manufacturer": str(meta.get("manufacturer") or "Generic"),
                "price": float(meta.get("price") or 0),
                "relPath": str(meta.get("relPath") or ""),
                "releaseYear": int(meta.get("releaseYear") or 0),
                "similarity": sim
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

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    
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
        "2. Eğer veritabanı bağlamında sorulan ürünler varsa, ürünlerin tam adını, fiyatını ve teknik özelliklerini vurgula.\n"
        "3. Karşılaştırma sorularında (örn: X vs Y) artı ve eksi yönleri liste veya tablo halinde açıkla.\n"
        "4. Yanıtı çok uzun tutma, okunabilirliği yüksek ve öz tut."
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
            "maxOutputTokens": 1024
        }
    }

    candidate_models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-flash-latest"
    ]
    last_error_msg = ""

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
            print(f"[SERVER] Gemini API HTTP Error ({model_name} - {e.code}):", err_msg)
            last_error_msg = f"HTTP {e.code} ({model_name})"
            if e.code in (404, 429, 503, 500):
                continue
            return {"answer": f"Gemini API Hatası ({e.code}): Lütfen .env dosyasındaki API key'inizi kontrol edin."}
        except Exception as e:
            print(f"[SERVER] Gemini API Exception ({model_name}):", e)
            last_error_msg = str(e)
            continue

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
            category_filter = CATEGORY_NORM_MAP.get(raw_cat.lower().strip(), raw_cat) if raw_cat else None

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
                res = collection.query(
                    query_texts=[query_str],
                    n_results=limit_val,
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
                        "releaseYear": meta.get("releaseYear", 0),
                        "similarity": sim,
                        "distance": dist,
                        "document": doc
                    })

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

    def _send_file(self, filepath, mime):
        try:
            with open(filepath, "rb") as f:
                content = f.read()
            
            accept_encoding = self.headers.get("Accept-Encoding", "") if self.headers else ""
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
            accept_encoding = self.headers.get("Accept-Encoding", "") if self.headers else ""
            
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
    server_address = ("", PORT)
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
