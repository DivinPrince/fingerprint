// Fingerprint Dashboard Client-Side Script
console.log('🔐 Fingerprint Dashboard loaded');

// Update current time every second
function updateTime() {
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        const now = new Date();
        timeElement.textContent = now.toLocaleTimeString();
    }
}

// Auto-refresh functionality
let autoRefreshInterval;
const REFRESH_INTERVAL = 30000; // 30 seconds

function startAutoRefresh() {
    // Update time every second
    setInterval(updateTime, 1000);
    
    // Auto-refresh page every 30 seconds
    autoRefreshInterval = setInterval(() => {
        console.log('Auto-refreshing page...');
        window.location.reload();
    }, REFRESH_INTERVAL);
}

// Check if we should auto-refresh based on the current tab
function shouldAutoRefresh() {
    const url = new URL(window.location.href);
    const tab = url.searchParams.get('tab') || 'dashboard';
    
    // Auto-refresh dashboard, devices, and logs tabs
    return ['dashboard', 'devices', 'logs', 'events'].includes(tab);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    // Update time immediately
    updateTime();
    
    // Start auto-refresh if on relevant tabs
    if (shouldAutoRefresh()) {
        startAutoRefresh();
        console.log(`Auto-refresh enabled (every ${REFRESH_INTERVAL/1000}s)`);
    }
    
    // Add smooth transitions to stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
    });
    
    // Add confirmation dialogs for destructive actions
    const deleteButtons = document.querySelectorAll('button[type="submit"]');
    deleteButtons.forEach(button => {
        const form = button.closest('form');
        if (form && form.action.includes('delete')) {
            button.addEventListener('click', function(e) {
                if (!confirm('Are you sure you want to delete this item?')) {
                    e.preventDefault();
                }
            });
        }
    });
    
    // Handle escape key to close any modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Close any open modals or dropdowns
            console.log('Escape key pressed');
        }
    });
    
    // Add toast notification for successful actions
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('success')) {
        showToast('Action completed successfully!', 'success');
    }
    
    // Log current page state
    console.log('Current tab:', urlParams.get('tab') || 'dashboard');
    console.log('Selected device:', urlParams.get('device') || 'all');
});

// Toast notification function
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white transform transition-transform z-50 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        type === 'warning' ? 'bg-yellow-500' : 
        'bg-blue-500'
    }`;
    toast.textContent = message;
    toast.style.transform = 'translateX(400px)';
    
    document.body.appendChild(toast);
    
    // Slide in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Slide out and remove
    setTimeout(() => {
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Handle network errors gracefully
window.addEventListener('error', function(e) {
    console.error('Page error:', e.message);
});

// Warn before leaving if there's unsaved data
window.addEventListener('beforeunload', function(e) {
    // Only show warning if there's a form with unsaved changes
    const forms = document.querySelectorAll('form');
    let hasUnsavedChanges = false;
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (input.value && input.defaultValue !== input.value) {
                hasUnsavedChanges = true;
            }
        });
    });
    
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});

// Add loading indicator for page transitions
window.addEventListener('beforeunload', function() {
    document.body.style.opacity = '0.7';
});

console.log('✅ Dashboard script loaded successfully');
