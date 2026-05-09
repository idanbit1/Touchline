document.addEventListener('DOMContentLoaded', () => {
    
    // --- מערכת שעון ותאריך בזמן אמת ---
    function updateClock() {
        const now = new Date();
        const timeDisplay = document.getElementById('live-time');
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        if(timeDisplay) timeDisplay.textContent = now.toLocaleTimeString('he-IL', timeOptions);

        const dateDisplay = document.getElementById('live-date');
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        if(dateDisplay) dateDisplay.textContent = now.toLocaleDateString('he-IL', dateOptions);
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- הגדרות מסכים ---
    const homeScreen = document.getElementById('home-screen');
    const setupScreen = document.getElementById('setup-screen');
    const lineupScreen = document.getElementById('lineup-screen');
    
    const btnNewMatch = document.getElementById('btn-new-match');
    const btnBackHome = document.getElementById('btn-back-home');
    const setupForm = document.getElementById('setup-form');

    function switchScreen(hideScreen, showScreen) {
        hideScreen.classList.remove('active');
        setTimeout(() => {
            showScreen.classList.add('active');
        }, 50);
    }

    // מעברים בסיסיים
    if(btnNewMatch) btnNewMatch.addEventListener('click', () => switchScreen(homeScreen, setupScreen));
    if(btnBackHome) btnBackHome.addEventListener('click', () => switchScreen(setupScreen, homeScreen));

    // --- שמירת הגדרות משחק ורשימת שחקנים ---
    if(setupForm) {
        setupForm.addEventListener('submit', (e) => {
            e.preventDefault(); // מונע רענון של העמוד

            // איסוף הנתונים
            const matchData = {
                opponent: document.getElementById('opponent-name').value,
                location: document.getElementById('match-location').value,
                format: document.getElementById('match-format').value,
                duration: parseInt(document.getElementById('match-duration').value),
                halfDuration: parseInt(document.getElementById('match-duration').value) / 2
            };

            // עיבוד רשימת השחקנים מתיבת הטקסט
            const playersRaw = document.getElementById('players-list').value;
            const playersArray = [];
            
            // פירוק שורות וניקוי רווחים
            const lines = playersRaw.split('\n');
            lines.forEach(line => {
                if (line.trim() !== '') {
                    // הפרדה לפי פסיק, מקף או טאב
                    const parts = line.split(/[,|\t|-]/);
                    if (parts.length >= 2) {
                        playersArray.push({
                            name: parts[0].trim(),
                            number: parts[1].trim(),
                            minutesPlayed: 0,
                            goals: 0
                        });
                    }
                }
            });

            // שמירה בזיכרון המקומי של המכשיר
            localStorage.setItem('tacticalMatchData', JSON.stringify(matchData));
            localStorage.setItem('tacticalPlayers', JSON.stringify(playersArray));

            console.log('הגדרות נשמרו:', matchData);
            console.log('שחקנים נשמרו:', playersArray);

            // מעבר למסך תכנון הרכב
            switchScreen(setupScreen, lineupScreen);
        });
    }
});
