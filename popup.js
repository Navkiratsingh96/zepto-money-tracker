document.addEventListener('DOMContentLoaded', () => {
  // Set default date
  const dateInput = document.getElementById('itemDate');
  if (dateInput) dateInput.valueAsDate = new Date();

  loadData();

  // Buttons
  document.getElementById('addBtn').addEventListener('click', addExpense);
  document.getElementById('scanBtn').addEventListener('click', startScan);
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
    alert("Please fill in Name and Price");
    return;
  }

  saveExpense({ id: Date.now(), name, price, date });
  
  document.getElementById('itemName').value = '';
  document.getElementById('itemPrice').value = '';
  alert("Saved!");
}

function saveExpense(expense) {
  // Prevent duplicates (simple check based on price and date)
  const isDuplicate = expenses.some(e => e.price === expense.price && e.date === expense.date);
  if (!isDuplicate) {
    expenses.push(expense);
    chrome.storage.local.set({ expenses }, () => {
      updateTotal();
      renderTab('recent');
    });
  }
}

// --- NEW SCANNER LOGIC ---
function startScan() {
  const msg = document.getElementById('scanMsg');
  msg.textContent = "Scanning...";

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const url = tabs[0].url;
    
    // Check for Zepto (now supports zepto.com AND zeptonow.com)
    if (!url.includes("zepto")) {
      msg.textContent = "❌ Go to Zepto website first.";
      return;
    }

    chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      function: scrapePage
    }, (results) => {
      if (chrome.runtime.lastError) {
        msg.textContent = "❌ Error: " + chrome.runtime.lastError.message;
        return;
      }

      if (results && results[0] && results[0].result) {
        const data = results[0].result;
        
        if (data.type === 'single') {
          // Found one price (Order Detail page)
          document.getElementById('itemPrice').value = data.price;
          document.getElementById('itemName').value = "Zepto Order";
          msg.textContent = "✅ Found: ₹" + data.price;
        } 
        else if (data.type === 'list') {
          // Found MULTIPLE orders (History page)
          const confirmAdd = confirm(`Found ${data.items.length} orders on this page totaling ₹${data.total}. Add them all?`);
          if (confirmAdd) {
            data.items.forEach(item => {
              saveExpense({ 
                id: Date.now() + Math.random(), 
                name: "Zepto Order", 
                price: item.price, 
                date: new Date().toISOString().split('T')[0] // Default to today as history dates are hard to parse
              });
            });
            msg.textContent = `✅ Added ${data.items.length} orders!`;
          } else {
            msg.textContent = "Cancelled.";
          }
        }
      } else {
        msg.textContent = "❌ No prices found. Scroll down?";
      }
    });
  });
}

// This function runs INSIDE the web page
function scrapePage() {
  const bodyText = document.body.innerText;
  
  // 1. Find all prices (e.g. ₹249 or ₹ 1,299)
  const regex = /[₹|Rs\.?]\s?([0-9,]{1,6})/gi;
  const matches = [...bodyText.matchAll(regex)];
  
  if (matches.length === 0) return null;

  const prices = matches.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(p => p > 0);

  // Strategy: If we find MANY prices, it's likely the History List.
  if (prices.length > 3) {
    // Return all of them (filtering out small numbers like discounts/savings if possible, but taking all for now)
    // We assume valid orders are usually > 10 rupees
    const validOrders = prices.filter(p => p > 10);
    const total = validOrders.reduce((a, b) => a + b, 0);
    return { type: 'list', items: validOrders.map(p => ({price: p})), total: total };
  } 
  else {
    // If few prices, assume it's a Detail page and take the max (Grand Total)
    return { type: 'single', price: Math.max(...prices) };
  }
}

// --- DASHBOARD ---
function updateTotal() {
  const total = expenses.reduce((sum, item) => sum + item.price, 0);
  document.getElementById('totalSpent').textContent = '₹' + total.toFixed(0);
}

function renderTab(tabName) {
  const content = document.getElementById('contentArea');
  content.innerHTML = '';
  let html = '';

  if (expenses.length === 0) {
    content.innerHTML = '<p style="text-align:center; color:#999;">No data.</p>';
    return;
  }

  // RECENT TAB
  if (tabName === 'recent') {
    const sorted = [...expenses].sort((a, b) => b.id - a.id);
    sorted.forEach(item => html += createRow(item.name, item.price, item.date));
  } 
  // TOP ITEMS TAB
  else if (tabName === 'top') {
    const sorted = [...expenses].sort((a, b) => b.price - a.price).slice(0, 5);
    html += '<h4>Highest Spends</h4>';
    sorted.forEach(item => html += createRow(item.name, item.price, item.date));
  } 
  // MONTHLY TAB
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
  if(confirm("Clear all data?")) {
    chrome.storage.local.clear(() => {
      expenses = [];
      updateTotal();
      renderTab('recent');
    });
  }
}
