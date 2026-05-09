document.addEventListener('DOMContentLoaded', () => {
    
    // --- ניהול שעון המערכת ---
    function updateClock() {
        const now = new Date();
        const timeDisplay = document.getElementById('live-time');
        const dateDisplay = document.getElementById('live-date');
        if(timeDisplay) timeDisplay.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        if(dateDisplay) dateDisplay.textContent = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    setInterval(updateClock, 1000); 
    updateClock();

    // --- ניהול מסכים וווידג'ט צף ---
    const homeScreen = document.getElementById('home-screen');
    const setupScreen = document.getElementById('setup-screen');
    const lineupScreen = document.getElementById('lineup-screen');
    const activeMatchWidget = document.getElementById('btn-resume-match');
    
    // בדיקה האם יש משחק בתהליך בזיכרון
    if(localStorage.getItem('tacticalMatchData')) {
        activeMatchWidget.classList.remove('hidden');
    }

    function switchScreen(hideScreen, showScreen) {
        if(!hideScreen || !showScreen) return;
        hideScreen.classList.remove('active');
        setTimeout(() => showScreen.classList.add('active'), 50);
    }

    // ניווט בסיסי
    document.getElementById('btn-new-match').addEventListener('click', () => switchScreen(homeScreen, setupScreen));
    document.getElementById('btn-back-home').addEventListener('click', () => switchScreen(setupScreen, homeScreen));
    document.getElementById('btn-back-setup').addEventListener('click', () => switchScreen(lineupScreen, setupScreen));
    
    // חזרה למשחק פעיל מהחלון הצף
    activeMatchWidget.addEventListener('click', () => {
        initLineupBuilder();
        switchScreen(homeScreen, lineupScreen);
    });

    // --- טופס הגדרות וניהול שחקנים דינמי ---
    const playersContainer = document.getElementById('players-list-container');
    const btnAddPlayer = document.getElementById('btn-add-player');
    const btnLoadDefault = document.getElementById('btn-load-default');

    function createPlayerRow(name = '', number = '') {
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `
            <input type="text" class="p-name" placeholder="שם השחקן" value="${name}" required>
            <input type="number" class="p-number" placeholder="מספר" value="${number}" required>
            <button type="button" class="btn-remove-player" title="הסר שחקן">X</button>
        `;
        row.querySelector('.btn-remove-player').addEventListener('click', () => row.remove());
        playersContainer.appendChild(row);
    }

    // שורות ריקות בברירת מחדל
    if(playersContainer.children.length === 0) {
        createPlayerRow(); createPlayerRow(); createPlayerRow();
    }

    btnAddPlayer.addEventListener('click', () => createPlayerRow());

    // טעינת סגל מ-CSV
    const btnLoadCSV = document.getElementById('btn-load-csv');
    const fileCSV = document.getElementById('file-csv');
    btnLoadCSV.addEventListener('click', () => fileCSV.click());
    fileCSV.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            playersContainer.innerHTML = '';
            text.split('\n').forEach(line => {
                const parts = line.split(',');
                if(parts.length >= 2) createPlayerRow(parts[0].trim(), parts[1].trim());
            });
        };
        reader.readAsText(file);
    });

    // טעינת סגל שמור
    btnLoadDefault.addEventListener('click', () => {
        const saved = JSON.parse(localStorage.getItem('defaultRoster'));
        if(saved && saved.length > 0) {
            playersContainer.innerHTML = '';
            saved.forEach(p => createPlayerRow(p.name, p.number));
        } else {
            alert('לא נמצא סגל שמור במערכת.');
        }
    });

    // שמירת ההגדרות ומעבר לתכנון הרכב
    document.getElementById('setup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const matchData = {
            opponent: document.getElementById('opponent-name').value,
            duration: document.getElementById('match-duration').value
        };

        const playersArray = [];
        document.querySelectorAll('.player-input-row').forEach((row, index) => {
            const name = row.querySelector('.p-name').value.trim();
            const number = row.querySelector('.p-number').value.trim();
            if(name && number) {
                playersArray.push({ id: 'player_' + index, name, number, goals: 0, minutesPlayed: 0 });
            }
        });

        localStorage.setItem('tacticalMatchData', JSON.stringify(matchData));
        localStorage.setItem('tacticalPlayers', JSON.stringify(playersArray));
        localStorage.setItem('defaultRoster', JSON.stringify(playersArray)); // שומר סגל קבוע

        activeMatchWidget.classList.remove('hidden');

        initLineupBuilder();
        switchScreen(setupScreen, lineupScreen);
    });

    // --- מערכת ההרכב: לחיצה ובחירה (Tap to Select) ---
    let selectedPlayerCard = null;

    function initLineupBuilder() {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
        if(!players) return;

        const pitchesContainer = document.getElementById('pitches-container');
        const benchContainer = document.getElementById('bench-players');
        pitchesContainer.innerHTML = ''; 
        benchContainer.innerHTML = '';

        // טעינת שחקנים לספסל
        players.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.id = player.id;
            card.innerHTML = `<div class="player-number">${player.number}</div><div class="player-name">${player.name}</div>`;
            
            // לוגיקת בחירת שחקן
            card.addEventListener('click', function(e) {
                e.stopPropagation();
                if(selectedPlayerCard) selectedPlayerCard.classList.remove('selected');
                
                if(selectedPlayerCard === this) {
                    selectedPlayerCard = null; // ביטול אם נלחץ שוב
                } else {
                    selectedPlayerCard = this;
                    this.classList.add('selected');
                }
            });
            benchContainer.appendChild(card);
        });

        // יצירת 2 חצאי מגרשים ימין ושמאל
        for(let i = 1; i <= 2; i++) {
            const pitch = document.createElement('div');
            pitch.className = 'pitch-half';
            pitch.id = `pitch_${i}`;
            
            // סידור עמדות מלמעלה למטה: חלוץ (1), קשרים (2), מגנים (2), בלם (1), שוער (1)
            const rows = [1, 2, 2, 1, 1];
            let zoneIndex = 0;

            rows.forEach(count => {
                const rowEl = document.createElement('div');
                rowEl.className = 'pitch-row';
                
                for(let j = 0; j < count; j++) {
                    const zone = document.createElement('div');
                    zone.className = 'drop-zone';
                    zone.id = `zone_${i}_${zoneIndex++}`;

                    // שיבוץ שחקן בלחיצה על העמדה
                    zone.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if(!selectedPlayerCard) {
                            // אם לחצו על עמדה עם שחקן בלי לבחור מחליף, החזר לספסל
                            if(this.children.length > 0) {
                                benchContainer.appendChild(this.children[0]);
                            }
                            return;
                        }

                        // אם יש כבר שחקן בעמדה, החזר אותו לספסל
                        if(this.children.length > 0) {
                            benchContainer.appendChild(this.children[0]);
                        }
                        
                        this.appendChild(selectedPlayerCard);
                        selectedPlayerCard.classList.remove('selected');
                        selectedPlayerCard = null;
                    });

                    rowEl.appendChild(zone);
                }
                pitch.appendChild(rowEl);
            });
            pitchesContainer.appendChild(pitch);
        }

        // לחיצה על אזור ריק תבטל את הבחירה
        document.body.addEventListener('click', () => {
            if(selectedPlayerCard) {
                selectedPlayerCard.classList.remove('selected');
                selectedPlayerCard = null;
            }
        });
    }

    // --- שמירה וטעינה של 3 הרכבים שונים ---
    document.querySelectorAll('.save-lineup').forEach(btn => {
        btn.addEventListener('click', function() {
            const slot = this.getAttribute('data-slot');
            const state = [];
            document.querySelectorAll('.drop-zone').forEach(zone => {
                if(zone.children.length > 0) {
                    state.push({ zoneId: zone.id, playerId: zone.children[0].id });
                }
            });
            localStorage.setItem(`savedLineup_${slot}`, JSON.stringify(state));
            alert(`ההרכב נשמר בהצלחה במשבצת ${slot}`);
        });
    });

    document.querySelectorAll('.load-lineup').forEach(btn => {
        btn.addEventListener('click', function() {
            const slot = this.getAttribute('data-slot');
            const state = JSON.parse(localStorage.getItem(`savedLineup_${slot}`));
            if(!state || state.length === 0) {
                alert('אין הרכב שמור במשבצת זו.');
                return;
            }

            const bench = document.getElementById('bench-players');
            // החזר את כולם לספסל לפני הטעינה
            document.querySelectorAll('.drop-zone .player-card').forEach(p => bench.appendChild(p));

            // שיבוץ לפי השמירה
            state.forEach(item => {
                const zone = document.getElementById(item.zoneId);
                const player = document.getElementById(item.playerId);
                if(zone && player) zone.appendChild(player);
            });
        });
    });
});
