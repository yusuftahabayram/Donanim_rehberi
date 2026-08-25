# Donanım Rehberi & PC Toplama Simülatörü 💻

Donanım Rehberi; binlerce bilgisayar bileşenini (İşlemci, Ekran Kartı, RAM, Anakart, SSD vb.) aramanızı, karşılaştırmanızı, parça uyumluluk kontrolleriyle sistem toplamanızı ve **Google Gemini + ChromaDB (RAG)** altyapısıyla yapay zekaya sistem önerisi yaptırmanızı sağlayan bir donanım keşif platformudur.

---

## 🚀 Öne Çıkan Özellikler

- **🔍 Gelişmiş Donanım Kataloğu:**
  - BuildCores, PC Part Dataset ve TechFuel veri kaynaklarından birleştirilmiş binlerce ürün.
  - Kategoriye, markaya, mimariye ve teknik özelliklere göre hızlı arama ve filtreleme.
  - Ürün detaylarını yerel veritabanında güncelleyebilme imkanı.

- **🛠️ Akıllı PC Toplama Simülatörü (PC Builder):**
  - İşlemci (CPU), Ekran Kartı (GPU), Anakart, RAM, Depolama (M.2/SATA), Güç Kaynağı (PSU) ve Kasa seçimi.
  - **Uyumluluk Kontrolü:** Soket uyumu, M.2 slot desteği ve tahmini güç tüketimi hesabı.
  - Seçilen sistemin özetini görüntüleme ve dışa aktarma.

- **🤖 Yapay Zeka Destekli Asistan (Gemini + ChromaDB RAG):**
  - Doğal dilde soru sorarak sistem önerisi alma (örn. *"70.000 TL bütçe ile oyun bilgisayarı tavsiyesi ver"*).
  - ChromaDB vektör veritabanından sorgulanan gerçek donanım verileriyle desteklenmiş doğru yanıtlar.

- **⚡ Hafif ve Hızlı Mimarisi:**
  - Bağımlılık karmaşası olmadan saf Python (`http.server`) ile çalışan Gzip destekli HTTP sunucu.
  - Framework (React, Vue vb.) yükü olmayan hızlı Vanilla JavaScript & CSS arayüzü.

---

## 🛠️ Kullanılan Teknolojiler

- **Backend / Sunucu:** Python 3 (`http.server`, `socketserver`)
- **Yapay Zeka & Vektör DB:** Google Gemini API (`google-genai`), ChromaDB
- **Frontend:** HTML5, Modern Vanilla CSS (CSS Variables, Responsive Layout), JavaScript (ES6+)
- **Veri İndeksleme & İşleme:** Python Scripts (`pandas`, `chromadb`, custom indexer)

---

## 📂 Proje Yapısı

```text
Donanim_Rehberi/
├── app.js                   # Frontend uygulama mantığı (Arama, Liste, UI)
├── pcDataEngine.js          # PC Builder & Uyumluluk kontrol motoru
├── server.py                # Python HTTP sunucusu ve API endpoint'leri (/api/chat, /api/index vb.)
├── styles.css               # Modern karanlık/aydınlık tema ve UI stilleri
├── index.html               # Ana sayfa ve SPA arayüzü
├── .env.example             # Örnek ortam değişkenleri dosyası
├── data/                    # İndekslenmiş JSON veri kümeleri (unified-index.json vb.)
├── scripts/                 # Veri işleme ve vektör veritabanı betikleri
│   ├── indexer.py           # JSON verilerini tekilleştirip birleştiren betik
│   ├── build_vector_db.py   # ChromaDB vektör veritabanını oluşturan betik
│   └── query_chat.py        # CLI üzerinden RAG / Gemini test betiği
└── docs/                    # Proje dokümantasyonu ve kod örnekleri
```

---

## ⚙️ Kurulum ve Çalıştırma

### 1. Gereksinimler
- Python 3.9+
- Pip ve temel Python kütüphaneleri (Opsiyonel AI özellikleri için `chromadb`, `google-genai`)

### 2. Ortam Değişkenleri (`.env`)
AI Chatbot özelliğini kullanmak istiyorsanız projenin ana dizininde bir `.env` dosyası oluşturun:

```env
GEMINI_API_KEY=senin_gemini_api_anahtarin
```

*(Not: `.env` dosyası yoksa veya API anahtarı girilmezse uygulama çalışmaya devam eder, yalnızca AI sohbet modülü uyarı verir.)*

### 3. Sunucuyu Başlatma
Uygulamayı çalıştırmak için terminalde şu komutu çalıştırın:

```bash
python server.py
```
Veya (Node.js/npm kurulu ise):
```bash
npm start
```

Sunucu başladıktan sonra tarayıcınızda `http://localhost:3000` adresine gidin.

---

## 📊 Veri İndeksleme ve Vektör Veritabanı (Opsiyonel)

Ham verileri yeniden işlemek veya ChromaDB veritabanını güncellemek isterseniz:

1. **Verileri Tekilleştirme ve İndeksleme:**
   ```bash
   python scripts/indexer.py
   ```
2. **ChromaDB Vektör Veritabanını Oluşturma:**
   ```bash
   python scripts/build_vector_db.py
   ```

---

## 📜 Lisans

Bu proje [MIT License](LICENSE) altında lisanslanmıştır.
