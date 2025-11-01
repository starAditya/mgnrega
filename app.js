// app.js - Frontend logic for UP MGNREGA dashboard
// Configure API_BASE to your backend endpoint; default assumes /api
const API_BASE = '/api'; // e.g. 'https://13.127.45.120:8000/api'
document.getElementById('apiBaseSpan')?.textContent = API_BASE;

const stateSelect = document.getElementById('stateSelect');
const districtSelect = document.getElementById('districtSelect');
const geoBtn = document.getElementById('geoBtn');
const getBtn = document.getElementById('getBtn');
const errorEl = document.getElementById('error');
const resultArea = document.getElementById('resultArea');

const trendCtx = document.getElementById('trendChart').getContext('2d');
const barCtx = document.getElementById('barChart').getContext('2d');
let trendChart = null, barChart = null;

// UP districts sample list (common districts)
// You may expand this list or replace by backend API call.
const UP_DISTRICTS = [
  "Agra","Aligarh","Prayagraj","Lucknow","Varanasi","Gorakhpur","Meerut","Moradabad","Faizabad","Kanpur Nagar",
  "Kanpur Dehat","Bareilly","Saharanpur","Jhansi","Mathura","Gautam Buddha Nagar","Ballia","Sultanpur","Rampur","Azamgarh",
  "Mau","Budaun","Ghaziabad","Firozabad","Etawah","Etah","Bijnor","Shahjahanpur","Sambhal","Bahraich"
];

// Sample fallback data (newest first)
const SAMPLE_DATA = [
  {month:"2025-10", households_worked:221000, persondays:760000, expenditure:52000000, female_pct:46.2},
  {month:"2025-09", households_worked:198500, persondays:710000, expenditure:48000000, female_pct:45.8},
  {month:"2025-08", households_worked:175000, persondays:650000, expenditure:44000000, female_pct:45.0},
  {month:"2025-07", households_worked:160200, persondays:600000, expenditure:40000000, female_pct:44.6},
  {month:"2025-06", households_worked:150000, persondays:560000, expenditure:38000000, female_pct:44.0},
  {month:"2025-05", households_worked:139000, persondays:520000, expenditure:35000000, female_pct:43.5},
  {month:"2025-04", households_worked:128000, persondays:480000, expenditure:33000000, female_pct:43.1},
  {month:"2025-03", households_worked:118000, persondays:450000, expenditure:30000000, female_pct:42.8},
  {month:"2025-02", households_worked:110000, persondays:420000, expenditure:28000000, female_pct:42.0},
  {month:"2025-01", households_worked:102000, persondays:400000, expenditure:26000000, female_pct:41.5}
];

function showError(msg){
  if(!errorEl) return;
  errorEl.style.display = 'block';
  errorEl.textContent = msg;
}
function clearError(){
  if(!errorEl) return;
  errorEl.style.display = 'none';
  errorEl.textContent = '';
}

function populateDistricts(){
  districtSelect.innerHTML = '<option>— जिला चुनें —</option>';
  UP_DISTRICTS.forEach(d=>{
    const opt = document.createElement('option'); opt.value = d; opt.textContent = d;
    districtSelect.appendChild(opt);
  });
}

// Fetch district list from backend (optional)
async function loadDistrictsFromApi(state){
  try {
    const res = await fetch(`${API_BASE}/districts/${encodeURIComponent(state)}`, {cache: 'no-store'});
    if(!res.ok) throw new Error('API districts error '+res.status);
    const data = await res.json();
    if(data.districts && data.districts.length){
      districtSelect.innerHTML = '<option>— जिला चुनें —</option>';
      data.districts.forEach(d=>{
        const opt = document.createElement('option'); opt.value = d; opt.textContent = d;
        districtSelect.appendChild(opt);
      });
      clearError();
      return;
    }
  } catch (err){
    console.warn('districts API failed', err);
    // fallback to built-in list
    populateDistricts();
    showError('सर्वर से जिले नहीं मिले — स्थानीय सूची दिखाई जा रही है।');
  }
}

async function fetchDistrictData(state, district){
  try {
    const res = await fetch(`${API_BASE}/data/${encodeURIComponent(state)}/${encodeURIComponent(district)}?months=12`, {cache:'no-store'});
    if(!res.ok) throw new Error('API data error '+res.status);
    const json = await res.json();
    if(!json.data || !json.data.length) throw new Error('No data');
    return json.data; // expect newest-first
  } catch (err){
    console.warn('data fetch failed', err);
    showError('सर्वर से डेटा नहीं मिला — नमूना डेटा दिखाया जाएगा।');
    return SAMPLE_DATA;
  }
}

function formatNumber(n){
  if(n == null) return '—';
  return n.toLocaleString('en-IN');
}

function displayData(series){
  if(!series || !series.length) return;
  resultArea.style.display = 'block';
  clearError();
  const latest = series[0];
  document.getElementById('m_house').textContent = formatNumber(latest.households_worked || latest.households || 0);
  document.getElementById('m_pd').textContent = formatNumber(latest.persondays || latest.persondays_generated || 0);
  document.getElementById('m_pay').textContent = '₹' + formatNumber(latest.expenditure || latest.total_expenditure || 0);
  document.getElementById('m_female').textContent = (latest.female_pct != null ? latest.female_pct : '—') + '%';

  // Prepare arrays oldest->newest for charting
  const slice = series.slice(0,12).reverse();
  const labels = slice.map(s=> s.month || '');
  const persons = slice.map(s=> s.persondays || s.persondays_generated || 0);
  const households = slice.map(s=> s.households_worked || s.households || 0);

  // Trend chart: line (persondays) + bar (households)
  if(trendChart) trendChart.destroy();
  trendChart = new Chart(trendCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type:'bar', label: 'काम पाने वाले परिवार', data: households, backgroundColor: 'rgba(14,165,164,0.8)', yAxisID:'y' },
        { type:'line', label: 'व्यक्ति-दिवस', data: persons, borderColor:'#0b9b90', fill:false, yAxisID:'y1' }
      ]
    },
    options: {
      responsive:true,
      interaction:{mode:'index',intersect:false},
      scales:{
        y: { position:'left', beginAtZero:true, ticks:{callback: v => v >= 1000 ? v/1000 + 'k' : v} },
        y1:{ position:'right', beginAtZero:true, grid: { drawOnChartArea:false }, ticks:{callback: v => v >= 1000 ? v/1000 + 'k' : v} }
      }
    }
  });

  // Bar chart for last 8 months (households)
  const slice8 = series.slice(0,8).reverse();
  const labels8 = slice8.map(s=> s.month || '');
  const values8 = slice8.map(s=> s.households_worked || s.households || 0);
  if(barChart) barChart.destroy();
  barChart = new Chart(barCtx, {
    type:'bar',
    data: { labels: labels8, datasets: [{ label: 'काम पाने वाले परिवार', data: values8, backgroundColor:'#10b981' }] },
    options:{ responsive:true, scales:{ y: { beginAtZero:true, ticks:{callback: v => v >= 1000 ? v/1000 + 'k' : v} } } }
  });
}

// Geolocation -> reverse geocode
geoBtn.addEventListener('click', async ()=>{
  clearError();
  if(!navigator.geolocation){ showError('यह ब्राउज़र लोकेशन सपोर्ट नहीं करता।'); return; }
  geoBtn.textContent = 'लोकेशन ले रहे हैं…';
  navigator.geolocation.getCurrentPosition(async pos=>{
    try {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
      if(!r.ok) throw new Error('geocode fail');
      const jd = await r.json();
      const addr = jd.address || {};
      const districtCandidate = addr.county || addr.state_district || addr.district || addr.town || addr.city || addr.village;
      if(districtCandidate){
        // set district if matches
        const opt = Array.from(districtSelect.options).find(o=> o.textContent.toLowerCase().includes(String(districtCandidate).toLowerCase()));
        if(opt){
          districtSelect.value = opt.value;
          clearError();
        } else {
          const newOpt = document.createElement('option'); newOpt.value = districtCandidate; newOpt.textContent = districtCandidate;
          districtSelect.appendChild(newOpt);
          districtSelect.value = districtCandidate;
          showError('लोकेशन से जिला जोड़ा गया (मैन्युअल सत्यापन जरुरी)।');
        }
      } else {
        showError('लोकेशन से जिला नहीं मिला। कृपया मैन्युअली चुनें।');
      }
    } catch (err){
      console.error(err);
      showError('लोकेशन लेने में समस्या आई।');
    } finally {
      geoBtn.textContent = '📍 लोकेशन से चुनें';
    }
  }, err=>{
    geoBtn.textContent = '📍 लोकेशन से चुनें';
    showError('Location अनुमति नहीं मिली: ' + (err.message || 'permission denied'));
  }, {timeout:10000});
});

// On Get Data
getBtn.addEventListener('click', async ()=>{
  clearError();
  const state = stateSelect.value;
  const district = districtSelect.value;
  if(!district || district.startsWith('—')){ showError('कृपया जिला चुनें।'); return; }
  getBtn.textContent = 'डेटा लाया जा रहा है…';
  getBtn.disabled = true;
  try {
    const data = await fetchDistrictData(state, district);
    displayData(data);
  } finally {
    getBtn.textContent = 'डेटा दिखाओ';
    getBtn.disabled = false;
  }
});

// init
(function init(){
  // try loading districts from API, else use built-in
  loadDistrictsFromApi('Uttar Pradesh').then(()=> {
    if(districtSelect.options.length <= 1) populateDistricts();
  });
})();
