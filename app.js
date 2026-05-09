document.addEventListener('DOMContentLoaded', () => {
    
    // --- שעון מערכת ---
    function updateClock() {
        const now = new Date();
        const timeDisplay = document.getElementById('live-time');
        if(timeDisplay) timeDisplay.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        const dateDisplay = document.getElementById('live-date');
        if(dateDisplay) dateDisplay.textContent = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    // --- אלמנטים ---
    const homeScreen = document.getElementById('home-screen');
    const setupScreen = document.getElementById('setup-screen');
    const lineupScreen = document.getElementById('lineup-screen');
    
    function switchScreen(hideScreen, showScreen) {
        hideScreen.classList.remove('active');
        setTimeout(() => showScreen.classList.add('active'), 50);
    }

    document.getElementById('btn-new-match')?.addEventListener('click', () => switchScreen(homeScreen, setupScreen));
    document.getElementById('btn-back-home')?.addEventListener('click', () => switchScreen(setupScreen, homeScreen));

    // --- שמירת הגדרות מעבר להרכב ---
    const setupForm = document.getElementById('setup-form');
    if(setupForm) {
        setupForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const matchData = {
                opponent: document.getElementById('opponent-name').value,
                location: document.getElementById('match-location').value,
                format: document.getElementById('match-format').value,
                duration: parseInt(document.getElementById('match-duration').value)
            };

            const playersArray = [];
            const lines = document.getElementById('players-list').value.split('\n');
            lines.forEach((line, index) => {
                if (line.trim() !== '') {
                    const parts = line.split(/[,|\t|-]/);
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

            localStorage.setItem('tacticalMatchData', JSON.stringify(matchData));
            localStorage.setItem('tacticalPlayers', JSON.stringify(playersArray));

            // קריאה לבניית המגרש ואז מעבר מסך
            initLineupBuilder();
            switchScreen(setupScreen, lineupScreen);
        });
    }

    // --- בניית מסך ההרכב והמגרשים ---
    let draggedItem = null;

    function initLineupBuilder() {
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData'));
        const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
        
        if(!matchData || !players) return;

        const pitchesContainer = document.getElementById('pitches-container');
        const benchContainer = document.getElementById('bench-players');
        
        pitchesContainer.innerHTML = '';
        benchContainer.innerHTML = '';

        // 1. טעינת השחקנים לספסל
        players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'player-card';
            playerEl.draggable = true;
            playerEl.id = player.id;
            playerEl.innerHTML = `
                <div class="player-number">${player.number}</div>
                <div class="player-name">${player.name}</div>
            `;
            
            playerEl.addEventListener('dragstart', function(e) {
                draggedItem = this;
                setTimeout(() => this.style.opacity = '0.5', 0);
            });
            playerEl.addEventListener('dragend', function() {
                setTimeout(() => this.style.opacity = '1', 0);
                draggedItem = null;
            });
            
            benchContainer.appendChild(playerEl);
        });

        // לאפשר גרירה חזרה לספסל
        benchContainer.addEventListener('dragover', e => e.preventDefault());
        benchContainer.addEventListener('drop', function(e) {
            this.appendChild(draggedItem);
        });

        // 2. בניית המגרשים לפי שיטת המשחק
        const numPitches = matchData.format === '2-7v7' ? 2 : 1;
        
        for(let i = 1; i <= numPitches; i++) {
            const pitch = document.createElement('div');
            pitch.className = 'pitch';
            
            // הגדרת עמדות: חלוץ (1), קשרים (2), מגנים (2), בלם (1), שוער (1)
            // השורות מסודרות מהתקפה (למעלה) להגנה (למטה)
            const formationRows = [1, 2, 2, 1, 1];

            formationRows.forEach(slotsCount => {
                const rowEl = document.createElement('div');
                rowEl.className = 'pitch-row';
                
                for(let j = 0; j < slotsCount; j++) {
                    const dropZone = document.createElement('div');
                    dropZone.className = 'drop-zone';
                    
                    // אירועי גרירה לעמדות המגרש
                    dropZone.addEventListener('dragover', e => e.preventDefault());
                    dropZone.addEventListener('dragenter', function(e) { e.preventDefault(); this.classList.add('drag-over'); });
                    dropZone.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
                    dropZone.addEventListener('drop', function(e) {
                        this.classList.remove('drag-over');
                        if (this.children.length === 0) {
                            this.appendChild(draggedItem); // אם ריק, פשוט שים שם
                        } else {
                            // אם כבר יש שחקן, החזר אותו לספסל ושים את החדש במקומו
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
