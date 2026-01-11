// === Maane Laprat Logic (Modular Loader) ===

// משתנה לשמירת הסקריפט הנוכחי (כדי למחוק אותו כשעוברים טופס)
let currentModuleScript = null;
// משתנה לשמירת סוג הבקשה הנוכחי (uniforms, shoes...)
let currentMaaneType = '';

/**
 * פונקציה ראשית לפתיחת טופס מענה לפרט
 * טוענת דינמית את ה-HTML וה-JS המתאימים מהשרת
 * @param {string} type - שם התיקייה/קובץ (למשל: 'uniforms')
 */
async function openMaaneForm(type) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        alert("נא להתחבר למערכת");
        return;
    }

    currentMaaneType = type;
    const category = 'maane-laprat'; // שם התיקייה הראשית ב-private

    try {
        // === 1. איפוס הטופס לפני טעינה ===
        // איפוס הכותרת המשנית לברירת מחדל (למקרה שהמודול הקודם שינה אותה)
        const subtitleEl = document.getElementById('ml-form-subtitle');
        if (subtitleEl) {
            subtitleEl.innerText = 'מלאו את הפרטים לבקשה';
            subtitleEl.style.color = ''; 
            subtitleEl.style.fontWeight = '';
        }
        // ניקוי תוכן קודם
        document.getElementById('ml-dynamic-fields').innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> טוען טופס...</div>';

        // === 2. טעינת ה-HTML של המודול ===
        const htmlRes = await fetch(`/api/resource/module/${category}/${type}/${type}.html`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!htmlRes.ok) throw new Error("Failed to load module HTML");
        const htmlContent = await htmlRes.text();

        // הזרקה לדף
        document.getElementById('ml-dynamic-fields').innerHTML = htmlContent;
        
        // עדכון כותרת ראשית לפי מילון
        document.getElementById('ml-form-title').innerText = getTitleByType(type); 

        // === 3. טעינת ה-JS של המודול ===
        // הסרת סקריפט קודם אם קיים (למניעת התנגשויות)
        if (currentModuleScript) {
            currentModuleScript.remove();
            currentModuleScript = null;
            // מחיקת הפונקציה הגלובלית של המודול הקודם
            delete window.collectModuleData; 
        }

        const jsRes = await fetch(`/api/resource/module/${category}/${type}/${type}.js`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (jsRes.ok) {
            const jsCode = await jsRes.text();
            const script = document.createElement('script');
            script.textContent = jsCode;
            script.id = "active-module-script"; // ID לזיהוי
            document.body.appendChild(script);
            currentModuleScript = script;
        } else {
            console.warn(`Module ${type} has no specific JS file.`);
        }

        // === 4. מילוי אוטומטי של שדות גלובליים ===
        const savedPhone = localStorage.getItem('userPhone');
        if(savedPhone) {
            const phoneEl = document.getElementById('ml_phone');
            if(phoneEl) phoneEl.value = savedPhone;
        }

        // הצגת המסך
        showScreen('maane-laprat-form');

    } catch (error) {
        console.error("Module load error:", error);
        document.getElementById('ml-dynamic-fields').innerHTML = '<p style="color:red; text-align:center;">שגיאה בטעינת הטופס</p>';
    }
}


//פונקציית שליחת הטופס למענה לפרט
//אוספת מידע כללי + מידע ספציפי מהמודול ושולחת לשרת

async function submitMaaneForm(event) {
    event.preventDefault();
    
    // === שלב א': איסוף מידע מהמודול הספציפי ===
    let dynamicData = {};
    
    // בדיקה אם המודול הנוכחי (למשל uniforms.js) הגדיר פונקציית איסוף מיוחדת
    if (typeof window.collectModuleData === 'function') {
        dynamicData = window.collectModuleData();
        
        // אם הפונקציה החזירה null - סימן שיש שגיאת ולידציה פנימית (למשל לא נבחרו מדים)
        // אנחנו עוצרים את השליחה כאן
        if (dynamicData === null) return; 
    } else {
        // Fallback: אם אין לוגיקה מיוחדת, אוספים את כל השדות מהאזור הדינמי
        const inputs = document.querySelectorAll('#ml-dynamic-fields input, #ml-dynamic-fields select, #ml-dynamic-fields textarea');
        inputs.forEach(input => {
            if (!input.disabled) {
                dynamicData[input.id] = (input.type === 'checkbox') ? input.checked : input.value;
            }
        });
    }

    // בדיקת התחברות
    const token = localStorage.getItem('authToken');
    if (!token) { 
        alert('החיבור מנותק, נא להתחבר מחדש'); 
        if(typeof logoutUser === 'function') logoutUser();
        return; 
    }

    // === שלב ב': איסוף מידע בסיסי (מהטופס הראשי) ===
    const baseData = {
        type: 'maane_laprat', // סיווג ראשי
        subType: currentMaaneType, // סיווג משני (uniforms, shoes...)
        fullname: document.getElementById('ml_fullname')?.value || '',
        personalId: document.getElementById('ml_id_num')?.value || '',
        notes: document.getElementById('ml_notes')?.value || ''
    };

    // איחוד הנתונים לאובייקט אחד
    const payload = { ...baseData, ...dynamicData };

    // === שלב ג': שליחה לשרת ===
    // טיפול בכפתור (מניעת לחיצות כפולות + אנימציה)
    const btn = event.target.querySelector('button[type="submit"]');
    const originalBtnText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> שולח...';

    try {
        // שליחה לנתיב הייעודי של מענה לפרט
        const response = await fetch('/api/maane/report', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        
        if (res.success) {
            alert('הבקשה נשלחה בהצלחה!');
            event.target.reset(); // ניקוי הטופס הראשי
            showScreen('main-menu'); // חזרה לתפריט
        } else {
            alert('שגיאה מהשרת: ' + res.message);
        }
    } catch (e) {
        console.error("Submission error:", e);
        alert('תקלת תקשורת בשליחת הטופס');
    } finally {
        // החזרת הכפתור למצב רגיל בכל מקרה (הצלחה או כישלון)
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}


//מילון כותרות לפי סוג (כדי שהכותרת תהיה יפה בעברית)

function getTitleByType(type) {
    const titles = {
        'uniforms': 'החלפת מדים וביגוד',
        'shoes': 'החלפת נעליים',
        'laundry': 'תיאום משלוח כביסה',
        'office_supplies': 'הזמנת ציוד משרדי',
        'furniture': 'הזמנת ריהוט'
    };
    return titles[type] || 'טופס בקשה';
}