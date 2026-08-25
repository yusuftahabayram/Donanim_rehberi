/**
 * Main Application Logic for PC Hardware JSON Hub, PC Builder Wizard & Educational Hardware Guide
 */

document.addEventListener('DOMContentLoaded', async () => {
  const engine = new PCPartsDataEngine();

  const CORE_HARDWARE_KEYS = new Set([
    'cpu', 'gpu', 'video-card', 'motherboard', 'ram', 'memory',
    'storage', 'internal-hard-drive', 'external-hard-drive',
    'pccase', 'case', 'psu', 'power-supply', 'cpucooler', 'cpu-cooler',
    'case-fan', 'casefan', 'thermal-paste', 'thermalpaste', 'thermalcompound',
    'networkcard', 'wired-network-card', 'wireless-network-card',
    'sound-card', 'soundcard', 'fan-controller', 'fancontroller',
    'optical-drive', 'opticaldrive', 'ups'
  ]);

  const LAPTOP_KEYS = new Set([
    'laptop', 'notebook', 'prebuiltdesktop', 'os'
  ]);

  function getCategoryGroup(catKey) {
    const raw = String(catKey || '').toLowerCase().trim();
    const norm = raw.replace(/[^a-z0-9]/g, '');
    if (LAPTOP_KEYS.has(raw) || LAPTOP_KEYS.has(norm)) {
      return 'laptop';
    }
    if (CORE_HARDWARE_KEYS.has(raw) || CORE_HARDWARE_KEYS.has(norm)) {
      return 'hardware';
    }
    return 'accessories';
  }

  function isAccessoryCategory(catKey) {
    return getCategoryGroup(catKey) === 'accessories';
  }

  const CATEGORY_CANONICAL_MAP = {
    'gpu': 'GPU',
    'ram': 'RAM',
    'psu': 'PSU',
    'video-card': 'GPU',
    'cpu': 'CPU',
    'motherboard': 'Motherboard',
    'memory': 'RAM',
    'power-supply': 'PSU',
    'pccase': 'case',
    'cpu-cooler': 'CPUCooler'
  };

  const expandedGroups = new Set(['hardware']);

  // Category WebP Image Assets Mapping
  const WEBP_CATEGORY_IMAGES = {
    'CPU': 'assets/images/cpu.webp',
    'cpu': 'assets/images/cpu.webp',
    'GPU': 'assets/images/gpu.webp',
    'video-card': 'assets/images/gpu.webp',
    'gpu': 'assets/images/gpu.webp',
    'Motherboard': 'assets/images/motherboard.webp',
    'motherboard': 'assets/images/motherboard.webp',
    'RAM': 'assets/images/ram.webp',
    'memory': 'assets/images/ram.webp',
    'ram': 'assets/images/ram.webp',
    'Storage': 'assets/images/storage.webp',
    'internal-hard-drive': 'assets/images/storage.webp',
    'external-hard-drive': 'assets/images/storage.webp',
    'PCCase': 'assets/images/case.webp',
    'case': 'assets/images/case.webp',
    'PSU': 'assets/images/psu.webp',
    'power-supply': 'assets/images/psu.webp',
    'psu': 'assets/images/psu.webp',
    'CPUCooler': 'assets/images/cooler.webp',
    'cpu-cooler': 'assets/images/cooler.webp'
  };

  // Comprehensive Category Turkish Dictionary
  const CATEGORY_TR_MAP = {
    'Accessory': 'Aksesuar',
    'case-accessory': 'Kasa Aksesuarı',
    'CaptureCard': 'Yayın & Video Yakalama Kartı',
    'CaseFan': 'Kasa Fanı',
    'case-fan': 'Kasa Fanı',
    'Chair': 'Oyuncu Koltuğu',
    'CPU': 'İşlemci (CPU)',
    'cpu': 'İşlemci (CPU)',
    'CPUCooler': 'İşlemci Soğutucu',
    'cpu-cooler': 'İşlemci Soğutucu',
    'Desk': 'Oyuncu Masası',
    'GPU': 'Ekran Kartı (GPU)',
    'video-card': 'Ekran Kartı (GPU)',
    'gpu': 'Ekran Kartı (GPU)',
    'Headphones': 'Kulaklık',
    'headphones': 'Kulaklık',
    'Keyboard': 'Klavye',
    'keyboard': 'Klavye',
    'Laptop': 'Dizüstü Bilgisayar (Laptop)',
    'Lighting': 'Aydınlatma / RGB',
    'Microphone': 'Mikrofon',
    'Monitor': 'Monitör',
    'monitor': 'Monitör',
    'Motherboard': 'Anakart',
    'motherboard': 'Anakart',
    'Mouse': 'Fare (Mouse)',
    'mouse': 'Fare (Mouse)',
    'Mousepad': 'Mousepad',
    'NetworkCard': 'Ağ Kartı',
    'wired-network-card': 'Kablolu Ağ Kartı',
    'wireless-network-card': 'Kablosuz Wi-Fi Kartı',
    'OS': 'İşletim Sistemi',
    'os': 'İşletim Sistemi',
    'PCCase': 'Bilgisayar Kasası',
    'case': 'Bilgisayar Kasası',
    'PrebuiltDesktop': 'Hazır Sistem Masaüstü',
    'PSU': 'Güç Kaynağı (PSU)',
    'power-supply': 'Güç Kaynağı (PSU)',
    'psu': 'Güç Kaynağı (PSU)',
    'RAM': 'RAM Bellek',
    'memory': 'RAM Bellek',
    'ram': 'RAM Bellek',
    'SoundCard': 'Ses Kartı',
    'sound-card': 'Ses Kartı',
    'Speaker': 'Hoparlör',
    'speakers': 'Hoparlör',
    'Stand': 'Stant & Tutucu',
    'Storage': 'Depolama (SSD/HDD)',
    'internal-hard-drive': 'Dahili Depolama (SSD/HDD)',
    'external-hard-drive': 'Harici Disk',
    'storage': 'Depolama',
    'ThermalCompound': 'Termal Macun',
    'thermal-paste': 'Termal Macun',
    'VRHeadset': 'VR Sanal Gerçeklik Gözlüğü',
    'Webcam': 'Web Kamerası',
    'webcam': 'Web Kamerası',
    'fan-controller': 'Fan Kontrolcüsü',
    'optical-drive': 'Optik Sürücü',
    'ups': 'Kesintisiz Güç Kaynağı (UPS)'
  };

  // Category Visual Icons
  const CATEGORY_VISUALS = {
    'CPU': { icon: 'fa-microchip', bg: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
    'cpu': { icon: 'fa-microchip', bg: 'linear-gradient(135deg, #0284c7, #38bdf8)' },
    'GPU': { icon: 'fa-tv', bg: 'linear-gradient(135deg, #7c3aed, #c084fc)' },
    'video-card': { icon: 'fa-tv', bg: 'linear-gradient(135deg, #7c3aed, #c084fc)' },
    'gpu': { icon: 'fa-tv', bg: 'linear-gradient(135deg, #7c3aed, #c084fc)' },
    'Motherboard': { icon: 'fa-border-all', bg: 'linear-gradient(135deg, #059669, #34d399)' },
    'motherboard': { icon: 'fa-border-all', bg: 'linear-gradient(135deg, #059669, #34d399)' },
    'RAM': { icon: 'fa-memory', bg: 'linear-gradient(135deg, #d97706, #fbbf24)' },
    'memory': { icon: 'fa-memory', bg: 'linear-gradient(135deg, #d97706, #fbbf24)' },
    'ram': { icon: 'fa-memory', bg: 'linear-gradient(135deg, #d97706, #fbbf24)' },
    'Storage': { icon: 'fa-hard-drive', bg: 'linear-gradient(135deg, #0891b2, #22d3ee)' },
    'internal-hard-drive': { icon: 'fa-hard-drive', bg: 'linear-gradient(135deg, #0891b2, #22d3ee)' },
    'external-hard-drive': { icon: 'fa-floppy-disk', bg: 'linear-gradient(135deg, #0891b2, #22d3ee)' },
    'PCCase': { icon: 'fa-computer', bg: 'linear-gradient(135deg, #475569, #94a3b8)' },
    'case': { icon: 'fa-computer', bg: 'linear-gradient(135deg, #475569, #94a3b8)' },
    'PSU': { icon: 'fa-bolt', bg: 'linear-gradient(135deg, #dc2626, #f87171)' },
    'power-supply': { icon: 'fa-bolt', bg: 'linear-gradient(135deg, #dc2626, #f87171)' },
    'CPUCooler': { icon: 'fa-fan', bg: 'linear-gradient(135deg, #2563eb, #60a5fa)' },
    'cpu-cooler': { icon: 'fa-fan', bg: 'linear-gradient(135deg, #2563eb, #60a5fa)' }
  };

  // Spec Translation Dictionary
  const SPEC_LABEL_TR = {
    'name': 'Ürün Adı',
    'manufacturer': 'Üretici Marka',
    'vendor': 'Üretici Marka',
    'model': 'Model Adı',
    'socket': 'Soket Tipi',
    'cores': 'Çekirdek Yapısı',
    'total': 'Toplam Çekirdek Sayısı',
    'threads': 'İş Parçacığı (Threads)',
    'clocks': 'Çalışma Frekansları',
    'base': 'Temel Frekans (GHz)',
    'boost': 'Artırılmış Frekans (GHz)',
    'cache': 'Önbellek (Cache)',
    'l3': 'L3 Önbellek (MB)',
    'tdp': 'TDP Tüketim (Watt)',
    'eccSupport': 'ECC Desteği',
    'lithography': 'Üretim Teknolojisi',
    'releaseYear': 'Çıkış Yılı',
    'microarchitecture': 'Mikromimari',
    'form_factor': 'Form Faktörü',
    'general_product_information': 'Genel Ürün Bilgileri',
    'product_information': 'Ürün Bilgileri',
    'manufacturer_url': 'Üretici Web Sitesi'
  };

  // 8 Steps PC Builder Definition
  const BUILDER_STEPS = [
    { key: 'case', name: '1. Kasa', categoryName: 'PCCase', fallbackCat: 'case', icon: 'fa-computer' },
    { key: 'motherboard', name: '2. Anakart', categoryName: 'Motherboard', fallbackCat: 'motherboard', icon: 'fa-border-all' },
    { key: 'cpu', name: '3. İşlemci', categoryName: 'CPU', fallbackCat: 'cpu', icon: 'fa-microchip' },
    { key: 'gpu', name: '4. Ekran Kartı', categoryName: 'GPU', fallbackCat: 'video-card', icon: 'fa-tv' },
    { key: 'ram', name: '5. RAM Bellek', categoryName: 'RAM', fallbackCat: 'memory', icon: 'fa-memory' },
    { key: 'psu', name: '6. Güç Kaynağı', categoryName: 'PSU', fallbackCat: 'power-supply', icon: 'fa-bolt' },
    { key: 'storage', name: '7. Depolama', categoryName: 'Storage', fallbackCat: 'internal-hard-drive', icon: 'fa-hard-drive' },
    { key: 'cooler', name: '8. Soğutucu', categoryName: 'CPUCooler', fallbackCat: 'cpu-cooler', icon: 'fa-fan' }
  ];

  // Application State
  let currentDataset = 'unified';
  let currentCategory = '';
  let subBranchType = 'all';
  let currentPage = 1;
  let currentSearch = '';
  let currentManufacturer = '';
  let currentSortBy = 'releaseYear';
  let currentSortOrder = 'desc';
  let viewMode = 'grid';

  // Builder Wizard State
  let currentBuilderStepIndex = 0;
  let currentBuilderSearch = '';
  const buildCart = {
    case: null,
    motherboard: null,
    cpu: null,
    gpu: null,
    ram: null,
    psu: null,
    storage: null,
    cooler: null
  };

  // DOM Elements
  const navBtnExplorer = document.getElementById('nav-btn-explorer');
  const navBtnBuilder = document.getElementById('nav-btn-builder');
  const navBtnGuide = document.getElementById('nav-btn-guide');
  const viewExplorer = document.getElementById('view-explorer');
  const viewBuilder = document.getElementById('view-builder');
  const viewGuide = document.getElementById('view-guide');
  const viewCode = document.getElementById('view-code');
  const sidebar = document.getElementById('sidebar');



  const categoryListEl = document.getElementById('category-list');
  const categoryFilterInput = document.getElementById('category-filter-input');
  const categoryTotalBadge = document.getElementById('category-total-badge');
  const currentCategoryNameEl = document.getElementById('current-category-name');

  const subtabContainer = document.getElementById('subtab-container');
  const subtabBtns = document.querySelectorAll('.subtab-btn');

  const productsContainer = document.getElementById('products-container');
  const inputSearch = document.getElementById('input-search');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const selectManufacturer = document.getElementById('select-manufacturer');
  const selectSort = document.getElementById('select-sort');
  const btnSortOrder = document.getElementById('btn-sort-order');
  const resultsCountEl = document.getElementById('results-count-number');

  const btnViewGrid = document.getElementById('btn-view-grid');
  const btnViewTable = document.getElementById('btn-view-table');

  const pageInfoText = document.getElementById('page-info-text');
  const btnPrevPage = document.getElementById('btn-prev-page');
  const btnNextPage = document.getElementById('btn-next-page');
  const pageNumbersContainer = document.getElementById('page-numbers-container');

  // Builder Elements
  const wizardStepsTrack = document.getElementById('wizard-steps-track');
  const builderStepNum = document.getElementById('builder-step-num');
  const builderStepTitle = document.getElementById('builder-step-title');
  const builderSearchInput = document.getElementById('builder-search-input');
  const builderProductsContainer = document.getElementById('builder-products-container');
  const selectedPartsList = document.getElementById('selected-parts-list');
  const summaryTotalWatt = document.getElementById('summary-total-watt');
  const summaryWattBar = document.getElementById('summary-watt-bar');
  const noticeText = document.getElementById('compatibility-notice-text');
  const btnResetBuild = document.getElementById('btn-reset-build');
  const btnExportBuildTxt = document.getElementById('btn-export-build-txt');
  const btnExportBuildJson = document.getElementById('btn-export-build-json');

  // Guide Elements
  const guideSearchInput = document.getElementById('guide-search-input');
  const guideChips = document.querySelectorAll('.guide-chip');
  const guideCards = document.querySelectorAll('.guide-card');

  const btnExportJson = document.getElementById('btn-export-json');
  const btnToggleCode = document.getElementById('btn-toggle-code');

  const detailModal = document.getElementById('detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCloseModalFooter = document.getElementById('btn-close-modal-footer');
  const modalItemTitle = document.getElementById('modal-item-title');
  const modalItemIcon = document.getElementById('modal-item-icon');
  const modalFilePath = document.getElementById('modal-file-path');
  const detailSpecGrid = document.getElementById('detail-spec-grid');

  function getWebpImageForItem(item, catKey) {
    if (item.data?.image || item.data?.imageUrl) {
      return item.data.image || item.data.imageUrl;
    }
    return WEBP_CATEGORY_IMAGES[catKey] || WEBP_CATEGORY_IMAGES['CPU'];
  }

  // Initialize Data Engine
  try {
    const summary = await engine.init();
    updateSummaryChips(summary);
    await selectDataset(currentDataset);
    renderBuilderSummary();
    renderWizardStepsTrack();
  } catch (err) {
    showToast('Veri indeksi yüklenirken hata oluştu. Lütfen indexer betiğini çalıştırın.', 'error');
  }

  // Top Nav View Switchers
  navBtnExplorer.addEventListener('click', () => {
    navBtnExplorer.classList.add('active');
    navBtnBuilder.classList.remove('active');
    navBtnGuide.classList.remove('active');
    viewExplorer.classList.add('active');
    viewBuilder.classList.remove('active');
    viewGuide.classList.remove('active');
    viewCode.classList.remove('active');
    sidebar.style.display = 'flex';
  });

  navBtnBuilder.addEventListener('click', () => {
    navBtnBuilder.classList.add('active');
    navBtnExplorer.classList.remove('active');
    navBtnGuide.classList.remove('active');
    viewBuilder.classList.add('active');
    viewExplorer.classList.remove('active');
    viewGuide.classList.remove('active');
    viewCode.classList.remove('active');
    sidebar.style.display = 'none';
    loadBuilderStepItems();
  });

  navBtnGuide.addEventListener('click', () => {
    navBtnGuide.classList.add('active');
    navBtnExplorer.classList.remove('active');
    navBtnBuilder.classList.remove('active');
    viewGuide.classList.add('active');
    viewExplorer.classList.remove('active');
    viewBuilder.classList.remove('active');
    viewCode.classList.remove('active');
    sidebar.style.display = 'none';
  });

  // Guide Filters & Search Logic
  guideChips.forEach(chip => {
    chip.addEventListener('click', () => {
      guideChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterGuideArticles();
    });
  });

  guideSearchInput.addEventListener('input', debounce(() => {
    filterGuideArticles();
  }, 200));

  function filterGuideArticles() {
    const activeFilter = document.querySelector('.guide-chip.active')?.dataset.guideFilter || 'all';
    const q = guideSearchInput.value.toLowerCase().trim();

    guideCards.forEach(card => {
      const cat = card.dataset.category;
      const text = card.textContent.toLowerCase();

      const matchesCategory = activeFilter === 'all' || cat === activeFilter;
      const matchesSearch = !q || text.includes(q);

      if (matchesCategory && matchesSearch) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  }

  function getTrCategory(rawName) {
    return CATEGORY_TR_MAP[rawName] || rawName;
  }

  function getCategoryVisual(rawName) {
    return CATEGORY_VISUALS[rawName] || { icon: 'fa-box-open', bg: 'linear-gradient(135deg, #475569, #64748b)' };
  }

  function isMobileGpu(item) {
    const name = (item.name || '').toLowerCase();
    const dataStr = JSON.stringify(item.data || {}).toLowerCase();
    const mobileKeywords = ['laptop', 'mobile', 'max-q', 'max q', 'm gpu', 'mobile gpu', '4090m', '4080m', '3080m', '3070m', '3060m', '7900m', '7800m', 'arc a770m', 'radeon 780m', 'iris xe'];
    return mobileKeywords.some(kw => name.includes(kw) || dataStr.includes(kw));
  }

  function isMobileCpu(item) {
    const name = (item.name || '').toLowerCase();
    const dataStr = JSON.stringify(item.data || {}).toLowerCase();
    const mobileKeywords = ['laptop', 'mobile', 'notebook', '14900hx', '14700hx', '13900h', '13700h', 'ultra 7 155h', '7940hs', '7840hs', '7730u', 'bga'];
    return mobileKeywords.some(kw => name.includes(kw) || dataStr.includes(kw));
  }

  function updateSummaryChips(summary) {
    // Summary chips removed as only master dataset is active
  }

  async function selectDataset(datasetName) {
    if (productsContainer) {
      productsContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Kategoriler ve parçalar yükleniyor...</div>';
    }
    try {
      const indexData = await engine.loadDataset(datasetName);
      const categoryNames = Object.keys(indexData || {});
      if (categoryTotalBadge) {
        categoryTotalBadge.textContent = `${categoryNames.length} Kategori`;
      }

      if (categoryNames.length > 0) {
        const hardwareCats = categoryNames.filter(c => getCategoryGroup(c) === 'hardware');
        const defaultCat = hardwareCats.includes('CPU') ? 'CPU' : (hardwareCats[0] || categoryNames[0]);
        currentCategory = defaultCat;

        try {
          renderCategories(indexData);
        } catch (catErr) {
          console.error('[renderCategories Error]', catErr);
        }

        await loadItems();
      }
    } catch (err) {
      console.error('[selectDataset Error]', err);
      if (productsContainer) {
        productsContainer.innerHTML = `<div class="error-state"><i class="fa-solid fa-triangle-exclamation"></i> Veri yüklenemedi: ${escapeHtml(err.message || String(err))}</div>`;
      }
    }
  }

  function renderCategories(indexData) {
    if (!categoryListEl) return;
    const filterTerm = categoryFilterInput ? (categoryFilterInput.value || '').toLowerCase().trim() : '';
    categoryListEl.innerHTML = '';

    // Merge duplicates (gpu -> GPU, ram -> RAM, psu -> PSU)
    const mergedIndex = {};
    Object.keys(indexData || {}).forEach(rawCat => {
      const canonical = CATEGORY_CANONICAL_MAP[rawCat] || rawCat;
      if (!mergedIndex[canonical]) {
        mergedIndex[canonical] = [];
      }
      if (Array.isArray(indexData[rawCat])) {
        mergedIndex[canonical] = mergedIndex[canonical].concat(indexData[rawCat]);
      }
    });

    const allCatKeys = Object.keys(mergedIndex);
    const hwCats = [];
    const laptopCats = [];
    const accCats = [];

    allCatKeys.forEach(cat => {
      const trName = getTrCategory(cat);
      if (filterTerm && !trName.toLowerCase().includes(filterTerm) && !cat.toLowerCase().includes(filterTerm)) {
        return;
      }
      const grp = getCategoryGroup(cat);
      if (grp === 'laptop') {
        laptopCats.push(cat);
      } else if (grp === 'hardware') {
        hwCats.push(cat);
      } else {
        accCats.push(cat);
      }
    });

    if (filterTerm) {
      if (hwCats.length > 0) expandedGroups.add('hardware');
      if (laptopCats.length > 0) expandedGroups.add('laptop');
      if (accCats.length > 0) expandedGroups.add('accessories');
    }

    if (currentCategory) {
      const activeGrp = getCategoryGroup(currentCategory);
      expandedGroups.add(activeGrp);
    }

    function createCategoryItem(cat) {
      const trName = getTrCategory(cat);
      const visual = getCategoryVisual(cat);
      const itemCount = Array.isArray(mergedIndex[cat]) ? mergedIndex[cat].length : 0;
      const isActive = cat.toLowerCase() === (currentCategory || '').toLowerCase();

      const itemEl = document.createElement('div');
      itemEl.className = `category-item ${isActive ? 'active' : ''}`;
      itemEl.innerHTML = `
        <div class="cat-left">
          <i class="fa-solid ${visual.icon}"></i>
          <span>${escapeHtml(trName)}</span>
        </div>
        <span class="cat-count">${itemCount.toLocaleString()}</span>
      `;

      itemEl.addEventListener('click', async () => {
        document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
        itemEl.classList.add('active');
        currentCategory = cat;
        subBranchType = 'all';
        currentPage = 1;
        await loadItems();
      });
      return itemEl;
    }

    function createAccordionSection(groupKey, titleText, iconClass, catList) {
      if (catList.length === 0) return;

      const isOpen = expandedGroups.has(groupKey);

      const sectionWrapper = document.createElement('div');
      sectionWrapper.className = 'category-accordion-wrapper';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `category-accordion-btn ${isOpen ? 'open' : ''}`;
      btn.innerHTML = `
        <div class="accordion-title">
          <i class="fa-solid ${iconClass}"></i>
          <span>${escapeHtml(titleText)}</span>
        </div>
        <div class="accordion-right">
          <span class="accordion-count-badge">${catList.length} Alt Kategori</span>
          <i class="fa-solid fa-chevron-down chevron-icon"></i>
        </div>
      `;

      btn.addEventListener('click', () => {
        if (expandedGroups.has(groupKey)) {
          expandedGroups.delete(groupKey);
        } else {
          expandedGroups.add(groupKey);
        }
        renderCategories(indexData);
      });

      const subListContainer = document.createElement('div');
      subListContainer.className = `category-sub-list ${isOpen ? 'open' : ''}`;
      catList.forEach(cat => subListContainer.appendChild(createCategoryItem(cat)));

      sectionWrapper.appendChild(btn);
      sectionWrapper.appendChild(subListContainer);
      categoryListEl.appendChild(sectionWrapper);
    }

    createAccordionSection('hardware', 'Bilgisayar Donanımı', 'fa-microchip', hwCats);
    createAccordionSection('laptop', 'Dizüstü Bilgisayarlar', 'fa-laptop', laptopCats);
    createAccordionSection('accessories', 'Bilgisayar Aksesuarları', 'fa-headphones', accCats);
  }

  if (categoryFilterInput) {
    categoryFilterInput.addEventListener('input', () => {
      if (engine.indexes[currentDataset]) {
        renderCategories(engine.indexes[currentDataset]);
      }
    });
  }

  subtabBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      subtabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      subBranchType = btn.dataset.gpuType || 'all';
      currentPage = 1;
      await loadItems();
    });
  });

  async function loadItems() {
    try {
      const isGpuCategory = ['GPU', 'video-card', 'gpu'].includes(currentCategory);
      const isCpuCategory = ['CPU', 'cpu'].includes(currentCategory);
      const isSubBranchable = isGpuCategory || isCpuCategory;
      
      if (isSubBranchable && subtabContainer) {
        subtabContainer.style.display = 'block';
        const btn1 = subtabBtns[0];
        const btn2 = subtabBtns[1];
        const btn3 = subtabBtns[2];

        if (btn1 && btn2 && btn3) {
          if (isCpuCategory) {
            btn1.innerHTML = `<i class="fa-solid fa-layer-group"></i> Tüm İşlemciler <span class="subtab-count" id="count-gpu-all">0</span>`;
            btn2.innerHTML = `<i class="fa-solid fa-desktop"></i> Masaüstü İşlemcileri <span class="subtab-count" id="count-gpu-desktop">0</span>`;
            btn3.innerHTML = `<i class="fa-solid fa-laptop"></i> Mobil İşlemcileri <span class="subtab-count" id="count-gpu-mobile">0</span>`;
          } else {
            btn1.innerHTML = `<i class="fa-solid fa-layer-group"></i> Tüm Ekran Kartları <span class="subtab-count" id="count-gpu-all">0</span>`;
            btn2.innerHTML = `<i class="fa-solid fa-desktop"></i> Masaüstü Ekran Kartları <span class="subtab-count" id="count-gpu-desktop">0</span>`;
            btn3.innerHTML = `<i class="fa-solid fa-laptop-code"></i> Mobil Ekran Kartları <span class="subtab-count" id="count-gpu-mobile">0</span>`;
          }
        }
      } else if (subtabContainer) {
        subtabContainer.style.display = 'none';
      }

      if (currentCategoryNameEl) {
        currentCategoryNameEl.textContent = getTrCategory(currentCategory);
      }
      if (productsContainer) {
        productsContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Donanım parçaları yükleniyor...</div>';
      }

      const options = {
        search: currentSearch,
        manufacturer: currentManufacturer,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder,
        page: currentPage,
        limit: 24
      };

      const res = await engine.getItems(currentDataset, currentCategory, { ...options, limit: 10000 });
      let allCategoryItems = res.items || [];

      if (isSubBranchable) {
        const checker = isCpuCategory ? isMobileCpu : isMobileGpu;
        const mobileCount = allCategoryItems.filter(checker).length;
        const desktopCount = allCategoryItems.length - mobileCount;

        const countAllEl = document.getElementById('count-gpu-all');
        const countDesktopEl = document.getElementById('count-gpu-desktop');
        const countMobileEl = document.getElementById('count-gpu-mobile');
        if (countAllEl) countAllEl.textContent = allCategoryItems.length.toLocaleString();
        if (countDesktopEl) countDesktopEl.textContent = desktopCount.toLocaleString();
        if (countMobileEl) countMobileEl.textContent = mobileCount.toLocaleString();

        if (subBranchType === 'desktop') {
          allCategoryItems = allCategoryItems.filter(item => !checker(item));
        } else if (subBranchType === 'mobile') {
          allCategoryItems = allCategoryItems.filter(item => checker(item));
        }
      }

      const totalCount = allCategoryItems.length;
      const totalPages = Math.ceil(totalCount / options.limit) || 1;
      const startIndex = (currentPage - 1) * options.limit;
      const paginatedItems = allCategoryItems.slice(startIndex, startIndex + options.limit);

      if (resultsCountEl) {
        resultsCountEl.textContent = totalCount.toLocaleString();
      }

      populateManufacturerDropdown(allCategoryItems);
      renderProducts(paginatedItems);
      renderPagination(totalPages, currentPage);
    } catch (err) {
      console.error('[loadItems Error]', err);
      if (productsContainer) {
        productsContainer.innerHTML = `<div class="error-state"><i class="fa-solid fa-triangle-exclamation"></i> Donanım yükleme hatası: ${escapeHtml(err.message || String(err))}</div>`;
      }
    }
  }

  function populateManufacturerDropdown(items) {
    const mfgSet = new Set();
    items.forEach(i => {
      if (i.manufacturer && i.manufacturer !== 'Unknown') mfgSet.add(i.manufacturer);
    });

    const currentVal = selectManufacturer.value;
    selectManufacturer.innerHTML = '<option value="">Tüm Markalar</option>';
    Array.from(mfgSet).sort().forEach(mfg => {
      const opt = document.createElement('option');
      opt.value = mfg;
      opt.textContent = mfg;
      if (mfg === currentVal) opt.selected = true;
      selectManufacturer.appendChild(opt);
    });
  }

  function renderProducts(items) {
    productsContainer.innerHTML = '';
    
    if (items.length === 0) {
      productsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-folder-open"></i>
          <p>Arama kriterlerine uygun donanım parçası bulunamadı.</p>
        </div>
      `;
      return;
    }

    if (viewMode === 'table') {
      productsContainer.classList.add('table-mode');
    } else {
      productsContainer.classList.remove('table-mode');
    }

    const visual = getCategoryVisual(currentCategory);

    items.forEach(item => {
      const card = document.createElement('div');
      
      if (viewMode === 'table') {
        card.className = 'table-item';
        card.innerHTML = `
          <div class="table-thumb" style="background: ${visual.bg};">
            <i class="fa-solid ${visual.icon}"></i>
          </div>
          <div class="title-box">
            <h4>${escapeHtml(item.name)}</h4>
            <span class="card-mfg">${escapeHtml(item.manufacturer || 'Üretici Belirtilmedi')}</span>
          </div>
          <div class="rel-path-tag">${item.relPath}</div>
          <button class="btn btn-sm btn-secondary btn-detail"><i class="fa-solid fa-eye"></i> Detayları İncele</button>
        `;
      } else {
        card.className = 'part-card';
        const specBadges = extractSpecsPreview(item.data);
        const webpImg = getWebpImageForItem(item, currentCategory);

        const isGpuCat = ['GPU', 'video-card', 'gpu'].includes(currentCategory);
        const isCpuCat = ['CPU', 'cpu'].includes(currentCategory);

        let subBranchBadge = getTrCategory(currentCategory);
        if (isGpuCat) {
          subBranchBadge += ` • ${isMobileGpu(item) ? 'Mobil Ekran Kartı' : 'Masaüstü Ekran Kartı'}`;
        } else if (isCpuCat) {
          subBranchBadge += ` • ${isMobileCpu(item) ? 'Mobil İşlemci' : 'Masaüstü İşlemci'}`;
        }

        card.innerHTML = `
          <div class="product-banner" style="background: ${visual.bg};">
            <img src="${webpImg}" alt="${escapeHtml(item.name)}" class="product-img" loading="lazy" onerror="this.style.display='none'">
            <span class="category-badge-pill">${escapeHtml(subBranchBadge)}</span>
          </div>

          <div class="card-header">
            <div class="card-title-group">
              <span class="card-mfg">${escapeHtml(item.manufacturer || 'Üretici Belirtilmedi')}</span>
              <h4>${escapeHtml(item.name)}</h4>
            </div>
          </div>
          
          <div class="specs-list">
            ${specBadges.map(s => `<span class="spec-pill">${escapeHtml(s)}</span>`).join('')}
          </div>

          <div class="card-footer">
            <span class="rel-path-tag" title="${item.relPath}">${item.relPath}</span>
            <div class="card-actions">
              <button class="btn btn-sm btn-secondary btn-detail"><i class="fa-solid fa-eye"></i> İncele</button>
            </div>
          </div>
        `;
      }

      card.querySelector('.btn-detail').addEventListener('click', () => openDetailModal(item));
      productsContainer.appendChild(card);
    });
  }

  function extractSpecsPreview(data) {
    if (!data) return [];
    const specs = [];
    if (data.releaseYear) specs.push(`Çıkış Yılı: ${data.releaseYear}`);
    if (data.socket) specs.push(`Soket: ${data.socket}`);
    if (data.cores?.total) specs.push(`${data.cores.total} Çekirdek`);
    if (data.core_count) specs.push(`${data.core_count} Çekirdek`);
    if (data.microarchitecture) specs.push(`Mimari: ${data.microarchitecture}`);
    if (data.specifications?.tdp) specs.push(`TDP: ${data.specifications.tdp}W`);
    if (data.tdp) specs.push(`TDP: ${data.tdp}W`);
    if (data.memory?.types) specs.push(`Bellek: ${data.memory.types.join('/')}`);
    if (data.form_factor) specs.push(`Form: ${data.form_factor}`);
    if (data.graphics) specs.push(`Grafik: ${data.graphics}`);
    return specs.slice(0, 4);
  }

  function renderPagination(totalPages, currentPage) {
    pageInfoText.textContent = `Sayfa ${currentPage} / ${totalPages}`;
    btnPrevPage.disabled = currentPage <= 1;
    btnNextPage.disabled = currentPage >= totalPages;

    pageNumbersContainer.innerHTML = '';
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxButtons - 1);

    for (let i = start; i <= end; i++) {
      const btn = document.createElement('button');
      btn.className = `page-num ${i === currentPage ? 'active' : ''}`;
      btn.textContent = i;
      btn.addEventListener('click', async () => {
        currentPage = i;
        await loadItems();
      });
      pageNumbersContainer.appendChild(btn);
    }
  }

  // Builder Wizard Logic
  function renderWizardStepsTrack() {
    wizardStepsTrack.innerHTML = '';
    BUILDER_STEPS.forEach((step, idx) => {
      const isCompleted = buildCart[step.key] !== null;
      const isActive = idx === currentBuilderStepIndex;

      const stepBtn = document.createElement('div');
      stepBtn.className = `wizard-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`;
      stepBtn.innerHTML = `
        <div class="step-circle">${isCompleted ? '<i class="fa-solid fa-check"></i>' : (idx + 1)}</div>
        <span class="step-label">${step.name.split('. ')[1]}</span>
      `;

      stepBtn.addEventListener('click', () => {
        currentBuilderStepIndex = idx;
        renderWizardStepsTrack();
        loadBuilderStepItems();
      });

      wizardStepsTrack.appendChild(stepBtn);
    });
  }

  async function loadBuilderStepItems() {
    const currentStepConfig = BUILDER_STEPS[currentBuilderStepIndex];
    builderStepNum.textContent = `Adım ${currentBuilderStepIndex + 1} / 8`;
    builderStepTitle.textContent = `${currentStepConfig.name.split('. ')[1]} Seçimi`;

    builderProductsContainer.innerHTML = '<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Uyumlu parçalar kontrol ediliyor...</div>';

    const dataset = await engine.loadDataset(currentDataset);
    
    // Case-insensitive and robust dataset category resolution
    let catItems = dataset[currentStepConfig.categoryName] || 
                   dataset[currentStepConfig.categoryName.toLowerCase()] || 
                   dataset[currentStepConfig.fallbackCat] || 
                   dataset[currentStepConfig.fallbackCat?.toLowerCase()] || [];

    if (!catItems || catItems.length === 0) {
      const matchKey = Object.keys(dataset).find(k => 
        k.toLowerCase() === currentStepConfig.categoryName.toLowerCase() ||
        k.toLowerCase() === currentStepConfig.fallbackCat.toLowerCase() ||
        (currentStepConfig.key === 'storage' && (k.toLowerCase() === 'storage' || k.toLowerCase().includes('hard-drive')))
      );
      if (matchKey) catItems = dataset[matchKey];
    }

    if (currentBuilderSearch.trim()) {
      const q = currentBuilderSearch.toLowerCase().trim();
      catItems = catItems.filter(i => (i.name || '').toLowerCase().includes(q) || (i.manufacturer || '').toLowerCase().includes(q));
    }

    const evaluatedItems = catItems.map(item => {
      const compat = engine.checkCompatibility(item, currentStepConfig.key, buildCart);
      return { ...item, compatibility: compat };
    });

    evaluatedItems.sort((a, b) => (b.compatibility.isCompatible ? 1 : 0) - (a.compatibility.isCompatible ? 1 : 0));

    updateNoticeBanner(currentStepConfig, evaluatedItems.length);
    renderBuilderProducts(evaluatedItems, currentStepConfig);
  }

  function updateNoticeBanner(stepConfig, itemCount) {
    let notice = `Seçilen önceki parçalara göre <strong>${itemCount}</strong> adet uyumlu ürün inceleniyor.`;
    if (buildCart.motherboard && (stepConfig.key === 'cpu' || stepConfig.key === 'ram')) {
      const mbSocket = buildCart.motherboard.data.socket || 'Soket Belirtilmedi';
      notice = `Anakart seçiminiz: <strong>${buildCart.motherboard.name} (${mbSocket})</strong>. Sadece bu soket ve bellek yapısıyla uyumlu ürünler önerilmektedir.`;
    } else if (stepConfig.key === 'storage' && buildCart.motherboard) {
      const mbData = buildCart.motherboard.data || {};
      const m2Slots = mbData.m2_slots || (mbData.storage_devices ? mbData.storage_devices.m2_slots : null);
      let hasM2 = false;
      if (Array.isArray(m2Slots)) hasM2 = m2Slots.length > 0;
      else if (typeof m2Slots === 'number') hasM2 = m2Slots > 0;
      else if (m2Slots) hasM2 = true;
      else {
        const mbStr = JSON.stringify(mbData).toLowerCase();
        hasM2 = mbStr.includes('m.2') || mbStr.includes('nvme');
      }

      if (hasM2) {
        notice = `Anakart seçiminiz (<strong>${buildCart.motherboard.name}</strong>) M.2 slotuna sahiptir. M.2 NVMe SSD, SATA SSD ve HDD sürücülerinin tümü önerilmektedir.`;
      } else {
        notice = `Anakart seçiminiz (<strong>${buildCart.motherboard.name}</strong>) üzerinde M.2 slotu bulunmamaktadır. Yalnızca SATA SSD ve HDD sürücüleri önerilmektedir (M.2 SSD'ler devredışı bırakılmıştır).`;
      }
    }
    noticeText.innerHTML = notice;
  }

  function renderBuilderProducts(items, stepConfig) {
    builderProductsContainer.innerHTML = '';

    if (items.length === 0) {
      builderProductsContainer.innerHTML = '<div class="empty-state"><p>Bu adım için parça bulunamadı.</p></div>';
      return;
    }

    const visual = getCategoryVisual(stepConfig.categoryName);
    const selectedInCart = buildCart[stepConfig.key];

    items.slice(0, 36).forEach(item => {
      const isSelected = selectedInCart && selectedInCart.id === item.id;
      const isCompat = item.compatibility.isCompatible;
      const webpImg = getWebpImageForItem(item, stepConfig.categoryName);

      const card = document.createElement('div');
      card.className = `part-card builder-card ${isSelected ? 'selected-in-cart' : ''} ${!isCompat ? 'incompatible-card' : ''}`;
      
      const specBadges = extractSpecsPreview(item.data);
      const compatReason = item.compatibility.reasons[0] || '✓ Uyumlu';

      card.innerHTML = `
        <div class="product-banner" style="background: ${visual.bg};">
          <img src="${webpImg}" alt="${escapeHtml(item.name)}" class="product-img" loading="lazy" onerror="this.style.display='none'">
          <span class="category-badge-pill">${isCompat ? '<i class="fa-solid fa-check"></i> Uyumlu' : '❌ Uyumsuz'}</span>
        </div>

        <div class="card-header">
          <div class="card-title-group">
            <span class="card-mfg">${escapeHtml(item.manufacturer || 'Üretici')}</span>
            <h4>${escapeHtml(item.name)}</h4>
          </div>
        </div>

        <div class="specs-list">
          ${specBadges.map(s => `<span class="spec-pill">${escapeHtml(s)}</span>`).join('')}
        </div>

        <div class="builder-compat-status ${isCompat ? 'yes' : 'no'}">
          ${escapeHtml(compatReason)}
        </div>

        <div class="card-footer">
          <button class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-select-part">
            ${isSelected ? '<i class="fa-solid fa-circle-check"></i> Seçildi' : '<i class="fa-solid fa-plus"></i> Bu Parçayı Seç'}
          </button>
        </div>
      `;

      card.querySelector('.btn-select-part').addEventListener('click', () => {
        buildCart[stepConfig.key] = item;
        showToast(`${stepConfig.name.split('. ')[1]} olarak "${item.name}" seçildi!`, 'success');
        
        if (currentBuilderStepIndex < BUILDER_STEPS.length - 1) {
          currentBuilderStepIndex++;
        }

        renderWizardStepsTrack();
        renderBuilderSummary();
        loadBuilderStepItems();
      });

      builderProductsContainer.appendChild(card);
    });
  }

  function renderBuilderSummary() {
    selectedPartsList.innerHTML = '';
    const estTdp = engine.calculateEstimatedTdp(buildCart);

    summaryTotalWatt.textContent = `${estTdp}W`;
    const wattPercent = Math.min(100, Math.round((estTdp / 1000) * 100));
    summaryWattBar.style.width = `${wattPercent}%`;

    BUILDER_STEPS.forEach((step, idx) => {
      const selectedItem = buildCart[step.key];
      const itemEl = document.createElement('div');
      itemEl.className = `summary-item ${selectedItem ? 'filled' : 'empty'}`;

      if (selectedItem) {
        itemEl.innerHTML = `
          <div class="summary-item-left">
            <div class="summary-item-icon"><i class="fa-solid ${step.icon}"></i></div>
            <div class="summary-item-text">
              <span class="step-cat">${step.name}</span>
              <strong>${escapeHtml(selectedItem.name)}</strong>
            </div>
          </div>
          <button class="btn-remove-part" title="Parçayı Çıkar"><i class="fa-solid fa-times"></i></button>
        `;

        itemEl.querySelector('.btn-remove-part').addEventListener('click', () => {
          buildCart[step.key] = null;
          renderWizardStepsTrack();
          renderBuilderSummary();
          if (viewBuilder.classList.contains('active')) {
            loadBuilderStepItems();
          }
        });
      } else {
        itemEl.innerHTML = `
          <div class="summary-item-left">
            <div class="summary-item-icon"><i class="fa-solid ${step.icon}"></i></div>
            <div class="summary-item-text">
              <span class="step-cat">${step.name}</span>
              <span class="placeholder-text">Henüz Seçilmedi</span>
            </div>
          </div>
        `;

        itemEl.addEventListener('click', () => {
          currentBuilderStepIndex = idx;
          renderWizardStepsTrack();
          loadBuilderStepItems();
        });
      }

      selectedPartsList.appendChild(itemEl);
    });
  }

  btnResetBuild.addEventListener('click', () => {
    BUILDER_STEPS.forEach(s => buildCart[s.key] = null);
    currentBuilderStepIndex = 0;
    renderWizardStepsTrack();
    renderBuilderSummary();
    loadBuilderStepItems();
    showToast('Tüm parça seçimleri sıfırlandı.', 'success');
  });

  btnExportBuildTxt.addEventListener('click', () => {
    let txt = `==================================================\n`;
    txt += `TOPLANAN BİLGİSAYAR SİSTEMİ ÖZETİ\n`;
    txt += `Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}\n`;
    txt += `Tahmini Toplam Güç Tüketimi: ${engine.calculateEstimatedTdp(buildCart)}W\n`;
    txt += `==================================================\n\n`;

    BUILDER_STEPS.forEach(step => {
      const part = buildCart[step.key];
      txt += `${step.name.toUpperCase()}:\n`;
      if (part) {
        txt += `  - Model: ${part.name}\n`;
        txt += `  - Üretici: ${part.manufacturer}\n`;
        txt += `  - Dosya Yolu: ${part.relPath}\n`;
      } else {
        txt += `  - (Seçilmedi)\n`;
      }
      txt += `\n`;
    });

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Toplanan-Sistem-${Date.now()}.txt`;
    a.click();
    showToast('Sistem özeti TXT olarak indirildi!', 'success');
  });

  if (btnExportBuildJson) {
    btnExportBuildJson.addEventListener('click', () => {
      const buildExportObj = {
        createdAt: new Date().toISOString(),
        estimatedTdpWatt: engine.calculateEstimatedTdp(buildCart),
        components: {}
      };

      BUILDER_STEPS.forEach(step => {
        const part = buildCart[step.key];
        if (part) {
          buildExportObj.components[step.key] = part.data;
        }
      });

      const jsonStr = JSON.stringify(buildExportObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Toplanan-Sistem-${Date.now()}.json`;
      a.click();
      showToast('Sistem şeması JSON olarak indirildi!', 'success');
    });
  }

  builderSearchInput.addEventListener('input', debounce((e) => {
    currentBuilderSearch = e.target.value;
    loadBuilderStepItems();
  }, 300));

  // Controls Event Listeners
  inputSearch.addEventListener('input', debounce(async (e) => {
    currentSearch = e.target.value;
    btnClearSearch.style.display = currentSearch ? 'block' : 'none';
    currentPage = 1;
    await loadItems();
  }, 300));

  btnClearSearch.addEventListener('click', async () => {
    inputSearch.value = '';
    currentSearch = '';
    btnClearSearch.style.display = 'none';
    currentPage = 1;
    await loadItems();
  });

  selectManufacturer.addEventListener('change', async (e) => {
    currentManufacturer = e.target.value;
    currentPage = 1;
    await loadItems();
  });

  selectSort.addEventListener('change', async (e) => {
    currentSortBy = e.target.value;
    await loadItems();
  });

  btnSortOrder.addEventListener('click', async () => {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    btnSortOrder.querySelector('i').className = `fa-solid fa-sort-amount-${currentSortOrder === 'asc' ? 'down' : 'up'}`;
    await loadItems();
  });

  btnViewGrid.addEventListener('click', () => {
    viewMode = 'grid';
    btnViewGrid.classList.add('active');
    btnViewTable.classList.remove('active');
    loadItems();
  });

  btnViewTable.addEventListener('click', () => {
    viewMode = 'table';
    btnViewTable.classList.add('active');
    btnViewGrid.classList.remove('active');
    loadItems();
  });

  btnPrevPage.addEventListener('click', async () => {
    if (currentPage > 1) {
      currentPage--;
      await loadItems();
    }
  });

  btnNextPage.addEventListener('click', async () => {
    currentPage++;
    await loadItems();
  });

  // Read-Only Detail Modal Handler
  function openDetailModal(item) {
    const visual = getCategoryVisual(currentCategory);
    modalItemTitle.textContent = item.name;
    if (modalFilePath) modalFilePath.style.display = 'none';
    modalItemIcon.innerHTML = `<i class="fa-solid ${visual.icon}"></i>`;
    modalItemIcon.style.background = visual.bg;

    renderTurkishDetailSpecGrid(item.data);
    detailModal.classList.add('active');
  }

  function formatTurkishValue(val) {
    if (val === true) return '<span class="badge-bool yes"><i class="fa-solid fa-check"></i> Evet / Var</span>';
    if (val === false) return '<span class="badge-bool no"><i class="fa-solid fa-xmark"></i> Hayır / Yok</span>';
    if (Array.isArray(val)) return val.map(v => `<span class="array-tag">${escapeHtml(String(v))}</span>`).join(' ');
    if (val === null || val === undefined || val === '') return '<span class="val-muted">Belirtilmedi</span>';
    if (typeof val === 'string' && val.startsWith('http')) {
      return `<a href="${val}" target="_blank" rel="noopener" class="spec-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Bağlantıyı Aç</a>`;
    }
    return escapeHtml(String(val));
  }

  function formatLabel(key) {
    if (SPEC_LABEL_TR[key]) return SPEC_LABEL_TR[key];
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function renderTurkishDetailSpecGrid(data, containerEl = detailSpecGrid, parentKey = '') {
    containerEl.innerHTML = '';
    if (!data) return;

    Object.keys(data).forEach(key => {
      const lowerKey = key.toLowerCase();
      const lowerParentKey = parentKey.toLowerCase();

      // Under general_product_information, keep ONLY manufacturer_url
      if (
        (lowerParentKey.includes('product_information') || lowerParentKey.includes('productinformation')) &&
        key !== 'manufacturer_url'
      ) {
        return;
      }

      if (
        key === 'price' ||
        key === 'price_usd' ||
        lowerKey === 'opendb_id' ||
        lowerKey === 'id' ||
        lowerKey === 'json_id' ||
        lowerKey === 'opendbid' ||
        lowerKey === 'jsonid' ||
        lowerKey.includes('opendb')
      ) return;

      const val = data[key];
      const trLabel = formatLabel(key);

      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        const groupCard = document.createElement('div');
        groupCard.className = 'spec-detail-group-card';
        groupCard.innerHTML = `<h5 class="spec-group-title"><i class="fa-solid fa-circle-dot"></i> ${escapeHtml(trLabel)}</h5>`;
        
        const subGrid = document.createElement('div');
        subGrid.className = 'detail-spec-grid inner';
        renderTurkishDetailSpecGrid(val, subGrid, key);
        
        if (subGrid.children.length > 0) {
          groupCard.appendChild(subGrid);
          containerEl.appendChild(groupCard);
        }
      } else {
        const card = document.createElement('div');
        card.className = 'spec-detail-card';
        const formattedVal = formatTurkishValue(val);

        card.innerHTML = `
          <span class="spec-name">${escapeHtml(trLabel)}</span>
          <div class="spec-val">${formattedVal}</div>
        `;
        containerEl.appendChild(card);
      }
    });
  }

  btnCloseModal.addEventListener('click', () => detailModal.classList.remove('active'));
  btnCloseModalFooter.addEventListener('click', () => detailModal.classList.remove('active'));

  // Export Category JSON
  if (btnExportJson) {
    btnExportJson.addEventListener('click', async () => {
      const jsonStr = await engine.exportCategory(currentDataset, currentCategory);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentDataset}-${getTrCategory(currentCategory)}.json`;
      a.click();
      showToast(`${getTrCategory(currentCategory)}.json dosyası indirildi!`, 'success');
    });
  }

  // Code Integration Tab Toggle
  let showingCodeView = false;
  if (btnToggleCode) {
    btnToggleCode.addEventListener('click', () => {
      showingCodeView = !showingCodeView;
      if (showingCodeView) {
        viewExplorer.classList.remove('active');
        viewBuilder.classList.remove('active');
        viewGuide.classList.remove('active');
        viewCode.classList.add('active');
        btnToggleCode.innerHTML = '<i class="fa-solid fa-table"></i> Explorer\'a Dön';
        sidebar.style.display = 'none';
      } else {
        viewCode.classList.remove('active');
        viewExplorer.classList.add('active');
        btnToggleCode.innerHTML = '<i class="fa-solid fa-code"></i> Kod Entegrasyonu';
        sidebar.style.display = 'flex';
      }
    });
  }

  // ==========================================================================
  // GEMINI AI & RAG CHATBOT UI LOGIC
  // ==========================================================================
  const chatToggleBtn = document.getElementById('chat-widget-toggle');
  const chatWindow = document.getElementById('chat-window');
  const chatCloseBtn = document.getElementById('btn-close-chat');
  const chatClearBtn = document.getElementById('btn-clear-chat');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatTyping = document.getElementById('chat-typing');
  const chatBody = document.getElementById('chat-body');
  const chatSuggestions = document.getElementById('chat-suggestions');

  let chatHistory = [];

  if (chatToggleBtn && chatWindow) {
    chatToggleBtn.addEventListener('click', () => {
      const isVisible = chatWindow.style.display !== 'none';
      chatWindow.style.display = isVisible ? 'none' : 'flex';
      if (!isVisible && chatInput) chatInput.focus();
    });

    if (chatCloseBtn) {
      chatCloseBtn.addEventListener('click', () => {
        chatWindow.style.display = 'none';
      });
    }

    if (chatClearBtn) {
      chatClearBtn.addEventListener('click', () => {
        chatHistory = [];
        if (chatMessagesContainer) chatMessagesContainer.innerHTML = '';
        if (chatSuggestions) chatSuggestions.style.display = 'flex';
        showToast('Sohbet geçmişi temizlendi.', 'success');
      });
    }

    // Handle suggestion chips
    if (chatSuggestions) {
      chatSuggestions.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip-btn');
        if (chip && chip.dataset.query) {
          if (chatInput) chatInput.value = chip.dataset.query;
          submitChatMessage(chip.dataset.query);
        }
      });
    }

    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = (chatInput?.value || '').trim();
        if (msg) {
          submitChatMessage(msg);
          if (chatInput) chatInput.value = '';
        }
      });
    }
  }

  async function submitChatMessage(userText) {
    if (!userText) return;

    // Hide suggestion chips once user starts chatting
    if (chatSuggestions) chatSuggestions.style.display = 'none';

    // 1. Render User Message
    appendChatMessage('user', userText);
    chatHistory.push({ role: 'user', content: userText });

    // 2. Show Typing Indicator
    if (chatTyping) chatTyping.style.display = 'flex';
    scrollToBottom();

    try {
      // 3. Call Backend RAG + Gemini Chat API
      const res = await engine.sendChatMessage(userText, chatHistory);

      // Hide Typing Indicator
      if (chatTyping) chatTyping.style.display = 'none';

      const botAnswer = res.answer || 'Yanıt oluşturulamadı.';
      const recProducts = res.recommendedProducts || [];

      // 4. Render Bot Response
      appendChatMessage('bot', botAnswer, recProducts);
      chatHistory.push({ role: 'model', content: botAnswer });

    } catch (err) {
      if (chatTyping) chatTyping.style.display = 'none';
      appendChatMessage('bot', `⚠️ Bir hata oluştu: ${escapeHtml(err.message || String(err))}`);
    }

    scrollToBottom();
  }

  function appendChatMessage(sender, text, recommendedProducts = []) {
    if (!chatMessagesContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender === 'user' ? 'user-message' : 'bot-message'}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (sender === 'user') {
      contentDiv.textContent = text;
    } else {
      contentDiv.innerHTML = parseMarkdownToHtml(text);

      // Append recommended products if present
      if (recommendedProducts && recommendedProducts.length > 0) {
        const recTitle = document.createElement('div');
        recTitle.className = 'rec-products-title';
        recTitle.innerHTML = '<i class="fa-solid fa-microchip"></i> İlgili Donanım Ürünleri:';
        contentDiv.appendChild(recTitle);

        const recGrid = document.createElement('div');
        recGrid.className = 'chat-rec-grid';

        recommendedProducts.slice(0, 3).forEach(prod => {
          const card = document.createElement('div');
          card.className = 'chat-rec-card';
          const formattedPrice = prod.price && prod.price > 0 ? `$${prod.price}` : '';
          card.innerHTML = `
            <div>
              <div class="chat-rec-name">${escapeHtml(prod.name || 'Bilinmeyen Ürün')}</div>
              <div class="chat-rec-meta">${escapeHtml(prod.category || '')} • ${escapeHtml(prod.manufacturer || '')} <span class="chat-rec-price">${formattedPrice}</span></div>
            </div>
            <button class="chat-rec-btn" title="Detay"><i class="fa-solid fa-eye"></i> İncele</button>
          `;

          const inspectBtn = card.querySelector('.chat-rec-btn');
          if (inspectBtn && prod.relPath) {
            inspectBtn.addEventListener('click', () => {
              openChatProductModal(prod);
            });
          }
          recGrid.appendChild(card);
        });

        contentDiv.appendChild(recGrid);
      }
    }

    msgDiv.appendChild(contentDiv);
    chatMessagesContainer.appendChild(msgDiv);
    scrollToBottom();
  }

  async function openChatProductModal(prod) {
    try {
      showToast(`${prod.name} detayı yükleniyor...`, 'success');
      const itemData = await fetchProductByRelPath(prod.relPath);
      if (itemData) {
        const fullItem = {
          id: prod.id,
          name: prod.name,
          manufacturer: prod.manufacturer,
          price: prod.price,
          relPath: prod.relPath,
          data: itemData
        };
        openDetailModal(fullItem);
      }
    } catch (e) {
      console.error('Error opening chat product modal:', e);
      showToast('Ürün detayları yüklenemedi.', 'warning');
    }
  }

  async function fetchProductByRelPath(relPath) {
    if (!relPath) return null;
    const res = await fetch(`/${relPath}`);
    if (!res.ok) return null;
    return await res.json();
  }

  function scrollToBottom() {
    if (chatBody) {
      setTimeout(() => {
        chatBody.scrollTop = chatBody.scrollHeight;
      }, 50);
    }
  }

  function parseMarkdownToHtml(mdText) {
    if (!mdText) return '';
    let html = escapeHtml(mdText);

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code `code`
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    // Headers # text
    html = html.replace(/^### (.*$)/gim, '<h5 style="margin:6px 0;color:#00dfd8;">$1</h5>');
    html = html.replace(/^## (.*$)/gim, '<h4 style="margin:8px 0;color:#00dfd8;">$1</h4>');

    // Convert bullet lists
    const lines = html.split('\n');
    let inList = false;
    let result = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          inList = true;
          result.push('<ul style="margin:4px 0;padding-left:18px;">');
        }
        result.push(`<li>${trimmed.substring(2)}</li>`);
      } else {
        if (inList) {
          inList = false;
          result.push('</ul>');
        }
        if (trimmed) {
          result.push(`<p>${line}</p>`);
        }
      }
    });

    if (inList) result.push('</ul>');
    return result.join('');
  }

  function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'triangle-exclamation'}"></i> ${msg}`;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});
