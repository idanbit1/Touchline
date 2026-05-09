document.addEventListener('DOMContentLoaded', () => {
    
    const btnFullscreen = document.getElementById('btn-fullscreen');
    btnFullscreen.addEventListener('click', () => {
        const doc = document.documentElement;
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (doc.requestFullscreen) doc.requestFullscreen();
            else if (doc.webkitRequestFullscreen) doc.webkitRequestFullscreen();
            btnFullscreen.textContent = 'יציאה ממסך מלא ↙️';
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            btnFullscreen.textContent = 'מסך מלא 🔲';
        }
    });

    function updateClock() {
        const now = new Date();
        const timeDisplay = document.getElementById('live-time');
        const dateDisplay = document.getElementById('live-date');
        if(timeDisplay) timeDisplay.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        if(dateDisplay) dateDisplay.textContent = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }
    setInterval(updateClock, 1000); updateClock();

    const homeScreen = document.getElementById('home-screen');
    const setupScreen = document.getElementById('setup-screen');
    const lineupScreen = document.getElementById('lineup-screen');
    const activeMatchWidget = document.getElementById('btn-resume-match');
    
    if(localStorage.getItem('tacticalMatchData')) {
        activeMatchWidget.classList.remove('hidden');
    }

    function switchScreen(hideScreen, showScreen) {
        if(!hideScreen || !showScreen) return;
        hideScreen.classList.remove('active');
        setTimeout(() => showScreen.classList.add('active'), 50);
    }

    document.getElementById('btn-new-match').addEventListener('click', () => switchScreen(homeScreen, setupScreen));
    document.getElementById('btn-back-home').addEventListener('click', () => switchScreen(setupScreen, homeScreen));
    document.getElementById('btn-back-setup').addEventListener('click', () => switchScreen(lineupScreen, setupScreen));
    document.getElementById('btn-back-home-lineup').addEventListener('click', () => switchScreen(lineupScreen, homeScreen));
    
    activeMatchWidget.addEventListener('click', () => {
        initLineupBuilder();
        switchScreen(homeScreen, lineupScreen);
    });

    const playersContainer = document.getElementById('players-list-container');
    const btnAddPlayer = document.getElementById('btn-add-player');

    function createPlayerRow(name = '', number = '') {
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `
            <input type="text" class="p-name" placeholder="שם שחקן מלא" value="${name}" required>
            <input type="number" class="p-number" placeholder="מספר" value="${number}" required>
            <button type="button" class="btn-remove-player" title="הסר שחקן">X</button>
        `;
        row.querySelector('.btn-remove-player').addEventListener('click', () => row.remove());
        playersContainer.appendChild(row);
    }

    if(playersContainer.children.length === 0) {
        createPlayerRow(); createPlayerRow(); createPlayerRow();
    }
    btnAddPlayer.addEventListener('click', () => createPlayerRow());

    document.getElementById('btn-load-excel').addEventListener('click', () => document.getElementById('file-excel').click());
    document.getElementById('file-excel').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1});

                playersContainer.innerHTML = '';
                
                let startIdx = 0;
                if(rows.length > 0 && isNaN(parseInt(rows[0][1]))) {
                    startIdx = 1;
                }

                for(let i = startIdx; i < rows.length; i++) {
                    const row = rows[i];
                    if(row && row.length >= 2) {
                        const name = row[0] ? row[0].toString().trim() : '';
                        const number = row[1] ? row[1].toString().trim() : '';
                        if(name) createPlayerRow(name, number);
                    }
                }
            } catch (err) {
                alert('שגיאה בקריאת הקובץ. ודא שזהו קובץ אקסל תקין.');
            }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = ''; 
    });

    document.getElementById('btn-load-default').addEventListener('click', () => {
        const saved = JSON.parse(localStorage.getItem('defaultRoster'));
        if(saved && saved.length > 0) {
            playersContainer.innerHTML = '';
            saved.forEach(p => createPlayerRow(p.name, p.number));
        } else {
            alert('לא נמצא סגל שמור במערכת.');
        }
    });

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
        localStorage.setItem('defaultRoster', JSON.stringify(playersArray)); 

        activeMatchWidget.classList.remove('hidden');
        initLineupBuilder();
        switchScreen(setupScreen, lineupScreen);
    });

    // --- מערכת שיבוץ מתקדמת: החלפות והחזרה לספסל ---
    let selectedPlayerCard = null;

    function initLineupBuilder() {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
        if(!players) return;

        const pitchesContainer = document.getElementById('pitches-container');
        const benchPlayersList = document.getElementById('bench-players');
        const benchArea = document.getElementById('bench-area');
        
        pitchesContainer.innerHTML = ''; 
        benchPlayersList.innerHTML = '';

        players.forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.id = player.id;
            card.innerHTML = `<div class="player-number">${player.number}</div><div class="player-name">${player.name}</div>`;
            
            // לחיצה על שחקן (בחירה, הסרת בחירה או החלפה)
            card.addEventListener('click', function(e) {
                e.stopPropagation();
                
                if (selectedPlayerCard) {
                    if (selectedPlayerCard === this) {
                        // ביטול בחירה
                        selectedPlayerCard.classList.remove('selected');
                        selectedPlayerCard = null;
                    } else {
                        // החלפה (Swap) בין השחקן הנבחר לשחקן שנלחץ עכשיו
                        const parentA = selectedPlayerCard.parentNode;
                        const parentB = this.parentNode;
                        
                        if (parentA === parentB && parentA === benchPlayersList) {
                            // אם שניהם בספסל - פשוט בחר את החדש
                            selectedPlayerCard.classList.remove('selected');
                            selectedPlayerCard = this;
                            this.classList.add('selected');
                        } else {
                            // ביצוע ההחלפה בפועל
                            parentB.appendChild(selectedPlayerCard);
                            parentA.appendChild(this);
                            
                            selectedPlayerCard.classList.remove('selected');
                            selectedPlayerCard = null;
                        }
                    }
                } else {
                    // בחירת השחקן
                    selectedPlayerCard = this;
                    this.classList.add('selected');
                }
            });
            benchPlayersList.appendChild(card);
        });

        for(let i = 1; i <= 2; i++) {
            const pitch = document.createElement('div');
            pitch.className = 'pitch-half';
            pitch.id = `pitch_${i}`;
            
            const rows = [1, 2, 2, 1, 1];
            let zoneIndex = 0;

            rows.forEach(count => {
                const rowEl = document.createElement('div');
                rowEl.className = 'pitch-row';
                
                for(let j = 0; j < count; j++) {
                    const zone = document.createElement('div');
                    zone.className = 'drop-zone';
                    zone.id = `zone_${i}_${zoneIndex++}`;

                    zone.addEventListener('click', function(e) {
                        e.stopPropagation();
                        
                        // אם לחצו על עמדה ואין שחקן נבחר, נבדוק אם יש פה שחקן שאפשר לבחור
                        if(!selectedPlayerCard) {
                            if(this.children.length > 0) {
                                selectedPlayerCard = this.children[0];
                                selectedPlayerCard.classList.add('selected');
                            }
                            return;
                        }

                        // אם העמדה תפוסה, נחליף ביניהם
                        if(this.children.length > 0) {
                            const existingPlayer = this.children[0];
                            selectedPlayerCard.parentNode.appendChild(existingPlayer);
                        }
                        
                        // הצבת השחקן הנבחר
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

        // לחיצה על אזור הספסל מחזירה את השחקן לספסל
        benchArea.addEventListener('click', function(e) {
            if(selectedPlayerCard) {
                benchPlayersList.appendChild(selectedPlayerCard);
                selectedPlayerCard.classList.remove('selected');
                selectedPlayerCard = null;
            }
        });

        // לחיצה מחוץ לכל אזור תבטל את הבחירה
        document.body.addEventListener('click', () => {
            if(selectedPlayerCard) {
                selectedPlayerCard.classList.remove('selected');
                selectedPlayerCard = null;
            }
        });
    }

    document.querySelectorAll('.save-lineup').forEach(btn => {
        btn.addEventListener('click', function() {
            const slot = this.getAttribute('data-slot');
            const state = [];
            document.querySelectorAll('.drop-zone').forEach(zone => {
                if(zone.children.length > 0) state.push({ zoneId: zone.id, playerId: zone.children[0].id });
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
            document.querySelectorAll('.drop-zone .player-card').forEach(p => bench.appendChild(p));

            state.forEach(item => {
                const zone = document.getElementById(item.zoneId);
                const player = document.getElementById(item.playerId);
                if(zone && player) zone.appendChild(player);
            });
        });
    });
});
