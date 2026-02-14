document.addEventListener('DOMContentLoaded', () => {
    updateUI();
    
    document.getElementById('clearBtn').addEventListener('click', () => {
        if(confirm("Clear history?")) {
            chrome.storage.local.clear(updateUI);
        }
    });
});

function updateUI() {
    chrome.storage.local.get(['expenses'], (result) => {
        const expenses = result.expenses || [];
        
        // Calculate Total
        const total = expenses.reduce((sum, item) => sum + item.price, 0);
        document.getElementById('totalAmount').textContent = '₹' + Math.round(total);
        document.getElementById('orderCount').textContent = expenses.length + ' Orders Tracked';

        // Render List
        const list = document.getElementById('orderList');
        list.innerHTML = '';
        
        expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).forEach(item => {
            const date = new Date(item.date).toLocaleDateString();
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `
                <span>${date}</span>
                <strong>₹${item.price}</strong>
            `;
            list.appendChild(div);
        });
    });
}
