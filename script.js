// ---------------- Global state ----------------
let countriesData = [];
let currentData = [];
let allData = [];
let filteredData = [];
let currentDataType = '';
let currentPage = 1;
let itemsPerPage = 50; // default
let searchFilter = '';

// ---------------- DOM ----------------
const form = document.getElementById('dataForm');
const dataTypeSelect = document.getElementById('dataType');
const chartTypeSelect = document.getElementById('chartType');
const chartContainer = document.getElementById('chart');
const tableContainer = document.getElementById('tableContainer');
const tooltip = document.getElementById('tooltip');
const clearFilterBtn = document.getElementById('clearFilterBtn');

// ---------------- Init ----------------
document.addEventListener('DOMContentLoaded', function() {
  loadCountriesData();
  setupEventListeners();
});

// ---------------- Data loading ----------------
async function loadCountriesData() {
  try {
    chartContainer.innerHTML = '<div style="text-align:center; padding:50px;"><p>Loading countries data...</p></div>';
    tableContainer.innerHTML = '';

    const response = await fetch('data/countries.json');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const raw = await response.json();
    const { data, errors, skipped } = validateCountriesData(raw);
    countriesData = data;

    console.log(`Loaded ${countriesData.length} valid countries. Skipped ${skipped}.`);
    if (errors.length) {
      console.warn('Validation issues (first 20):', errors.slice(0, 20));
      if (errors.length > 20) console.warn(`(+${errors.length - 20} more)`);
    }

    chartContainer.innerHTML = `
      <div style="text-align:center; padding: 24px;">
        <p>Loaded ${countriesData.length} records${skipped ? ` (skipped ${skipped} invalid)` : ''}.</p>
        <p>Select a data type from the form above to visualize the data.</p>
      </div>`;
  } catch (error) {
    console.error('Error loading countries data:', error);
    chartContainer.innerHTML = `<div style="text-align:center; padding:50px; color:#e74c3c;">
      <p>Error loading countries data: ${escapeHTML(error.message)}</p>
      <p>Please check the console for details.</p></div>`;
    tableContainer.innerHTML = '';
  }
}

// ---------------- Event listeners ----------------
function setupEventListeners() {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    let selectedType = dataTypeSelect.value;
    if (!ALLOWED_DATA_TYPES.has(selectedType)) {
      console.warn('Invalid data type; defaulting to "population"');
      selectedType = 'population';
      dataTypeSelect.value = 'population';
    }
    updateVisualization(selectedType);
  });

  // Search input
  const searchInput = document.getElementById('searchFilter');
  searchInput.addEventListener('input', (e) => {
    filterData(e.target.value);
  });
  clearFilterBtn.addEventListener('click', () => clearFilter());

  // Resize re-renders current chart
  window.addEventListener('resize', function() {
    if (!currentData || currentData.length === 0) return;
    const chartType = ALLOWED_CHART_TYPES.has(chartTypeSelect.value) ? chartTypeSelect.value : 'bubble';
    chartType === 'treemap' ? createTreemapChart() : createBubbleChart();
  });

  // Chart type change
  chartTypeSelect.addEventListener('change', function() {
    if (!ALLOWED_CHART_TYPES.has(this.value)) this.value = 'bubble';
    if (currentData && currentData.length > 0) {
      this.value === 'treemap' ? createTreemapChart() : createBubbleChart();
    }
  });

  // Keyboard pagination (left/right)
  document.addEventListener('keydown', function(e) {
    if (itemsPerPage === 'all') return;
    if (e.key === 'ArrowLeft' && currentPage > 1) {
      changePage(currentPage - 1);
    } else if (e.key === 'ArrowRight' && currentPage < Math.ceil(filteredData.length / itemsPerPage)) {
      changePage(currentPage + 1);
    }
  });
}

// ---------------- Visualization update ----------------
function updateVisualization(dataType) {
  const loadingProgress = document.getElementById('loadingProgress');
  loadingProgress.style.display = 'block';

  setTimeout(() => {
    currentDataType = dataType;

    switch (dataType) {
      case 'population':
      case 'borders':
      case 'timezones':
      case 'languages':
        allData = processCountryData(dataType);
        break;
      case 'region-countries':
        allData = processRegionData('countries');
        break;
      case 'region-timezones':
        allData = processRegionData('timezones');
        break;
      default:
        console.error('Unknown data type:', dataType);
        loadingProgress.style.display = 'none';
        return;
    }

    // Initialize filtered/paged views
    filteredData = [...allData];
    currentPage = 1;
    itemsPerPage = 50; // reset default on each selection (optional)
    document.getElementById('searchFilter').value = '';
    hideSearchResults();

    updatePagination();
    updateCurrentData();

    const chartType = ALLOWED_CHART_TYPES.has(chartTypeSelect.value) ? chartTypeSelect.value : 'bubble';
    chartType === 'treemap' ? createTreemapChart() : createBubbleChart();

    createDataTable();
    createChartStats();

    loadingProgress.style.display = 'none';
  }, 50);
}

// ---------------- Processing ----------------
function processCountryData(kind) {
  return countriesData
    .filter(country => country && country.name)
    .map(country => {
      let value = 0;
      switch (kind) {
        case 'population': value = country.population || 0; break;
        case 'borders':    value = Array.isArray(country.borders)   ? country.borders.length   : 0; break;
        case 'timezones':  value = Array.isArray(country.timezones) ? country.timezones.length : 0; break;
        case 'languages':  value = Array.isArray(country.languages) ? country.languages.length : 0; break;
      }
      return { label: country.name, value, type: 'country', country };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function processRegionData(kind) {
  const regionMap = new Map();

  countriesData
    .filter(country => country && country.name && country.region)
    .forEach(country => {
      const region = country.region || 'Unknown';
      if (!regionMap.has(region)) {
        regionMap.set(region, { countries: new Set(), timezones: new Set() });
      }
      regionMap.get(region).countries.add(country.name);
      (country.timezones || []).forEach(tz => {
        if (tz && typeof tz === 'string') regionMap.get(region).timezones.add(tz);
      });
    });

  return Array.from(regionMap.entries())
    .map(([region, data]) => {
      const value = (kind === 'countries') ? data.countries.size :
                    (kind === 'timezones') ? data.timezones.size : 0;
      return { label: region, value, type: 'region', regionData: data };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

// ---------------- Charts ----------------
// Bubble (force) to avoid overlap
function createBubbleChart() {
  chartContainer.innerHTML = '';
  if (!currentData || currentData.length === 0) {
    chartContainer.innerHTML = searchFilter && filteredData.length === 0
      ? '<div style="text-align:center; padding:50px; color:#e74c3c;"><p>No data found matching your search criteria.</p><p>Try adjusting your search term or clearing the filter.</p></div>'
      : '<div style="text-align:center; padding:50px;"><p>No data available for the selected option.</p></div>';
    return;
  }

  const margin = { top: 40, right: 20, bottom: 40, left: 20 };
  const width  = chartContainer.clientWidth - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = d3.select(chartContainer)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  svg.append('text')
    .attr('x', width / 2).attr('y', -20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px').attr('font-weight', 'bold')
    .attr('fill', '#2c3e50')
    .text(getChartTitle());

  const maxVal = safeMaxValue(currentData);
  const radiusScale = d3.scaleSqrt().domain([0, maxVal]).range([12, 60]);

  const dataSize = currentData.length;
  const chargeStrength   = dataSize > 100 ? 2 : dataSize > 50 ? 3 : 5;
  const collisionPadding = dataSize > 100 ? 2 : dataSize > 50 ? 3 : 4;

  const simulation = d3.forceSimulation(currentData)
    .force('charge', d3.forceManyBody().strength(chargeStrength))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => radiusScale(d.value) + collisionPadding))
    .on('tick', ticked);

  const bubbles = svg.selectAll('.bubble')
    .data(currentData)
    .enter().append('circle')
    .attr('class', 'bubble')
    .attr('r', 0)
    .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
    .attr('opacity', 0)
    .attr('stroke', '#fff').attr('stroke-width', 2)
    .on('mouseover', function(evt, d) { showTooltip(evt, d); d3.select(this).attr('opacity', 1).attr('stroke-width', 3); })
    .on('mouseout',  function() { hideTooltip(); d3.select(this).attr('opacity', 0.8).attr('stroke-width', 2); });

  const labels = svg.selectAll('.bubble-label')
    .data(currentData)
    .enter().append('text')
    .attr('class', 'bubble-label')
    .attr('text-anchor', 'middle').attr('dy', '0.3em')
    .attr('font-size', d => Math.max(11, Math.min(16, radiusScale(d.value) / 2.5)))
    .attr('fill', 'white').attr('font-weight', 'bold')
    .attr('text-shadow', '1px 1px 3px rgba(0,0,0,0.9), -1px -1px 3px rgba(0,0,0,0.9)')
    .attr('opacity', 0)
    .text(d => {
      const name = d.label;
      const r = radiusScale(d.value);
      if (r < 25) return name.length > 8  ? name.slice(0,6)  + '...' : name;
      if (r < 40) return name.length > 12 ? name.slice(0,10) + '...' : name;
      if (r < 50) return name.length > 15 ? name.slice(0,13) + '...' : name;
      return name.length > 18 ? name.slice(0,16) + '...' : name;
    });

  bubbles.transition().duration(1000).delay((d,i) => i*50)
    .attr('r', d => radiusScale(d.value)).attr('opacity', 0.8);

  labels.transition().duration(800).delay((d,i) => 1000 + i*30).attr('opacity', 1);

  function ticked() {
    bubbles
      .attr('cx', d => Math.max(radiusScale(d.value), Math.min(width  - radiusScale(d.value), d.x)))
      .attr('cy', d => Math.max(radiusScale(d.value), Math.min(height - radiusScale(d.value), d.y)));
    labels
      .attr('x', d => Math.max(radiusScale(d.value), Math.min(width  - radiusScale(d.value), d.x)))
      .attr('y', d => Math.max(radiusScale(d.value), Math.min(height - radiusScale(d.value), d.y)));
  }

  const simulationTime = dataSize > 100 ? 5000 : dataSize > 50 ? 4000 : 3000;
  setTimeout(() => simulation.stop(), simulationTime);
}

// Treemap
function createTreemapChart() {
  chartContainer.innerHTML = '';
  if (!currentData || currentData.length === 0) {
    chartContainer.innerHTML = searchFilter && filteredData.length === 0
      ? '<div style="text-align:center; padding:50px; color:#e74c3c;"><p>No data found matching your search criteria.</p><p>Try adjusting your search term or clearing the filter.</p></div>'
      : '<div style="text-align:center; padding:50px;"><p>No data available for the selected option.</p></div>';
    return;
  }

  const margin = { top: 40, right: 20, bottom: 40, left: 20 };
  const width  = chartContainer.clientWidth - margin.left - margin.right;
  const height = 500 - margin.top - margin.bottom;

  const svg = d3.select(chartContainer)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  svg.append('text')
    .attr('x', width/2).attr('y', -20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px').attr('font-weight', 'bold')
    .attr('fill', '#2c3e50')
    .text(getChartTitle() + ' (Treemap View)');

  const treemapData = {
    name: 'root',
    children: currentData.map(d => ({ name: d.label, value: d.value, originalData: d }))
  };

  const root = d3.hierarchy(treemapData)
    .sum(d => d.value)
    .sort((a,b) => b.value - a.value);

  d3.treemap().size([width, height]).padding(2).round(true)(root);

  const nodes = svg.selectAll('.treemap-node').data(root.leaves())
    .enter().append('g')
    .attr('class', 'treemap-node')
    .attr('transform', d => `translate(${d.x0},${d.y0})`)
    .on('mouseover', function(evt, d) { showTooltip(evt, d.data.originalData); d3.select(this).select('rect').attr('stroke-width', 3); })
    .on('mouseout',  function() { hideTooltip(); d3.select(this).select('rect').attr('stroke-width', 1); });

  nodes.append('rect')
    .attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0)
    .attr('fill', (d,i) => d3.schemeCategory10[i % 10])
    .attr('stroke', '#fff').attr('stroke-width', 1)
    .attr('opacity', 0)
    .transition().duration(800).delay((d,i) => i*50).attr('opacity', 0.8);

  nodes.filter(d => (d.x1 - d.x0) > 30 && (d.y1 - d.y0) > 20)
    .append('text').attr('x', 5).attr('y', 15)
    .attr('font-size', '11px').attr('fill', 'white').attr('font-weight', 'bold')
    .attr('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
    .attr('opacity', 0)
    .text(d => {
      const name = d.data.name;
      const maxW = d.x1 - d.x0 - 10;
      return name.length > maxW/6 ? name.slice(0, Math.floor(maxW/6)) + '...' : name;
    })
    .transition().duration(600).delay((d,i)=>800+i*30).attr('opacity',1);

  nodes.filter(d => (d.x1 - d.x0) > 80 && (d.y1 - d.y0) > 30)
    .append('text').attr('x', 5).attr('y', 30)
    .attr('font-size', '10px').attr('fill', 'white').attr('opacity', 0)
    .text(d => d3.format('.2s')(d.data.value))
    .transition().duration(600).delay((d,i)=>1000+i*30).attr('opacity', 0.9);
}

// ---------------- Table ----------------
function createDataTable() {
  if (!currentData || currentData.length === 0) {
    tableContainer.innerHTML = searchFilter && filteredData.length === 0
      ? '<div style="text-align:center; padding:30px; color:#e74c3c;"><p>No data found matching your search criteria.</p></div>'
      : '<div style="text-align:center; padding:30px;"><p>No data available for the selected option.</p></div>';
    return;
  }

  const table = document.createElement('table');

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Rank','Name/Region','Value','Percentage'].forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const totalValue = currentData.reduce((sum, item) => sum + item.value, 0);

  currentData.forEach((item, index) => {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    rankCell.textContent = index + 1;
    rankCell.style.textAlign = 'center';

    const nameCell = document.createElement('td');
    nameCell.textContent = item.label;

    const valueCell = document.createElement('td');
    valueCell.textContent = item.value.toLocaleString();
    valueCell.style.textAlign = 'right';

    const percentageCell = document.createElement('td');
    const percentage = totalValue ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
    percentageCell.textContent = percentage + '%';
    percentageCell.style.textAlign = 'right';

    row.append(rankCell, nameCell, valueCell, percentageCell);
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  tableContainer.innerHTML = '';
  tableContainer.appendChild(table);
}

// ---------------- Tooltip ----------------
function showTooltip(event, data) {
  const safe = (s) => escapeHTML(s);
  let html = '';

  if (data.type === 'country') {
    const c = data.country;
    const currentValue = getCurrentValueLabel(data);
    html = `
      <div style="margin-bottom:8px;"><strong style="color:#3498db; font-size:16px;">${safe(c.name)}</strong></div>
      <div style="margin-bottom:4px;"><span style="color:#e74c3c; font-weight:bold;">${safe(currentValue)}:</span> ${data.value.toLocaleString()}</div>
      <hr style="border:none; border-top:1px solid #555; margin:8px 0;">
      <div style="font-size:12px; line-height:1.4;">
        <strong>Capital:</strong> ${safe(c.capital || 'N/A')}<br>
        <strong>Region:</strong> ${safe(c.region || 'N/A')}<br>
        <strong>Population:</strong> ${c.population ? c.population.toLocaleString() : 'N/A'}<br>
        <strong>Area:</strong> ${c.area ? c.area.toLocaleString() + ' km²' : 'N/A'}<br>
        <strong>Borders:</strong> ${Array.isArray(c.borders) ? c.borders.length : 0}<br>
        <strong>Timezones:</strong> ${Array.isArray(c.timezones) ? safe(c.timezones.join(', ')) : 'N/A'}<br>
        <strong>Languages:</strong> ${Array.isArray(c.languages) ? safe(c.languages.map(l => l.name).join(', ')) : 'N/A'}
      </div>`;
  } else if (data.type === 'region') {
    const regionData = data.regionData;
    const currentValue = getCurrentValueLabel(data);
    html = `
      <div style="margin-bottom:8px;"><strong style="color:#3498db; font-size:16px;">${safe(data.label)}</strong></div>
      <div style="margin-bottom:4px;"><span style="color:#e74c3c; font-weight:bold;">${safe(currentValue)}:</span> ${data.value.toLocaleString()}</div>
      <hr style="border:none; border-top:1px solid #555; margin:8px 0;">
      <div style="font-size:12px; line-height:1.4;">
        <strong>Total Countries:</strong> ${regionData.countries.size}<br>
        <strong>Unique Timezones:</strong> ${regionData.timezones.size}<br>
        <strong>Sample Countries:</strong> ${escapeHTML(Array.from(regionData.countries).slice(0,5).join(', '))}${regionData.countries.size > 5 ? '...' : ''}
      </div>`;
  }

  tooltip.innerHTML = html;
  tooltip.classList.add('show');

  const rect = event.target.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  let left = rect.left + rect.width / 2 - tw / 2;
  let top  = rect.top - th - 10;

  if (left < 10) left = 10;
  if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10;

  if (top < 10) {
    top = rect.bottom + 10;
    if (top + th > window.innerHeight - 10) {
      if (rect.left > tw + 20)      { left = rect.left - tw - 10; top = rect.top + rect.height/2 - th/2; }
      else if (rect.right + tw + 20 < window.innerWidth) { left = rect.right + 10; top = rect.top + rect.height/2 - th/2; }
    }
  }

  tooltip.style.left = left + 'px';
  tooltip.style.top  = top  + 'px';
}

function hideTooltip() { tooltip.classList.remove('show'); }

// ---------------- Labels ----------------
function getChartTitle() {
  switch (currentDataType) {
    case 'population':        return 'Country Population Distribution';
    case 'borders':           return 'Number of Borders by Country';
    case 'timezones':         return 'Number of Timezones by Country';
    case 'languages':         return 'Number of Languages by Country';
    case 'region-countries':  return 'Number of Countries by Region';
    case 'region-timezones':  return 'Number of Unique Timezones by Region';
    default:                  return 'Country Data Visualization';
  }
}

function getAxisLabel() {
  switch (currentDataType) {
    case 'population':        return 'Population';
    case 'borders':           return 'Number of Borders';
    case 'timezones':         return 'Number of Timezones';
    case 'languages':         return 'Number of Languages';
    case 'region-countries':  return 'Number of Countries';
    case 'region-timezones':  return 'Number of Unique Timezones';
    default:                  return 'Value';
  }
}

function getCurrentValueLabel() {
  switch (currentDataType) {
    case 'population':        return 'Population';
    case 'borders':           return 'Borders';
    case 'timezones':         return 'Timezones';
    case 'languages':         return 'Languages';
    case 'region-countries':  return 'Countries';
    case 'region-timezones':  return 'Unique Timezones';
    default:                  return 'Value';
  }
}

// ---------------- Stats ----------------
function createChartStats() {
  if (!currentData || currentData.length === 0) {
    document.getElementById('chartStats').innerHTML = '';
    return;
  }

  const statsContainer = document.getElementById('chartStats');
  const totalValue = currentData.reduce((s, it) => s + it.value, 0);
  const values = currentData.map(it => it.value);
  const avgValue = totalValue / currentData.length;

  let totalPages, startItem, endItem;
  if (itemsPerPage === 'all') {
    totalPages = 1; startItem = 1; endItem = filteredData.length;
  } else {
    totalPages = Math.ceil(filteredData.length / itemsPerPage);
    startItem = (currentPage - 1) * itemsPerPage + 1;
    endItem   = Math.min(currentPage * itemsPerPage, filteredData.length);
  }

  statsContainer.innerHTML = `
    <div class="stat-item"><span class="stat-value">${currentData.length}</span><span class="stat-label">${itemsPerPage === 'all' ? 'Total Items' : 'Current Page Items'}</span></div>
    <div class="stat-item"><span class="stat-value">${filteredData.length}</span><span class="stat-label">Filtered Items</span></div>
    <div class="stat-item"><span class="stat-value">${allData.length}</span><span class="stat-label">Total Available</span></div>
    <div class="stat-item"><span class="stat-value">${itemsPerPage === 'all' ? 'All' : `${currentPage}/${totalPages}`}</span><span class="stat-label">${itemsPerPage === 'all' ? 'Display Mode' : 'Current Page'}</span></div>
    <div class="stat-item"><span class="stat-value">${avgValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span><span class="stat-label">Average Value</span></div>
    <div class="stat-item"><span class="stat-value">${totalValue.toLocaleString()}</span><span class="stat-label">Page Total Value</span></div>
  `;
}

// ---------------- Filtering ----------------
function filterData(searchTerm) {
  searchFilter = String(searchTerm || '').toLowerCase().trim();

  if (searchFilter === '') {
    filteredData = [...allData];
    hideSearchResults();
  } else {
    filteredData = allData.filter(item =>
      item.label.toLowerCase().includes(searchFilter)
      || (item.type === 'country' && item.country.region && item.country.region.toLowerCase().includes(searchFilter))
    );
    showSearchResults(searchTerm, filteredData.length);
  }

  currentPage = 1;
  updatePagination();
  updateCurrentData();

  const chartType = ALLOWED_CHART_TYPES.has(chartTypeSelect.value) ? chartTypeSelect.value : 'bubble';
  chartType === 'treemap' ? createTreemapChart() : createBubbleChart();
  createDataTable();
  createChartStats();
}

function showSearchResults(searchTerm, resultsCount) {
  const searchResults = document.getElementById('searchResults');
  const safeTerm = escapeHTML(searchTerm);
  searchResults.innerHTML = resultsCount === 0
    ? `<div class="search-term">No results found for: "${safeTerm}"</div><div class="results-count">Try a different search term</div>`
    : `<div class="search-term">Search Results for: "${safeTerm}"</div><div class="results-count">Found ${resultsCount} items</div>`;
  searchResults.classList.add('show');
}

function hideSearchResults() {
  const searchResults = document.getElementById('searchResults');
  searchResults.classList.remove('show');
}

function clearFilter() {
  document.getElementById('searchFilter').value = '';
  filterData('');
  hideSearchResults();
}

// ---------------- Pagination ----------------
function updatePagination() {
  const paginationContainer = document.getElementById('pagination');

  const itemsSelector = `
    <div class="pagination-info">
      <label for="itemsPerPage">Items per page:</label>
      <select id="pagination-select" class="pagination-select" onchange="changeItemsPerPage(this.value)">
        <option value="25"  ${itemsPerPage === 25  ? 'selected' : ''}>25</option>
        <option value="50"  ${itemsPerPage === 50  ? 'selected' : ''}>50</option>
        <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
        <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200</option>
        <option value="all" ${itemsPerPage === 'all' ? 'selected' : ''}>All</option>
      </select>
    </div>`;

  if (itemsPerPage === 'all') {
    paginationContainer.innerHTML = `
      ${itemsSelector}
      <div class="pagination-info">Showing all ${filteredData.length} items (${allData.length} total)</div>`;
    return;
  }

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (totalPages <= 1) {
    paginationContainer.innerHTML = `
      ${itemsSelector}
      <div class="pagination-info">Showing ${filteredData.length} items (${allData.length} total)</div>`;
    return;
  }

  let html = '';
  html += `<button onclick="changePage(${currentPage-1})" ${currentPage===1 ? 'disabled' : ''}>Previous</button>`;

  const startPage = Math.max(1, currentPage - 2);
  const endPage   = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    html += `<button onclick="changePage(1)">1</button>`;
    if (startPage > 2) html += `<span>...</span>`;
  }
  for (let i = startPage; i <= endPage; i++) {
    html += `<button class="${i===currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
  }
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span>...</span>`;
    html += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
  }

  html += `<button onclick="changePage(${currentPage+1})" ${currentPage===totalPages ? 'disabled' : ''}>Next</button>`;
  html += itemsSelector;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem   = Math.min(currentPage * itemsPerPage, filteredData.length);
  html += `<div class="pagination-info">Showing ${startItem}-${endItem} of ${filteredData.length} items (${allData.length} total)</div>`;

  paginationContainer.innerHTML = html;
}

function updateCurrentData() {
  if (itemsPerPage === 'all') {
    currentData = [...filteredData];
  } else {
    const start = (currentPage - 1) * itemsPerPage;
    currentData = filteredData.slice(start, start + itemsPerPage);
  }
}

function changePage(page) {
  if (itemsPerPage === 'all') return;
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    updateCurrentData();
    updatePagination();

    const chartType = ALLOWED_CHART_TYPES.has(chartTypeSelect.value) ? chartTypeSelect.value : 'bubble';
    chartType === 'treemap' ? createTreemapChart() : createBubbleChart();
    createDataTable();
    createChartStats();
  }
}

function changeItemsPerPage(newItemsPerPage) {
  itemsPerPage = sanitizeItemsPerPage(newItemsPerPage);
  currentPage = 1;
  updatePagination();
  updateCurrentData();

  const chartType = ALLOWED_CHART_TYPES.has(chartTypeSelect.value) ? chartTypeSelect.value : 'bubble';
  chartType === 'treemap' ? createTreemapChart() : createBubbleChart();
  createDataTable();
  createChartStats();
}
