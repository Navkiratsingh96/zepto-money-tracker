(function() {
    // Save the original fetch function
    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        
        // Clone the response so we can read it without breaking the site
        const clone = response.clone();
        
        // Check if the URL looks like an Order History request
        // Zepto API usually contains "orders" or "history"
        if (args[0].toString().includes("orders")) {
            clone.json().then(data => {
                // Parse Zepto's specific JSON structure
                // Note: We try to handle different API shapes gracefully
                let items = [];
                
                // If the API returns a list of orders directly
                if (Array.isArray(data)) {
                    items = data;
                } 
                // If the API returns { count: 10, results: [...] }
                else if (data.results || data.orders || data.data) {
                    items = data.results || data.orders || data.data;
                }

                if (items.length > 0) {
                    // Convert raw Zepto data into our simple format
                    const cleanOrders = items.map(o => ({
                        id: o.id || o.order_id || Math.random().toString(),
                        date: o.created_at || o.order_date || new Date().toISOString(),
                        price: parseFloat(o.amount || o.total_amount || o.payable_amount || o.grand_total || 0),
                        name: "Zepto Order" // We could parse items here too if we wanted
                    })).filter(o => o.price > 0); // Remove cancelled/zero orders

                    // Send data to content.js
                    window.dispatchEvent(new CustomEvent("ZEPTO_ORDER_DATA", { detail: cleanOrders }));
                }
            }).catch(err => {
                // Ignore JSON errors (some requests aren't JSON)
            });
        }
        
        return response;
    };
})();
