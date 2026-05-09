document.addEventListener('DOMContentLoaded', () => {
    
    // --- מערכת שעון ותאריך בזמן אמת ---
    function updateClock() {
        const now = new Date();
        
        // עדכון שעה
        const timeDisplay = document.getElementById('live-time');
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        timeDisplay.textContent = now.toLocaleTimeString('he-IL', timeOptions);

        // עדכון תאריך
        const dateDisplay = document.getElementById('live-date');
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.textContent = now.toLocaleDateString('he-IL', dateOptions);
    }

    // הפעלת השעון כל שנייה
    setInterval(updateClock, 1000);
    updateClock(); // קריאה ראשונית כדי למנוע השהיה

    // --- ניהול ניווט בין מסכים ---
    const homeScreen = document.getElementById('home-screen');
    const setupScreen = document.getElementById('setup-screen');
    const btnNewMatch = document.getElementById('btn-new-match');
    const btnBackHome = document.getElementById('btn-back-home');

    // פונקציה להחלפת מסכים
    function switchScreen(hideScreen, showScreen) {
        hideScreen.classList.remove('active');
        // השהיה קטנה כדי לתת לאנימציה לעבוד חלק
        setTimeout(() => {
            showScreen.classList.add('active');
        }, 50);
    }

    // מאזינים לכפתורים
    btnNewMatch.addEventListener('click', () => {
        switchScreen(homeScreen, setupScreen);
    });

    btnBackHome.addEventListener('click', () => {
        switchScreen(setupScreen, homeScreen);
    });
});
