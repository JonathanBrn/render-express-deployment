// === Admin Logic V2.0 ===

let adminTickets = [];
let currentTicket = null;

// === CONFIGURATION: The heart of the dynamic system ===
// Add new types here in the future without changing logic!
const TYPE_CONFIG = {
    'entry_permit': { 
        label: 'אישור כניסה', 
        icon: 'fa-id-card', 
        color: '#2563eb', // Blue
        class: 'type-entry'
    },
    'maintenance': { // Fallback for specific maintenance types
        label: 'אחזקה', 
        icon: 'fa-wrench', 
        color: '#d97706', // Orange
        class: 'type-maint'
    },
    'computing': { 
        label: 'מחשוב', 
        icon: 'fa-laptop-code', 
        color: '#9333ea', // Purple
        class: 'type-comp'
    },
    'default': { 
        label: 'כללי', 
        icon: 'fa-file-lines', 
        color: '#64748b', 
        class: 'type-def'
    }
};

// Map specific maintenance subtypes to the general maintenance config
const MAINTENANCE_SUBTYPES = ['electricity', 'plumbing', 'air_condition', 'furniture', 'general'];

// Initialize
(function init() {
    fetchAdminData();
})();

// === 1. Fetch Data ===
async function fetchAdminData() {
    const token = localStorage.getItem('authToken');
    const container = document.getElementById('admin-container');

    try {
        const res = await fetch('/api/admin/all-data', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const json = await res.json();

        if (json.success) {
            adminTickets = json.tickets;
            updateStats();
            filterAdminTickets(); // Initial render
        } else {
            alert('Session Expired');
            location.reload();
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:red">
            <i class="fa-solid fa-triangle-exclamation"></i> תקלת תקשורת
        </div>`;
    }
}

// === 2. Stats Calculation ===
function updateStats() {
    const total = adminTickets.length;
    const open = adminTickets.filter(t => t.status === 'open').length;
    const progress = adminTickets.filter(t => t.status === 'in_progress').length;
    const closed = adminTickets.filter(t => t.status === 'closed').length;

    // Element IDs must match HTML
    if(document.getElementById('st-total')) {
        document.getElementById('st-total').innerText = total;
        document.getElementById('st-open').innerText = open;
        document.getElementById('st-closed').innerText = closed; 
        // Optional: Add progress stat to HTML if you want
    }
}

// === 3. Filtering ===
function filterAdminTickets() {
    const search = document.getElementById('adm-search').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;

    const filtered = adminTickets.filter(t => {
        // Search (Deep search in object string)
        const textMatch = JSON.stringify(t).toLowerCase().includes(search);
        
        // Type Filter logic
        let typeMatch = true;
        if (typeFilter === 'entry_permit') typeMatch = (t.type === 'entry_permit');
        if (typeFilter === 'maintenance') typeMatch = (t.type !== 'entry_permit'); // Catch all maintenance

        // Status Filter
        const statusMatch = statusFilter === 'all' || t.status === statusFilter;

        return textMatch && typeMatch && statusMatch;
    });

    renderGrid(filtered);
}

// === 4. Rendering Cards (Updated) ===

function renderGrid(tickets) {
    const container = document.getElementById('admin-container');
    container.innerHTML = '';

    if (tickets.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; margin-top:40px; opacity:0.6;">
            <i class="fa-regular fa-folder-open fa-3x"></i><br>לא נמצאו תוצאות
        </div>`;
        return;
    }

    // מילון תרגום לסוגי תקלות (שלא יופיע באנגלית)
    const typeNames = {
        'electricity': 'חשמל',
        'plumbing': 'אינסטלציה',
        'air_condition': 'מיזוג אוויר',
        'furniture': 'ריהוט',
        'general': 'כללי',
        'computing': 'מחשוב',
        'entry_permit': 'אישור כניסה'
    };

    tickets.forEach(t => {
        // --- הגדרות עיצוב ---
        let config = TYPE_CONFIG[t.type] || TYPE_CONFIG['default'];
        if (MAINTENANCE_SUBTYPES.includes(t.type)) {
            config = TYPE_CONFIG['maintenance'];
        }

        // --- נרמול נתונים ---
        const userName = t.contactName || t.visitorName || 'ללא שם';
        const userPhone = t.phone || t.requestorPhone || t.visitorPhone;
        const mainDesc = t.description || t.purpose || t.notes || 'אין פירוט';
        
        // תרגום הסוג לעברית (אם אין תרגום, מציג את המקור)
        const displayType = typeNames[t.type] || t.type;
        
        // --- עיצוב סטטוס ---
        const statusMeta = {
            'open': { text: 'פתוח', bg: '#51ffcb', color: '#23452e' },
            'in_progress': { text: 'בטיפול', bg: '#ffd500', color: '#000000' },
            'closed': { text: 'סגור', bg: '#0040ff', color: '#000000' }
        };
        const s = statusMeta[t.status] || { text: t.status, bg: '#eee', color: '#333' };

        // --- בניית הכרטיס ---
        const card = document.createElement('div');
        card.className = 't-card';
        card.onclick = () => openModal(t);

        // שינוי קריטי כאן ב-t-header:
        // 1. קודם שמים את המספר (t-id) -> כדי שיהיה בימין
        // 2. אחר כך שמים את הסטטוס (badge) -> כדי שיהיה בשמאל
        card.innerHTML = `
            <div class="t-strip" style="background-color: ${config.color};"></div>
            
            <div class="t-body">
                <div class="t-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <!-- אלמנט ראשון: הולך לימין -->
                    <span class="t-id" style="font-weight:bold; color:#cbd5e1;">#${t.ticketNumber}</span>

                    <!-- אלמנט שני: הולך לשמאל -->
                    <span class="badge" style="background:${s.bg}; color:${s.color}">${s.text}</span>
                </div>

                <div class="t-title" style="color: ${config.color}; margin-top: 10px;">
                    <i class="fa-solid ${config.icon}"></i> ${displayType}
                </div>

                <div class="t-user">
                    <i class="fa-regular fa-user"></i> ${userName}
                </div>

                <div class="t-preview">
                    ${mainDesc}
                </div>

                <div class="t-date">
                    <i class="fa-regular fa-calendar"></i> 
                    ${new Date(t.createdAtStr).toLocaleDateString('he-IL')}
                    <span style="float:left; opacity:0.7; direction:ltr;">${userPhone}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// === 5. Modal Logic (Dynamic Fields) ===
function openModal(t) {
    currentEditingTicket = t;
    const modal = document.getElementById('admin-modal');
    
    // Basic Header Info
    document.getElementById('mdl-header-id').innerText = `#${t.ticketNumber} | ${t.type}`;
    document.getElementById('mdl-status').value = t.status;
    document.getElementById('mdl-notes').value = t.adminNotes || '';

    // Description
    document.getElementById('mdl-desc-text').innerText = t.description || t.purpose || 'ללא תיאור';

    // === Dynamic Grid Builder ===
    // We build the grid based on what data is actually available!
    const grid = document.getElementById('mdl-dynamic-info');
    grid.innerHTML = '';

    const addField = (label, value) => {
        if (!value) return; // Don't show empty fields
        grid.innerHTML += `
            <div class="info-item">
                <span class="info-label">${label}</span>
                <span class="info-value">${value}</span>
            </div>
        `;
    };

    // 1. User Info (Always show)
    const name = t.contactName || t.visitorName;
    const phone = t.phone || t.requestorPhone;
    
    addField('שם המבקש/מבקר', name);
    // Phone needs a link
    grid.innerHTML += `
        <div class="info-item">
            <span class="info-label">טלפון</span>
            <a href="tel:${phone}" class="info-value" style="color:var(--primary); text-decoration:none;">${phone}</a>
        </div>
    `;

    // 2. Specifics based on Type
    if (t.type === 'entry_permit') {
        addField('ת.ז / מ.א', t.visitorId);
        addField('רכב', `${t.carNum || '-'} ${t.carColor ? '('+t.carColor+')' : ''}`);
        addField('תאריכים', `${t.dateStart} -> ${t.dateEnd}`);
        addField('סיווג', t.securityLevel);
    } else {
        // Maintenance
        addField('מיקום', t.location);
        addField('נכס / מזגן', t.assetNumber);
        addField('מנהל/אחראי', t.manager);
        // Note: Description is shown in the main text block
    }

    // Show modal
    modal.classList.remove('hidden');
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.add('hidden');
}

// === 6. Saving ===
async function saveAdminChanges() {
    if (!currentEditingTicket) return;

    const newStatus = document.getElementById('mdl-status').value;
    const newNotes = document.getElementById('mdl-notes').value;
    const token = localStorage.getItem('authToken');
    const btn = document.querySelector('#admin-modal .submit-btn');

    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> מעדכן...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/admin/update-ticket', {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                collectionType: currentEditingTicket.collectionType,
                ticketId: currentEditingTicket.id,
                status: newStatus,
                adminNotes: newNotes
            })
        });

        const res = await response.json();
        if (res.success) {
            closeAdminModal();
            fetchAdminData(); // Refresh list to see changes
            
            // Subtle success notification (optional, simple alert for now)
            // You could use a toast library here for better UX
        } else {
            alert('שגיאה: ' + res.message);
        }
    } catch (e) {
        alert('תקלה בשמירה');
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}