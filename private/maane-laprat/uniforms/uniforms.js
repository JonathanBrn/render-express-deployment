(function initUniforms() {
    
    // --- 1. מילוי חולצות ---
    const shirtSelect = document.getElementById('size_shirt');
    if (shirtSelect) {
        const sizes = [
            { val: 'k', text: 'ק (קטן)' },
            { val: 'b', text: 'ב (בינוני)' },
            { val: 'g', text: 'ג (גדול)' },
            { val: 'm', text: 'מ' },
            { val: 'm2', text: 'מ2' },
            { val: 'm3', text: 'מ3' },
            { val: 'm4', text: 'מ4' }
        ];
        let html = '<option value="" disabled selected>מידה</option>';
        sizes.forEach(s => html += `<option value="${s.val}">${s.text}</option>`);
        shirtSelect.innerHTML = html;
    }

    // --- 2. מילוי מכנסיים ---
    const pantsSelect = document.getElementById('size_pants');
    if (pantsSelect) {
        let html = '<option value="" disabled selected>מידה</option>';
        for(let i = 36; i <= 66; i += 2) {
            html += `<option value="${i}">${i}</option>`;
        }
        pantsSelect.innerHTML = html;
    }

    // --- 3. מילוי סופטשל ---
    const softSelect = document.getElementById('size_softshell');
    if (softSelect) {
        const sizes = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'];
        let html = '<option value="" disabled selected>מידה</option>';
        sizes.forEach(s => html += `<option value="${s}">${s}</option>`);
        softSelect.innerHTML = html;
    }

})();

// === פונקציית בחירת פריט (Toggle) ===
// חייבת להיות על window כדי שה-onclick ב-HTML יזהה אותה
window.toggleItem = function(type) {
    const card = document.getElementById(`card_${type}`);
    const select = document.getElementById(`size_${type}`);
    
    if (!card || !select) return;

    // בדיקה: האם זה כבר נבחר?
    const isSelected = card.classList.contains('selected');

    if (isSelected) {
        // אם כבר נבחר -> בטל בחירה
        card.classList.remove('selected');
        select.value = ""; // איפוס המידה
    } else {
        // אם לא נבחר -> בחר
        card.classList.add('selected');
        // פוקוס אוטומטי לסלקט כדי לעודד בחירה
        setTimeout(() => select.focus(), 300); 
    }
};

// === ולידציה ואיסוף נתונים ===
window.collectModuleData = function() {
    const gender = document.getElementById('ml_gender').value;
    const reason = document.getElementById('ml_reason').value;

    // איסוף הערכים (רק אם הכרטיס נבחר והסלקט מכיל ערך)
    const getVal = (type) => {
        const card = document.getElementById(`card_${type}`);
        const select = document.getElementById(`size_${type}`);
        return (card.classList.contains('selected') && select.value) ? select.value : null;
    };

    const shirt = getVal('shirt');
    const pants = getVal('pants');
    const softshell = getVal('softshell');

    // ולידציות
    if (gender === "") {
        alert("יש לבחור שיוך מגדרי");
        return null;
    }

    // בדיקה: האם נבחר לפחות פריט אחד?
    if (!shirt && !pants && !softshell) {
        alert("לא נבחרו פריטים.\nיש ללחוץ על פריט ולבחור מידה.");
        return null;
    }

    // בדיקה: האם סומן כרטיס אבל לא נבחרה מידה?
    const checkMissingSize = (type, name) => {
        const card = document.getElementById(`card_${type}`);
        const select = document.getElementById(`size_${type}`);
        if (card.classList.contains('selected') && select.value === "") {
            alert(`בחרת ${name} אך לא ציינת מידה.`);
            return true;
        }
        return false;
    };

    if (checkMissingSize('shirt', 'חולצה')) return null;
    if (checkMissingSize('pants', 'מכנסיים')) return null;
    if (checkMissingSize('softshell', 'סופטשל')) return null;

    return {
        gender: gender,
        shirt: shirt || 'לא הוזמן',
        pants: pants || 'לא הוזמן',
        softshell: softshell || 'לא הוזמן',
        reason: reason
    };
};