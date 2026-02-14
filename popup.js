document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today
  const dateInput = document.getElementById('itemDate');
  if (dateInput) dateInput.valueAsDate = new Date();

  loadData();

  // Button Listeners
  document.getElementById('addBtn').addEventListener('click', addExpense);
  document.getElementById('scanBtn').addEventListener('click', scanPageForTotal);
  document.getElementById('clearData').addEventListener('click', clearAllData);
  
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderTab(e.target.dataset.tab);
    });
  });
});

let expenses = [];

function loadData() {
  chrome.storage.local.get(['expenses'], (result) => {
    if (result.expenses) {
      expenses = result.expenses;
      updateTotal();
      renderTab('recent');
    }
  });
}

function addExpense() {
  const name = document.getElementById('itemName').value;
  const price = parseFloat(document.getElementById('itemPrice').value);
  const date = document.getElementById('itemDate').value;

  if (!name || isNaN(price) || !date) {
    alert("Please enter a valid Name, Price, and Date.");
    return;
  }

  saveExpense({ id: Date.now(), name, price, date });
  
  // Clear inputs
  document.getElementById('itemName').value = '';
  document.getElementById('itemPrice').value = '';
  alert("Expense Added!");
}

function saveExpense(expense) {
  expenses.push(expense);
  chrome.storage.local.set({ expenses }, () => {
    updateTotal();
    renderTab(document.querySelector('.tab-btn.active').dataset.tab);
  });
}

// --- UPDATED SCANNER LOGIC ---
function scanPageForTotal() {
  const msg = document.getElementById('scanMsg');
  msg.textContent = "Scanning...";

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    // 1. Check if we are on Zepto
    if(!tabs[0].url.includes("zeptonow")) {
      alert("DEBUG: This does not look like Zepto. URL: " + tabs[0].url);
      msg.textContent = "❌ Not Zepto site.";
      return;
    }
    
    // 2. Inject Script
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: scrapeTotalFromPage
    }, (results) => {
      // 3. Handle Errors
      if (chrome.runtime.lastError) {
        alert("Error: " + chrome.runtime.lastError.message);
        return;
      }

      if (results && results[0] && results[0].result) {
        const foundPrice = results[0].result;
        document.getElementById('itemPrice').value = foundPrice;
        document.getElementById('itemName').value = "Zepto Order";
        msg.textContent = "✅ Found: ₹" + foundPrice;
      } else {
        alert("DEBUG: Scanner ran but found NO prices. Try scrolling down the page to ensure the Total is visible, then try again.");
        msg.textContent = "❌ No price found.";
      }
    });
  });
}

// This runs on the Zepto page
function scrapeTotalFromPage() {
  // Method A: Look for text like "Grand Total ₹240"
  const bodyText = document.body.innerText;
  
  // Regex to find prices (looks for Rupee symbol or just numbers near 'Total')
  // Matches: ₹ 123, ₹123, 123.00
  const regex = /[₹|Rs\.?]\s?(\d{1,5}(\.\d{2})?)/gi;
  const matches = [...bodyText.matchAll(regex)];
  
  if (matches.length > 0) {
    // Convert all found strings to Numbers
    const prices = matches.map(m => parseFloat(m[1].replace(/,/g, ''))); // remove commas
    
    // Usually the highest number on the receipt page is the Total
    const maxPrice = Math.max(...prices);
    return maxPrice;
  }
  return null;
}

// --- DASHBOARD LOGIC (Same as before) ---
function updateTotal() {
  const total = expenses.reduce((sum, item) => sum + item.price, 0);
  document.getElementById('totalSpent').textContent = '₹' + total.toFixed(0);
}

function renderTab(tabName) {
  const content = document.getElementById('contentArea');
  content.innerHTML = '';
  let html = '';

  if (expenses.length === 0) {
    content.innerHTML = '<p style="text-align:center; color:#999;">No orders tracked yet.</p>';
    return;
  }

  if (tabName === 'recent') {
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(item => html += createRow(item.name, item.price, item.date));
  } 
  else if (tabName === 'top') {
    const sorted = [...expenses].sort((a, b) => b.price - a.price).slice(0, 5);
    html += '<h4>Highest Spends</h4>';
    sorted.forEach(item => html += createRow(item.name, item.price, item.date));
  } 
  else if (tabName === 'monthly') {
    const groups = expenses.reduce((acc, item) => {
      const month = item.date.substring(0, 7); 
      if (!acc[month]) acc[month] = 0;
      acc[month] += item.price;
      return acc;
    }, {});
    Object.keys(groups).sort().reverse().forEach(month => {
      html += createRow(month, groups[month], 'Total');
    });
  }
  content.innerHTML = html;
}

function createRow(left, price, right) {
  return `
    <div class="list-item">
      <span><strong>${left}</strong> <br> <small style="color:#999">${right}</small></span>
      <span style="font-weight:bold; color:#3d0752">₹${price.toFixed(0)}</span>
    </div>
  `;
}

function clearAllData() {
  if(confirm("Delete all Zepto history?")) {
    chrome.storage.local.clear(() => {
      expenses = [];
      updateTotal();
      renderTab('recent');
    });
  }
}
