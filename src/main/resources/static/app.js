// Agent Travel Portal Javascript Logic

// Base API Endpoints
const API_URL = ''; // Relative path, since we serve from the same domain
const DESTINATIONS_API = `${API_URL}/api/destinations`;
const BOOKINGS_API = `${API_URL}/api/bookings`;
const AUTH_API = `${API_URL}/api/auth`;

// App State
let destinations = [];
let bookings = [];
let activeTab = 'explorer';
let currentSelectedDest = null;

// Authentication State
let token = localStorage.getItem('jwt_token') || null;
let user = JSON.parse(localStorage.getItem('user_details')) || null;

// DOM Elements
const destinationsContainer = document.getElementById('destinations-container');
const bookingsTableBody = document.getElementById('bookings-table-body');
const searchInput = document.getElementById('search-input');
const bookingsCountBadge = document.getElementById('bookings-count');
const toastEl = document.getElementById('toast');

// Loading Elements
const explorerLoading = document.getElementById('explorer-loading');
const bookingsLoading = document.getElementById('bookings-loading');
const noBookingsView = document.getElementById('no-bookings-view');

// Stats Elements
const statRevenue = document.getElementById('stat-revenue');
const statConfirmed = document.getElementById('stat-confirmed');
const statPending = document.getElementById('stat-pending');

// Modal Elements
const bookingModal = document.getElementById('booking-modal');
const destinationModal = document.getElementById('destination-modal');
const authModal = document.getElementById('auth-modal');

const bookingForm = document.getElementById('booking-form');
const destinationForm = document.getElementById('destination-form');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

// Auth Header Helper
function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initModals();
    initSearch();
    initAuth();
    
    // Initial Load
    loadDestinations();
    syncAuthUI();
    
    // Set default travel date in modal to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('travel-date').value = tomorrow.toISOString().split('T')[0];

    // Dynamic Price Calculation
    const durationInput = document.getElementById('booking-duration');
    durationInput.addEventListener('input', () => {
        if (currentSelectedDest) {
            const dur = Math.max(1, parseInt(durationInput.value) || 1);
            durationInput.value = dur;
            document.getElementById('modal-dest-price').textContent = formatCurrency(currentSelectedDest.price * dur);
        }
    });
});

// Toast Notifications Helper
function showToast(message, type = 'success') {
    toastEl.textContent = '';
    
    let icon = 'fa-circle-check';
    if (type === 'error') {
        icon = 'fa-circle-exclamation';
        toastEl.style.borderLeftColor = 'var(--danger)';
    } else if (type === 'warning') {
        icon = 'fa-triangle-exclamation';
        toastEl.style.borderLeftColor = 'var(--warning)';
    } else {
        toastEl.style.borderLeftColor = 'var(--primary)';
    }

    toastEl.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastEl.classList.remove('hidden');
    
    setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 4500);
}

// Format Currency Utility (IDR)
function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(amount);
}

// 1. Tab Navigation System
function initTabs() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            if (!targetTab) return; // Ignore custom buttons like Swagger

            // Auth Guard on Bookings Tab
            if (targetTab === 'bookings' && !token) {
                showToast('Please sign in to manage customer bookings!', 'warning');
                openAuthModal('login');
                return;
            }

            // Remove active classes
            navButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));

            // Add active class to current selection
            btn.classList.add('active');
            const targetPane = document.getElementById(`tab-${targetTab}`);
            targetPane.classList.add('active');
            
            activeTab = targetTab;
            
            // Trigger refresh when entering tab
            if (activeTab === 'explorer') {
                loadDestinations();
                document.getElementById('page-title').textContent = 'Explore the World';
                document.getElementById('page-subtitle').textContent = 'Select a destination and finalize customer bookings easily.';
            } else if (activeTab === 'bookings') {
                loadBookings();
                const isStaff = user && (user.role === 'ADMIN' || user.role === 'OPERATOR');
                document.getElementById('page-title').textContent = isStaff ? 'Manage Customer Bookings' : 'My Travel Bookings';
                document.getElementById('page-subtitle').textContent = isStaff 
                    ? 'Track and confirm transactions, payments, and client statuses.'
                    : 'Track your packages, download tickets, and keep up with tour statuses.';
            }
        });
    });
}

// 2. Modals Management
function initModals() {
    // Add Destination Modal triggers
    document.getElementById('btn-add-destination').addEventListener('click', () => {
        if (!token) {
            showToast('Sign in required to add new travel destinations!', 'warning');
            openAuthModal('login');
            return;
        }
        destinationModal.classList.remove('hidden');
    });

    document.getElementById('close-dest-modal').addEventListener('click', () => {
        destinationModal.classList.add('hidden');
    });
    document.getElementById('btn-cancel-dest-modal').addEventListener('click', () => {
        destinationModal.classList.add('hidden');
    });

    // Booking Modal Close triggers
    document.getElementById('close-booking-modal').addEventListener('click', () => {
        bookingModal.classList.add('hidden');
    });
    document.getElementById('btn-cancel-booking-modal').addEventListener('click', () => {
        bookingModal.classList.add('hidden');
    });

    // Form Submissions
    bookingForm.addEventListener('submit', handleBookingSubmit);
    destinationForm.addEventListener('submit', handleDestinationSubmit);
}

// 3. Search & Filter System (Debounced)
let searchTimeout;
function initSearch() {
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = searchInput.value.trim();
            loadDestinations(query);
        }, 350);
    });
}

// 4. Fetch Destinations
async function loadDestinations(keyword = '') {
    explorerLoading.classList.remove('hidden');
    destinationsContainer.classList.add('hidden');
    
    try {
        let url = DESTINATIONS_API;
        if (keyword) {
            url += `?keyword=${encodeURIComponent(keyword)}`;
        }
        
        const response = await fetch(url);
        const resData = await response.json();
        
        if (resData.success) {
            destinations = resData.data;
            renderDestinations();
        } else {
            showToast(resData.message || 'Failed to fetch destinations', 'error');
        }
    } catch (err) {
        console.error('Error fetching destinations:', err);
        showToast('Unable to connect to the server', 'error');
    } finally {
        explorerLoading.classList.add('hidden');
        destinationsContainer.classList.remove('hidden');
    }
}

// Render Destinations to Explorer Grid
function renderDestinations() {
    destinationsContainer.innerHTML = '';
    
    if (destinations.length === 0) {
        destinationsContainer.innerHTML = `
            <div class="empty-view" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-plane-slash"></i>
                <p>No destinations found matching your criteria.</p>
            </div>
        `;
        return;
    }
    
    destinations.forEach(dest => {
        const defaultImg = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80';
        const imgUrl = dest.imageUrl || defaultImg;
        
        const card = document.createElement('div');
        card.className = 'dest-card';
        card.innerHTML = `
            <div class="dest-image-wrapper">
                <img src="${imgUrl}" alt="${dest.name}" onerror="this.src='${defaultImg}'">
                <div class="rating-badge">
                    <i class="fa-solid fa-star"></i>
                    <span>${dest.rating ? dest.rating.toFixed(1) : '4.5'}</span>
                </div>
            </div>
            <div class="dest-info">
                <span class="dest-location">${dest.country}</span>
                <h3 class="dest-title">${dest.name}</h3>
                <p class="dest-desc">${dest.description || 'No description available for this breathtaking destination.'}</p>
                <div class="dest-footer">
                    <div class="price-meta">
                        <span>Price / Pax</span>
                        <p>${formatCurrency(dest.price)}</p>
                    </div>
                    <button class="btn btn-primary btn-book" data-id="${dest.id}">
                        <i class="fa-solid fa-calendar-check"></i> Book Now
                    </button>
                </div>
            </div>
        `;
        
        // Add booking button listener
        card.querySelector('.btn-book').addEventListener('click', () => {
            openBookingModal(dest);
        });
        
        destinationsContainer.appendChild(card);
    });
}

// 5. Fetch Bookings
async function loadBookings() {
    if (!token) return;
    
    bookingsLoading.classList.remove('hidden');
    bookingsTableBody.innerHTML = '';
    
    try {
        const response = await fetch(BOOKINGS_API, {
            headers: getAuthHeaders()
        });
        
        // Handle Session Expiry or Unauthorized
        if (response.status === 403 || response.status === 401) {
            handleSignOut();
            showToast('Session expired. Please sign in again.', 'warning');
            openAuthModal('login');
            return;
        }
        
        const resData = await response.json();
        
        if (resData.success) {
            bookings = resData.data;
            renderBookings();
            updateDashboardStats();
        } else {
            showToast(resData.message || 'Failed to fetch bookings', 'error');
        }
    } catch (err) {
        console.error('Error fetching bookings:', err);
    } finally {
        bookingsLoading.classList.add('hidden');
    }
}

// Render Bookings in Management Table
function renderBookings() {
    bookingsTableBody.innerHTML = '';
    
    // Update badge in sidebar
    bookingsCountBadge.textContent = bookings.length;
    
    if (bookings.length === 0) {
        noBookingsView.classList.remove('hidden');
        return;
    }
    
    noBookingsView.classList.add('hidden');
    
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        
        const travelDate = new Date(booking.travelDate).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const defaultImg = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=100&q=80';
        const imgUrl = booking.destination.imageUrl || defaultImg;
        
        row.innerHTML = `
            <td>
                <span style="font-weight: 700; color: #a78bfa;">#B-${booking.id}</span>
            </td>
            <td>
                <span class="cust-name">${booking.customerName}</span>
                <span class="cust-email">${booking.customerEmail}</span>
            </td>
            <td>
                <div class="table-dest">
                    <img class="table-dest-img" src="${imgUrl}" alt="${booking.destination.name}" onerror="this.src='${defaultImg}'">
                    <div>
                        <span style="font-weight: 600; display:block;">${booking.destination.name}</span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${booking.destination.country}</span>
                    </div>
                </div>
            </td>
            <td>
                <span style="font-weight: 500;"><i class="fa-regular fa-calendar" style="margin-right: 6px; color: var(--secondary)"></i>${travelDate} (${booking.duration} days)</span>
            </td>
            <td>
                <span style="font-weight: 700; color: #ffffff;">${formatCurrency(booking.totalPrice)}</span>
            </td>
            <td>
                <span class="status-tag ${booking.status.toLowerCase()}">${booking.status}</span>
            </td>
            <td>
                <div style="display:flex; gap: 0.50rem;">
                    ${booking.status === 'PENDING' ? (
                        (user && (user.role === 'ADMIN' || user.role === 'OPERATOR')) ? `
                            <button class="btn-icon-only btn-success-light btn-action-confirm" title="Confirm Booking" data-id="${booking.id}">
                                <i class="fa-solid fa-check"></i>
                            </button>
                            <button class="btn-icon-only btn-danger-light btn-action-cancel" title="Cancel Booking" data-id="${booking.id}">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        ` : `
                            <button class="btn-icon-only btn-danger-light btn-action-cancel" title="Cancel Booking" data-id="${booking.id}">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        `
                    ) : `
                        <span style="font-size:0.8rem; color:var(--text-muted);">Processed</span>
                    `}
                </div>
            </td>
        `;
        
        // Action Listeners
        const confirmBtn = row.querySelector('.btn-action-confirm');
        const cancelBtn = row.querySelector('.btn-action-cancel');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => updateStatus(booking.id, 'CONFIRMED'));
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => updateStatus(booking.id, 'CANCELLED'));
        }
        
        bookingsTableBody.appendChild(row);
    });
}

// 6. Update Dashboard Widgets
function updateDashboardStats() {
    let totalRevenue = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    
    bookings.forEach(b => {
        if (b.status === 'CONFIRMED') {
            totalRevenue += b.totalPrice;
            confirmedCount++;
        } else if (b.status === 'PENDING') {
            pendingCount++;
        }
    });
    
    statRevenue.textContent = formatCurrency(totalRevenue);
    statConfirmed.textContent = confirmedCount;
    statPending.textContent = pendingCount;

    const statRevenueTitle = document.querySelector('.stat-card .stat-info h3');
    if (statRevenueTitle) {
        const isStaff = user && (user.role === 'ADMIN' || user.role === 'OPERATOR');
        statRevenueTitle.textContent = isStaff ? 'Total Revenue' : 'Total Spent';
    }
}

// 7. Booking Processes
function openBookingModal(dest) {
    if (!token) {
        showToast('Please sign in to book travel packages!', 'warning');
        openAuthModal('login');
        return;
    }

    document.getElementById('booking-destination-id').value = dest.id;
    document.getElementById('modal-dest-name').textContent = dest.name;
    document.getElementById('modal-dest-country').textContent = dest.country;
    document.getElementById('modal-dest-price').textContent = formatCurrency(dest.price);
    
    const defaultImg = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=150&q=80';
    document.getElementById('modal-dest-image').src = dest.imageUrl || defaultImg;

    currentSelectedDest = dest;
    document.getElementById('booking-duration').value = 1;

    // Pre-fill fields with user details
    if (user) {
        document.getElementById('customer-name').value = user.name;
        document.getElementById('customer-email').value = user.email;
    }
    
    bookingModal.classList.remove('hidden');
    document.getElementById('travel-date').focus();
}

async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const destId = document.getElementById('booking-destination-id').value;
    const name = document.getElementById('customer-name').value;
    const email = document.getElementById('customer-email').value;
    const date = document.getElementById('travel-date').value;
    const duration = parseInt(document.getElementById('booking-duration').value) || 1;
    
    const requestPayload = {
        customerName: name,
        customerEmail: email,
        destinationId: parseInt(destId),
        travelDate: date,
        duration: duration
    };
    
    try {
        const response = await fetch(BOOKINGS_API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(requestPayload)
        });
        
        if (response.status === 403) {
            showToast('Unauthorized action. Please sign in again.', 'error');
            return;
        }

        const resData = await response.json();
        
        if (resData.success) {
            showToast('Booking successfully created! Stand by for confirmations.', 'success');
            bookingModal.classList.add('hidden');
            bookingForm.reset();
            
            // Re-set default travel date
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('travel-date').value = tomorrow.toISOString().split('T')[0];
            
            // Redirect to Bookings to view transaction
            document.querySelector('[data-tab="bookings"]').click();
        } else {
            const errMsg = resData.errors ? resData.errors.join(', ') : resData.message;
            showToast(errMsg || 'Failed to finalize booking.', 'error');
        }
    } catch (err) {
        console.error('Error creating booking:', err);
        showToast('Network error while processing booking', 'error');
    }
}

// 8. Add Destination Process
async function handleDestinationSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('dest-name').value;
    const country = document.getElementById('dest-country').value;
    const price = document.getElementById('dest-price').value;
    const imgUrl = document.getElementById('dest-image').value;
    const rating = document.getElementById('dest-rating').value;
    const desc = document.getElementById('dest-description').value;
    
    const requestPayload = {
        name: name,
        country: country,
        price: parseFloat(price),
        imageUrl: imgUrl || null,
        rating: parseFloat(rating),
        description: desc
    };
    
    try {
        const response = await fetch(DESTINATIONS_API, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(requestPayload)
        });
        
        const resData = await response.json();
        
        if (resData.success) {
            showToast(`Destination "${name}" successfully added!`, 'success');
            destinationModal.classList.add('hidden');
            destinationForm.reset();
            document.getElementById('dest-rating').value = '4.8';
            
            // Refresh list
            loadDestinations();
        } else {
            const errMsg = resData.errors ? resData.errors.join(', ') : resData.message;
            showToast(errMsg || 'Failed to create destination.', 'error');
        }
    } catch (err) {
        console.error('Error adding destination:', err);
        showToast('Network error while adding destination', 'error');
    }
}

// 9. Update Booking Status (PATCH API)
async function updateStatus(bookingId, status) {
    try {
        const response = await fetch(`${BOOKINGS_API}/${bookingId}/status?status=${status}`, {
            method: 'PATCH',
            headers: getAuthHeaders()
        });
        
        const resData = await response.json();
        
        if (resData.success) {
            showToast(`Booking #${bookingId} has been ${status.toLowerCase()}!`, 'success');
            loadBookings();
        } else {
            showToast(resData.message || 'Failed to update booking.', 'error');
        }
    } catch (err) {
        console.error('Error updating status:', err);
        showToast('Network error while updating booking', 'error');
    }
}

// 10. Authentication System Functions
function initAuth() {
    const btnLoginTrigger = document.getElementById('btn-login-trigger');
    const btnCloseAuth = document.getElementById('btn-close-auth');
    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    const btnSignout = document.getElementById('btn-signout');

    // Display Modal
    btnLoginTrigger.addEventListener('click', () => openAuthModal('login'));
    btnCloseAuth.addEventListener('click', () => authModal.classList.add('hidden'));

    // Switch Tabs
    tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
    tabRegisterBtn.addEventListener('click', () => switchAuthTab('register'));

    // Sign Out Trigger
    btnSignout.addEventListener('click', handleSignOut);

    // Form Submissions
    loginForm.addEventListener('submit', handleLoginSubmit);
    registerForm.addEventListener('submit', handleRegisterSubmit);

    // Google Buttons (OAuth Simulator)
    document.getElementById('btn-google-login').addEventListener('click', handleGoogleLogin);
    document.getElementById('btn-google-register').addEventListener('click', handleGoogleLogin);
}

function openAuthModal(mode = 'login') {
    authModal.classList.remove('hidden');
    switchAuthTab(mode);
}

function switchAuthTab(mode = 'login') {
    const tabLoginBtn = document.getElementById('tab-login-btn');
    const tabRegisterBtn = document.getElementById('tab-register-btn');
    
    if (mode === 'login') {
        tabLoginBtn.classList.add('active');
        tabRegisterBtn.classList.remove('active');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        document.getElementById('login-email').focus();
    } else {
        tabRegisterBtn.classList.add('active');
        tabLoginBtn.classList.remove('active');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        document.getElementById('register-name').focus();
    }
}

// Auth UI Synchronizer
function syncAuthUI() {
    const headerProfile = document.getElementById('user-profile-header');
    const headerLoginBtn = document.getElementById('btn-login-trigger');
    const sidebarBadge = document.getElementById('bookings-count');

    // 1. Show/Hide Add Destination button based on admin role
    const btnAddDestination = document.getElementById('btn-add-destination');
    if (btnAddDestination) {
        if (user && user.role === 'ADMIN') {
            btnAddDestination.classList.remove('hidden');
        } else {
            btnAddDestination.classList.add('hidden');
        }
    }

    // 2. Dynamic Sidebar tab title based on role
    const bookingsTabSpan = document.querySelector('.nav-btn[data-tab="bookings"] span');
    if (bookingsTabSpan) {
        if (user && (user.role === 'ADMIN' || user.role === 'OPERATOR')) {
            bookingsTabSpan.textContent = 'Manage Bookings';
        } else {
            bookingsTabSpan.textContent = 'My Bookings';
        }
    }

    if (token && user) {
        // Logged In State
        headerLoginBtn.classList.add('hidden');
        headerProfile.classList.remove('hidden');
        
        document.getElementById('user-profile-name').textContent = user.name;
        document.getElementById('user-profile-email').textContent = user.email;
        
        // Avatar Initials
        const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2);
        document.getElementById('user-avatar-initials').textContent = initials;
        
        // Load bookings in background to update badge
        fetch(`${BOOKINGS_API}`, { headers: getAuthHeaders() })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    sidebarBadge.textContent = data.data.length;
                }
            }).catch(e => console.error(e));
    } else {
        // Logged Out State
        headerLoginBtn.classList.remove('hidden');
        headerProfile.classList.add('hidden');
        sidebarBadge.textContent = '0';
        
        // If they were on the bookings tab, force them to Explorer
        if (activeTab === 'bookings') {
            document.querySelector('[data-tab="explorer"]').click();
        }
    }
}

// Traditional Login
async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch(`${AUTH_API}/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const resData = await response.json();
        
        if (resData.success) {
            handleSignInSuccess(resData.data);
            showToast(`Welcome back, ${resData.data.name}!`, 'success');
        } else {
            showToast(resData.message || 'Invalid email or password.', 'error');
        }
    } catch (err) {
        console.error('Error logging in:', err);
        showToast('Network error during login.', 'error');
    }
}

// Traditional Register
async function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch(`${AUTH_API}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const resData = await response.json();
        
        if (resData.success) {
            handleSignInSuccess(resData.data);
            showToast(`Account successfully created! Welcome, ${resData.data.name}!`, 'success');
        } else {
            const errMsg = resData.errors ? resData.errors.join(', ') : resData.message;
            showToast(errMsg || 'Registration failed.', 'error');
        }
    } catch (err) {
        console.error('Error registering:', err);
        showToast('Network error during registration.', 'error');
    }
}

// Branded Google Login (Interactive OAuth Simulator)
async function handleGoogleLogin() {
    let selectedRole = prompt("Simulasi Autentikasi Google OAuth\n\nPilih Peran Anda (USER, ADMIN, atau OPERATOR):", "USER");
    if (selectedRole === null) return; // User cancelled
    
    selectedRole = selectedRole.trim().toUpperCase();
    if (selectedRole !== 'USER' && selectedRole !== 'ADMIN' && selectedRole !== 'OPERATOR') {
        showToast("Peran tidak valid! Silakan masukkan USER, ADMIN, atau OPERATOR.", "error");
        return;
    }

    const fullName = prompt("Simulasi Autentikasi Google OAuth\n\nMasukkan Nama Lengkap Anda:", "Alex Traveler");
    if (!fullName) return; // User cancelled

    const email = prompt("Masukkan Alamat Email Google Anda:", `${fullName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`);
    if (!email) return;

    // Generate mock token: mock_google_[ROLE]_[NAME]_[EMAIL]
    const sanitizedName = fullName.trim().replace(/\s+/g, '-');
    const mockGoogleIdToken = `mock_google_${selectedRole}_${sanitizedName}_${email}`;

    try {
        const response = await fetch(`${AUTH_API}/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: mockGoogleIdToken })
        });
        
        const resData = await response.json();
        
        if (resData.success) {
            handleSignInSuccess(resData.data);
            showToast(`Successfully signed in with Google as ${resData.data.name}!`, 'success');
        } else {
            showToast(resData.message || 'Google Sign-In failed.', 'error');
        }
    } catch (err) {
        console.error('Google Sign-In Error:', err);
        showToast('Network error during Google Sign-In.', 'error');
    }
}

function handleSignInSuccess(authData) {
    token = authData.token;
    user = {
        name: authData.name,
        email: authData.email,
        role: authData.role
    };
    
    localStorage.setItem('jwt_token', token);
    localStorage.setItem('user_details', JSON.stringify(user));
    
    authModal.classList.add('hidden');
    loginForm.reset();
    registerForm.reset();
    
    syncAuthUI();
    
    // Reload bookings if they are logged in and looking at it
    if (activeTab === 'bookings') {
        loadBookings();
    }
}

function handleSignOut() {
    token = null;
    user = null;
    
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user_details');
    
    showToast('Successfully signed out.', 'success');
    syncAuthUI();
}
