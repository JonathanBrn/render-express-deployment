// === לוגיקת בחירת כרטיס סטטוס (קיים) ===
function selectEpStatus(value, element) {
    document.getElementById('ep_status').value = value;
    document.querySelectorAll('#entry-permit-screen .selection-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
}

// === לוגיקה חדשה: סיווג בטחוני (כן/לא + מספרים) ===
function toggleSecurity(isRequired) {
    const section = document.getElementById('security-section');
    const btnYes = document.getElementById('btn-sec-yes');
    const btnNo = document.getElementById('btn-sec-no');
    const hiddenInput = document.getElementById('ep_security_required');
    const levelInput = document.getElementById('ep_security_level');

    if (isRequired) {
        // מצב "כן"
        section.classList.add('visible');
        btnYes.classList.add('active-yes');
        btnNo.classList.remove('active-no'); // מסיר את האפור/אדום
        hiddenInput.value = 'yes';
    } else {
        // מצב "לא"
        section.classList.remove('visible');
        btnYes.classList.remove('active-yes');
        btnNo.classList.add('active-no'); // מחזיר את האפור
        hiddenInput.value = 'no';
        levelInput.value = 'none'; // איפוס
        
        // ניקוי ויזואלי של המספרים
        document.querySelectorAll('.scale-num').forEach(el => el.classList.remove('selected'));
    }
}

function selectSecurityNum(num, element) {
    document.getElementById('ep_security_level').value = num;
    document.querySelectorAll('.scale-num').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
}

// === לוגיקה חדשה: רכב (כן/לא) ===
function toggleVehicle(isRequired) {
    const section = document.getElementById('vehicle-section');
    const btnYes = document.getElementById('btn-veh-yes');
    const btnNo = document.getElementById('btn-veh-no');
    const hiddenInput = document.getElementById('ep_vehicle_required');

    if (isRequired) {
        section.classList.add('visible');
        btnYes.classList.add('active-yes');
        btnNo.classList.remove('active-no');
        hiddenInput.value = 'yes';
    } else {
        section.classList.remove('visible');
        btnYes.classList.remove('active-yes');
        btnNo.classList.add('active-no');
        hiddenInput.value = 'no';
        
        // ניקוי השדות למקרה שכתבו ומחקו
        document.getElementById('ep_car_num').value = '';
        document.getElementById('ep_car_color').value = '';
    }
}

// === פונקציית שליחה מעודכנת ===
async function submitEntryPermit(event) {
    event.preventDefault();

    const myPhone = localStorage.getItem('userPhone');
    const token = localStorage.getItem('authToken');

    if (!myPhone || !token) { 
        alert("נא להתחבר מחדש"); 
        if(typeof logoutUser === 'function') logoutUser();
        return; 
    }

    // ולידציה ידנית
    const statusVal = document.getElementById('ep_status').value;
    if(!statusVal) {
        alert("אנא בחרו סוג אוכלוסיה");
        return;
    }

    // ולידציית סיווג - אם נדרש, חובה לבחור מספר
    const secRequired = document.getElementById('ep_security_required').value === 'yes';
    const secLevel = document.getElementById('ep_security_level').value;
    
    if (secRequired && (secLevel === 'none' || !secLevel)) {
        alert("סימנת שנדרש סיווג - אנא בחר רמה (1-5)");
        return;
    }

    // ולידציית רכב - אם נדרש, חובה למלא מספר
    const vehRequired = document.getElementById('ep_vehicle_required').value === 'yes';
    const carNum = document.getElementById('ep_car_num').value;
    const carColor = document.getElementById('ep_car_color').value;

    if (vehRequired && !carNum) {
        alert("סימנת שנדרש רכב - אנא הזן מספר רכב");
        return;
    }

    // הכנת המידע
    const formData = {
        requestorPhone: myPhone,
        visitorName: document.getElementById('ep_fullname').value,
        visitorId: document.getElementById('ep_id_num').value,
        visitorPhone: document.getElementById('ep_phone').value,
        status: statusVal,
        
        // שולחים 'none' אם לא נבחר, או את המספר
        securityLevel: secRequired ? secLevel : 'none', 
        
        // שולחים ריק אם לא נדרש רכב
        carNum: vehRequired ? carNum : '',
        carColor: vehRequired ? carColor : '',
        
        purpose: document.getElementById('ep_purpose').value,
        dateStart: document.getElementById('ep_date_start').value,
        dateEnd: document.getElementById('ep_date_end').value,
        description: `ביקור: ${document.getElementById('ep_fullname').value}`, 
        location: 'שער ראשי'
    };

    // UI - כפתור טעינה
    const btn = event.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        const response = await fetch('/api/entry/create', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token 
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        
        if (result.success) {
            // שימוש ב-Toast החדש אם קיים, אחרת אלרט
            if (typeof showToast === 'function') showToast('הבקשה נשלחה בהצלחה!', 'success');
            else alert('הבקשה נשלחה בהצלחה!');
            
            event.target.reset(); 
            // איפוס ויזואלי של הטפסים המותנים
            toggleSecurity(false);
            toggleVehicle(false);
            // איפוס כרטיסים
            document.querySelectorAll('.selection-card').forEach(c => c.classList.remove('selected'));
            
            showScreen('main-menu'); 
        } else {
            alert('שגיאה: ' + result.message);
        }
    } catch (error) {
        console.error("Submission error:", error);
        alert('שגיאת תקשורת');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}