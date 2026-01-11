let selectedType = null; // 'medi_a' או 'medi_b'

// מופעל בלחיצה על כרטיס
window.selectLaundryType = function(type) {
    selectedType = type;

    // 1. סימון ויזואלי
    const cards = document.querySelectorAll('.laundry-card');
    cards.forEach(c => c.classList.remove('selected'));
    
    if (type === 'medi_a') cards[0].classList.add('selected');
    else cards[1].classList.add('selected');

    // 2. עדכון הודעת הזכאות
    updateRightsMessage(type);

    // 3. הצגת האזור התחתון (ההודעה)
    document.getElementById('laundry-details').classList.add('visible');
};

// עדכון ההודעה הצבעונית
function updateRightsMessage(type) {
    const msgBox = document.getElementById('rights-message');

    if (type === 'medi_a') {
        // מדי א': ירוק
        msgBox.className = 'rights-box rights-success';
        msgBox.innerHTML = '<i class="fa-solid fa-check-circle"></i> <strong>מדי א\':</strong> זכאות לכביסה + גיהוץ כלולה.';
    } else {
        // מדי ב': כתום
        msgBox.className = 'rights-box rights-warning';
        msgBox.innerHTML = `
            <div style="font-weight:bold; margin-bottom:5px;">
                <i class="fa-solid fa-triangle-exclamation"></i> מדי ב': כביסה וקיפול בלבד.
            </div>
            <div style="font-size:0.85rem; opacity:0.9;">
                זכאי לגיהוץ (סא״ל / רנ״ג / רס״ר)? <br>
                <strong>אנא ציינו זאת בהערות בתחתית הטופס.</strong>
            </div>
        `;
    }
}

// === איסוף נתונים ===
window.collectModuleData = function() {
    // ולידציה יחידה: האם נבחר סוג?
    if (!selectedType) {
        alert("יש לבחור סוג מדים (א' או ב')");
        return null;
    }

    // החזרת הנתון היחיד הרלוונטי (ההערות נלקחות מהטופס הראשי ב-dashboard.html)
    return {
        uniform_type: (selectedType === 'medi_a') ? "מדי א'" : "מדי ב'"
    };
};