(function() {
    // 1. INTERCEPT FETCH (Newer method)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        const clone = response.clone();
        
        if (args[0] && args[0].toString().match(/orders|history/i)) {
            clone.json().then(data => processData(data)).catch(e => {});
        }
        return response;
    };

    // 2. INTERCEPT XHR (Older method, likely what Zepto uses)
    const XHR = XMLHttpRequest.prototype;
    const open = XHR.open;
    const send = XHR.send;

    XHR.open = function(method, url) {
        this._url = url; // Save URL for later
        return open.apply(this, arguments);
    };

    XHR.send = function(postData) {
        this.addEventListener('load', function() {
            if (this._url && this._url.match(/orders|history/i)) {
                try {
                    const data = JSON.parse(this.responseText);
                    processData(data);
                } catch (e) { /* Ignore non-JSON */ }
            }
        });
        return send.apply(this, arguments);
    };

    // 3. PROCESS DATA (The Brain)
    function processData(data) {
        let items = [];
        
        // Handle various Zepto data shapes
        // Shape A: Direct Array [ {id:1}, {id:2} ]
        if (Array.isArray(data)) items = data;
        
        // Shape B: { results: [...] }
        else if (data.results && Array.isArray(data.results)) items = data.results;
        
        // Shape C: { data: { orders: [...] } }
        else if (data.data && data.data.orders) items = data.data.orders;
        
        // Shape D: { store_orders: [...] }
        else if (data.store_orders) items = data.store_orders;

        if (items.length > 0) {
            const cleanOrders = items.map(o => {
                // Try every possible name for "Total Price"
                let price = o.grand_total || o.total_amount || o.payable_amount || o.amount || o.final_amount || 0;
                
                // Try every possible name for "Date"
                let date = o.order_date || o.created_at || o.delivery_date || new Date().toISOString();

                return {
                    id: o.id || o.order_id || Math.random().toString(),
                    date: date,
                    price: parseFloat(price),
                    name: "Zepto Order"
                };
            }).filter(o => o.price > 0);

            if (cleanOrders.length > 0) {
                window.dispatchEvent(new CustomEvent("ZEPTO_ORDER_DATA", { detail: cleanOrders }));
            }
        }
    }
})();
