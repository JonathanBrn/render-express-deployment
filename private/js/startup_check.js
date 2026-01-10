// === הרצה בטעינת הדף ===
document.addEventListener('DOMContentLoaded', () => {
    const savedPhone = sessionStorage.getItem('userPhone');
    
    if (savedPhone) {
        // אם יש משתמש מחובר - דלג ישר לתפריט הראשי
        currentPhone = savedPhone; // שחזור המשתנה הגלובלי
        showScreen('main-menu');
    } else {
        // אם אין משתמש - וודא שאנחנו במסך הכניסה
        showScreen('login-screen');
    }
});