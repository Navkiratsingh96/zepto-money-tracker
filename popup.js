document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('itemDate').valueAsDate = new Date();
  loadData();

  document.getElementById('addBtn').addEventListener('click', addExpense);
  document.getElementById('scanBtn').addEventListener('click', scanPageForTotal);
  document.getElementById('clearData').addEventListener('click', clearAllData);
  
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

  if (!name || isNaN(price) || !date) return;

  saveExpense({ id: Date.now(), name, price, date });
  
  // Clear inputs
  document.getElementById('itemName').value = '';
  document.getElementById('itemPrice').value = '';
}

function saveExpense(expense) {
  expenses.push(expense);
  chrome.storage.local.set({ expenses }, () => {
    updateTotal();
    renderTab(document.querySelector('.tab-btn.active').dataset.tab);
  });
}

// --- NEW: Page Scanning Logic ---
function scanPageForTotal() {
  const msg = document.getElementById('scanMsg');
  msg.textContent = "Scanning page...";

  // Execute script in the active tab
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if(!tabs[0].url.includes("zepto")) {
      msg.textContent = "⚠️ Use this on Zepto order page.";
      return;
    }
    
    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: scrapeTotalFromPage
    }, (results) => {
      if (results && results[0] && results[0].result) {
        // If script found a price, fill the input
        document.getElementById('itemPrice').value = results[0].result;
        document.getElementById('itemName').value = "Order Total (Scanned)";
        msg.textContent = "✅ Found price! Click Add.";
      } else {
        msg.textContent = "❌ Couldn't find a clear total.";
      }
    });
  });
}

// This function runs INSIDE the web page
function scrapeTotalFromPage() {
  // Regex to look for Rupee symbol followed by digits (e.g., ₹240)
  // This is safer than class names because Zepto class names change.
  const regex = /₹\s?(\d{1,5}(\.\d{2})?)/g;
  const bodyText = document.body.innerText;
  const matches = [...bodyText.matchAll(regex)];
  
  if (matches.length > 0) {
    // Usually the last "price" on a summary page is the Grand Total
    // Or we find the highest value. Let's try finding the highest value found.
    const prices = matches.map(m => parseFloat(m[1]));
    return Math.max(...prices);
  }
  return null;
}
// --------------------------------

function updateTotal() {
  const total = expenses.reduce((sum, item) => sum + item.price, 0);
  document.getElementById('totalSpent').textContent = '₹' + total.toFixed(0);
}

function renderTab(tabName) {
  const content = document.getElementById('contentArea');
  content.innerHTML = '';
  let html = '';

  if (expenses.length === 0) {
    content.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px">No orders tracked yet.</p>';
    return;
  }

  if (tabName === 'recent') {
    const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(item => html += createRow(item.name, item.price, item.date));
  } 
  else if (tabName === 'top') {
    // Sort by most expensive items
    const sorted = [...expenses].sort((a, b) => b.price - a.price).slice(0, 5);
    html += '<h4>Most Expensive</h4>';
    sorted.forEach(item => html += createRow(item.name, item.price, item.date));
  } 
  else if (tabName === 'monthly') {
    const groups = expenses.reduce((acc, item) => {
      const month = item.date.substring(0, 7); // 2024-02
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
