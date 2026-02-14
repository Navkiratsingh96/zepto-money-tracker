// Inject the "Spy Script" into the main page
const s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
s.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(s);

// Listen for the data coming from the Spy Script
window.addEventListener("ZEPTO_ORDER_DATA", (event) => {
    const orders = event.detail;
    if (orders && orders.length > 0) {
        // Save to Chrome Storage
        chrome.storage.local.get(['expenses'], (result) => {
            let existing = result.expenses || [];
            
            // Add new orders (avoid duplicates by checking Order ID)
            let count = 0;
            orders.forEach(newOrder => {
                const exists = existing.some(e => e.id === newOrder.id);
                if (!exists) {
                    existing.push(newOrder);
                    count++;
                }
            });

            chrome.storage.local.set({ expenses: existing }, () => {
                console.log(`[Zepto Tracker] Saved ${count} new orders!`);
            });
        });
    }
}, false);
