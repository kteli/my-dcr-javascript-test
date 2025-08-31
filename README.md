# Country Data Visualization

A modern web application that visualizes country data using interactive bubble charts and comprehensive tables. Built with vanilla JavaScript and D3.js for the Digital Control Room JavaScript test.

## 🎯 Project Overview

This application allows users to visualize country data through different perspectives:
- **Country-level metrics**: Population, borders, timezones, languages
- **Region-level aggregations**: Country counts and unique timezone counts per region

## ✨ Features Implemented

### Core Requirements ✅
- **Interactive Form**: Dropdown selection for different data visualization types
- **Bubble Chart**: Dynamic D3.js visualization with smooth animations
- **Data Table**: Comprehensive table view with rankings and percentages
- **Rich Tooltips**: Detailed hover information for each data point

### Enhanced Features 🚀
- **Complete Data Access**: No artificial limits - view all 250+ countries and regions
- **Smart Pagination**: Configurable items per page (25, 50, 100, 200, All)
- **Advanced Search & Filter**: Real-time search through all data
- **Loading Progress**: Visual feedback during data processing
- **Chart Statistics**: Summary statistics with current page and total data info
- **Smooth Animations**: Bubbles and labels animate in with staggered delays
- **Responsive Design**: Adapts to different screen sizes
- **Interactive Elements**: Hover effects and smooth transitions
- **Error Handling**: Robust error handling for data loading issues
- **Keyboard Navigation**: Use arrow keys to navigate pages

## 🛠️ Tech Stack

- **Frontend**: Pure HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Charts**: D3.js v7 for data visualization
- **Styling**: Modern CSS with Flexbox, Grid, and CSS animations
- **Data Processing**: Client-side data aggregation using Map and Set
- **No Frameworks**: Built entirely with native web technologies as requested

## 📁 Project Structure

```
dcr-javascript-test-main/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling and animations
├── script.js           # JavaScript functionality and D3.js charts
├── data/
│   └── countries.json  # Source country data (19456 lines)
└── README.md           # This documentation
```

## 🚀 How to Run

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.x or Node.js (for local server)

### Step 1: Clone/Download
```bash
# If you have the repository
git clone <repository-url>
cd dcr-javascript-test-main

# Or simply download and extract the project files
```

### Step 2: Start Local Server
Due to CORS restrictions when loading JSON files, you need to serve the files from a local server:

**Option A: Python 3 (Recommended)**
```bash
python3 -m http.server 8000
```

**Option B: Node.js**
```bash
npx http-server
```

### Step 3: Open Application
Navigate to `http://localhost:8000` in your web browser.

## 📊 Data Visualization Options

### Country Metrics
- **Population Size**: Visualizes population distribution across countries
- **Number of Borders**: Shows countries by their border count
- **Number of Timezones**: Displays countries by timezone count
- **Number of Languages**: Visualizes linguistic diversity

### Region Aggregations
- **Countries per Region**: Shows region sizes by country count
- **Unique Timezones per Region**: Displays timezone diversity by region

## 🔍 Search & Filter System

### Real-time Search
- **Instant Filtering**: Type to search through all countries and regions
- **Smart Matching**: Case-insensitive search with partial matching
- **Clear Results**: Clear button to reset search instantly
- **Results Counter**: Shows how many items match your search

### Search Features
- **Live Updates**: Charts and tables update as you type
- **No Results Handling**: Helpful messages when no matches found
- **Search Persistence**: Search term maintained during pagination
- **Performance**: Efficient client-side filtering

## 📄 Pagination System

### Flexible Display Options
- **25 items per page**: For detailed analysis
- **50 items per page**: Balanced view (default)
- **100 items per page**: For broader overview
- **200 items per page**: Maximum pagination
- **All items**: View everything at once

### Navigation Features
- **Page Controls**: Previous/Next buttons
- **Page Numbers**: Direct page navigation
- **Smart Ellipsis**: Shows relevant page ranges
- **Current Page**: Always know where you are
- **Keyboard Navigation**: Use arrow keys to navigate

