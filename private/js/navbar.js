function toggleNav() {
    const nav = document.getElementById('side-nav');
    const overlay = document.getElementById('nav-overlay');
    
    // האם אנחנו מנסים לפתוח?
    const isOpening = !nav.classList.contains('active');

    if (isOpening) {
        // בדיקה: האם יש טוקן שמור?
        const token = localStorage.getItem('authToken');
        
        if (!token) {
            alert("יש להתחבר למערכת כדי לצפות בתפריט");
            // אופציונלי: לזרוק למסך כניסה
            // showScreen('login-screen');
            return;
        }
    }
    
    // פתיחה / סגירה ויזואלית
    if (nav.classList.contains('active')) {
        nav.classList.remove('active');
        overlay.classList.remove('active');
    } else {
        nav.classList.add('active');
        overlay.classList.add('active');
    }
}