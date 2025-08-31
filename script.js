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
const chartTypeSelect = document.getElementById('chartType');
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
            const chartType = chartTypeSelect.value || 'bubble';
            if (chartType === 'treemap') {
                createTreemapChart();
            } else {
                createBubbleChart();
            }
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
    
    // Handle chart type changes
    chartTypeSelect.addEventListener('change', function() {
        if (currentData && currentData.length > 0) {
            const chartType = this.value;
            if (chartType === 'treemap') {
                createTreemapChart();
            } else {
                createBubbleChart();
            }
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
        
        // Create chart based on selected type
        const chartType = chartTypeSelect.value || 'bubble';
        if (chartType === 'treemap') {
            createTreemapChart();
        } else {
            createBubbleChart();
        }
        
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

// Create bubble chart using D3.js with force simulation to prevent overlapping
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
    const margin = { top: 40, right: 20, bottom: 40, left: 20 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Radius scale for bubbles - larger range so names fit better
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(currentData, d => d.value)])
        .range([12, 60]);
    
    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('font-weight', 'bold')
        .attr('fill', '#2c3e50')
        .text(getChartTitle());
    
    // Create force simulation with adaptive parameters based on data size
    const dataSize = currentData.length;
    const chargeStrength = dataSize > 100 ? 2 : dataSize > 50 ? 3 : 5;
    const collisionPadding = dataSize > 100 ? 2 : dataSize > 50 ? 3 : 4;
    
    const simulation = d3.forceSimulation(currentData)
        .force('charge', d3.forceManyBody().strength(chargeStrength))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => radiusScale(d.value) + collisionPadding))
        .on('tick', ticked);
    
    // Add bubbles
    const bubbles = svg.selectAll('.bubble')
        .data(currentData)
        .enter()
        .append('circle')
        .attr('class', 'bubble')
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
    
    // Add labels for ALL bubbles (not just large ones)
    const labels = svg.selectAll('.bubble-label')
        .data(currentData)
        .enter()
        .append('text')
        .attr('class', 'bubble-label')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.3em')
        .attr('font-size', d => Math.max(11, Math.min(16, radiusScale(d.value) / 2.5))) // Adaptive font size for larger bubbles
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('text-shadow', '1px 1px 3px rgba(0,0,0,0.9), -1px -1px 3px rgba(0,0,0,0.9)')
        .attr('opacity', 0)
        .text(d => {
            const name = d.label;
            const radius = radiusScale(d.value);
            // For larger bubbles, show more complete names
            if (radius < 25) {
                return name.length > 8 ? name.substring(0, 6) + '...' : name;
            } else if (radius < 40) {
                return name.length > 12 ? name.substring(0, 10) + '...' : name;
            } else if (radius < 50) {
                return name.length > 15 ? name.substring(0, 13) + '...' : name;
            } else {
                return name.length > 18 ? name.substring(0, 16) + '...' : name;
            }
        });
    
    // Animate bubbles appearing
    bubbles.transition()
        .duration(1000)
        .delay((d, i) => i * 50)
        .attr('r', d => radiusScale(d.value))
        .attr('opacity', 0.8);
    
    // Animate labels appearing
    labels.transition()
        .duration(800)
        .delay((d, i) => 1000 + (i * 30))
        .attr('opacity', 1);
    
    // Legend removed - no more small/medium/large circles on bottom right
    // createBubbleLegend(svg, width, height, radiusScale);
    
    // Tick function for force simulation
    function ticked() {
        bubbles
            .attr('cx', d => Math.max(radiusScale(d.value), Math.min(width - radiusScale(d.value), d.x)))
            .attr('cy', d => Math.max(radiusScale(d.value), Math.min(height - radiusScale(d.value), d.y)));
        
        // Position labels at the center of each bubble
        labels
            .attr('x', d => Math.max(radiusScale(d.value), Math.min(width - radiusScale(d.value), d.x)))
            .attr('y', d => Math.max(radiusScale(d.value), Math.min(height - radiusScale(d.value), d.y)));
    }
    
    // Stop simulation after a few seconds to save performance
    // For larger datasets, run longer to ensure proper positioning
    const simulationTime = dataSize > 100 ? 5000 : dataSize > 50 ? 4000 : 3000;
    setTimeout(() => {
        simulation.stop();
    }, simulationTime);
}

// Create bubble legend
function createBubbleLegend(svg, width, height, radiusScale) {
    const legendData = [
        { label: 'Small', value: radiusScale.domain()[1] * 0.1 },
        { label: 'Medium', value: radiusScale.domain()[1] * 0.5 },
        { label: 'Large', value: radiusScale.domain()[1] * 0.9 }
    ];
    
    const legendGroup = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${width - 100}, ${height - 120})`);
    
    legendGroup.append('text')
        .attr('x', 0)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('font-weight', 'bold')
        .attr('fill', '#666')
        .text('Bubble Size');
    
    legendData.forEach((d, i) => {
        const legendItem = legendGroup.append('g')
            .attr('transform', `translate(0, ${i * 25})`);
        
        legendItem.append('circle')
            .attr('r', radiusScale(d.value))
            .attr('fill', '#ddd')
            .attr('stroke', '#999')
            .attr('stroke-width', 1);
        
        legendItem.append('text')
            .attr('x', radiusScale(d.value) + 15)
            .attr('y', 4)
            .attr('font-size', '11px')
            .attr('fill', '#666')
            .text(d.label);
    });
}

// Create treemap chart as alternative visualization
function createTreemapChart() {
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
    const margin = { top: 40, right: 20, bottom: 40, left: 20 };
    const width = chartContainer.clientWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    // Create SVG
    const svg = d3.select(chartContainer)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Add chart title
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', -20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('font-weight', 'bold')
        .attr('fill', '#2c3e50')
        .text(getChartTitle() + ' (Treemap View)');
    
    // Prepare data for treemap
    const treemapData = {
        name: 'root',
        children: currentData.map(d => ({
            name: d.label,
            value: d.value,
            originalData: d
        }))
    };
    
    // Create treemap layout
    const treemap = d3.treemap()
        .size([width, height])
        .padding(2)
        .round(true);
    
    // Apply treemap layout
    const root = d3.hierarchy(treemapData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
    
    treemap(root);
    
    // Create treemap rectangles
    const nodes = svg.selectAll('.treemap-node')
        .data(root.leaves())
        .enter()
        .append('g')
        .attr('class', 'treemap-node')
        .attr('transform', d => `translate(${d.x0},${d.y0})`)
        .on('mouseover', function(event, d) {
            showTooltip(event, d.data.originalData);
            d3.select(this).select('rect').attr('stroke-width', 3);
        })
        .on('mouseout', function() {
            hideTooltip();
            d3.select(this).select('rect').attr('stroke-width', 1);
        });
    
    // Add rectangles
    nodes.append('rect')
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', (d, i) => d3.schemeCategory10[i % 10])
        .attr('stroke', '#fff')
        .attr('stroke-width', 1)
        .attr('opacity', 0)
        .transition()
        .duration(800)
        .delay((d, i) => i * 50)
        .attr('opacity', 0.8);
    
    // Add labels only for rectangles large enough to display text
    nodes.filter(d => (d.x1 - d.x0) > 30 && (d.y1 - d.y0) > 20)
        .append('text')
        .attr('x', 5)
        .attr('y', 15)
        .attr('font-size', '11px')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
        .attr('opacity', 0)
        .text(d => {
            const name = d.data.name;
            const maxWidth = d.x1 - d.x0 - 10;
            return name.length > maxWidth / 6 ? name.substring(0, Math.floor(maxWidth / 6)) + '...' : name;
        })
        .transition()
        .duration(600)
        .delay((d, i) => 800 + (i * 30))
        .attr('opacity', 1);
    
    // Add value labels for larger rectangles
    nodes.filter(d => (d.x1 - d.x0) > 80 && (d.y1 - d.y0) > 30)
        .append('text')
        .attr('x', 5)
        .attr('y', 30)
        .attr('font-size', '10px')
        .attr('fill', 'white')
        .attr('opacity', 0)
        .text(d => d3.format('.2s')(d.data.value))
        .transition()
        .duration(600)
        .delay((d, i) => 1000 + (i * 30))
        .attr('opacity', 0.9);
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
    
    // Position tooltip with better logic to avoid going off-screen
    const rect = event.target.getBoundingClientRect();
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let top = rect.top - tooltipHeight - 10;
    
    // Ensure tooltip doesn't go off-screen horizontally
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
    
    // Ensure tooltip doesn't go off-screen vertically - prefer below the bubble
    if (top < 10) {
        // If above doesn't fit, try below
        top = rect.bottom + 10;
        // If below also doesn't fit, try to the side
        if (top + tooltipHeight > window.innerHeight - 10) {
            if (rect.left > tooltipWidth + 20) {
                // Position to the left of the bubble
                left = rect.left - tooltipWidth - 10;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
            } else if (rect.right + tooltipWidth + 20 < window.innerWidth) {
                // Position to the right of the bubble
                left = rect.right + 10;
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
            }
        }
    }
    
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
    
    // Create chart based on selected type
    const chartType = chartTypeSelect.value || 'bubble';
    if (chartType === 'treemap') {
        createTreemapChart();
    } else {
        createBubbleChart();
    }
    
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
        
        // Create chart based on selected type
        const chartType = chartTypeSelect.value || 'bubble';
        if (chartType === 'treemap') {
            createTreemapChart();
        } else {
            createBubbleChart();
        }
        
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
    
    // Create chart based on selected type
    const chartType = chartTypeSelect.value || 'bubble';
    if (chartType === 'treemap') {
        createTreemapChart();
    } else {
        createBubbleChart();
    }
    
    createDataTable();
    createChartStats();
}
