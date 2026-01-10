async function submitMaintenanceForm(event) {
    event.preventDefault();

    // בדיקת טוקן
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert("יש להתחבר מחדש");
        logoutUser();
        return;
    }

    // איסוף הנתונים (אנחנו לא צריכים לאסוף את הטלפון, השרת יודע מי אנחנו!)
    const formData = {
        type: document.getElementById('m_type').value,
        description: document.getElementById('m_description').value,
        assetNumber: document.getElementById('m_asset_num').value,
        location: document.getElementById('m_location').value,
        manager: document.getElementById('m_manager').value,
        contactName: document.getElementById('m_contact_name').value,
        // phone: ... לא צריך לשלוח, השרת לוקח מהטוקן
        notes: document.getElementById('m_notes').value
    };

    const btn = event.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        const response = await fetch('/api/maintenance/report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token // === שליחת הטוקן ===
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
            alert('הקריאה נפתחה בהצלחה!');
            event.target.reset();
            
            // החזרת הטלפון לשדה (כי ה-reset מחק אותו)
            const savedPhone = localStorage.getItem('userPhone');
            if(savedPhone) document.getElementById('m_phone').value = savedPhone;

            showScreen('main-menu');
        } else {
            alert('שגיאה: ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('תקלה בתקשורת');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}