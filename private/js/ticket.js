// === משתנה גלובלי לשמירת הנתונים ===
let myTicketsData = [];

// מילון תרגום סוגי תקלות
const typeTranslation = {
    'air_condition': 'מיזוג אוויר',
    'electricity': 'חשמל',
    'plumbing': 'אינסטלציה',
    'furniture': 'ריהוט ונגרות',
    'general': 'אחזקה כללית'
};

// מילון תרגום למענה לפרט
const subTypeTranslation = {
    'uniforms': 'החלפת מדים',
    'shoes': 'החלפת נעליים',
    'laundry': 'משלוח כביסה',
    'office_supplies': 'ציוד משרדי',
    'furniture': 'הזמנת ריהוט'
};

const statusTranslation = {
    'open': 'פתוח',
    'closed': 'טופל',
    'in_progress': 'בטיפול'
};

// 1. פונקציה ראשית - טעינת הכרטיסים
async function loadMyTickets() {
    toggleNav(); 
    showScreen('my-tickets-screen');
    const container = document.getElementById('tickets-container');
    
    // שליפת הטוקן
    const token = localStorage.getItem('authToken');

    if (!token) {
        container.innerHTML = '<p>נא להתחבר למערכת</p>';
        showScreen('login-screen');
        return;
    }

    try {
        const response = await fetch('/api/maintenance/my-tickets', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            myTicketsData = result.tickets; // שמירה בזיכרון אם נצטרך
            renderTickets(result.tickets);
        } else {
            if (response.status === 403 || response.status === 401) {
                alert("פג תוקף ההתחברות, נא להתחבר מחדש");
                if(typeof logoutUser === 'function') logoutUser();
            } else {
                container.innerHTML = `<p>${result.message}</p>`;
            }
        }
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color:red">תקלת תקשורת</p>';
    }
}

// 2. פונקציה לציור הכרטיסיות (Render)
function renderTickets(tickets) {
    const container = document.getElementById('tickets-container');


    container.innerHTML = '';

    if (tickets.length === 0) {
        container.innerHTML = `<p style="text-align:center; margin-top:50px; color:#64748b">אין קריאות פתוחות</p>`;
        return;
    }

    const maintenanceTypes = ['air_condition', 'electricity', 'plumbing', 'furniture', 'general'];

    tickets.forEach((ticket) => {



        // המרת תאריך
        let dateStr = '---';
        if (ticket.createdAtStr) {
            const d = new Date(ticket.createdAtStr);
            dateStr = d.toLocaleDateString('he-IL') + ' | ' + d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        }

        const statusText = statusTranslation[ticket.status] || ticket.status;

        // === לוגיקת צבעים וכותרות ===
        let colorClass = 'type-default'; 
        let cardTitle = ticket.type;
        let extraInfoHtml = '';

        if (ticket.type === 'entry_permit') {
            // === אישורי כניסה (כחול) ===
            colorClass = 'type-entry-permit';
            cardTitle = 'אישור כניסה';
            extraInfoHtml = `<span style="font-weight:600; color:#334155; margin-right: auto;"><i class="fa-regular fa-user"></i> ${ticket.visitorName || 'אורח'}</span>`;
        
        } else if (ticket.type === 'maane_laprat') {
            // === מענה לפרט (טורקיז/ירוק) ===
            // מומלץ להוסיף ב-CSS את .type-logistics { border-right-color: ... }
            colorClass = 'type-maane-laprat'; 
            cardTitle = subTypeTranslation[ticket.subType] || ticket.subType;
            // אפשר להציג פרט רלוונטי
            let info = ticket.subType === 'laundry' ? (ticket.uniform_type || '') : (ticket.reason || '');
            if(info) extraInfoHtml = `<span style="font-size:0.85em; color:#64748b; margin-right:auto;">${info}</span>`;

        } else if (maintenanceTypes.includes(ticket.type)) {
            // === בינוי ואחזקה (חום) ===
            colorClass = 'type-maintenance';
            cardTitle = typeTranslation[ticket.type] || ticket.type;
        
        } else if (ticket.type === 'computing') {
            // === מחשוב (סגול) ===
            colorClass = 'type-computing';
            cardTitle = 'תקלת מחשוב';
        }

        // יצירת הכרטיס
        const card = document.createElement('div');
        card.className = `ticket-card ${colorClass}`;
        
        card.innerHTML = `
            <div class="status-badge">${statusText}</div>
            <h3 class="ticket-title">${cardTitle}</h3>
            <div class="ticket-id">#${ticket.id || ticket.id}</div>
            
            <div class="ticket-footer" style="display: flex; align-items: center; justify-content: space-between;">
                <span class="timestamp">${dateStr}</span>
                ${extraInfoHtml}
            </div>
        `;

        card.onclick = () => openTicketModal(ticket);
        container.appendChild(card);
    });
}

// 3. פתיחת המודאל עם הפרטים המלאים
function openTicketModal(ticket) {
    const modal = document.getElementById('ticket-modal');
    
    // כותרת עליונה קבועה
    const statusText = statusTranslation[ticket.status] || ticket.status;
    document.getElementById('modal-status').innerText = statusText;
    // מציג את ה-ID המלא (למשל 97250...-5)
    document.getElementById('modal-id').innerText = ticket.id; 

    // תאריך יצירה
    let dateDisplay = '---';
    if (ticket.createdAtStr) {
        const d = new Date(ticket.createdAtStr);
        dateDisplay = d.toLocaleString('he-IL');
    }
    document.getElementById('modal-date').innerText = 'נפתח בתאריך: ' + dateDisplay;

    // === בניית התוכן המשתנה ===
    const contentDiv = document.getElementById('modal-dynamic-content');
    let htmlContent = '';

    if (ticket.type === 'entry_permit') {
        // === אישור כניסה ===
        document.getElementById('modal-title').innerText = 'אישור כניסה';
        htmlContent = `
            <div class="detail-group">
                <div class="detail-row"><span class="detail-label">שם המבקר:</span> <span class="detail-value">${ticket.visitorName || '-'}</span></div>
                <div class="detail-row"><span class="detail-label">ת.ז:</span> <span class="detail-value">${ticket.visitorId || '-'}</span></div>
                <div class="detail-row"><span class="detail-label">טלפון:</span> <span class="detail-value">${ticket.visitorPhone || '-'}</span></div>
            </div>
            <hr style="margin:10px 0; border-top:1px dashed #e2e8f0;">
            <div class="detail-group">
                <div class="detail-row"><span class="detail-label">רכב:</span> <span class="detail-value">${ticket.carNum || '-'}</span></div>
                <div class="detail-row"><span class="detail-label">תאריכים:</span> <span class="detail-value">${ticket.dateStart} -> ${ticket.dateEnd}</span></div>
            </div>
            <div class="detail-row full-width" style="margin-top:10px;">
                <span class="detail-label">מטרה:</span>
                <p class="detail-text">${ticket.purpose || '-'}</p>
            </div>
        `;

    } else if (ticket.type === 'maane_laprat') {
        // === מענה לפרט ===
        const title = subTypeTranslation[ticket.subType] || ticket.subType;
        document.getElementById('modal-title').innerText = title;

        let dynamicRows = '';
        
        // לוגיקה לפי תת-סוג
        if (ticket.subType === 'uniforms') {
            dynamicRows = `
                <div class="detail-row"><span class="detail-label">מגדר:</span> <span class="detail-value">${ticket.gender}</span></div>
                <div class="detail-row"><span class="detail-label">חולצה:</span> <span class="detail-value">${ticket.shirt}</span></div>
                <div class="detail-row"><span class="detail-label">מכנס:</span> <span class="detail-value">${ticket.pants}</span></div>
                <div class="detail-row"><span class="detail-label">סופטשל:</span> <span class="detail-value">${ticket.softshell}</span></div>
            `;
        } else if (ticket.subType === 'shoes') {
            dynamicRows = `
                <div class="detail-row"><span class="detail-label">מגדר:</span> <span class="detail-value">${ticket.gender}</span></div>
                ${ticket.shoe_combat !== 'לא הוזמן' ? `<div class="detail-row"><span class="detail-label">נעלי חי"ר:</span> <span class="detail-value">${ticket.shoe_combat}</span></div>` : ''}
                ${ticket.shoe_office !== 'לא הוזמן' ? `<div class="detail-row"><span class="detail-label">נעלי יח"ש:</span> <span class="detail-value">${ticket.shoe_office}</span></div>` : ''}
            `;
        } else if (ticket.subType === 'laundry') {
             dynamicRows = `
                <div class="detail-row"><span class="detail-label">סוג מדים:</span> <span class="detail-value">${ticket.uniform_type}</span></div>
                ${ticket.laundry_notes ? `<div class="detail-row full-width"><span class="detail-label">הערות כביסה:</span><p class="detail-text">${ticket.laundry_notes}</p></div>` : ''}
            `;
        } else if (ticket.subType === 'office_supplies') {
             dynamicRows = `<div class="detail-row full-width"><span class="detail-label">פירוט ציוד:</span><p class="detail-text">${ticket.items_list || '-'}</p></div>`;
        } else if (ticket.subType === 'furniture') {
             dynamicRows = `
                <div class="detail-row"><span class="detail-label">פריט:</span> <span class="detail-value">${ticket.furniture_type}</span></div>
                <div class="detail-row"><span class="detail-label">כמות:</span> <span class="detail-value">${ticket.quantity}</span></div>
                <div class="detail-row full-width"><span class="detail-label">הצדקה:</span><p class="detail-text">${ticket.justification || '-'}</p></div>
            `;
        }

        htmlContent = `
            <div class="detail-group" style="margin-bottom:15px;">
                <div class="detail-row" style="background:#f0f9ff; padding:8px; border-radius:6px; margin-bottom:5px;">
                    <span class="detail-label">עבור:</span> 
                    <span class="detail-value" style="font-weight:bold;">${ticket.fullname || 'לא צוין'}</span>
                </div>
                <div class="detail-row" style="background:#f0f9ff; padding:8px; border-radius:6px;">
                    <span class="detail-label">מספר אישי:</span> 
                    <span class="detail-value">${ticket.personalId || 'לא צוין'}</span>
                </div>
            </div>

            <div class="detail-group">
                ${dynamicRows}
            </div>
            
            <hr style="margin:10px 0; border-top:1px dashed #e2e8f0;">
            
            <div class="detail-row full-width">
                <span class="detail-label">הערות כלליות/סיבה:</span>
                <p class="detail-text">${ticket.reason || ticket.notes || 'אין הערות'}</p>
            </div>
        `;

    } else {
        // === תקלות בינוי ===
        const typeText = typeTranslation[ticket.type] || ticket.type;
        document.getElementById('modal-title').innerText = 'פרטי קריאת שירות';

        htmlContent = `
            <div class="detail-row"><span class="detail-label">סוג תקלה:</span> <span class="detail-value">${typeText}</span></div>
            <div class="detail-row"><span class="detail-label">מיקום:</span> <span class="detail-value">${ticket.location || '-'}</span></div>
            
            ${ticket.assetNumber ? `<div class="detail-row"><span class="detail-label">נכס:</span> <span class="detail-value">${ticket.assetNumber}</span></div>` : ''}
            ${ticket.manager ? `<div class="detail-row"><span class="detail-label">אחראי:</span> <span class="detail-value">${ticket.manager}</span></div>` : ''}
            
            <div class="detail-row"><span class="detail-label">איש קשר:</span> <span class="detail-value">${ticket.contactName || ticket.phone}</span></div>

            <hr style="margin:10px 0; border-top:1px dashed #e2e8f0;">
            <div class="detail-row full-width"><span class="detail-label">תיאור:</span><p class="detail-text">${ticket.description || '-'}</p></div>
            <div class="detail-row full-width"><span class="detail-label">הערות:</span><p class="detail-text" style="${ticket.notes ? 'color:#d9534f' : ''}">${ticket.notes || 'אין הערות'}</p></div>
        `;
    }

    // ===========================================
    //        הוספת כפתור הצ'אט (החלק החדש)
    // ===========================================
    htmlContent += `
        <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #f1f5f9; text-align: center;">
            <button onclick="ChatSystem.open('${ticket.id}', '${ticket.collectionType}')" 
                    class="submit-btn" 
                    style="background: #3b82f6; width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px;">
                <i class="fa-regular fa-comments"></i> צ'אט עם המוקד
            </button>
        </div>
    `;

    // הזרקת התוכן למודאל
    contentDiv.innerHTML = htmlContent;

    // הצגת המודאל
    modal.classList.remove('hidden');
}

// 4. סגירת המודאל
function closeTicketModal(e, force = false) {
    if (force || e.target.id === 'ticket-modal') {
        document.getElementById('ticket-modal').classList.add('hidden');
    }
}