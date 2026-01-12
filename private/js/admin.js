// === Admin Logic V3.0 (Fixed) ===

let adminTickets = [];
let currentEditingTicket = null;

// === מילוני תרגום (חובה שיהיו כאן) ===
const typeTranslation = {
    'air_condition': 'מיזוג אוויר',
    'electricity': 'חשמל',
    'plumbing': 'אינסטלציה',
    'furniture': 'ריהוט ונגרות',
    'general': 'אחזקה כללית',
    'computing': 'מחשוב'
};

const subTypeTranslation = {
    'uniforms': 'החלפת מדים',
    'shoes': 'החלפת נעליים',
    'laundry': 'משלוח כביסה',
    'office_supplies': 'ציוד משרדי',
    'furniture': 'הזמנת ריהוט'
};

// === קונפיגורציה ===
const TYPE_CONFIG = {
    'entry_permit': { 
        label: 'אישור כניסה', 
        icon: 'fa-id-card', 
        color: '#2563eb', // Blue
        class: 'type-entry'
    },
    'maintenance': { 
        label: 'אחזקה', 
        icon: 'fa-wrench', 
        color: '#d97706', // Orange
        class: 'type-maint'
    },
    'maane_laprat': { 
        label: 'לוגיסטיקה', 
        icon: 'fa-box-open', 
        color: '#0d9488', // Teal
        class: 'type-logistics' 
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

const MAINTENANCE_SUBTYPES = ['electricity', 'plumbing', 'air_condition', 'furniture', 'general'];

// הרצה ראשונית
(function init() {
    fetchAdminData();
})();

// === 1. שליפת נתונים ===
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
            filterAdminTickets(); // רינדור ראשוני
        } else {
            alert('Session Expired');
            location.reload();
        }
    } catch (e) {
        console.error(e);
        if(container) container.innerHTML = `<div style="text-align:center; color:red">תקלת תקשורת</div>`;
    }
}

// === 2. סטטיסטיקות ===
function updateStats() {
    const total = adminTickets.length;
    const open = adminTickets.filter(t => t.status === 'open').length;
    const closed = adminTickets.filter(t => t.status === 'closed').length;

    if(document.getElementById('st-total')) {
        document.getElementById('st-total').innerText = total;
        document.getElementById('st-open').innerText = open;
        document.getElementById('st-closed').innerText = closed; 
    }
}

// === 3. סינון ===
function filterAdminTickets() {
    const search = document.getElementById('adm-search').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;

    const filtered = adminTickets.filter(t => {
        const textMatch = JSON.stringify(t).toLowerCase().includes(search);
        
        let typeMatch = true;
        if (typeFilter === 'entry_permit') typeMatch = (t.type === 'entry_permit');
        if (typeFilter === 'maintenance') typeMatch = (MAINTENANCE_SUBTYPES.includes(t.type) || t.type === 'maane_laprat');

        const statusMatch = statusFilter === 'all' || t.status === statusFilter;

        return textMatch && typeMatch && statusMatch;
    });

    renderGrid(filtered);
}

// === 4. רינדור כרטיסים (התיקון כאן) ===
function renderGrid(tickets) {
    const container = document.getElementById('admin-container');
    container.innerHTML = '';

    if (tickets.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; margin-top:40px; opacity:0.6;">
            <i class="fa-regular fa-folder-open fa-3x"></i><br>לא נמצאו תוצאות
        </div>`;
        return;
    }

    // הבעיה הייתה כאן: וודא שכתוב 't' בתוך ה-forEach
    tickets.forEach(t => {
        // קביעת הקונפיגורציה
        let config = TYPE_CONFIG[t.type] || TYPE_CONFIG['default'];
        
        if (MAINTENANCE_SUBTYPES.includes(t.type)) {
            config = TYPE_CONFIG['maintenance'];
        } else if (t.type === 'maane_laprat') {
            config = TYPE_CONFIG['maane_laprat'];
        }

        // נרמול נתונים
        const userName = t.contactName || t.visitorName || t.fullname || 'ללא שם';
        const userPhone = t.phone || t.requestorPhone || t.visitorPhone;
        const mainDesc = t.description || t.purpose || t.notes || 'אין פירוט';
        
        // כותרת
        let displayType = t.type;
        if (t.type === 'entry_permit') {
            displayType = 'אישור כניסה';
        } else if (t.type === 'maane_laprat') {
            displayType = subTypeTranslation[t.subType] || t.subType;
        } else {
            displayType = typeTranslation[t.type] || t.type;
        }
        
        // סטטוס
        const statusMeta = {
            'open': { text: 'פתוח', bg: '#fee2e2', color: '#991b1b' },
            'in_progress': { text: 'בטיפול', bg: '#ffedd5', color: '#9a3412' },
            'closed': { text: 'סגור', bg: '#dcfce7', color: '#166534' }
        };
        const s = statusMeta[t.status] || { text: t.status, bg: '#eee', color: '#333' };

        // בניית הכרטיס
        const card = document.createElement('div');
        card.className = 't-card';
        // שימוש ב-openModal עם האובייקט t
        card.onclick = () => openModal(t);

        card.innerHTML = `
            <div class="t-strip" style="background-color: ${config.color};"></div>
            
            <div class="t-body">
                <div class="t-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <!-- מספר טיקט בימין -->
                    <span class="t-id">#${t.ticketNumber || t.id.split('-')[1]}</span>
                    <!-- סטטוס בשמאל -->
                    <span class="badge" style="background:${s.bg}; color:${s.color}">${s.text}</span>
                </div>

                <div class="t-title" style="color: ${config.color}">
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

// === 5. לוגיקת המודאל (פרטים מלאים) ===
function openModal(t) {
    currentEditingTicket = t;
    const modal = document.getElementById('admin-modal');
    
    // כותרת
    document.getElementById('mdl-header-id').innerText = `#${t.id}`;
    document.getElementById('mdl-status').value = t.status;
    document.getElementById('mdl-notes').value = t.adminNotes || '';

    // תיאור ראשי
    document.getElementById('mdl-desc-text').innerText = t.description || t.purpose || t.notes || 'ללא תיאור';

    // בניית הגריד
    const grid = document.getElementById('mdl-dynamic-info');
    grid.innerHTML = '';

    const addField = (label, value) => {
        if (!value || value === 'undefined') return;
        grid.innerHTML += `
            <div class="info-item">
                <span class="info-label">${label}</span>
                <span class="info-value">${value}</span>
            </div>
        `;
    };

    // פרטים בסיסיים (מטפל בכל סוגי הטלפונים)
    const name = t.contactName || t.visitorName || t.fullname;
    const phone = t.phone || t.requestorPhone || t.visitorPhone;
    const pid = t.personalId || t.visitorId;
    
    addField('שם', name);
    if(pid) addField('מ.א / ת.ז', pid);
    
    // טלפון לחיץ
    grid.innerHTML += `
        <div class="info-item">
            <span class="info-label">טלפון</span>
            <a href="tel:${phone}" class="info-value" style="color:#2563eb; text-decoration:none; direction:ltr; text-align:right;">${phone}</a>
        </div>
    `;

    // כפתור צ'אט
    grid.innerHTML += `
        <div class="info-item" style="grid-column: 1 / -1; margin-top: 10px;">
            <button onclick="ChatSystem.open('${t.id}', '${t.collectionType}')" 
                    class="submit-btn" style="background: #6366f1; width: 100%; display: flex; justify-content: center; gap: 8px;">
                <i class="fa-regular fa-comments"></i> פתח צ'אט
            </button>
        </div>
    `;

    // פרטים ספציפיים לפי סוג
    if (t.type === 'entry_permit') {
        addField('רכב', `${t.carNum || ''} ${t.carColor || ''}`);
        addField('תאריכים', `${t.dateStart} -> ${t.dateEnd}`);
        addField('סיווג', t.securityLevel);
    } 
    else if (t.type === 'maane_laprat') {
        const subTypeTitle = subTypeTranslation[t.subType] || t.subType;
        addField('סוג בקשה', subTypeTitle);

        if(t.subType === 'uniforms') {
            addField('מגדר', t.gender);
            if(t.shirt && t.shirt !== 'לא הוזמן') addField('חולצה', t.shirt);
            if(t.pants && t.pants !== 'לא הוזמן') addField('מכנס', t.pants);
            if(t.softshell && t.softshell !== 'לא הוזמן') addField('סופטשל', t.softshell);
            addField('סיבה', t.reason);
        } else if (t.subType === 'shoes') {
            addField('מגדר', t.gender);
            if(t.shoe_combat && t.shoe_combat !== 'לא הוזמן') addField('נעלי חי"ר', t.shoe_combat);
            if(t.shoe_office && t.shoe_office !== 'לא הוזמן') addField('נעלי יח"ש', t.shoe_office);
            addField('סיבה', t.reason);
        } else if (t.subType === 'laundry') {
            addField('סוג מדים', t.uniform_type);
            // addField('שירות', t.service_included); // אופציונלי
            if(t.laundry_notes) addField('הערות כביסה', t.laundry_notes);
        } else if (t.subType === 'furniture') {
            addField('פריט', t.furniture_type);
            addField('כמות', t.quantity);
            addField('הצדקה', t.justification);
        } else if (t.subType === 'office_supplies') {
            addField('פירוט', t.items_list);
        }
    }
    else {
        // אחזקה
        addField('מיקום', t.location);
        if(t.assetNumber) addField('נכס', t.assetNumber);
        if(t.manager) addField('אחראי', t.manager);
    }

    modal.classList.remove('hidden');
}

function closeAdminModal() {
    document.getElementById('admin-modal').classList.add('hidden');
}

// === 6. שמירה לשרת ===
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
            fetchAdminData(); 
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