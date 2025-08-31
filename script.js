// Global variables
let countriesData = [];
let currentData = [];
let allData = [];
let filteredData = [];
let currentDataType = '';
let currentPage = 1;
let itemsPerPage = 50; // Default to 50 items per page
let searchFilter = '';

// DOM elements
const form = document.getElementById('dataForm');
const dataTypeSelect = document.getElementById('dataType');
const chartContainer = document.getElementById('chart');
const tableContainer = document.getElementById('tableContainer');
const tooltip = document.getElementById('tooltip');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadCountriesData();
    setupEventListeners();
});

// Load countries data from JSON file
async function loadCountriesData() {
    try {
        // Show loading state
        chartContainer.innerHTML = '<div style="text-align: center; padding: 50px;"><p>Loading countries data...</p></div>';
        tableContainer.innerHTML = '';
        
        const response = await fetch('data/countries.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        countriesData = await response.json();
        console.log('Loaded', countriesData.length, 'countries');
        
        // Clear loading state
        chartContainer.innerHTML = '<div style="text-align: center; padding: 50px;"><p>Select a data type from the form above to visualize the data.</p></div>';
        
    } catch (error) {
        console.error('Error loading countries data:', error);
        chartContainer.innerHTML = `<div style="text-align: center; padding: 50px; color: #e74c3c;"><p>Error loading countries data: ${error.message}</p><p>Please check the console for details.</p></div>`;
        tableContainer.innerHTML = '';
    }
}

// Setup event listeners
function setupEventListeners() {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const selectedType = dataTypeSelect.value;
        if (selectedType) {
            updateVisualization(selectedType);
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (currentData && currentData.length > 0) {
            createBubbleChart();
        }
    });
    
    // Handle keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (itemsPerPage === 'all') return; // No navigation needed when showing all
        
        if (e.key === 'ArrowLeft' && currentPage > 1) {
            changePage(currentPage - 1);
        } else if (e.key === 'ArrowRight' && currentPage < Math.ceil(filteredData.length / itemsPerPage)) {
            changePage(currentPage + 1);
        }
    });
}

// Update visualization based on selected data type
function updateVisualization(dataType) {
    // Show loading progress
    const loadingProgress = document.getElementById('loadingProgress');
    loadingProgress.style.display = 'block';
    
    // Use setTimeout to allow the UI to update before processing
    setTimeout(() => {
        currentDataType = dataType;
        
        switch(dataType) {
            case 'population':
                currentData = processCountryData('population');
                break;
            case 'borders':
                currentData = processCountryData('borders');
                break;
            case 'timezones':
                currentData = processCountryData('timezones');
                break;
            case 'languages':
                currentData = processCountryData('languages');
                break;
            case 'region-countries':
                currentData = processRegionData('countries');
                break;
            case 'region-timezones':
                currentData = processRegionData('timezones');
                break;
            default:
                console.error('Unknown data type:', dataType);
                return;
        }
        
        // Store all data and implement pagination
        allData = currentData;
        filteredData = [...currentData]; // Initialize filtered data
        currentPage = 1;
        searchFilter = ''; // Reset search filter
        
        // Clear search input
        document.getElementById('searchFilter').value = '';
        
        updatePagination();
        updateCurrentData();
        createBubbleChart();
        createDataTable();
        createChartStats();
        
        // Hide loading progress
        loadingProgress.style.display = 'none';
    }, 100);
}

// Process country-level data
function processCountryData(dataType) {
    return countriesData
        .filter(country => country && country.name) // Filter out invalid entries
        .map(country => {
            let value;
            let label = country.name;
            
            switch(dataType) {
                case 'population':
                    value = country.population || 0;
                    break;
                case 'borders':
                    value = country.borders ? country.borders.length : 0;
                    break;
                case 'timezones':
                    value = country.timezones ? country.timezones.length : 0;
                    break;
                case 'languages':
                    value = country.languages ? country.languages.length : 0;
                    break;
                default:
                    value = 0;
            }
            
            return {
                label: label,
                value: value,
                type: 'country',
                country: country
            };
        })
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
}

// Process region-level data
function processRegionData(dataType) {
    const regionMap = new Map();
    
    countriesData
        .filter(country => country && country.name && country.region) // Filter out invalid entries
        .forEach(country => {
            const region = country.region || 'Unknown';
            
            if (!regionMap.has(region)) {
                regionMap.set(region, {
                    countries: new Set(),
                    timezones: new Set()
                });
            }
            
            regionMap.get(region).countries.add(country.name);
            
            if (country.timezones && Array.isArray(country.timezones)) {
                country.timezones.forEach(tz => {
                    if (tz && typeof tz === 'string') {
                        regionMap.get(region).timezones.add(tz);
                    }
                });
            }
        });
    
    return Array.from(regionMap.entries())
        .map(([region, data]) => {
            let value;
            switch(dataType) {
                case 'countries':
                    value = data.countries.size;
                    break;
                case 'timezones':
                    value = data.timezones.size;
                    break;
                default:
                    value = 0;
            }
            
            return {
                label: region,
                value: value,
                type: 'region',
                regionData: data
            };
        })
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value);
}

// Create bubble chart using D3.js
function createBubbleChart() {
    // Clear previous chart
    chartContainer.innerHTML = '';
    
    if (!currentData || currentData.length === 0) {
        if (searchFilter && filteredData.length === 0) {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px; color: #e74c3c;"><p>No data found matching your search criteria.</p><p>Try adjusting your search term or clearing the filter.</p></div>';
        } else {
            chartContainer.innerHTML = '<div style="text-align: center; padding: 50px;"><p>No data available for the selected option.</p></div>';
        }
        return;
    }
    
    // Chart dimensions
    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(currentData, d => d.value)])
        .range([0, width]);
    
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(currentData, d => d.value)])
        .range([height, 0]);
    
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(currentData, d => d.value)])
        .range([8, 60]);
    
    // Add X axis with better formatting
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => d3.format('.2s')(d));
    
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(xAxis);
    
    // Add Y axis with better formatting
    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => d3.format('.2s')(d));
    
    svg.append('g')
        .call(yAxis);
    
    // Add axis labels
    svg.append('text')
        .attr('transform', `translate(${width/2}, ${height + margin.bottom - 5})`)
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#666')
        .text(getAxisLabel());
    
    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left + 20)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '14px')
        .style('fill', '#666')
        .text('Value');
    
    // Add bubbles with animation
    const bubbles = svg.selectAll('.bubble')
        .data(currentData)
        .enter()
        .append('circle')
        .attr('class', 'bubble')
        .attr('cx', d => xScale(d.value))
        .attr('cy', d => yScale(d.value))
        .attr('r', 0) // Start with radius 0
        .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
        .attr('opacity', 0) // Start with opacity 0
        .attr('stroke', '#fff')
        .attr('stroke-width', 2)
        .on('mouseover', function(event, d) {
            showTooltip(event, d);
            d3.select(this).attr('opacity', 1).attr('stroke-width', 3);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).attr('opacity', 0.8).attr('stroke-width', 2);
        });
    
    // Animate bubbles appearing
    bubbles.transition()
        .duration(1000)
        .delay((d, i) => i * 50)
        .attr('r', d => radiusScale(d.value))
        .attr('opacity', 0.8);
    
    // Add labels for larger bubbles with animation
    const labels = svg.selectAll('.bubble-label')
        .data(currentData.filter(d => radiusScale(d.value) > 25))
        .enter()
        .append('text')
        .attr('class', 'bubble-label')
        .attr('x', d => xScale(d.value))
        .attr('y', d => yScale(d.value))
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '12px')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
        .attr('opacity', 0)
        .text(d => d.label.length > 15 ? d.label.substring(0, 12) + '...' : d.label);
    
    // Animate labels appearing
    labels.transition()
        .duration(800)
        .delay((d, i) => 1000 + (i * 30))
        .attr('opacity', 1);
    
    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('font-weight', 'bold')
        .attr('fill', '#2c3e50')
        .text(getChartTitle());
}

// Create data table
function createDataTable() {
    if (!currentData || currentData.length === 0) {
        if (searchFilter && filteredData.length === 0) {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: #e74c3c;"><p>No data found matching your search criteria.</p></div>';
        } else {
            tableContainer.innerHTML = '<div style="text-align: center; padding: 30px;"><p>No data available for the selected option.</p></div>';
        }
        return;
    }
    
    const table = document.createElement('table');
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = ['Rank', 'Name/Region', 'Value', 'Percentage'];
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    const totalValue = currentData.reduce((sum, item) => sum + item.value, 0);
    
    currentData.forEach((item, index) => {
        const row = document.createElement('tr');
        
        const rankCell = document.createElement('td');
        rankCell.textContent = index + 1;
        rankCell.style.textAlign = 'center';
        row.appendChild(rankCell);
        
        const nameCell = document.createElement('td');
        nameCell.textContent = item.label;
        row.appendChild(nameCell);
        
        const valueCell = document.createElement('td');
        valueCell.textContent = item.value.toLocaleString();
        valueCell.style.textAlign = 'right';
        row.appendChild(valueCell);
        
        const percentageCell = document.createElement('td');
        const percentage = ((item.value / totalValue) * 100).toFixed(1);
        percentageCell.textContent = percentage + '%';
        percentageCell.style.textAlign = 'right';
        row.appendChild(percentageCell);
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    
    // Clear and append new table
    tableContainer.innerHTML = '';
    tableContainer.appendChild(table);
}

// Show tooltip
function showTooltip(event, data) {
    let tooltipContent = '';
    
    if (data.type === 'country') {
        const country = data.country;
        const currentValue = getCurrentValueLabel(data);
        
        tooltipContent = `
            <div style="margin-bottom: 8px;">
                <strong style="color: #3498db; font-size: 16px;">${country.name}</strong>
            </div>
            <div style="margin-bottom: 4px;">
                <span style="color: #e74c3c; font-weight: bold;">${currentValue}:</span> ${data.value.toLocaleString()}
            </div>
            <hr style="border: none; border-top: 1px solid #555; margin: 8px 0;">
            <div style="font-size: 12px; line-height: 1.4;">
                <strong>Capital:</strong> ${country.capital || 'N/A'}<br>
                <strong>Region:</strong> ${country.region || 'N/A'}<br>
                <strong>Population:</strong> ${country.population ? country.population.toLocaleString() : 'N/A'}<br>
                <strong>Area:</strong> ${country.area ? country.area.toLocaleString() + ' km²' : 'N/A'}<br>
                <strong>Borders:</strong> ${country.borders ? country.borders.length : 0}<br>
                <strong>Timezones:</strong> ${country.timezones ? country.timezones.join(', ') : 'N/A'}<br>
                <strong>Languages:</strong> ${country.languages ? country.languages.map(l => l.name).join(', ') : 'N/A'}
            </div>
        `;
    } else if (data.type === 'region') {
        const regionData = data.regionData;
        const currentValue = getCurrentValueLabel(data);
        
        tooltipContent = `
            <div style="margin-bottom: 8px;">
                <strong style="color: #3498db; font-size: 16px;">${data.label}</strong>
            </div>
            <div style="margin-bottom: 4px;">
                <span style="color: #e74c3c; font-weight: bold;">${currentValue}:</span> ${data.value.toLocaleString()}
            </div>
            <hr style="border: none; border-top: 1px solid #555; margin: 8px 0;">
            <div style="font-size: 12px; line-height: 1.4;">
                <strong>Total Countries:</strong> ${regionData.countries.size}<br>
                <strong>Unique Timezones:</strong> ${regionData.timezones.size}<br>
                <strong>Sample Countries:</strong> ${Array.from(regionData.countries).slice(0, 5).join(', ')}${regionData.countries.size > 5 ? '...' : ''}
            </div>
        `;
    }
    
    tooltip.innerHTML = tooltipContent;
    tooltip.classList.add('show');
    
    // Position tooltip
    const rect = event.target.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top - tooltipHeight - 10;
    
    // Ensure tooltip doesn't go off-screen
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
    if (top < 10) top = rect.bottom + 10;
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

// Hide tooltip
function hideTooltip() {
    tooltip.classList.remove('show');
}

// Get chart title based on current data type
function getChartTitle() {
    switch(currentDataType) {
        case 'population':
            return 'Country Population Distribution';
        case 'borders':
            return 'Number of Borders by Country';
        case 'timezones':
            return 'Number of Timezones by Country';
        case 'languages':
            return 'Number of Languages by Country';
        case 'region-countries':
            return 'Number of Countries by Region';
        case 'region-timezones':
            return 'Number of Unique Timezones by Region';
        default:
            return 'Country Data Visualization';
    }
}

// Get axis label based on current data type
function getAxisLabel() {
    switch(currentDataType) {
        case 'population':
            return 'Population';
        case 'borders':
            return 'Number of Borders';
        case 'timezones':
            return 'Number of Timezones';
        case 'languages':
            return 'Number of Languages';
        case 'region-countries':
            return 'Number of Countries';
        case 'region-timezones':
            return 'Number of Unique Timezones';
        default:
            return 'Value';
    }
}

// Get current value label for tooltip
function getCurrentValueLabel(data) {
    switch(currentDataType) {
        case 'population':
            return 'Population';
        case 'borders':
            return 'Borders';
        case 'timezones':
            return 'Timezones';
        case 'languages':
            return 'Languages';
        case 'region-countries':
            return 'Countries';
        case 'region-timezones':
            return 'Unique Timezones';
        default:
            return 'Value';
    }
}

// Create chart statistics
function createChartStats() {
    if (!currentData || currentData.length === 0) {
        document.getElementById('chartStats').innerHTML = '';
        return;
    }
    
    const statsContainer = document.getElementById('chartStats');
    const totalValue = currentData.reduce((sum, item) => sum + item.value, 0);
    const maxValue = Math.max(...currentData.map(item => item.value));
    const minValue = Math.min(...currentData.map(item => item.value));
    const avgValue = totalValue / currentData.length;
    
    let totalPages, startItem, endItem;
    
    if (itemsPerPage === 'all') {
        totalPages = 1;
        startItem = 1;
        endItem = filteredData.length;
    } else {
        totalPages = Math.ceil(filteredData.length / itemsPerPage);
        startItem = (currentPage - 1) * itemsPerPage + 1;
        endItem = Math.min(currentPage * itemsPerPage, filteredData.length);
    }
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${currentData.length}</span>
            <span class="stat-label">${itemsPerPage === 'all' ? 'Total Items' : 'Current Page Items'}</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${filteredData.length}</span>
            <span class="stat-label">Filtered Items</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${allData.length}</span>
            <span class="stat-label">Total Available</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${itemsPerPage === 'all' ? 'All' : `${currentPage}/${totalPages}`}</span>
            <span class="stat-label">${itemsPerPage === 'all' ? 'Display Mode' : 'Current Page'}</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${maxValue.toLocaleString()}</span>
            <span class="stat-label">Maximum Value</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${minValue.toLocaleString()}</span>
            <span class="stat-label">Minimum Value</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${avgValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
            <span class="stat-label">Average Value</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${totalValue.toLocaleString()}</span>
            <span class="stat-label">Page Total Value</span>
        </div>
    `;
}

// Filter data based on search input
function filterData(searchTerm) {
    searchFilter = searchTerm.toLowerCase().trim();
    
    if (searchFilter === '') {
        filteredData = [...allData];
        hideSearchResults();
    } else {
        filteredData = allData.filter(item => 
            item.label.toLowerCase().includes(searchFilter)
        );
        showSearchResults(searchTerm, filteredData.length);
    }
    
    currentPage = 1; // Reset to first page
    updatePagination();
    updateCurrentData();
    createBubbleChart();
    createDataTable();
    createChartStats();
}

// Show search results
function showSearchResults(searchTerm, resultsCount) {
    const searchResults = document.getElementById('searchResults');
    
    if (resultsCount === 0) {
        searchResults.innerHTML = `
            <div class="search-term">No results found for: "${searchTerm}"</div>
            <div class="results-count">Try a different search term</div>
        `;
    } else {
        searchResults.innerHTML = `
            <div class="search-term">Search Results for: "${searchTerm}"</div>
            <div class="results-count">Found ${resultsCount} items</div>
        `;
    }
    
    searchResults.classList.add('show');
}

// Hide search results
function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    searchResults.classList.remove('show');
}

// Clear search filter
function clearFilter() {
    document.getElementById('searchFilter').value = '';
    filterData('');
    hideSearchResults();
}

// Pagination functions
function updatePagination() {
    const paginationContainer = document.getElementById('pagination');
    
    // If showing all items, hide pagination
    if (itemsPerPage === 'all') {
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                <label for="itemsPerPage">Items per page:</label>
                <select id="pagination-select" class="pagination-select" onchange="changeItemsPerPage(this.value)">
                    <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                    <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200</option>
                    <option value="all" ${itemsPerPage === 'all' ? 'selected' : ''}>All</option>
                </select>
            </div>
            <div class="pagination-info">Showing all ${filteredData.length} items (${allData.length} total)</div>
        `;
        return;
    }
    
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    if (totalPages <= 1) {
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                <label for="itemsPerPage">Items per page:</label>
                <select id="pagination-select" class="pagination-select" onchange="changeItemsPerPage(this.value)">
                    <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                    <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                    <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200</option>
                    <option value="all" ${itemsPerPage === 'all' ? 'selected' : ''}>All</option>
                </select>
            </div>
            <div class="pagination-info">Showing ${filteredData.length} items (${allData.length} total)</div>
        `;
        return;
    }
    
    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `<button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>`;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span>...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span>...</span>`;
        }
        paginationHTML += `<button onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    
    // Next button
    paginationHTML += `<button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
    
    // Items per page selector
    paginationHTML += `
        <div class="pagination-info">
            <label for="itemsPerPage">Items per page:</label>
            <select id="pagination-select" class="pagination-select" onchange="changeItemsPerPage(this.value)">
                <option value="25" ${itemsPerPage === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${itemsPerPage === 100 ? 'selected' : ''}>100</option>
                <option value="200" ${itemsPerPage === 200 ? 'selected' : ''}>200</option>
                <option value="all" ${itemsPerPage === 'all' ? 'selected' : ''}>All</option>

            </select>
        </div>
    `;
    
    // Page info
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);
    paginationHTML += `<div class="pagination-info">Showing ${startItem}-${endItem} of ${filteredData.length} items (${allData.length} total)</div>`;
    
    paginationContainer.innerHTML = paginationHTML;
}

function updateCurrentData() {
    if (itemsPerPage === 'all') {
        currentData = [...filteredData];
    } else {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        currentData = filteredData.slice(startIndex, endIndex);
    }
}

function changePage(page) {
    if (itemsPerPage === 'all') return; // No pagination when showing all
    
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        updateCurrentData();
        updatePagination();
        createBubbleChart();
        createDataTable();
        createChartStats();
    }
}

function changeItemsPerPage(newItemsPerPage) {
    if (newItemsPerPage === 'all') {
        itemsPerPage = 'all';
    } else {
        itemsPerPage = parseInt(newItemsPerPage);
    }
    currentPage = 1; // Reset to first page
    updatePagination();
    updateCurrentData();
    createBubbleChart();
    createDataTable();
    createChartStats();
}
