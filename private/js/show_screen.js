function initMaintenanceForm() {
        // 1. שליפת הטלפון מהזיכרון הקבוע
        const savedPhone = localStorage.getItem('userPhone');
    
        // 2. בדיקת אבטחה
        if (!savedPhone) {
            // אם אין טלפון, זרוק ללוגין (אבל בלי אלרט מעצבן אם אנחנו כבר שם)
            showScreen('login-screen'); 
            return;
        }
    
        // 3. הצבה בשדות (גם בטופס תחזוקה וגם בטופס אישור כניסה)
        const phoneInputM = document.getElementById('m_phone'); // תחזוקה
        if (phoneInputM) phoneInputM.value = savedPhone;
    
        // כאן השורה החשובה לטופס החדש:
        const requestorPhoneInput = document.getElementById('ep_requestor_phone'); // אם יש לך שדה כזה נסתר
        // או אם אין שדה נסתר, המידע נלקח מהזיכרון בעת השליחה בכל מקרה.
    }

// --- ניווט בין מסכים (חשוב שיהיה כאן כי הקוד המוזרק משתמש בו) ---
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('fade-in'));
    if (screenId === 'maintenance-screen' || screenId === 'entry-permit-screen') {
        if (typeof initMaintenanceForm === 'function') initMaintenanceForm();
    }

    if (screenId === 'login-screen') {
        document.getElementById('otp-input').value = '';
        // איפוס UI של לוגין אם צריך
    }
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
        setTimeout(() => { screen.classList.add('fade-in'); }, 10);
    }
    window.scrollTo(0,0);
}