class FingerprintUI {
    constructor() {
        this.deviceId = '8C128B2B1838';
        this.apiBase = '/api';
        this.isOnline = false;
        this.users = [];
        this.logs = [];
        this.enrollmentActive = false;
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startAutoRefresh();
        
        // Show dashboard by default
        this.showSection('dashboard');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.getAttribute('href').substring(1);
                this.showSection(sectionId);
                
                // Update active nav item
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                });
                link.parentElement.classList.add('active');
            });
        });

        // Enrollment form
        document.getElementById('enrollmentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.startEnrollment();
        });

        // Refresh buttons
        document.querySelectorAll('[onclick*="refresh"]').forEach(btn => {
            btn.addEventListener('click', () => this.refreshSystemStatus());
        });
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected section
        document.getElementById(sectionId).classList.add('active');
    }

    async loadInitialData() {
        await Promise.all([
            this.loadSystemStatus(),
            this.loadUsers(),
            this.loadAccessLogs()
        ]);
    }

    async loadSystemStatus() {
        try {
            const response = await fetch(`${this.apiBase}/devices/${this.deviceId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateSystemStatus(data.device);
                    this.isOnline = true;
                }
            }
        } catch (error) {
            console.error('Error loading system status:', error);
            this.setOfflineStatus();
        }
    }

    async loadUsers() {
        try {
            const response = await fetch(`${this.apiBase}/devices/${this.deviceId}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.device.users) {
                    this.users = data.device.users;
                    this.renderUsers();
                }
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async loadAccessLogs() {
        try {
            const response = await fetch(`${this.apiBase}/logs/access?deviceId=${this.deviceId}&limit=50`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.logs = data.logs;
                    this.renderAccessLogs();
                    this.renderRecentActivity();
                    this.updateStats();
                }
            }
        } catch (error) {
            console.error('Error loading access logs:', error);
        }
    }

    updateSystemStatus(device) {
        // Update status indicators
        document.getElementById('statusText').textContent = 'System Online';
        document.getElementById('statusDot').className = 'status-dot online';
        
        // Update device info
        document.getElementById('lastUpdate').textContent = `Last update: ${this.formatTime(new Date())}`;
        document.getElementById('settingsLastSeen').textContent = this.formatTime(new Date(device.lastSeen));
        document.getElementById('settingsUserCount').textContent = device.users?.length || 0;
        
        // Update stats
        this.updateStats();
    }

    setOfflineStatus() {
        this.isOnline = false;
        document.getElementById('statusText').textContent = 'System Offline';
        document.getElementById('statusDot').className = 'status-dot offline';
        document.getElementById('settingsStatus').textContent = 'Offline';
        document.getElementById('settingsStatus').className = 'status-badge offline';
    }

    renderUsers() {
        const container = document.getElementById('usersGrid');
        
        if (this.users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No users registered</p>
                    <button class="btn btn-primary" onclick="ui.showEnrollmentModal()">
                        Add First User
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.users.map(user => `
            <div class="user-card">
                <div class="user-header">
                    <div class="user-avatar">
                        ${user.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-info">
                        <h3>${user.name}</h3>
                        <p>ID: ${user.id}</p>
                    </div>
                </div>
                <div class="user-details">
                    <div class="detail-item">
                        <label>Card ID:</label>
                        <span>${user.cardId || 'Not set'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Phone:</label>
                        <span>${user.phone || 'Not set'}</span>
                    </div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-danger btn-sm" onclick="ui.deleteUser(${user.id})">
                        <i class="fas fa-trash"></i>
                        Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderAccessLogs() {
        const container = document.getElementById('accessLogsList');
        const filter = document.getElementById('logFilter').value;
        const dateFilter = document.getElementById('logDate').value;

        let filteredLogs = this.logs;

        // Apply filters
        if (filter !== 'all') {
            filteredLogs = filteredLogs.filter(log => 
                filter === 'granted' ? log.granted : !log.granted
            );
        }

        if (dateFilter) {
            filteredLogs = filteredLogs.filter(log => {
                const logDate = new Date(log.timestamp).toISOString().split('T')[0];
                return logDate === dateFilter;
            });
        }

        if (filteredLogs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <p>No logs match the current filters</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredLogs.map(log => `
            <div class="log-item">
                <span>${this.formatTime(new Date(log.timestamp))}</span>
                <span>${log.userName}</span>
                <span>${log.cardId || 'N/A'}</span>
                <span class="log-status ${log.granted ? 'granted' : 'denied'}">
                    ${log.granted ? 'Granted' : 'Denied'}
                </span>
            </div>
        `).join('');
    }

    renderRecentActivity() {
        const container = document.getElementById('recentActivity');
        const recentLogs = this.logs.slice(0, 5);

        if (recentLogs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = recentLogs.map(log => `
            <div class="activity-item">
                <div class="activity-icon ${log.granted ? 'granted' : 'denied'}">
                    <i class="fas fa-${log.granted ? 'check' : 'times'}"></i>
                </div>
                <div class="activity-info">
                    <h4>${log.userName}</h4>
                    <p>${log.cardId || 'No Card ID'}</p>
                </div>
                <div class="activity-time">
                    ${this.formatRelativeTime(new Date(log.timestamp))}
                </div>
            </div>
        `).join('');
    }

    updateStats() {
        // Update user count
        document.getElementById('totalUsers').textContent = this.users.length;
        document.getElementById('settingsUserCount').textContent = this.users.length;

        // Calculate today's access
        const today = new Date().toDateString();
        const todayAccess = this.logs.filter(log => 
            new Date(log.timestamp).toDateString() === today && log.granted
        ).length;
        document.getElementById('todayAccess').textContent = todayAccess;

        // Calculate denied attempts
        const deniedAttempts = this.logs.filter(log => !log.granted).length;
        document.getElementById('deniedAttempts').textContent = deniedAttempts;
    }

    async startEnrollment() {
        const id = document.getElementById('enrollId').value;
        const name = document.getElementById('enrollName').value;
        const phone = document.getElementById('enrollPhone').value;
        const cardId = document.getElementById('enrollCardId').value;

        if (!id || !name || !phone || !cardId) {
            this.showToast('Please fill all fields', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    type: 'enroll',
                    id: parseInt(id),
                    name,
                    phone,
                    cardId
                })
            });

            if (response.ok) {
                this.showEnrollmentStatus(name, cardId);
                this.showToast('Enrollment started successfully', 'success');
                document.getElementById('enrollmentForm').reset();
            } else {
                this.showToast('Failed to start enrollment', 'error');
            }
        } catch (error) {
            console.error('Error starting enrollment:', error);
            this.showToast('Error starting enrollment', 'error');
        }
    }

    showEnrollmentStatus(name, cardId) {
        document.getElementById('currentEnrollName').textContent = name;
        document.getElementById('currentEnrollCardId').textContent = cardId;
        document.getElementById('enrollmentForm').classList.add('hidden');
        document.getElementById('enrollmentStatus').classList.remove('hidden');
        
        this.enrollmentActive = true;
        this.monitorEnrollment();
    }

    async monitorEnrollment() {
        const checkInterval = setInterval(async () => {
            if (!this.enrollmentActive) {
                clearInterval(checkInterval);
                return;
            }

            await this.loadUsers();
            
            // Check if the enrolled user now exists
            const enrolledUser = this.users.find(user => user.name === document.getElementById('currentEnrollName').textContent);
            
            if (enrolledUser) {
                this.hideEnrollmentStatus();
                this.showToast('Enrollment completed successfully!', 'success');
                clearInterval(checkInterval);
            }
        }, 2000);

        // Timeout after 2 minutes
        setTimeout(() => {
            if (this.enrollmentActive) {
                this.hideEnrollmentStatus();
                this.showToast('Enrollment timeout', 'warning');
                clearInterval(checkInterval);
            }
        }, 120000);
    }

    hideEnrollmentStatus() {
        document.getElementById('enrollmentStatus').classList.add('hidden');
        document.getElementById('enrollmentForm').classList.remove('hidden');
        this.enrollmentActive = false;
    }

    cancelEnrollment() {
        this.hideEnrollmentStatus();
        this.showToast('Enrollment cancelled', 'warning');
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user?')) return;

        try {
            const response = await fetch(`${this.apiBase}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    type: 'delete',
                    id: userId
                })
            });

            if (response.ok) {
                this.showToast('User deleted successfully', 'success');
                this.loadUsers();
            } else {
                this.showToast('Failed to delete user', 'error');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showToast('Error deleting user', 'error');
        }
    }

    async clearAllUsers() {
        if (!confirm('This will delete ALL users. This action cannot be undone.')) return;

        try {
            const response = await fetch(`${this.apiBase}/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    type: 'clear'
                })
            });

            if (response.ok) {
                this.showToast('All users cleared successfully', 'success');
                this.loadUsers();
            } else {
                this.showToast('Failed to clear users', 'error');
            }
        } catch (error) {
            console.error('Error clearing users:', error);
            this.showToast('Error clearing users', 'error');
        }
    }

    async refreshSystemStatus() {
        await this.loadInitialData();
        this.showToast('System status refreshed', 'success');
    }

    showEnrollmentModal() {
        this.showSection('enrollment');
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Remove toast after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', {
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    }

    startAutoRefresh() {
        // Refresh data every 30 seconds
        setInterval(() => {
            this.loadInitialData();
        }, 30000);
    }
}

// Global functions for HTML onclick handlers
function filterLogs() {
    ui.renderAccessLogs();
}

function showEnrollmentModal() {
    ui.showEnrollmentModal();
}

function cancelEnrollment() {
    ui.cancelEnrollment();
}

function clearAllUsers() {
    ui.clearAllUsers();
}

function refreshSystemStatus() {
    ui.refreshSystemStatus();
}

// Initialize the application
let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new FingerprintUI();
});
