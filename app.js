document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. מערכת שעון ותאריך ---
    function updateClock() {
        const now = new Date();
        const timeDisplay = document.getElementById('live-time');
        const dateDisplay = document.getElementById('live-date');
        
        if(timeDisplay) {
            timeDisplay.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        }
        if(dateDisplay) {
            dateDisplay.textContent = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- 2. מזהי מסכים וכפתורים ---
    const homeScreen = document.getElementById('home-screen');
    const setupScreen = document.getElementById('setup-screen');
    const lineupScreen = document.getElementById('lineup-screen');
    
    const btnNewMatch = document.getElementById('btn-new-match');
    const btnBackHome = document.getElementById('btn-back-home');
    const setupForm = document.getElementById('setup-form');

    function switchScreen(hideScreen, showScreen) {
        if(!hideScreen || !showScreen) return;
        hideScreen.classList.remove('active');
        setTimeout(() => showScreen.classList.add('active'), 50);
    }

    // מאזיני לחיצה - מעברי מסך
    if (btnNewMatch) {
        btnNewMatch.addEventListener('click', () => switchScreen(homeScreen, setupScreen));
    }
    if (btnBackHome) {
        btnBackHome.addEventListener('click', () => switchScreen(setupScreen, homeScreen));
    }

    // --- 3. טיפול בטופס הגדרות המשחק ---
    if (setupForm) {
        setupForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // איסוף נתוני הגדרות
            const matchData = {
                opponent: document.getElementById('opponent-name').value,
                location: document.getElementById('match-location').value,
                format: document.getElementById('match-format').value,
                duration: parseInt(document.getElementById('match-duration').value)
            };

            // איסוף שחקנים
            const playersArray = [];
            const playersText = document.getElementById('players-list').value;
            const lines = playersText.split('\n');
            
            lines.forEach((line, index) => {
                if (line.trim() !== '') {
                    const parts = line.split(/[,|\t|-]/); // מזהה פסיק, מקף או טאב
                    if (parts.length >= 2) {
                        playersArray.push({
                            id: 'player_' + index,
                            name: parts[0].trim(),
                            number: parts[1].trim(),
                            minutesPlayed: 0,
                            goals: 0
                        });
                    }
                }
            });

            // שמירה בזיכרון והפעלת המגרש
            localStorage.setItem('tacticalMatchData', JSON.stringify(matchData));
            localStorage.setItem('tacticalPlayers', JSON.stringify(playersArray));

            initLineupBuilder();
            switchScreen(setupScreen, lineupScreen);
        });
    }

    // --- 4. בניית המגרש והשחקנים ---
    let draggedItem = null;

    function initLineupBuilder() {
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData'));
        const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
        
        if(!matchData || !players) return;

        const pitchesContainer = document.getElementById('pitches-container');
        const benchContainer = document.getElementById('bench-players');
        
        if(!pitchesContainer || !benchContainer) return;

        pitchesContainer.innerHTML = '';
        benchContainer.innerHTML = '';

        // טעינת שחקנים לספסל
        players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'player-card';
            playerEl.draggable = true;
            playerEl.id = player.id;
            playerEl.innerHTML = `
                <div class="player-number">${player.number}</div>
                <div class="player-name">${player.name}</div>
            `;
            
            playerEl.addEventListener('dragstart', function() {
                draggedItem = this;
                setTimeout(() => this.style.opacity = '0.5', 0);
            });
            playerEl.addEventListener('dragend', function() {
                setTimeout(() => this.style.opacity = '1', 0);
                draggedItem = null;
            });
            
            benchContainer.appendChild(playerEl);
        });

        benchContainer.addEventListener('dragover', e => e.preventDefault());
        benchContainer.addEventListener('drop', function() {
            if(draggedItem) this.appendChild(draggedItem);
        });

        // יצירת מגרשים לפי הבחירה
        const numPitches = matchData.format === '2-7v7' ? 2 : 1;
        const formationRows = [1, 2, 2, 1, 1]; // שוער, בלם, מגנים, קשרים, חלוץ

        for(let i = 1; i <= numPitches; i++) {
            const pitch = document.createElement('div');
            pitch.className = 'pitch';
            
            formationRows.forEach(slotsCount => {
                const rowEl = document.createElement('div');
                rowEl.className = 'pitch-row';
                
                for(let j = 0; j < slotsCount; j++) {
                    const dropZone = document.createElement('div');
                    dropZone.className = 'drop-zone';
                    
                    dropZone.addEventListener('dragover', e => e.preventDefault());
                    dropZone.addEventListener('dragenter', function(e) { e.preventDefault(); this.classList.add('drag-over'); });
                    dropZone.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
                    dropZone.addEventListener('drop', function() {
                        this.classList.remove('drag-over');
                        if(!draggedItem) return;

                        if (this.children.length === 0) {
                            this.appendChild(draggedItem);
                        } else {
                            const existingPlayer = this.children[0];
                            document.getElementById('bench-players').appendChild(existingPlayer);
                            this.appendChild(draggedItem);
                        }
                    });
                    
                    rowEl.appendChild(dropZone);
                }
                pitch.appendChild(rowEl);
            });
            
            pitchesContainer.appendChild(pitch);
        }
    }
});
