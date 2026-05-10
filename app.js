document.addEventListener('DOMContentLoaded', () => {

    let matchState = JSON.parse(localStorage.getItem('touchlineMatchState')) || null;
    let savedMatches = JSON.parse(localStorage.getItem('touchlineSavedMatches')) || []; 

    function saveState() { 
        if(matchState) {
            localStorage.setItem('touchlineMatchState', JSON.stringify(matchState)); 
            updateSavedMatchesList(); 
        }
    }

    function updateSavedMatchesList() {
        if(!matchState) return;
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData'));
        if(!matchData) return;
        
        const matchId = matchData.date + '_' + matchData.time; 
        const existingIdx = savedMatches.findIndex(m => m.id === matchId);
        
        const snapshot = {
            id: matchId,
            title: `${matchData.myTeam} נגד ${matchData.opponent}`,
            date: matchData.date,
            time: matchData.time,
            state: matchState,
            data: matchData,
            players: JSON.parse(localStorage.getItem('tacticalPlayers')),
            roster: JSON.parse(localStorage.getItem('defaultRoster'))
        };

        if(existingIdx > -1) savedMatches[existingIdx] = snapshot;
        else savedMatches.push(snapshot);
        
        localStorage.setItem('touchlineSavedMatches', JSON.stringify(savedMatches));
        renderHomeData();
    }

    // --- Home Screen Rendering (Active + Saved) ---
    function renderHomeData() {
        const grid = document.getElementById('saved-matches-grid');
        const activeContainer = document.getElementById('active-match-container');
        grid.innerHTML = '';
        
        const currentMatchData = JSON.parse(localStorage.getItem('tacticalMatchData'));
        const currentId = currentMatchData ? (currentMatchData.date + '_' + currentMatchData.time) : null;

        let hasSaved = false;

        if (matchState && matchState.isActive && currentId) {
            // אם יש משחק פעיל - הוא מוצג בקוביה נפרדת ומהבהבת ישר מתחת לכפתור התחל
            activeContainer.classList.remove('hidden');
            const m = Math.floor(matchState.elapsedSeconds / 60).toString().padStart(2, '0');
            const s = (matchState.elapsedSeconds % 60).toString().padStart(2, '0');
            const sc = matchState.scores;
            
            activeContainer.innerHTML = `
                <div class="active-match-floating" id="btn-resume-match">
                    <h3>משחק פעיל 🔴</h3>
                    <p style="font-size:18px;">${currentMatchData.myTeam} נגד ${currentMatchData.opponent}</p>
                    <div class="active-timer" id="active-cube-time">${m}:${s}</div>
                    <div style="font-size:24px; font-weight:bold; margin-top:5px;">${sc.myTeam1+sc.myTeam2} - ${sc.opp1+sc.opp2}</div>
                    <div style="font-size:14px; margin-top:5px;">לחץ כאן כדי לחזור למשחק</div>
                </div>
            `;
            document.getElementById('btn-resume-match').addEventListener('click', () => {
                switchScreen('live');
            });
        } else {
            activeContainer.classList.add('hidden');
        }

        // הצגת רק משחקים שהם לא המשחק הפעיל ברשימה למטה
        savedMatches.forEach(match => {
            if (match.id === currentId && match.state && match.state.isActive) return; // לא להציג למטה את הפעיל

            hasSaved = true;
            const cube = document.createElement('div');
            cube.className = 'match-cube';
            cube.innerHTML = `
                <button class="btn-delete-match" data-id="${match.id}" title="מחק משחק">X</button>
                <h3>${match.title}</h3>
                <p>${match.date} | ${match.time}</p>
                <p style="margin-top:10px; font-weight:bold;">תוצאה סופית: ${match.state.scores.myTeam1+match.state.scores.myTeam2} - ${match.state.scores.opp1+match.state.scores.opp2}</p>
            `;
            
            cube.addEventListener('click', (e) => {
                if(e.target.classList.contains('btn-delete-match')) return;
                loadMatchSnapshot(match);
            });

            cube.querySelector('.btn-delete-match').addEventListener('click', (e) => {
                e.stopPropagation();
                if(confirm('האם למחוק משחק זה?')) {
                    savedMatches = savedMatches.filter(m => m.id !== match.id);
                    localStorage.setItem('touchlineSavedMatches', JSON.stringify(savedMatches));
                    renderHomeData();
                }
            });

            grid.appendChild(cube);
        });

        if(!hasSaved) {
            grid.innerHTML = '<p style="color:var(--text-secondary);">אין משחקים שמורים קודמים.</p>';
        }
    }

    function loadMatchSnapshot(snapshot) {
        localStorage.setItem('tacticalMatchData', JSON.stringify(snapshot.data));
        localStorage.setItem('tacticalPlayers', JSON.stringify(snapshot.players));
        localStorage.setItem('defaultRoster', JSON.stringify(snapshot.roster));
        localStorage.setItem('touchlineMatchState', JSON.stringify(snapshot.state));
        matchState = snapshot.state;
        
        if(matchState.isActive) {
            initLineupBuilder(); 
            switchScreen('live');
        } else {
            switchScreen('setup'); // אפשר גם לפתוח ישירות את מודל הסיכום כאן בעתיד
        }
    }

    // --- Global Clocks ---
    function updateClocks() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeStr = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        document.getElementById('live-time-date').textContent = `${dateStr} | ${timeStr}`;
        
        if (matchState && matchState.timerRunning && matchState.lastTickTime) {
            const diff = Math.floor((Date.now() - matchState.lastTickTime) / 1000);
            if (diff > 0) {
                matchState.elapsedSeconds += diff;
                matchState.lastTickTime = Date.now();
                updatePlayerMinutes(diff);
                saveState();
            }
        }
        renderTimer();
        check40PercentRule(); 
    }
    setInterval(updateClocks, 1000);
    updateClocks();

    function renderTimer() {
        if(!matchState) return;
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData')) || { duration: 70 };
        const halfTimeSeconds = (matchData.duration / 2) * 60;
        
        const m = Math.floor(matchState.elapsedSeconds / 60).toString().padStart(2, '0');
        const s = (matchState.elapsedSeconds % 60).toString().padStart(2, '0');
        const mainClock = document.getElementById('main-stopwatch');
        const activeCubeTime = document.getElementById('active-cube-time');
        
        if(mainClock) {
            mainClock.textContent = `${m}:${s}`;
            if ((matchState.currentHalf === 1 && matchState.elapsedSeconds >= halfTimeSeconds) ||
                (matchState.currentHalf === 2 && matchState.elapsedSeconds >= halfTimeSeconds * 2)) {
                mainClock.classList.add('injury');
            } else {
                mainClock.classList.remove('injury');
            }
        }
        if(activeCubeTime) activeCubeTime.textContent = `${m}:${s}`;
    }

    // --- Navigation Flow ---
    const screens = {
        home: document.getElementById('home-screen'),
        players: document.getElementById('players-screen'),
        setup: document.getElementById('setup-screen'),
        attendance: document.getElementById('attendance-screen'),
        lineup: document.getElementById('lineup-screen'),
        live: document.getElementById('live-match-screen')
    };

    function switchScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
        
        document.getElementById('nav-live').style.display = (matchState && matchState.isActive) ? 'block' : 'none';
        document.getElementById('nav-setup').style.display = localStorage.getItem('tacticalMatchData') ? 'block' : 'none';
        document.getElementById('nav-attendance').style.display = localStorage.getItem('tacticalMatchData') ? 'block' : 'none';
        document.getElementById('nav-lineup').style.display = localStorage.getItem('tacticalMatchData') ? 'block' : 'none';
        
        if(screenName === 'live') {
            renderScores();
            updateTeamNames();
            document.getElementById('live-pitch-1-container').appendChild(document.getElementById('lineup_pitch_1') || createEmptyPitch(1));
            document.getElementById('live-pitch-2-container').appendChild(document.getElementById('lineup_pitch_2') || createEmptyPitch(2));
            const liveBench = document.getElementById('live-bench-players');
            const oldBench = document.getElementById('bench-players');
            while(oldBench && oldBench.firstChild) liveBench.appendChild(oldBench.firstChild);
        }
        
        if(screenName === 'lineup') {
            const isSecondHalf = (matchState && matchState.currentHalf === 2);
            document.getElementById('lineup-title').textContent = isSecondHalf ? "תכנון הרכב מחצית שניה" : "תכנון הרכב מחצית ראשונה";
            document.getElementById('btn-load-h1-lineup').style.display = isSecondHalf ? 'inline-block' : 'none';
        }
        
        if(screenName === 'home') renderHomeData();
    }

    function createEmptyPitch(i) {
        const pitch = document.createElement('div');
        pitch.className = 'pitch-half'; pitch.id = `lineup_pitch_${i}`;
        const rows = [1, 2, 2, 1, 1];
        let zoneIdx = 0;
        rows.forEach(c => {
            const rowEl = document.createElement('div'); rowEl.className = 'pitch-row';
            for(let j=0; j<c; j++) {
                const zone = document.createElement('div'); zone.className = 'drop-zone'; zone.id = `zone_${i}_${zoneIdx++}`;
                enableZoneClick(zone, document.getElementById('live-bench-players'));
                rowEl.appendChild(zone);
            }
            pitch.appendChild(rowEl);
        });
        return pitch;
    }

    document.getElementById('nav-home').addEventListener('click', () => switchScreen('home'));
    document.getElementById('nav-players').addEventListener('click', () => switchScreen('players'));
    document.getElementById('nav-setup').addEventListener('click', () => switchScreen('setup'));
    document.getElementById('nav-attendance').addEventListener('click', () => switchScreen('attendance'));
    document.getElementById('nav-lineup').addEventListener('click', () => switchScreen('lineup'));
    document.getElementById('nav-live').addEventListener('click', () => switchScreen('live'));
    
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
        else document.exitFullscreen();
    });

    // --- PLAYERS MANAGEMENT (New Screen) ---
    const playersContainer = document.getElementById('players-list-container');
    function createSetupPlayerRow(name = '', number = '') {
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `<input type="text" class="p-name" placeholder="שם מלא" value="${name}"><input type="number" class="p-number" placeholder="מס'" value="${number}"><button type="button" class="btn-remove-player" title="מחק">X</button>`;
        row.querySelector('.btn-remove-player').addEventListener('click', () => row.remove());
        playersContainer.appendChild(row);
    }

    const loadDefRoster = JSON.parse(localStorage.getItem('defaultRoster'));
    if(loadDefRoster && loadDefRoster.length > 0) {
        loadDefRoster.forEach(p => createSetupPlayerRow(p.name, p.number));
    } else {
        createSetupPlayerRow(); createSetupPlayerRow();
    }

    document.getElementById('btn-add-player').addEventListener('click', () => createSetupPlayerRow());
    
    document.getElementById('btn-save-roster').addEventListener('click', () => {
        const roster = [];
        document.querySelectorAll('#players-list-container .player-input-row').forEach((row, index) => {
            const name = row.querySelector('.p-name').value.trim();
            const number = row.querySelector('.p-number').value.trim();
            if(name && number) roster.push({ id: 'p_' + index, name, number, goals: 0, secondsPlayed: 0 });
        });
        localStorage.setItem('defaultRoster', JSON.stringify(roster)); 
        alert('הסגל נשמר בהצלחה במערכת!');
    });

    document.getElementById('btn-load-excel').addEventListener('click', () => document.getElementById('file-excel').click());
    document.getElementById('file-excel').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {header: 1});
                playersContainer.innerHTML = '';
                let startIdx = (rows.length > 0 && isNaN(parseInt(rows[0][1]))) ? 1 : 0;
                for(let i = startIdx; i < rows.length; i++) {
                    if(rows[i] && rows[i].length >= 2) createSetupPlayerRow(rows[i][0]||'', rows[i][1]||'');
                }
            } catch (err) { alert('שגיאה בקריאת הקובץ.'); }
        };
        reader.readAsArrayBuffer(file); e.target.value = ''; 
    });

    document.getElementById('btn-export-excel').addEventListener('click', () => {
        const roster = JSON.parse(localStorage.getItem('defaultRoster')) || [];
        if(roster.length === 0) return alert('אין שחקנים לייצוא.');
        const wsData = roster.map(p => ({ 'שם שחקן': p.name, 'מספר חולצה': p.number }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Players");
        XLSX.writeFile(wb, "Touchline_Roster.xlsx");
    });

    // --- SETUP MATCH ---
    document.getElementById('btn-new-match').addEventListener('click', () => {
        matchState = null;
        localStorage.removeItem('tacticalMatchData'); 
        localStorage.removeItem('tacticalPlayers'); 
        document.getElementById('setup-form').reset();
        document.getElementById('my-team-name').value = "מ.ס רובי שפירא"; 
        switchScreen('setup');
    });

    document.getElementById('setup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const matchData = {
            myTeam: document.getElementById('my-team-name').value,
            opponent: document.getElementById('opponent-name').value,
            location: document.getElementById('match-location').value,
            homeAway: document.getElementById('home-away').value,
            date: document.getElementById('match-date').value,
            time: document.getElementById('match-time').value,
            duration: parseInt(document.getElementById('match-duration').value)
        };
        localStorage.setItem('tacticalMatchData', JSON.stringify(matchData));
        
        const roster = JSON.parse(localStorage.getItem('defaultRoster')) || [];
        buildAttendanceList(roster);
        switchScreen('attendance');
    });

    // --- ATTENDANCE ---
    function buildAttendanceList(roster) {
        const attContainer = document.getElementById('attendance-list-container');
        attContainer.innerHTML = '';
        document.getElementById('total-roster-count').textContent = roster.length;
        
        roster.forEach(p => {
            const row = document.createElement('div');
            row.className = 'attendance-row';
            row.innerHTML = `<input type="checkbox" class="att-checkbox" id="att_${p.id}" checked>
                             <label for="att_${p.id}" class="att-name">${p.name}</label>
                             <span class="att-num">${p.number}</span>`;
            row.querySelector('input').addEventListener('change', updateAttCount);
            attContainer.appendChild(row);
        });
        updateAttCount();
    }

    function updateAttCount() { document.getElementById('total-arrived-count').textContent = document.querySelectorAll('.att-checkbox:checked').length; }

    document.getElementById('btn-confirm-attendance').addEventListener('click', () => {
        const roster = JSON.parse(localStorage.getItem('defaultRoster')) || [];
        const matchSquad = [];
        roster.forEach(p => {
            const cb = document.getElementById(`att_${p.id}`);
            if(cb && cb.checked) {
                // יוצרים עותק נקי של השחקן למשחק הזה
                matchSquad.push({ id: p.id, name: p.name, number: p.number, goals: 0, secondsPlayed: 0 });
            }
        });
        localStorage.setItem('tacticalPlayers', JSON.stringify(matchSquad));
        
        if(!matchState) {
            matchState = { isActive: false, timerRunning: false, elapsedSeconds: 0, currentHalf: 1, scores: { myTeam1: 0, opp1: 0, myTeam2: 0, opp2: 0 }, lastTickTime: null };
        }
        saveState();

        initLineupBuilder();
        switchScreen('lineup');
    });

    // --- LINEUP ---
    let selectedCard = null;

    function initLineupBuilder() {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers')) || [];
        const pitchesContainer = document.getElementById('pitches-container');
        const benchContainer = document.getElementById('bench-players');
        
        if(!document.getElementById('lineup_pitch_1')) {
            pitchesContainer.innerHTML = ''; 
            for(let i = 1; i <= 2; i++) {
                pitchesContainer.appendChild(createEmptyPitch(i));
            }
        } else {
            pitchesContainer.appendChild(document.getElementById('lineup_pitch_1'));
            pitchesContainer.appendChild(document.getElementById('lineup_pitch_2'));
        }

        benchContainer.innerHTML = '';
        const liveBench = document.getElementById('live-bench-players');
        while(liveBench && liveBench.firstChild) benchContainer.appendChild(liveBench.firstChild);

        players.forEach(p => {
            if(!document.getElementById(p.id)) {
                const card = document.createElement('div');
                card.className = 'player-card'; card.id = p.id;
                card.innerHTML = `<div class="player-number">${p.number}</div><div class="player-name">${p.name}</div>`;
                enablePlayerClick(card, benchContainer);
                benchContainer.appendChild(card);
            }
        });
    }

    function enablePlayerClick(card, benchContainer) {
        card.addEventListener('click', function(e) {
            e.stopPropagation();
            const activeBench = document.getElementById('live-bench-players').contains(this) ? document.getElementById('live-bench-players') : document.getElementById('bench-players');
            
            if (selectedCard) {
                if (selectedCard === this) { selectedCard.classList.remove('selected'); selectedCard = null; }
                else {
                    const pA = selectedCard.parentNode, pB = this.parentNode;
                    if (pA === pB && (pA.id === 'bench-players' || pA.id === 'live-bench-players')) {
                        selectedCard.classList.remove('selected'); selectedCard = this; this.classList.add('selected');
                    } else {
                        pB.appendChild(selectedCard); pA.appendChild(this);
                        selectedCard.classList.remove('selected'); selectedCard = null;
                    }
                }
            } else { selectedCard = this; this.classList.add('selected'); }
        });
    }

    function enableZoneClick(zone, benchContainer) {
        zone.addEventListener('click', function(e) {
            e.stopPropagation();
            if(!selectedCard) { if(this.children.length > 0) { selectedCard = this.children[0]; selectedCard.classList.add('selected'); } return; }
            if(this.children.length > 0) selectedCard.parentNode.appendChild(this.children[0]);
            this.appendChild(selectedCard);
            selectedCard.classList.remove('selected'); selectedCard = null;
        });
    }

    document.getElementById('bench-area').addEventListener('click', function() {
        if(selectedCard) { document.getElementById('bench-players').appendChild(selectedCard); selectedCard.classList.remove('selected'); selectedCard = null; }
    });

    document.getElementById('btn-clear-lineup').addEventListener('click', () => {
        const bench = document.getElementById('bench-players');
        document.querySelectorAll('.drop-zone .player-card').forEach(p => bench.appendChild(p));
    });

    document.querySelectorAll('.save-lineup').forEach(btn => {
        btn.addEventListener('click', function() {
            const slot = this.getAttribute('data-slot');
            const state = [];
            document.querySelectorAll('.drop-zone').forEach(zone => {
                if(zone.children.length > 0) state.push({ zoneId: zone.id, playerId: zone.children[0].id });
            });
            localStorage.setItem(`savedLineup_${slot}`, JSON.stringify(state));
            alert('הרכב נשמר!');
        });
    });

    document.querySelectorAll('.load-lineup').forEach(btn => {
        btn.addEventListener('click', function() {
            const slot = this.getAttribute('data-slot');
            const state = JSON.parse(localStorage.getItem(`savedLineup_${slot}`));
            if(!state) return alert('אין הרכב שמור במיקום זה.');
            const bench = document.getElementById('bench-players');
            document.querySelectorAll('.drop-zone .player-card').forEach(p => bench.appendChild(p));
            state.forEach(item => {
                const zone = document.getElementById(item.zoneId);
                const player = document.getElementById(item.playerId);
                if(zone && player) zone.appendChild(player);
            });
        });
    });

    // שמירה ושחזור ההרכב שהיה בתחילת המחצית (לצורך טעינה במחצית שניה)
    document.getElementById('btn-load-h1-lineup').addEventListener('click', () => {
        const state = JSON.parse(localStorage.getItem(`savedLineup_H1`));
        if(!state) return alert('לא נמצא הרכב שמור ממחצית ראשונה.');
        const bench = document.getElementById('bench-players');
        document.querySelectorAll('.drop-zone .player-card').forEach(p => bench.appendChild(p));
        state.forEach(item => {
            const zone = document.getElementById(item.zoneId);
            const player = document.getElementById(item.playerId);
            if(zone && player) zone.appendChild(player);
        });
    });

    document.getElementById('btn-go-live').addEventListener('click', () => {
        // שמירת ההרכב האוטומטית לפני היציאה ללייב (כדי לשחזר במחצית השניה)
        if(matchState.currentHalf === 1 && !matchState.isActive) {
            const h1State = [];
            document.querySelectorAll('.drop-zone').forEach(zone => {
                if(zone.children.length > 0) h1State.push({ zoneId: zone.id, playerId: zone.children[0].id });
            });
            localStorage.setItem(`savedLineup_H1`, JSON.stringify(h1State));
        }

        matchState.isActive = true; saveState();
        
        const livePitch1 = document.getElementById('live-pitch-1-container');
        const livePitch2 = document.getElementById('live-pitch-2-container');
        const liveBench = document.getElementById('live-bench-players');
        
        livePitch1.appendChild(document.getElementById('lineup_pitch_1'));
        livePitch2.appendChild(document.getElementById('lineup_pitch_2'));
        
        const oldBench = document.getElementById('bench-players');
        while(oldBench.firstChild) {
            liveBench.appendChild(oldBench.firstChild);
        }
        
        document.getElementById('live-bench-area').addEventListener('click', function() {
            if(selectedCard) { liveBench.appendChild(selectedCard); selectedCard.classList.remove('selected'); selectedCard = null; }
        });

        switchScreen('live');
    });

    // --- LIVE MATCH LOGIC ---
    function updateTeamNames() {
        const data = JSON.parse(localStorage.getItem('tacticalMatchData'));
        if(!data) return;
        document.querySelectorAll('.my-team-label').forEach(el => el.textContent = data.myTeam);
        document.querySelectorAll('.opp-team-label').forEach(el => el.textContent = data.opponent);
    }

    const btnToggleTimer = document.getElementById('btn-toggle-timer');
    btnToggleTimer.addEventListener('click', () => {
        if(matchState.timerRunning) {
            matchState.timerRunning = false; matchState.lastTickTime = null;
            btnToggleTimer.textContent = 'המשך משחק'; btnToggleTimer.classList.replace('secondary-action', 'primary-action');
            btnToggleTimer.style.color = '#fff';
        } else {
            matchState.timerRunning = true; matchState.lastTickTime = Date.now();
            btnToggleTimer.textContent = 'עצור שעון'; btnToggleTimer.classList.replace('primary-action', 'secondary-action');
        }
        saveState();
    });

    function check40PercentRule() {
        if(!matchState) return;
        const players = JSON.parse(localStorage.getItem('tacticalPlayers')) || [];
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData')) || { duration: 70 };
        const totalSecs = matchData.duration * 60;
        const requiredSecs = totalSecs * 0.4;
        const remainingSecs = totalSecs - matchState.elapsedSeconds;

        players.forEach(p => {
            const card = document.getElementById(p.id);
            if(card) {
                const needed = requiredSecs - p.secondsPlayed;
                if (needed > 0 && needed >= (remainingSecs - 60)) {
                    card.classList.add('alert-40');
                } else {
                    card.classList.remove('alert-40');
                }
            }
        });
    }

    function updatePlayerMinutes(sec) {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers')) || [];
        const onPitch = document.querySelectorAll('#live-pitches-container .player-card');
        onPitch.forEach(el => {
            const idx = players.findIndex(p => p.id === el.id);
            if(idx > -1) players[idx].secondsPlayed += sec;
        });
        localStorage.setItem('tacticalPlayers', JSON.stringify(players));
    }

    function renderScores() {
        if(!matchState) return;
        const s = matchState.scores;
        document.getElementById('live-score-1').textContent = `${s.myTeam1} - ${s.opp1}`;
        document.getElementById('live-score-2').textContent = `${s.myTeam2} - ${s.opp2}`;
        document.getElementById('live-score-total').textContent = `${s.myTeam1+s.myTeam2} - ${s.opp1+s.opp2}`;
    }

    document.querySelectorAll('.btn-goal-opp').forEach(btn => {
        btn.addEventListener('click', function() {
            const pitch = this.getAttribute('data-pitch');
            const isPlus = this.classList.contains('plus');
            if(pitch === '1') matchState.scores.opp1 = Math.max(0, matchState.scores.opp1 + (isPlus?1:-1));
            else matchState.scores.opp2 = Math.max(0, matchState.scores.opp2 + (isPlus?1:-1));
            saveState(); renderScores();
        });
    });

    let pendingGoalPitch = 0;
    const goalModal = document.getElementById('goal-modal');

    document.querySelectorAll('.btn-goal-mine').forEach(btn => {
        btn.addEventListener('click', function() {
            pendingGoalPitch = this.getAttribute('data-pitch');
            const isPlus = this.classList.contains('plus');
            
            if(!isPlus) { 
                if(pendingGoalPitch==='1') matchState.scores.myTeam1 = Math.max(0, matchState.scores.myTeam1 - 1);
                else matchState.scores.myTeam2 = Math.max(0, matchState.scores.myTeam2 - 1);
                saveState(); renderScores(); return;
            }

            const pitchEl = document.getElementById(`lineup_pitch_${pendingGoalPitch}`);
            const playersOnPitch = pitchEl.querySelectorAll('.player-card');
            const listGrid = document.getElementById('goal-scorers-list');
            listGrid.innerHTML = '';
            
            if(playersOnPitch.length === 0) { alert('אין שחקנים במגרש זה!'); return; }

            playersOnPitch.forEach(card => {
                const b = document.createElement('button');
                b.className = 'ios-button-small';
                b.textContent = card.querySelector('.player-name').textContent + ` (${card.querySelector('.player-number').textContent})`;
                b.style.padding = '15px 25px'; b.style.background = 'var(--ios-blue)'; b.style.fontSize = '18px';
                b.style.fontWeight = 'bold';
                
                b.addEventListener('click', () => {
                    const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
                    const pIdx = players.findIndex(p => p.id === card.id);
                    if(pIdx > -1) {
                        players[pIdx].goals += 1;
                        localStorage.setItem('tacticalPlayers', JSON.stringify(players));
                        if(pendingGoalPitch==='1') matchState.scores.myTeam1++; else matchState.scores.myTeam2++;
                        saveState(); renderScores();
                        goalModal.classList.add('hidden');
                    }
                });
                listGrid.appendChild(b);
            });
            goalModal.classList.remove('hidden');
        });
    });
    document.getElementById('btn-cancel-goal-modal').addEventListener('click', () => goalModal.classList.add('hidden'));

    // --- סיכום מחצית וסיום ---
    const summaryModal = document.getElementById('summary-modal');
    document.getElementById('btn-end-half').addEventListener('click', () => {
        matchState.timerRunning = false; saveState();
        const data = JSON.parse(localStorage.getItem('tacticalMatchData'));
        const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
        
        document.getElementById('rep-teams').textContent = `${data.myTeam} נגד ${data.opponent}`;
        document.getElementById('rep-details').textContent = `${data.date} | שעה: ${data.time} | ${data.location} | ${data.homeAway === 'home'?'בית':'חוץ'}`;
        const s = matchState.scores;
        document.getElementById('rep-score').textContent = `תוצאה סופית: ${s.myTeam1+s.myTeam2} - ${s.opp1+s.opp2} (מגרש 1: ${s.myTeam1}-${s.opp1} | מגרש 2: ${s.myTeam2}-${s.opp2})`;

        const tbody = document.getElementById('summary-stats-body'); tbody.innerHTML = '';
        const reqSec = (data.duration * 60) * 0.4;

        players.forEach(p => {
            const mins = Math.floor(p.secondsPlayed / 60);
            const percent = Math.round((p.secondsPlayed / (data.duration * 60)) * 100) || 0;
            const status = p.secondsPlayed >= reqSec ? '<span class="status-ok">כן</span>' : '<span class="status-risk">לא (הפרה)</span>';
            tbody.innerHTML += `<tr><td style="font-weight:bold;">${p.number}</td><td style="font-weight:bold;">${p.name}</td><td>${mins}</td><td>${percent}%</td><td>${status}</td><td style="font-size:18px; font-weight:bold;">${p.goals}</td></tr>`;
        });
        
        document.getElementById('btn-continue-match').style.display = (matchState.currentHalf === 1) ? 'inline-block' : 'none';
        document.getElementById('summary-title').textContent = (matchState.currentHalf === 1) ? 'סיכום מחצית ראשונה' : 'סיכום משחק מלא';
        summaryModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-summary').addEventListener('click', () => summaryModal.classList.add('hidden'));
    
    document.getElementById('btn-continue-match').addEventListener('click', () => {
        matchState.currentHalf = 2;
        const data = JSON.parse(localStorage.getItem('tacticalMatchData'));
        matchState.elapsedSeconds = (data.duration / 2) * 60; 
        saveState(); updateClocks();
        summaryModal.classList.add('hidden');
        document.getElementById('btn-end-half').textContent = 'סיים משחק סופית';
        
        switchScreen('lineup');
    });

    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        const el = document.getElementById('summary-content-area');
        const opt = {
            margin:       [5, 5, 5, 5], 
            filename:     'סיכום_משחק_Touchline.pdf',
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: ['avoid-all'] }
        };
        html2pdf().set(opt).from(el).save();
    });
    
    renderHomeData();
});
