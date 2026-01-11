// === תיקון: שימוש ב-window במקום let למניעת שגיאת Redeclaration ===
window.selectedShoeType = null; 

(function initShoes() {
    // מילוי המידות בסלקט היחיד (34-48)
    const sizeSelect = document.getElementById('final_shoe_size');
    if (sizeSelect) {
        let html = '<option value="" disabled selected>בחר מידה...</option>';
        for(let i = 34; i <= 48; i++) {
            html += `<option value="${i}">${i}</option>`;
        }
        sizeSelect.innerHTML = html;
    }
})();

// === לוגיקת בחירת כרטיס ===
window.selectShoeType = function(type) {
    window.selectedShoeType = type; // שימוש במשתנה הגלובלי

    // 1. ניקוי ויזואלי
    const cards = document.querySelectorAll('.shoe-card');
    cards.forEach(card => card.classList.remove('selected'));

    // 2. סימון הכרטיס שנלחץ
    if (type === 'combat') {
        cards[0].classList.add('selected');
        document.getElementById('size-label').innerText = 'בחר מידה (גבוהות):';
    } else {
        cards[1].classList.add('selected');
        document.getElementById('size-label').innerText = 'בחר מידה (נמוכות):';
    }

    // 3. חשיפת אזור המידה
    const container = document.getElementById('size-container');
    if (container) container.classList.add('visible');
    
    // 4. איפוס המידה
    document.getElementById('final_shoe_size').value = "";
};

// === איסוף נתונים וולידציה ===
window.collectModuleData = function() {
    const gender = document.getElementById('ml_gender').value;
    const size = document.getElementById('final_shoe_size').value;
    const reason = document.getElementById('ml_reason').value;

    if (gender === "") {
        alert("יש לבחור שיוך מגדרי");
        return null;
    }

    if (!window.selectedShoeType) { // שימוש במשתנה הגלובלי
        alert("יש לבחור סוג נעליים (גבוהות או נמוכות)");
        return null;
    }

    if (size === "") {
        alert("חובה לבחור מידה");
        return null;
    }

    if (reason === "") {
        alert("יש לבחור סיבת החלפה");
        return null;
    }

    return {
        gender: gender,
        shoe_combat: (window.selectedShoeType === 'combat') ? size : 'לא הוזמן',
        shoe_office: (window.selectedShoeType === 'office') ? size : 'לא הוזמן',
        reason: reason
    };
};