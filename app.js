document.addEventListener('DOMContentLoaded', () => {

    let matchState = JSON.parse(localStorage.getItem('touchlineMatchState')) || {
        isActive: false, timerRunning: false, elapsedSeconds: 0, currentHalf: 1, 
        scores: { myTeam1: 0, opp1: 0, myTeam2: 0, opp2: 0 }, lastTickTime: null
    };

    function saveState() { localStorage.setItem('touchlineMatchState', JSON.stringify(matchState)); }

    function updateClocks() {
        document.getElementById('live-date').textContent = new Date().toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        if (matchState.timerRunning && matchState.lastTickTime) {
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

    function renderTimer() {
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData')) || { duration: 70 };
        const halfTimeSeconds = (matchData.duration / 2) * 60;
        
        const m = Math.floor(matchState.elapsedSeconds / 60).toString().padStart(2, '0');
        const s = (matchState.elapsedSeconds % 60).toString().padStart(2, '0');
        const mainClock = document.getElementById('main-stopwatch');
        
        if(mainClock) {
            mainClock.textContent = `${m}:${s}`;
            if ((matchState.currentHalf === 1 && matchState.elapsedSeconds >= halfTimeSeconds) ||
                (matchState.currentHalf === 2 && matchState.elapsedSeconds >= halfTimeSeconds * 2)) {
                mainClock.classList.add('injury');
            } else {
                mainClock.classList.remove('injury');
            }
        }
    }

    const screens = {
        home: document.getElementById('home-screen'),
        setup: document.getElementById('setup-screen'),
        attendance: document.getElementById('attendance-screen'),
        lineup: document.getElementById('lineup-screen'),
        live: document.getElementById('live-match-screen')
    };

    function switchScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
        
        document.getElementById('nav-live').style.display = matchState.isActive ? 'block' : 'none';
        document.getElementById('nav-attendance').style.display = localStorage.getItem('tacticalMatchData') ? 'block' : 'none';
        document.getElementById('nav-lineup').style.display = localStorage.getItem('tacticalMatchData') ? 'block' : 'none';
        
        if(screenName === 'live') {
            renderScores();
            updateTeamNames();
        }
    }

    document.getElementById('nav-home').addEventListener('click', () => switchScreen('home'));
    document.getElementById('nav-setup').addEventListener('click', () => switchScreen('setup'));
    document.getElementById('nav-attendance').addEventListener('click', () => switchScreen('attendance'));
    document.getElementById('nav-lineup').addEventListener('click', () => switchScreen('lineup'));
    document.getElementById('nav-live').addEventListener('click', () => switchScreen('live'));
    document.getElementById('btn-new-match').addEventListener('click', () => switchScreen('setup'));
    
    const resumeBtn = document.getElementById('btn-resume-match');
    if(localStorage.getItem('tacticalMatchData')) resumeBtn.classList.remove('hidden');
    resumeBtn.addEventListener('click', () => {
        if(matchState.isActive) switchScreen('live');
        else switchScreen('lineup');
    });

    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
        else document.exitFullscreen();
    });

    // --- SETUP: Roster ---
    const playersContainer = document.getElementById('players-list-container');
    function createSetupPlayerRow(name = '', number = '') {
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `<input type="text" class="p-name" placeholder="שם מלא" value="${name}"><input type="number" class="p-number" placeholder="מס'" value="${number}"><button type="button" class="btn-remove-player" title="מחק">X</button>`;
        row.querySelector('.btn-remove-player').addEventListener('click', () => row.remove());
        playersContainer.appendChild(row);
    }

    const defaultRoster = JSON.parse(localStorage.getItem('defaultRoster'));
    if(defaultRoster && defaultRoster.length > 0) {
        defaultRoster.forEach(p => createSetupPlayerRow(p.name, p.number));
    } else {
        createSetupPlayerRow(); createSetupPlayerRow();
    }

    document.getElementById('btn-add-player').addEventListener('click', () => createSetupPlayerRow());
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

    document.getElementById('setup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        matchState = { isActive: true, timerRunning: false, elapsedSeconds: 0, currentHalf: 1, scores: { myTeam1: 0, opp1: 0, myTeam2: 0, opp2: 0 }, lastTickTime: null };
        saveState();

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

        const roster = [];
        document.querySelectorAll('.player-input-row').forEach((row, index) => {
            const name = row.querySelector('.p-name').value.trim();
            const number = row.querySelector('.p-number').value.trim();
            if(name && number) roster.push({ id: 'p_' + index, name, number, goals: 0, secondsPlayed: 0 });
        });
        localStorage.setItem('defaultRoster', JSON.stringify(roster)); 

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
    document.getElementById('btn-back-to-setup').addEventListener('click', () => switchScreen('setup'));

    document.getElementById('btn-confirm-attendance').addEventListener('click', () => {
        const roster = JSON.parse(localStorage.getItem('defaultRoster')) || [];
        const matchSquad = [];
        roster.forEach(p => {
            const cb = document.getElementById(`att_${p.id}`);
            if(cb && cb.checked) matchSquad.push(p);
        });
        localStorage.setItem('tacticalPlayers', JSON.stringify(matchSquad));
        
        matchState = { isActive: false, timerRunning: false, elapsedSeconds: 0, currentHalf: 1, scores: { myTeam1: 0, opp1: 0, myTeam2: 0, opp2: 0 }, lastTickTime: null };
        saveState();
        document.getElementById('btn-resume-match').classList.remove('hidden');

        initLineupBuilder();
        switchScreen('lineup');
    });

    // --- LINEUP ---
    let selectedCard = null;

    function initLineupBuilder() {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers')) || [];
        const pitchesContainer = document.getElementById('pitches-container');
        const benchContainer = document.getElementById('bench-players');
        pitchesContainer.innerHTML = ''; benchContainer.innerHTML = '';

        players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'player-card'; card.id = p.id;
            card.innerHTML = `<div class="player-number">${p.number}</div><div class="player-name">${p.name}</div>`;
            enablePlayerClick(card, benchContainer);
            benchContainer.appendChild(card);
        });

        for(let i = 1; i <= 2; i++) {
            const pitch = document.createElement('div');
            pitch.className = 'pitch-half'; pitch.id = `lineup_pitch_${i}`;
            const rows = [1, 2, 2, 1, 1];
            let zoneIdx = 0;
            rows.forEach(c => {
                const rowEl = document.createElement('div'); rowEl.className = 'pitch-row';
                for(let j=0; j<c; j++) {
                    const zone = document.createElement('div'); zone.className = 'drop-zone'; zone.id = `zone_${i}_${zoneIdx++}`;
                    enableZoneClick(zone, benchContainer);
                    rowEl.appendChild(zone);
                }
                pitch.appendChild(rowEl);
            });
            pitchesContainer.appendChild(pitch);
        }
    }

    function enablePlayerClick(card, bench) {
        card.addEventListener('click', function(e) {
            e.stopPropagation();
            if (selectedCard) {
                if (selectedCard === this) { selectedCard.classList.remove('selected'); selectedCard = null; }
                else {
                    const pA = selectedCard.parentNode, pB = this.parentNode;
                    if (pA === pB && pA === bench) {
                        selectedCard.classList.remove('selected'); selectedCard = this; this.classList.add('selected');
                    } else {
                        pB.appendChild(selectedCard); pA.appendChild(this);
                        selectedCard.classList.remove('selected'); selectedCard = null;
                    }
                }
            } else { selectedCard = this; this.classList.add('selected'); }
        });
    }

    function enableZoneClick(zone, bench) {
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
            document.querySelectorAll('#pitches-container .drop-zone').forEach(zone => {
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
            if(!state) return alert('אין הרכב שמור.');
            const bench = document.getElementById('bench-players');
            document.querySelectorAll('#pitches-container .drop-zone .player-card').forEach(p => bench.appendChild(p));
            state.forEach(item => {
                const zone = document.getElementById(item.zoneId);
                const player = document.getElementById(item.playerId);
                if(zone && player) zone.appendChild(player);
            });
        });
    });

    // --- מעבר למשחק חי ---
    document.getElementById('btn-go-live').addEventListener('click', () => {
        matchState.isActive = true; saveState();
        
        const livePitch1 = document.getElementById('live-pitch-1-container');
        const livePitch2 = document.getElementById('live-pitch-2-container');
        const liveBench = document.getElementById('live-bench-players');
        
        livePitch1.innerHTML = ''; livePitch2.innerHTML = ''; liveBench.innerHTML = '';
        
        livePitch1.appendChild(document.getElementById('lineup_pitch_1'));
        livePitch2.appendChild(document.getElementById('lineup_pitch_2'));
        
        while(document.getElementById('bench-players').firstChild) {
            liveBench.appendChild(document.getElementById('bench-players').firstChild);
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
        } else {
            matchState.timerRunning = true; matchState.lastTickTime = Date.now();
            btnToggleTimer.textContent = 'עצור שעון'; btnToggleTimer.classList.replace('primary-action', 'secondary-action');
        }
        saveState();
    });

    function check40PercentRule() {
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
        const s = matchState.scores;
        document.getElementById('live-score-1').textContent = `${s.myTeam1} - ${s.opp1}`;
        document.getElementById('live-score-2').textContent = `${s.myTeam2} - ${s.opp2}`;
        document.getElementById('live-score-total').textContent = `${s.myTeam1+s.myTeam2} - ${s.opp1+s.opp2}`;
    }

    // ניהול תוצאות מול הכפתורים החדשים
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
        document.getElementById('rep-details').textContent = `${data.date} ${data.time} | ${data.location} | ${data.homeAway === 'home'?'משחק בית':'משחק חוץ'}`;
        const s = matchState.scores;
        document.getElementById('rep-score').textContent = `תוצאה סופית: ${s.myTeam1+s.myTeam2} - ${s.opp1+s.opp2} (מגרש 1: ${s.myTeam1}-${s.opp1} | מגרש 2: ${s.myTeam2}-${s.opp2})`;

        const tbody = document.getElementById('summary-stats-body'); tbody.innerHTML = '';
        const reqSec = (data.duration * 60) * 0.4;

        players.forEach(p => {
            const mins = Math.floor(p.secondsPlayed / 60);
            const percent = Math.round((p.secondsPlayed / (data.duration * 60)) * 100) || 0;
            const status = p.secondsPlayed >= reqSec ? '<span class="status-ok">כן</span>' : '<span class="status-risk">לא</span>';
            tbody.innerHTML += `<tr><td>${p.number}</td><td>${p.name}</td><td>${mins}</td><td>${percent}%</td><td>${status}</td><td>${p.goals}</td></tr>`;
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
        
        document.getElementById('pitches-container').appendChild(document.getElementById('lineup_pitch_1'));
        document.getElementById('pitches-container').appendChild(document.getElementById('lineup_pitch_2'));
        const bench = document.getElementById('bench-players');
        while(document.getElementById('live-bench-players').firstChild) bench.appendChild(document.getElementById('live-bench-players').firstChild);
        switchScreen('lineup');
    });

    // ייצוא מותאם שייכנס בעמוד אחד
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
});
