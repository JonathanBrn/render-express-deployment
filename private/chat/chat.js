window.ChatSystem = {
    intervalId: null,
    currentTicketId: null,
    currentCollection: null,
    lastSyncTime: 0,
    isLoaded: false,

    // === 1. טעינת משאבים ===
    async loadResources(token) {
        if (this.isLoaded) return true;

        try {
            // HTML
            const htmlRes = await fetch('/api/resource/chat/chat.html', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const html = await htmlRes.text();
            
            const div = document.createElement('div');
            div.innerHTML = html;
            document.body.appendChild(div.firstElementChild);

            // CSS
            const cssRes = await fetch('/api/resource/chat/chat.css', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const css = await cssRes.text();
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);

            this.isLoaded = true;
            return true;
        } catch (e) {
            console.error("Chat load error", e);
            return false;
        }
    },

    // === 2. פתיחת הצ'אט (התיקון כאן) ===
    async open(ticketId, collectionType) {
        const token = localStorage.getItem('authToken');
        
        if (!this.isLoaded) {
            const success = await this.loadResources(token);
            if (!success) return;
        }

        this.currentTicketId = ticketId;
        this.currentCollection = collectionType;
        this.lastSyncTime = 0;
        
        // איפוס UI
        document.getElementById('chat-messages-area').innerHTML = '<div class="chat-loader"><i class="fa-solid fa-circle-notch fa-spin"></i> טוען...</div>';
        document.getElementById('chat-ticket-id').innerText = ticketId.split('-')[1] || ticketId;
        
        // === התיקון: הסרת הקלאס hidden כדי שהחלון יופיע ===
        const overlay = document.getElementById('chat-overlay');
        overlay.classList.remove('hidden'); 
        
        // הוספת visible לאנימציה (setTimeout קטן נותן לדפדפן זמן לצייר לפני האנימציה)
        setTimeout(() => {
            overlay.classList.add('visible');
        }, 10);

        this.syncMessages(); 
        
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = setInterval(() => this.syncMessages(), 2000);
    },

    // === 3. סגירת הצ'אט (התיקון כאן) ===
    close() {
        const overlay = document.getElementById('chat-overlay');
        
        // התחלת אנימציית היעלמות
        overlay.classList.remove('visible');
        
        // עצירת סנכרון
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;

        // החזרת hidden אחרי שהאנימציה נגמרת (300ms)
        setTimeout(() => {
            overlay.classList.add('hidden');
        }, 300);
    },

    // === 4. סנכרון (ללא שינוי) ===
    // === 4. סנכרון הודעות (GET) ===
    async syncMessages() {
        const token = localStorage.getItem('authToken');
        
        try {
            const url = `/api/chat/sync?collectionType=${this.currentCollection}&ticketId=${this.currentTicketId}&lastSync=${this.lastSyncTime}`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': 'Bearer ' + token }
            });

            // אם השרת החזיר שגיאה (403, 500 וכו') - עוצרים כאן!
            if (!response.ok) {
                console.warn(`Chat sync failed: ${response.status}`);
                return; 
            }

            const data = await response.json();

            // בדיקה שקיבלנו מערך תקין לפני שבודקים length
            if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
                const area = document.getElementById('chat-messages-area');
                
                // הסרת loader אם קיים
                const loader = area.querySelector('.chat-loader');
                if (loader) loader.remove();

                data.messages.forEach(msg => this.renderMessage(msg));
                
                this.lastSyncTime = data.messages[data.messages.length - 1].timestamp;
                area.scrollTop = area.scrollHeight;
            } else if (this.lastSyncTime === 0 && (!data.messages || data.messages.length === 0)) {
                 // הודעה רק אם הצ'אט ריק לגמרי בהתחלה
                 document.getElementById('chat-messages-area').innerHTML = '<div style="text-align:center; color:#ccc; margin-top:20px;">אין הודעות עדיין.</div>';
            }
        } catch (e) {
            console.error("Sync error logic:", e);
        }
    },

    // === 5. ציור הודעה ===
    renderMessage(msg) {
        const area = document.getElementById('chat-messages-area');
        if (document.getElementById(`msg-${msg.id}`)) return;

        const div = document.createElement('div');
        div.id = `msg-${msg.id}`;
        div.className = `msg-bubble ${msg.isMe ? 'msg-me' : 'msg-other'}`;
        
        const time = new Date(msg.timestamp).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'});
        
        // תיקון קטן: זיהוי מנהל
        // אם ההודעה היא לא ממני, והשולח הוא אדמין -> הצג תגית
        const adminLabel = (msg.isAdmin && !msg.isMe) ? '<span class="msg-admin-badge">נציג שירות</span>' : '';

        div.innerHTML = `
            ${adminLabel}
            ${msg.text}
            <span class="msg-time">${time}</span>
        `;
        area.appendChild(div);
    },

    // === 6. שליחה ===
    async sendMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = ''; 
        const token = localStorage.getItem('authToken');

        try {
            await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token 
                },
                body: JSON.stringify({
                    collectionType: this.currentCollection,
                    ticketId: this.currentTicketId,
                    message: text
                })
            });
            this.syncMessages();
        } catch (e) { alert("שגיאה בשליחה"); }
    }
};