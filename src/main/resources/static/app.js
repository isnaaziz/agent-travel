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
let activeHistoryFilter = 'active';

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
    initFlightAndHotelModules();
    initEticketModal();
    
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
            } else if (activeTab === 'flights') {
                document.getElementById('page-title').textContent = 'Book Cheap Flights';
                document.getElementById('page-subtitle').textContent = 'Compare and book flight tickets to top worldwide destinations.';
                const flightDateInput = document.getElementById('flight-date');
                if (flightDateInput && !flightDateInput.value) {
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    flightDateInput.value = nextWeek.toISOString().split('T')[0];
                }
            } else if (activeTab === 'hotels') {
                document.getElementById('page-title').textContent = 'Premium Hotels & Resorts';
                document.getElementById('page-subtitle').textContent = 'Book luxury staycations, holiday villas, and cheap hotel deals.';
                const hotelDateInput = document.getElementById('hotel-date');
                if (hotelDateInput && !hotelDateInput.value) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    hotelDateInput.value = tomorrow.toISOString().split('T')[0];
                }
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
    const isStaff = user && (user.role === 'ADMIN' || user.role === 'OPERATOR');
    
    const staffStats = document.getElementById('staff-booking-stats');
    const staffView = document.getElementById('staff-bookings-view');
    const userFilters = document.getElementById('user-history-filters');
    const userView = document.getElementById('user-bookings-view');
    
    if (isStaff) {
        staffStats?.classList.remove('hidden');
        staffView?.classList.remove('hidden');
        userFilters?.classList.add('hidden');
        userView?.classList.add('hidden');
        
        renderAdminBookings();
    } else {
        staffStats?.classList.add('hidden');
        staffView?.classList.add('hidden');
        userFilters?.classList.remove('hidden');
        userView?.classList.remove('hidden');
        
        renderUserBookings();
    }
}

function renderAdminBookings() {
    bookingsTableBody.innerHTML = '';
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
                            <button class="btn btn-primary btn-sm btn-action-pay" style="padding: 0.25rem 0.50rem; font-size: 0.75rem; font-family: inherit; gap: 4px; display: inline-flex; align-items: center;" data-id="${booking.id}">
                                <i class="fa-solid fa-credit-card"></i> Pay Now
                            </button>
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
        
        const confirmBtn = row.querySelector('.btn-action-confirm');
        const cancelBtn = row.querySelector('.btn-action-cancel');
        const payBtn = row.querySelector('.btn-action-pay');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => updateStatus(booking.id, 'CONFIRMED'));
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => updateStatus(booking.id, 'CANCELLED'));
        }
        if (payBtn) {
            payBtn.addEventListener('click', () => initiatePayment(booking.id));
        }
        
        bookingsTableBody.appendChild(row);
    });
}

function renderUserBookings() {
    const userViewContainer = document.getElementById('user-bookings-view');
    userViewContainer.innerHTML = '';
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    const filteredBookings = bookings.filter(b => {
        if (activeHistoryFilter === 'active') {
            return b.status === 'PENDING' || (b.status === 'CONFIRMED' && b.travelDate >= todayStr);
        } else if (activeHistoryFilter === 'past') {
            return b.status === 'CONFIRMED' && b.travelDate < todayStr;
        } else if (activeHistoryFilter === 'cancelled') {
            return b.status === 'CANCELLED';
        }
        return true;
    });
    
    bookingsCountBadge.textContent = bookings.length;
    
    if (filteredBookings.length === 0) {
        noBookingsView.classList.remove('hidden');
        return;
    }
    
    noBookingsView.classList.add('hidden');
    
    filteredBookings.forEach(booking => {
        const card = document.createElement('div');
        card.className = 'booking-card';
        
        const travelDate = new Date(booking.travelDate).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const defaultImg = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=200&q=80';
        const imgUrl = booking.destination.imageUrl || defaultImg;
        
        let statusLabel = 'Payment Pending';
        if (booking.status === 'CONFIRMED') {
            statusLabel = 'E-Ticket Issued';
        } else if (booking.status === 'CANCELLED') {
            statusLabel = 'Cancelled / Refunded';
        }
        
        let category = 'Holiday Package';
        let categoryIcon = 'fa-compass';
        if (booking.destination.name.toLowerCase().includes('flight') || booking.destination.description?.toLowerCase().includes('flight')) {
            category = 'Flight Ticket';
            categoryIcon = 'fa-plane';
        } else if (booking.destination.name.toLowerCase().includes('hotel') || booking.destination.description?.toLowerCase().includes('hotel')) {
            category = 'Hotel Room';
            categoryIcon = 'fa-hotel';
        }
        
        card.innerHTML = `
            <div class="booking-card-left">
                <img class="booking-card-img" src="${imgUrl}" alt="${booking.destination.name}" onerror="this.src='${defaultImg}'">
                <div class="booking-card-meta">
                    <span class="booking-card-category" style="${category === 'Flight Ticket' ? 'color:#ef4444;' : category === 'Hotel Room' ? 'color:#10b981;' : 'color:#3b82f6;'}">
                        <i class="fa-solid ${categoryIcon}"></i> ${category}
                    </span>
                    <h4 class="booking-card-title">${booking.destination.name}</h4>
                    <div class="booking-card-info">
                        <span><i class="fa-regular fa-calendar" style="color:var(--secondary);"></i> ${travelDate}</span>
                        <span><i class="fa-regular fa-clock" style="color:var(--primary);"></i> ${booking.duration} days</span>
                        <span><i class="fa-regular fa-user" style="color:var(--success);"></i> ${booking.customerName}</span>
                    </div>
                </div>
            </div>
            <div class="booking-card-right">
                <span class="status-tag ${booking.status.toLowerCase()}">${statusLabel}</span>
                <div class="booking-card-price">${formatCurrency(booking.totalPrice)}</div>
                <div style="display:flex; gap:0.5rem; margin-top:0.25rem;">
                    ${booking.status === 'PENDING' ? `
                        <button class="btn btn-primary btn-sm btn-action-pay" style="padding:0.4rem 0.8rem; font-size:0.8rem; font-family:inherit; display:flex; align-items:center; gap:4px;" data-id="${booking.id}">
                            <i class="fa-solid fa-credit-card"></i> Pay Now
                        </button>
                        <button class="btn btn-secondary btn-sm btn-action-cancel" style="padding:0.4rem 0.6rem; font-size:0.8rem; font-family:inherit;" data-id="${booking.id}">
                            Cancel
                        </button>
                    ` : booking.status === 'CONFIRMED' ? `
                        <button class="btn btn-primary btn-sm btn-action-eticket" style="padding:0.4rem 0.8rem; font-size:0.8rem; background:linear-gradient(135deg, #0284c7, #0369a1); border-color:#0284c7; font-family:inherit; display:flex; align-items:center; gap:4px;" data-id="${booking.id}">
                            <i class="fa-solid fa-ticket"></i> View E-Ticket
                        </button>
                    ` : `
                        <span style="font-size:0.8rem; color:var(--text-muted);">Refund Processed</span>
                    `}
                </div>
            </div>
        `;
        
        const payBtn = card.querySelector('.btn-action-pay');
        const cancelBtn = card.querySelector('.btn-action-cancel');
        const eticketBtn = card.querySelector('.btn-action-eticket');
        
        if (payBtn) payBtn.addEventListener('click', () => initiatePayment(booking.id));
        if (cancelBtn) cancelBtn.addEventListener('click', () => updateStatus(booking.id, 'CANCELLED'));
        if (eticketBtn) eticketBtn.addEventListener('click', () => openEticket(booking.id));
        
        userViewContainer.appendChild(card);
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

async function initiatePayment(bookingId) {
    showToast('Initializing payment checkout...', 'info');
    try {
        const response = await fetch(`${BOOKINGS_API}/${bookingId}/pay`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (response.status === 403 || response.status === 401) {
            showToast('Access denied. Please login again.', 'error');
            return;
        }
        
        const resData = await response.json();
        if (resData.success) {
            const paymentData = resData.data;
            if (paymentData.isMock) {
                openMockPaymentGateway(bookingId, paymentData);
            } else {
                openMidtransSnap(bookingId, paymentData);
            }
        } else {
            showToast(resData.message || 'Failed to initiate payment', 'error');
        }
    } catch (err) {
        console.error('Payment initialization error:', err);
        showToast('Network error during checkout', 'error');
    }
}

function openMidtransSnap(bookingId, paymentData) {
    const snapScriptUrl = paymentData.redirectUrl.includes("sandbox") 
        ? "https://app.sandbox.midtrans.com/snap/snap.js" 
        : "https://app.midtrans.com/snap/snap.js";

    let script = document.querySelector(`script[src="${snapScriptUrl}"]`);
    if (!script) {
        script = document.createElement('script');
        script.src = snapScriptUrl;
        script.setAttribute('data-client-key', paymentData.clientKey);
        document.body.appendChild(script);
        
        script.onload = () => {
            triggerSnapPay(bookingId, paymentData.token);
        };
    } else {
        triggerSnapPay(bookingId, paymentData.token);
    }
}

function triggerSnapPay(bookingId, token) {
    if (window.snap) {
        window.snap.pay(token, {
            onSuccess: function(result) {
                showToast('Payment successful! Processing ticket...', 'success');
                setTimeout(() => loadBookings(), 1000);
            },
            onPending: function(result) {
                showToast('Payment pending. Please complete your transaction.', 'warning');
                setTimeout(() => loadBookings(), 1000);
            },
            onError: function(result) {
                showToast('Payment failed. Please try again.', 'error');
            },
            onClose: function() {
                showToast('Payment popup closed.', 'info');
            }
        });
    } else {
        showToast('Midtrans Snap SDK loading failed.', 'error');
    }
}

function openMockPaymentGateway(bookingId, paymentData) {
    injectMockPaymentStyles();
    
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
        showToast('Booking details not found', 'error');
        return;
    }
    
    const backdrop = document.createElement('div');
    backdrop.className = 'mock-payment-backdrop';
    backdrop.id = 'mock-payment-backdrop';
    
    const amountStr = formatCurrency(booking.totalPrice);
    
    backdrop.innerHTML = `
        <div class="mock-payment-modal">
            <div class="mock-loader hidden" id="mock-payment-loader">
                <div class="spinner"></div>
                <p id="mock-loader-text">Processing your transaction...</p>
            </div>
            
            <div class="mock-payment-header">
                <h3><i class="fa-solid fa-shield-halved"></i> AgentTravel Secure Pay</h3>
                <button class="mock-payment-close" id="btn-close-mock-pay">&times;</button>
            </div>
            
            <div class="mock-payment-summary">
                <div><span>Booking ID</span><span style="font-weight:600; color:#a78bfa;">#B-${booking.id}</span></div>
                <div><span>Destination</span><span>${booking.destination.name}</span></div>
                <div><span>Traveler</span><span>${booking.customerName}</span></div>
                <div><span>Amount to Pay</span><span>${amountStr}</span></div>
            </div>
            
            <div class="mock-payment-tabs">
                <button class="mock-tab-btn active" data-mock-tab="qris">
                    <i class="fa-solid fa-qrcode"></i>
                    <span>QRIS / GoPay</span>
                </button>
                <button class="mock-tab-btn" data-mock-tab="va">
                    <i class="fa-solid fa-university"></i>
                    <span>Virtual Account</span>
                </button>
                <button class="mock-tab-btn" data-mock-tab="cc">
                    <i class="fa-solid fa-credit-card"></i>
                    <span>Credit Card</span>
                </button>
            </div>
            
            <div class="mock-tab-content">
                <div class="mock-qris-area" id="mock-pane-qris">
                    <div class="mock-qr-code">
                        <div style="width: 90px; height: 90px; background: repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 15px 15px;"></div>
                    </div>
                    <span style="font-size: 0.75rem; color: var(--text-muted); margin-top:0.5rem;">Scan this QR code using GoPay, ShopeePay, or Dana</span>
                </div>
                
                <div class="mock-va-area hidden" id="mock-pane-va">
                    <label style="font-size:0.75rem; color:var(--text-muted); margin-bottom: 0.25rem; display:block;">Select Target Bank</label>
                    <select class="mock-va-select">
                        <option>BCA Virtual Account (88301)</option>
                        <option>Mandiri Virtual Account (88302)</option>
                        <option>BNI Virtual Account (88303)</option>
                    </select>
                    <div class="mock-va-number-box" style="margin-top:0.75rem;">
                        <span style="font-size: 0.7rem; color: var(--text-muted); display:block; margin-bottom: 2px;">VIRTUAL ACCOUNT NUMBER</span>
                        <span class="mock-va-number" id="mock-va-num-display">88301${booking.id}771</span>
                    </div>
                </div>
                
                <div class="mock-cc-area hidden" id="mock-pane-cc">
                    <input type="text" class="mock-input" placeholder="Card Number (4111 1111 1111 1111)" value="4111 1111 1111 1111" disabled style="margin-bottom:0.50rem;">
                    <div class="mock-cc-row">
                        <input type="text" class="mock-input" placeholder="MM/YY" value="12/28" disabled>
                        <input type="text" class="mock-input" placeholder="CVV" value="123" disabled>
                    </div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); margin-top:0.25rem; text-align:center; display:block;">Fully simulated card transaction environment</span>
                </div>
            </div>
            
            <div class="mock-payment-footer">
                <button class="btn btn-secondary" id="btn-mock-simulate-expire" style="border-color: rgba(239, 68, 68, 0.2); color:#f87171;">Simulate Expire</button>
                <button class="btn btn-primary" id="btn-mock-simulate-success"><i class="fa-solid fa-circle-check"></i> Simulate Success</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    
    const tabBtns = backdrop.querySelectorAll('.mock-tab-btn');
    const panes = {
        qris: backdrop.querySelector('#mock-pane-qris'),
        va: backdrop.querySelector('#mock-pane-va'),
        cc: backdrop.querySelector('#mock-pane-cc')
    };
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const target = btn.getAttribute('data-mock-tab');
            Object.keys(panes).forEach(k => {
                if (k === target) {
                    panes[k].classList.remove('hidden');
                } else {
                    panes[k].classList.add('hidden');
                }
            });
        });
    });
    
    const closeModal = () => {
        backdrop.classList.add('hidden');
        setTimeout(() => backdrop.remove(), 300);
    };
    
    backdrop.querySelector('#btn-close-mock-pay').addEventListener('click', closeModal);
    
    const loader = backdrop.querySelector('#mock-payment-loader');
    const loaderText = backdrop.querySelector('#mock-loader-text');
    
    backdrop.querySelector('#btn-mock-simulate-success').addEventListener('click', async () => {
        loaderText.textContent = "Verifying transaction settlement...";
        loader.classList.remove('hidden');
        
        await new Promise(r => setTimeout(r, 1500));
        
        try {
            const response = await fetch(`${API_URL}/api/payments/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: `B-${booking.id}-mock-${Date.now()}`,
                    transaction_status: 'settlement',
                    payment_type: 'qris',
                    gross_amount: String(booking.totalPrice),
                    status_code: '200'
                })
            });
            
            const resData = await response.json();
            if (resData.success) {
                showToast(`Payment successfully completed for Booking #B-${booking.id}!`, 'success');
                closeModal();
                loadBookings();
            } else {
                showToast(resData.message || 'Mock settlement callback failed', 'error');
                loader.classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            showToast('Connection failed during simulated callback', 'error');
            loader.classList.add('hidden');
        }
    });
    
    backdrop.querySelector('#btn-mock-simulate-expire').addEventListener('click', async () => {
        loaderText.textContent = "Cancelling payment request...";
        loader.classList.remove('hidden');
        
        await new Promise(r => setTimeout(r, 1000));
        
        try {
            const response = await fetch(`${API_URL}/api/payments/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: `B-${booking.id}-mock-${Date.now()}`,
                    transaction_status: 'expire',
                    payment_type: 'qris',
                    gross_amount: String(booking.totalPrice),
                    status_code: '407'
                })
            });
            
            const resData = await response.json();
            if (resData.success) {
                showToast(`Simulated payment expiration for Booking #B-${booking.id}`, 'warning');
                closeModal();
                loadBookings();
            } else {
                showToast('Mock callback failed', 'error');
                loader.classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            showToast('Connection failed during simulation', 'error');
            loader.classList.add('hidden');
        }
    });
}

function injectMockPaymentStyles() {
    if (document.getElementById('mock-payment-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'mock-payment-styles';
    styleEl.textContent = `
        .mock-payment-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(10, 10, 15, 0.85);
            backdrop-filter: blur(12px);
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        }
        .mock-payment-modal {
            background: linear-gradient(135deg, rgba(20, 20, 30, 0.95), rgba(15, 15, 25, 0.98));
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            border-radius: 20px;
            width: 480px;
            max-width: 95%;
            padding: 2rem;
            color: #ffffff;
            font-family: 'Outfit', sans-serif;
            position: relative;
            overflow: hidden;
        }
        .mock-payment-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            padding-bottom: 1rem;
        }
        .mock-payment-header h3 {
            margin: 0;
            font-size: 1.35rem;
            font-weight: 600;
            color: #a78bfa;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .mock-payment-close {
            background: none;
            border: none;
            color: var(--text-muted);
            font-size: 1.5rem;
            cursor: pointer;
            transition: color 0.2s;
        }
        .mock-payment-close:hover {
            color: #ffffff;
        }
        .mock-payment-summary {
            background: rgba(255, 255, 255, 0.03);
            border-radius: 12px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .mock-payment-summary div {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
            font-size: 0.9rem;
        }
        .mock-payment-summary div:last-child {
            margin-bottom: 0;
            padding-top: 0.5rem;
            border-top: 1px dashed rgba(255, 255, 255, 0.1);
            font-weight: 700;
            font-size: 1.05rem;
            color: #ffffff;
        }
        .mock-payment-tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            padding-bottom: 0.75rem;
        }
        .mock-tab-btn {
            flex: 1;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: var(--text-muted);
            padding: 0.6rem 0.5rem;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.8rem;
            transition: all 0.2s ease;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
            font-family: inherit;
        }
        .mock-tab-btn i {
            font-size: 1.1rem;
        }
        .mock-tab-btn.active {
            background: rgba(167, 139, 250, 0.1);
            border-color: rgba(167, 139, 250, 0.3);
            color: #a78bfa;
        }
        .mock-tab-content {
            min-height: 140px;
            margin-bottom: 1.5rem;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .mock-qris-area {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.75rem;
            text-align: center;
        }
        .mock-qr-code {
            background: #ffffff;
            padding: 8px;
            border-radius: 8px;
            width: 110px;
            height: 110px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .mock-qr-code::after {
            content: "QRIS MOCK";
            position: absolute;
            bottom: -8px;
            background: #e11d48;
            color: white;
            font-size: 0.55rem;
            padding: 1px 4px;
            border-radius: 3px;
            font-weight: 800;
        }
        .mock-va-area {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .mock-va-select {
            width: 100%;
            background: rgba(20, 20, 30, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            padding: 0.5rem;
            border-radius: 6px;
            font-family: inherit;
            font-size: 0.85rem;
            outline: none;
        }
        .mock-va-number-box {
            background: rgba(255, 255, 255, 0.02);
            border: 1px dashed rgba(255, 255, 255, 0.1);
            padding: 0.75rem;
            border-radius: 8px;
            text-align: center;
        }
        .mock-va-number {
            font-family: monospace;
            font-size: 1.3rem;
            font-weight: 700;
            color: #34d399;
            letter-spacing: 1px;
        }
        .mock-cc-area {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }
        .mock-input {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            padding: 0.5rem;
            border-radius: 6px;
            font-size: 0.85rem;
            width: 100%;
            box-sizing: border-box;
        }
        .mock-cc-row {
            display: flex;
            gap: 0.5rem;
        }
        .mock-payment-footer {
            display: flex;
            gap: 0.75rem;
        }
        .mock-payment-footer button {
            flex: 1;
        }
        .mock-loader {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15, 15, 25, 0.95);
            z-index: 10;
            border-radius: 20px;
        }
    `;
    document.head.appendChild(styleEl);
}

const MOCK_AIRLINES = [
    { name: 'Garuda Indonesia', code: 'GA-874', logo: 'fa-paper-plane', timeDep: '08:30', timeArr: '16:15', dur: '5h 45m', price: 3450000, color: '#0369a1' },
    { name: 'Singapore Airlines', code: 'SQ-951', logo: 'fa-plane', timeDep: '14:20', timeArr: '20:10', dur: '4h 50m', price: 4200000, color: '#b45309' },
    { name: 'Japan Airlines', code: 'JL-726', logo: 'fa-jet-fighter', timeDep: '21:55', timeArr: '06:30', dur: '6h 35m', price: 5800000, color: '#be123c' },
    { name: 'Batik Air', code: 'ID-601', logo: 'fa-plane-departure', timeDep: '06:15', timeArr: '12:45', dur: '6h 30m', price: 1850000, color: '#4d7c0f' }
];

const MOCK_HOTELS = [
    { name: 'Kyoto Zen Garden House', rating: 4.9, country: 'Japan', price: 1250000, imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=400&q=80', desc: 'Serene traditional ryokan experience with views of our authentic rock garden.' },
    { name: 'Marina Bay Sands Villa', rating: 4.8, country: 'Singapore', price: 3800000, imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80', desc: 'World-renowned infinity pool, shopping complex, and high-end suites.' },
    { name: 'Bali Cliff Luxury Resort', rating: 4.7, country: 'Indonesia', price: 2100000, imageUrl: 'https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=400&q=80', desc: 'Breathtaking ocean views perched atop Jimbaran cliffs, private plunge pool.' },
    { name: 'Parisian Classic Suite', rating: 4.6, country: 'France', price: 2900000, imageUrl: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=400&q=80', desc: 'Charming romantic architecture in the heart of Paris, gourmet breakfasts.' }
];

function initFlightAndHotelModules() {
    const searchFlightsBtn = document.getElementById('btn-search-flights');
    if (searchFlightsBtn) {
        searchFlightsBtn.addEventListener('click', performFlightSearch);
    }
    
    const searchHotelsBtn = document.getElementById('btn-search-hotels');
    if (searchHotelsBtn) {
        searchHotelsBtn.addEventListener('click', performHotelSearch);
    }
    
    const historyTabs = document.querySelectorAll('.history-tab');
    historyTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            historyTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeHistoryFilter = tab.getAttribute('data-history-filter');
            renderBookings();
        });
    });
}

function initEticketModal() {
    const eticketModal = document.getElementById('eticket-modal');
    const closeBtn = document.getElementById('close-eticket-modal');
    const closeFooterBtn = document.getElementById('btn-close-eticket');
    const printBtn = document.getElementById('btn-print-eticket');
    
    const closeModal = () => {
        eticketModal?.classList.add('hidden');
    };
    
    closeBtn?.addEventListener('click', closeModal);
    closeFooterBtn?.addEventListener('click', closeModal);
    
    printBtn?.addEventListener('click', () => {
        window.print();
    });
}

async function performFlightSearch() {
    const loader = document.getElementById('flights-loading');
    const resultsContainer = document.getElementById('flight-results-container');
    
    loader.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
    
    await new Promise(r => setTimeout(r, 1200));
    
    const origin = document.getElementById('flight-origin').value;
    const dest = document.getElementById('flight-destination').value;
    
    MOCK_AIRLINES.forEach(airline => {
        const adjustedPrice = airline.price + (Math.floor(Math.random() * 200000) - 100000);
        const card = document.createElement('div');
        card.className = 'flight-airline-card';
        card.innerHTML = `
            <div class="airline-info">
                <div class="airline-logo-box" style="border-color: ${airline.color};">
                    <i class="fa-solid ${airline.logo}" style="color:${airline.color};"></i>
                </div>
                <div class="airline-details">
                    <span class="airline-name">${airline.name}</span>
                    <span class="airline-code">${airline.code} • Business</span>
                </div>
            </div>
            <div class="flight-time-block">
                <div class="time-node">
                    <span class="time-val">${airline.timeDep}</span>
                    <span class="time-city">${origin}</span>
                </div>
                <div class="flight-connector">
                    <span class="flight-dur">${airline.dur}</span>
                    <div class="flight-line"></div>
                    <span style="font-size:0.6rem; color:var(--text-muted);">Direct</span>
                </div>
                <div class="time-node">
                    <span class="time-val">${airline.timeArr}</span>
                    <span class="time-city">${dest}</span>
                </div>
            </div>
            <div style="font-weight: 700; font-size: 1.15rem; color:#a78bfa; text-align:center;">
                ${formatCurrency(adjustedPrice)}
            </div>
            <div style="text-align:right;">
                <button class="btn btn-primary btn-book-airline" style="padding: 0.5rem 1rem; font-size: 0.85rem; font-family:inherit;">
                    <i class="fa-solid fa-calendar-check"></i> Book Flight
                </button>
            </div>
        `;
        
        card.querySelector('.btn-book-airline').addEventListener('click', () => {
            bookFlight({ ...airline, price: adjustedPrice });
        });
        
        resultsContainer.appendChild(card);
    });
    
    loader.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
}

async function performHotelSearch() {
    const loader = document.getElementById('hotels-loading');
    const resultsContainer = document.getElementById('hotel-results-container');
    
    loader.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
    resultsContainer.innerHTML = '';
    
    await new Promise(r => setTimeout(r, 1200));
    
    MOCK_HOTELS.forEach(hotel => {
        const adjustedPrice = hotel.price + (Math.floor(Math.random() * 100000) - 50000);
        const card = document.createElement('div');
        card.className = 'dest-card';
        card.innerHTML = `
            <div class="dest-image-wrapper">
                <img src="${hotel.imageUrl}" alt="${hotel.name}">
                <div class="rating-badge">
                    <i class="fa-solid fa-star"></i>
                    <span>${hotel.rating.toFixed(1)}</span>
                </div>
            </div>
            <div class="dest-info">
                <span class="dest-location">${hotel.country}</span>
                <h3 class="dest-title">${hotel.name}</h3>
                <p class="dest-desc">${hotel.desc}</p>
                <div class="dest-footer">
                    <div class="price-meta">
                        <span>Price / Night</span>
                        <p>${formatCurrency(adjustedPrice)}</p>
                    </div>
                    <button class="btn btn-primary btn-book-hotel" style="padding:0.5rem 1rem; font-family:inherit;">
                        <i class="fa-solid fa-calendar-check"></i> Book Room
                    </button>
                </div>
            </div>
        `;
        
        card.querySelector('.btn-book-hotel').addEventListener('click', () => {
            bookHotel({ ...hotel, price: adjustedPrice });
        });
        
        resultsContainer.appendChild(card);
    });
    
    loader.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
}

function bookFlight(airline) {
    if (!token) {
        showToast('Please sign in to book flights!', 'warning');
        openAuthModal('login');
        return;
    }
    
    const origin = document.getElementById('flight-origin').value;
    const dest = document.getElementById('flight-destination').value;
    const dateVal = document.getElementById('flight-date').value;
    
    const destMock = {
        id: 99000 + Math.floor(Math.random() * 100),
        name: `Flight: ${airline.name} (${origin} ➔ ${dest})`,
        country: dest,
        price: airline.price,
        imageUrl: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=300&q=80',
        description: `Flight ticket from ${origin} to ${dest} onboard ${airline.name} (${airline.code}). Seat Class: Business. Departure date: ${dateVal}.`
    };
    
    destinations.push(destMock);
    openBookingModal(destMock);
    
    if (dateVal) {
        document.getElementById('travel-date').value = dateVal;
    }
    document.getElementById('booking-duration').value = 1;
    document.getElementById('modal-dest-price').textContent = formatCurrency(airline.price);
}

function bookHotel(hotel) {
    if (!token) {
        showToast('Please sign in to book hotels!', 'warning');
        openAuthModal('login');
        return;
    }
    
    const dateVal = document.getElementById('hotel-date').value;
    
    const destMock = {
        id: 99100 + Math.floor(Math.random() * 100),
        name: `Hotel: ${hotel.name}`,
        country: hotel.country,
        price: hotel.price,
        imageUrl: hotel.imageUrl,
        description: hotel.desc
    };
    
    destinations.push(destMock);
    openBookingModal(destMock);
    
    if (dateVal) {
        document.getElementById('travel-date').value = dateVal;
    }
    document.getElementById('booking-duration').value = 1;
    document.getElementById('modal-dest-price').textContent = formatCurrency(hotel.price);
}

function openEticket(bookingId) {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) {
        showToast('Booking details not found', 'error');
        return;
    }
    
    const travelDate = new Date(booking.travelDate).toLocaleDateString('id-ID', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const barcodeMock = `*AT${booking.id}${booking.duration}*`;
    const bookingCode = `AT-20260530-${booking.id}`;
    
    let eticketHtml = `
        <div class="eticket-paper">
            <div class="eticket-paper-header">
                <div class="eticket-logo">
                    <i class="fa-solid fa-plane-departure"></i> AgentTravel
                </div>
                <div class="eticket-receipt">
                    <span style="font-weight: 700; display:block;">E-TICKET / VOUCHER</span>
                    <span style="font-size:0.7rem; opacity:0.85;">Booking Code: ${bookingCode}</span>
                </div>
            </div>
            <div class="eticket-paper-body">
                <div class="eticket-grid">
                    <div class="eticket-info-item">
                        <span class="eticket-info-label">CUSTOMER NAME</span>
                        <span class="eticket-info-value">${booking.customerName}</span>
                    </div>
                    <div class="eticket-info-item">
                        <span class="eticket-info-label">CUSTOMER EMAIL</span>
                        <span class="eticket-info-value">${booking.customerEmail}</span>
                    </div>
                </div>
                
                <div class="eticket-section-title">Itinerary Details</div>
                <div class="eticket-grid">
                    <div class="eticket-info-item">
                        <span class="eticket-info-label">TRAVEL TARGET / ITEM</span>
                        <span class="eticket-info-value" style="color:#0284c7;">${booking.destination.name}</span>
                    </div>
                    <div class="eticket-info-item">
                        <span class="eticket-info-label">COUNTRY / REGION</span>
                        <span class="eticket-info-value">${booking.destination.country}</span>
                    </div>
                    <div class="eticket-info-item">
                        <span class="eticket-info-label">DEPARTURE / CHECK-IN</span>
                        <span class="eticket-info-value">${travelDate}</span>
                    </div>
                    <div class="eticket-info-item">
                        <span class="eticket-info-label">TRIP DURATION</span>
                        <span class="eticket-info-value">${booking.duration} days</span>
                    </div>
                </div>
                
                <div class="eticket-section-title">Passenger / Guest List</div>
                <table class="eticket-table">
                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>Passenger Name</th>
                            <th>Ticket Type</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1.</td>
                            <td><strong>${booking.customerName}</strong></td>
                            <td>Adult (Primary Traveler)</td>
                            <td style="color:#10b981; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Active / Issued</td>
                        </tr>
                    </tbody>
                </table>
                
                <div class="eticket-grid" style="margin-top: 2rem;">
                    <div class="eticket-barcode-box">
                        <span style="font-family:'Courier New', monospace; font-size:1.4rem; font-weight:700; letter-spacing:4px; color:#475569;">${barcodeMock}</span>
                        <span style="font-size:0.6rem; color:#64748b; margin-top:4px;">BARCODE SECURITY ID</span>
                    </div>
                    <div class="eticket-barcode-box" style="flex-direction:row; gap:10px; text-align:left;">
                        <div style="width: 50px; height: 50px; background: repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 50% / 10px 10px;"></div>
                        <div>
                            <span style="font-size: 0.75rem; font-weight: 700; display:block;">Scan QR Ticket</span>
                            <span style="font-size: 0.65rem; color:#64748b;">Scan barcode during check-in or airport gates.</span>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 2rem; padding-top: 1rem; border-top:1px dashed #cbd5e1; font-size: 0.7rem; color:#64748b;">
                    <span style="font-weight: 700; display:block; margin-bottom: 2px;">Terms & Conditions / Syarat & Ketentuan:</span>
                    <p>1. Present this printable ticket or digital QR Code at the boarding/check-in gates.</p>
                    <p>2. Keep your identity passport or KTP card aligned with traveler name listed above.</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('eticket-content').innerHTML = eticketHtml;
    document.getElementById('eticket-modal').classList.remove('hidden');
}
