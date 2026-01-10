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
        // שליחה לשרת עם ה-Header של האבטחה
        // שים לב: אין צורך לשלוח ?phone=... השרת יודע לבד!
        const response = await fetch('/api/maintenance/my-tickets', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token, // שליחת הטוקן
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();

        if (result.success) {
            renderTickets(result.tickets);
        } else {
            // אם הטוקן פג תוקף - לזרוק להתחברות
            if (response.status === 403 || response.status === 401) {
                alert("פג תוקף ההתחברות, נא להתחבר מחדש");
                logoutUser();
            } else {
                container.innerHTML = `<p>${result.message}</p>`;
            }
        }
    } catch (error) {
        console.error(error);
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

    // רשימת סוגים ששייכים ל"בינוי ואחזקה"
    const maintenanceTypes = ['air_condition', 'electricity', 'plumbing', 'furniture', 'general'];

    tickets.forEach((ticket) => {
        // המרת תאריך
        let dateStr = '---';
        if (ticket.createdAtStr) {
            const d = new Date(ticket.createdAtStr);
            dateStr = d.toLocaleDateString('he-IL') + ' | ' + d.toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        }

        const statusText = statusTranslation[ticket.status] || ticket.status;

        // === לוגיקת צבעים (החלק החדש) ===
        let colorClass = 'type-default'; // ברירת מחדל
        let cardTitle = '';
        let extraInfoHtml = '';

        if (ticket.type === 'entry_permit') {
            // אישור כניסה -> כחול
            colorClass = 'type-entry-permit';
            cardTitle = 'אישור כניסה';
            extraInfoHtml = `<span style="font-weight:600; color:#334155; margin-right: auto;"><i class="fa-regular fa-user"></i> ${ticket.visitorName || 'אורח'}</span>`;
        
        } else if (maintenanceTypes.includes(ticket.type)) {
            // בינוי ואחזקה (כל הסוגים) -> חום
            colorClass = 'type-maintenance';
            cardTitle = typeTranslation[ticket.type] || ticket.type;
        
        } else if (ticket.type === 'computing') {
            // מחשוב -> סגול
            colorClass = 'type-computing';
            cardTitle = 'תקלת מחשוב';
        }

        // יצירת הכרטיס
        const card = document.createElement('div');
        // הוספנו את colorClass לרשימת הקלאסים
        card.className = `ticket-card ${colorClass}`;
        
        card.innerHTML = `
            <div class="status-badge">${statusText}</div> <!-- הסטטוס נשאר למעלה -->
            <h3 class="ticket-title">${cardTitle}</h3>
            <div class="ticket-id">#${ticket.id || '---'}</div>
            
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
    
    // === 1. כותרת עליונה קבועה (סטטוס + מזהה) ===
    const statusText = statusTranslation[ticket.status] || ticket.status;
    document.getElementById('modal-status').innerText = statusText;
    document.getElementById('modal-id').innerText = ticket.id || '-';
    console.log("Ticket ID is -", ticket.id)

    // טיפול בתאריך יצירה
    let dateDisplay = '---';
    if (ticket.createdAtStr) {
        const d = new Date(ticket.createdAtStr);
        dateDisplay = d.toLocaleString('he-IL');
    } else if (ticket.createdAt && ticket.createdAt.toDate) {
         dateDisplay = ticket.createdAt.toDate().toLocaleString('he-IL');
    }
    document.getElementById('modal-date').innerText = 'נפתח בתאריך: ' + dateDisplay;

    // === 2. בניית התוכן המשתנה (לפי סוג) ===
    const contentDiv = document.getElementById('modal-dynamic-content');
    let htmlContent = '';

    console.log(ticket)
    if (ticket.type === 'entry_permit') {
        // =================================================
        //                 תצוגת אישור כניסה
        // =================================================
        document.getElementById('modal-title').innerText = 'אישור כניסה';

        htmlContent = `
            <!-- פרטי המבקר -->
            <div class="detail-group">
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-regular fa-user"></i> שם המבקר:</span>
                    <span class="detail-value">${ticket.visitorName || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-id-card"></i> ת.ז / מ.א:</span>
                    <span class="detail-value">${ticket.visitorId || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-phone"></i> טלפון מבקר:</span>
                    <span class="detail-value">${ticket.visitorPhone || '-'}</span>
                </div>
            </div>
            
            <hr style="border: 0; border-top: 1px dashed #e2e8f0; margin: 10px 0;">

            <!-- פרטי רכב ותאריכים -->
            <div class="detail-group">
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-car"></i> רכב:</span>
                    <span class="detail-value">${ticket.carNum || 'ללא'} ${ticket.carColor ? `(${ticket.carColor})` : ''}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-calendar-days"></i> תאריכים:</span>
                    <span class="detail-value" style="direction: ltr; text-align: right;">
                        ${ticket.dateStart || '?'} <i class="fa-solid fa-arrow-left" style="font-size:0.7em;"></i> ${ticket.dateEnd || '?'}
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label"><i class="fa-solid fa-shield-halved"></i> סיווג:</span>
                    <span class="detail-value">רמה ${ticket.securityLevel || 'ללא'}</span>
                </div>
            </div>

            <!-- מטרת הביקור -->
            <div class="detail-row full-width" style="margin-top: 10px;">
                <span class="detail-label">מטרת הביקור:</span>
                <p class="detail-text">${ticket.purpose || '-'}</p>
            </div>
        `;

    } else {
        // =================================================
        //                 תצוגת תקלות בינוי
        // =================================================
        
        const typeText = typeTranslation[ticket.type] || ticket.type;
        document.getElementById('modal-title').innerText = 'פרטי קריאת שירות';

        htmlContent = `
            <div class="detail-row">
                <span class="detail-label">סוג תקלה:</span>
                <span class="detail-value">${typeText}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">מיקום:</span>
                <span class="detail-value">${ticket.location || '-'}</span>
            </div>

            <!-- שדות נוספים שראיתי בצילום מסך שלך -->
            ${ticket.assetNumber ? `
            <div class="detail-row">
                <span class="detail-label">מס' נכס/מזגן:</span>
                <span class="detail-value">${ticket.assetNumber}</span>
            </div>` : ''}

            ${ticket.manager ? `
            <div class="detail-row">
                <span class="detail-label">אחראי ענפי:</span>
                <span class="detail-value">${ticket.manager}</span>
            </div>` : ''}

            <div class="detail-row">
                <span class="detail-label">איש קשר:</span>
                <span class="detail-value">${ticket.contactName || ticket.phone}</span>
            </div>

            <hr style="border: 0; border-top: 1px dashed #e2e8f0; margin: 10px 0;">

            <div class="detail-row full-width">
                <span class="detail-label">תיאור התקלה:</span>
                <p class="detail-text">${ticket.description || '-'}</p>
            </div>
            
            <div class="detail-row full-width">
                <span class="detail-label">הערות נוספות:</span>
                <p class="detail-text" style="${ticket.notes ? 'color:#d9534f' : ''}">${ticket.notes || 'אין הערות'}</p>
            </div>
        `;
    }

    // הזרקת התוכן למודאל
    contentDiv.innerHTML = htmlContent;

    // הצגת המודאל
    modal.classList.remove('hidden');
}

// 4. סגירת המודאל
function closeTicketModal(e, force = false) {
    // סגירה רק אם לחצו על הרקע הכהה או על ה-X
    if (force || e.target.id === 'ticket-modal') {
        document.getElementById('ticket-modal').classList.add('hidden');
    }
}