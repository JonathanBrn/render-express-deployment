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
    // תיקון: שינוי מ-'admin-container' ל-'tickets-grid'
    const container = document.getElementById('tickets-grid');

    try {
        const res = await fetch('/api/admin/all-data', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const json = await res.json();

        if (json.success) {
            adminTickets = json.tickets;
            // הוספנו הגנה בתוך updateStats בתשובה הקודמת, אז זה בסדר
            updateStats(); 
            filterAdminTickets(); 
        } else {
            alert('Session Expired');
            location.reload();
        }
    } catch (e) {
        console.error(e);
        // בדיקה שהקונטיינר קיים לפני שמנסים לכתוב אליו
        if(container) {
            container.innerHTML = `<div style="text-align:center; color:red">תקלת תקשורת</div>`;
        }
    }
}

// === 2. סטטיסטיקות ===
// === בתוך admin.js ===

function updateStats() {
    // חישובים
    const total = adminTickets.length;
    const open = adminTickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
    const closed = adminTickets.filter(t => t.status === 'closed').length;

    // פונקציית עזר בטוחה (Safe Update)
    const safeSetText = (id, value) => {
        const el = document.getElementById(id);
        if (el) {
            el.innerText = value;
        } else {
            console.warn(`Warning: Element #${id} not found in DOM`);
        }
    };

    // עדכון בטוח שלא יקריס את המערכת
    safeSetText('st-total', total);
    safeSetText('st-open', open);
    safeSetText('st-closed', closed);
}

// === 3. סינון ===
function filterAdminTickets() {
    const search = document.getElementById('adm-search').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;

    const filtered = adminTickets.filter(t => {
        const textMatch = JSON.stringify(t).toLowerCase().includes(search);
        
        // === התיקון מתחיל כאן ===
        let typeMatch = true;

        if (typeFilter === 'entry_permit') {
            // רק אישורי כניסה
            typeMatch = (t.type === 'entry_permit');
        } 
        else if (typeFilter === 'maintenance') {
            // רק בינוי ואחזקה (בלי מענה לפרט!)
            typeMatch = MAINTENANCE_SUBTYPES.includes(t.type); 
        } 
        else if (typeFilter === 'maane_laprat') {
            // רק מענה לפרט (חדש!)
            typeMatch = (t.type === 'maane_laprat');
        }
        // === התיקון מסתיים כאן ===

        const statusMatch = statusFilter === 'all' || t.status === statusFilter;

        return textMatch && typeMatch && statusMatch;
    });

    renderGrid(filtered);
}

// === 4. רינדור כרטיסים (התיקון כאן) ===
function renderGrid(tickets) {
    // 1. איתור הקונטיינר הנכון (החדש)
    const container = document.getElementById('tickets-grid');

    // הגנה: אם אנחנו בטאב אחר והאלמנט לא קיים - נעצור כאן כדי למנוע קריסה
    if (!container) return;

    // ניקוי תוכן קודם
    container.innerHTML = '';

    // 2. מצב ריק (אין פניות)
    if (!tickets || tickets.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <i class="fa-regular fa-folder-open fa-3x" style="opacity: 0.5;"></i>
                <span style="font-size: 1.1rem;">לא נמצאו פניות במערכת</span>
            </div>`;
        return;
    }

    // 3. לולאה על כל הטיקטים
    tickets.forEach(t => {
        // --- א. קביעת הגדרות עיצוב (צבע ואייקון) ---
        let config = TYPE_CONFIG['default'];
        
        if (t.type === 'entry_permit') {
            config = TYPE_CONFIG['entry_permit'];
        } else if (t.type === 'maane_laprat') {
            config = TYPE_CONFIG['maane_laprat'];
        } else if (MAINTENANCE_SUBTYPES.includes(t.type)) {
            config = TYPE_CONFIG['maintenance'];
        } else if (t.type === 'computing') {
            config = TYPE_CONFIG['computing'];
        }

        // --- ב. נרמול נתונים (כי כל טיקט שומר שדות בשמות שונים) ---
        // שם המבקש
        const userName = t.contactName || t.visitorName || t.fullname || 'ללא שם';
        // טלפון
        const userPhone = t.phone || t.requestorPhone || t.visitorPhone || '';
        // תיאור הפנייה
        const mainDesc = t.description || t.purpose || t.notes || 'אין פירוט נוסף';
        
        // כותרת הפנייה (טקסט בעברית)
        let displayType = t.type;
        if (t.type === 'entry_permit') {
            displayType = 'אישור כניסה';
        } else if (t.type === 'maane_laprat') {
            displayType = subTypeTranslation[t.subType] || t.subType; // למשל "החלפת מדים"
        } else {
            displayType = typeTranslation[t.type] || t.type; // למשל "מיזוג אוויר"
        }
        
        // --- ג. עיצוב סטטוס ---
        const statusMeta = {
            'open': { text: 'פתוח', bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
            'in_progress': { text: 'בטיפול', bg: '#ffedd5', color: '#9a3412', border: '#fed7aa' },
            'closed': { text: 'סגור', bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
        };
        const s = statusMeta[t.status] || { text: t.status, bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };

        // --- ד. פרמוט תאריך ---
        let dateStr = '---';
        if (t.createdAtStr) {
            const dateObj = new Date(t.createdAtStr);
            dateStr = dateObj.toLocaleDateString('he-IL', {day: '2-digit', month: '2-digit'});
        }

        // --- ה. יצירת כרטיס ה-HTML ---
        const card = document.createElement('div');
        card.className = 't-card'; // המחלקה שעיצבנו ב-CSS
        
        // הוספת אירוע לחיצה לפתיחת המודאל
        card.onclick = () => {
            if (typeof openModal === 'function') {
                openModal(t);
            } else {
                console.error("openModal function is missing!");
            }
        };

        // הזרקת ה-HTML הפנימי
        card.innerHTML = `
            <!-- פס צבע עליון -->
            <div class="t-strip" style="background-color: ${config.color};"></div>
            
            <div class="t-body">
                <!-- כותרת עליונה: מזהה + באדג' סטטוס -->
                <div class="t-header">
                    <span class="t-id">#${t.ticketNumber || (t.id ? t.id.split('-')[1] : '---')}</span>
                    <span class="badge" style="background:${s.bg}; color:${s.color}; border: 1px solid ${s.border};">
                        ${s.text}
                    </span>
                </div>

                <!-- כותרת ראשית (סוג הפנייה) -->
                <div class="t-title" style="color: ${config.color}; font-weight: 700; margin-top: 8px; font-size: 1.1rem;">
                    <i class="fa-solid ${config.icon}"></i> ${displayType}
                </div>

                <!-- שם המשתמש -->
                <div class="t-user" style="color: #64748b; font-size: 0.9rem; margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-regular fa-user"></i> ${userName}
                </div>

                <!-- תקציר (Preview) -->
                <div class="t-preview" style="background: #f8fafc; padding: 10px; border-radius: 8px; margin: 12px 0; font-size: 0.9rem; color: #334155; height: 50px; overflow: hidden; text-overflow: ellipsis;">
                    ${mainDesc}
                </div>

                <!-- תחתית: תאריך וטלפון -->
                <div class="t-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px; font-size: 0.8rem; color: #94a3b8;">
                    <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                    <span style="direction: ltr;">${userPhone}</span>
                </div>
            </div>
        `;

        // --- ו. הוספה לדף ---
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

// === Tab Switching Logic ===
function switchAdminTab(tabName) {
    // 1. עדכון כפתורים
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // 2. עדכון תצוגה
    document.querySelectorAll('.admin-view').forEach(view => view.classList.add('hidden'));
    
    // הצגת המסך הרלוונטי
    if (tabName === 'tickets') {
        document.getElementById('view-tickets').classList.remove('hidden');
    } else if (tabName === 'users') {
        document.getElementById('view-users').classList.remove('hidden');
        loadUsersData(); // טעינת נתונים
    } else if (tabName === 'roles') {
        document.getElementById('view-roles').classList.remove('hidden');
    }
}

// === Users Management Logic (Frontend Mock) ===
// נחליף את זה בקריאה אמיתית לשרת בהמשך
let usersData = [];

async function loadUsersData() {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> טוען משתמשים...</td></tr>';

    try {
        const token = localStorage.getItem('authToken');
        const res = await fetch('/api/admin/users', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        
        if (data.success) {
            usersData = data.users; // שמירה במשתנה גלובלי לסינון
            renderUsersTable(usersData);
        } else {
            tableBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">אין הרשאה לצפות במשתמשים</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = '<tr><td colspan="5" style="color:red; text-align:center;">שגיאת תקשורת</td></tr>';
    }
}
function openUserModal(phone = null) {
    const modal = document.getElementById('user-modal');
    
    if (phone) {
        // מצב עריכה - מצא את המשתמש
        const user = usersData.find(u => u.phone === phone);
        if (user) {
            document.getElementById('usr-phone').value = user.phone;
            document.getElementById('usr-phone').readOnly = true; // אי אפשר לשנות מפתח
            document.getElementById('usr-name').value = user.fullName;
            document.getElementById('usr-role').value = user.roleId;
            document.getElementById('usr-active').checked = user.isActive;
        }
    } else {
        // מצב הוספה חדשה
        document.getElementById('usr-phone').value = '';
        document.getElementById('usr-phone').readOnly = false;
        document.getElementById('usr-name').value = '';
        document.getElementById('usr-role').value = 'user';
        document.getElementById('usr-active').checked = true;
    }
    
    modal.classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
}

async function saveUser(e) {
    e.preventDefault();
    
    const payload = {
        phone: document.getElementById('usr-phone').value,
        fullName: document.getElementById('usr-name').value,
        roleId: document.getElementById('usr-role').value,
        isActive: document.getElementById('usr-active').checked
    };

    const token = localStorage.getItem('authToken');
    
    try {
        const res = await fetch('/api/admin/users', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });
        
        const json = await res.json();
        if (json.success) {
            alert('נשמר בהצלחה');
            closeUserModal();
            loadUsersData(); // רענון הטבלה
        } else {
            alert('שגיאה: ' + json.error);
        }
    } catch (err) {
        alert('תקלת תקשורת');
    }
}


function renderUsersTable(users) {
    const tableBody = document.getElementById('users-table-body');
    tableBody.innerHTML = '';

    const roleLabels = {
        'super_admin': 'מנהל על',
        'maintenance_manager': 'מנהל בינוי',
        'logistics_manager': 'מנהל לוגיסטיקה',
        'user': 'משתמש'
    };

    users.forEach(user => {
        let active = user.isActive ? "פעיל" : "לא פעיל";
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:500;">${user.fullName}</td>
            <td style="direction:ltr; text-align:right;">${user.phone}</td>
            <td><span class="role-badge role-${user.roleId}">${roleLabels[user.roleId] || user.roleId}</span></td>
            <td><span style="font-size:0.85rem; color:#64748b;">${active}</span></td>
            <td>
                <button class="action-btn" onclick="editUser('${user.phone}')" title="ערוך הרשאות">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="action-btn" onclick="deleteUser('${user.phone}')" title="חסום גישה" style="color:#ef4444; border-color:transparent;">
                    <i class="fa-solid fa-ban"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

function filterUsers() {
    const term = document.getElementById('user-search').value.toLowerCase();
    const filtered = usersData.filter(u => 
        u.name.toLowerCase().includes(term) || u.phone.includes(term)
    );
    renderUsersTable(filtered);
}

// Placeholder functions
function editUser(phone) {
    alert(`עריכת משתמש ${phone} - (יפתח מודל עריכה בהמשך)`);
}

function openAddUserModal() {
    let modal = document.getElementById('add-user-modal');

    // 1. יצירת המודאל בפעם הראשונה בלבד
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'add-user-modal';

        modal.innerHTML = `
            <div class="modal-content">
                <h2 style="margin-bottom: 20px; font-size: 20px; text-align: center;">הוסף משתמש חדש</h2>
                <form id="add-user-form">
                    <input type="text" name="name" placeholder="שם מלא" required />
                    <input type="tel" name="phone" placeholder="מס' טלפון" required />
                    <button type="submit">הוסף למערכת</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        // סגירה בלחיצה על הרקע הכהה
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // === לוגיקת השליחה לשרת (החלק החדש) ===
        const form = modal.querySelector('#add-user-form');
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const btn = form.querySelector('button');
            const nameInput = form.querySelector('input[name="name"]');
            const phoneInput = form.querySelector('input[name="phone"]');
            const originalText = btn.innerText;

            // נעילת כפתור
            btn.innerText = "שומר...";
            btn.disabled = true;

            try {
                const token = localStorage.getItem('authToken');
                
                // שליחה לשרת
                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        fullName: nameInput.value,
                        phone: phoneInput.value
                        // השרת ישלים לבד roleId='user' ו-isActive=true
                    })
                });

                const data = await res.json();

                if (data.success) {
                    alert("המשתמש נוסף בהצלחה!");
                    closeModal();
                    // רענון טבלת המשתמשים ברקע (אם הפונקציה קיימת)
                    if (typeof loadUsersData === 'function') loadUsersData();
                } else {
                    alert("שגיאה: " + data.message);
                }
            } catch (err) {
                console.error(err);
                alert("תקלת תקשורת מול השרת");
            } finally {
                // שחרור כפתור
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
    }

    // 2. איפוס הטופס בכל פתיחה מחדש
    const form = modal.querySelector('form');
    if (form) form.reset();

    // 3. פתיחה עם אנימציה
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });

    // פונקציית עזר לסגירה
    function closeModal() {
        modal.classList.remove('show');
        // ממתין לסיום ה-Transition (250ms לפי ה-CSS שלך) ואז מסיר מה-DOM
        setTimeout(() => {
            if (modal && modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 250);
    }
}