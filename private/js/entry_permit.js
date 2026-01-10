async function submitEntryPermit(event) {
    event.preventDefault(); 
    
    // === תיקון 1: קריאה מ-localStorage במקום sessionStorage ===
    const myPhone = localStorage.getItem('userPhone');
    const token = localStorage.getItem('authToken');

    if (!myPhone || !token) { 
        alert("נא להתחבר מחדש (חסר טוקן)"); 
        logoutUser(); // פונקציית ההתנתקות המסודרת שלנו
        return; 
    }

    const formData = {
        requestorPhone: myPhone,
        visitorName: document.getElementById('ep_fullname').value,
        visitorId: document.getElementById('ep_id_num').value,
        visitorPhone: document.getElementById('ep_phone').value,
        status: document.getElementById('ep_status').value,
        securityLevel: document.getElementById('ep_security').value,
        carNum: document.getElementById('ep_car_num').value,
        carColor: document.getElementById('ep_car_color').value,
        purpose: document.getElementById('ep_purpose').value,
        dateStart: document.getElementById('ep_date_start').value,
        dateEnd: document.getElementById('ep_date_end').value,
        description: `ביקור: ${document.getElementById('ep_fullname').value}`, 
        location: 'שער ראשי'
    };

    // שינוי הלחצן ל"שולח..."
    const btn = event.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        const response = await fetch('/api/entry/create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // === תיקון 2: הוספת הטוקן לכותרת ===
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        
        if (result.success) {
            alert('בקשת הכניסה נשלחה בהצלחה!');
            event.target.reset(); 
            showScreen('main-menu'); 
        } else {
            alert('שגיאה מהשרת: ' + result.message);
        }
    } catch (error) {
        console.error("Submission error:", error);
        alert('שגיאת תקשורת');
    } finally {
        // החזרת הכפתור למצב רגיל
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}