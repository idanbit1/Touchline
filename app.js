document.addEventListener('DOMContentLoaded', () => {

    // --- מצבים גלובליים ושמירה רציפה ---
    let matchState = JSON.parse(localStorage.getItem('touchlineMatchState')) || {
        isActive: false,
        timerRunning: false,
        elapsedSeconds: 0,
        currentHalf: 1,
        scores: { myTeam1: 0, opp1: 0, myTeam2: 0, opp2: 0 },
        events: [],
        lastTickTime: null
    };

    let timerInterval = null;

    function saveState() {
        localStorage.setItem('touchlineMatchState', JSON.stringify(matchState));
    }

    // --- ניהול שעון זמן אמת וזמן משחק ---
    function updateClocks() {
        // שעון נוכחי למעלה
        const now = new Date();
        document.getElementById('live-date').textContent = now.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

        // אם השעון רץ, נחשב כמה שניות עברו מאז הטיק האחרון
        if (matchState.timerRunning && matchState.lastTickTime) {
            const diff = Math.floor((Date.now() - matchState.lastTickTime) / 1000);
            if (diff > 0) {
                matchState.elapsedSeconds += diff;
                matchState.lastTickTime = Date.now();
                updatePlayerMinutes(diff); // עדכון דקות לשחקנים שעל המגרש
                saveState();
            }
        }
        renderTimer();
        check40PercentRule(); // בדיקת חוק 40% בכל טיק
    }
    
    setInterval(updateClocks, 1000);

    function renderTimer() {
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData')) || { duration: 70 };
        const halfTimeSeconds = (matchData.duration / 2) * 60;
        
        const m = Math.floor(matchState.elapsedSeconds / 60).toString().padStart(2, '0');
        const s = (matchState.elapsedSeconds % 60).toString().padStart(2, '0');
        const displayString = `${m}:${s}`;
        
        const mainClock = document.getElementById('main-stopwatch');
        const globalClock = document.getElementById('global-live-timer');
        
        mainClock.textContent = displayString;
        globalClock.textContent = displayString;

        // צבע אדום בזמן פציעות (חצה את זמן המחצית)
        if ((matchState.currentHalf === 1 && matchState.elapsedSeconds >= halfTimeSeconds) ||
            (matchState.currentHalf === 2 && matchState.elapsedSeconds >= halfTimeSeconds * 2)) {
            mainClock.classList.add('injury-time');
            globalClock.style.color = '#ff453a';
        } else {
            mainClock.classList.remove('injury-time');
            globalClock.style.color = '#fff';
        }
    }

    // --- ניווט חכם ---
    const screens = {
        home: document.getElementById('home-screen'),
        setup: document.getElementById('setup-screen'),
        lineup: document.getElementById('lineup-screen'),
        live: document.getElementById('live-match-screen')
    };

    function switchScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
        
        // תצוגות כפתורי ניווט עליונים
        document.getElementById('nav-live').style.display = matchState.isActive ? 'block' : 'none';
        document.getElementById('global-live-timer').style.display = matchState.isActive ? 'block' : 'none';
        document.getElementById('global-live-score').style.display = matchState.isActive ? 'block' : 'none';
        
        if(screenName === 'live') renderScores();
    }

    document.getElementById('nav-home').addEventListener('click', () => switchScreen('home'));
    document.getElementById('nav-setup').addEventListener('click', () => switchScreen('setup'));
    document.getElementById('nav-lineup').addEventListener('click', () => switchScreen('lineup'));
    document.getElementById('nav-live').addEventListener('click', () => switchScreen('live'));
    
    document.getElementById('btn-new-match').addEventListener('click', () => switchScreen('setup'));
    document.getElementById('btn-resume-match').addEventListener('click', () => switchScreen('live'));

    // --- טופס נוכחות והגדרות ---
    const playersContainer = document.getElementById('players-list-container');
    
    function createPlayerRow(name = '', number = '', arrived = true) {
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `
            <div class="checkbox-container"><input type="checkbox" class="p-arrived" ${arrived ? 'checked' : ''}></div>
            <input type="text" class="p-name" placeholder="שם שחקן" value="${name}" required>
            <input type="number" class="p-number" placeholder="מס'" value="${number}" required>
            <button type="button" class="btn-remove-player" title="הסר">X</button>
        `;
        row.querySelector('.btn-remove-player').addEventListener('click', () => row.remove());
        row.querySelector('.p-arrived').addEventListener('change', updateAttendance);
        playersContainer.appendChild(row);
        updateAttendance();
    }

    function updateAttendance() {
        const total = playersContainer.children.length;
        const arrived = document.querySelectorAll('.p-arrived:checked').length;
        document.getElementById('total-roster').textContent = total;
        document.getElementById('total-arrived').textContent = arrived;
    }

    document.getElementById('btn-add-player').addEventListener('click', () => createPlayerRow());

    // טעינת אקסל
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
                    if(rows[i] && rows[i].length >= 2) createPlayerRow(rows[i][0]||'', rows[i][1]||'', true);
                }
            } catch (err) { alert('שגיאה בקריאת הקובץ.'); }
        };
        reader.readAsArrayBuffer(file);
        e.target.value = ''; 
    });

    // שמירת הגדרות ונוכחות
    document.getElementById('setup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        // יצירת משחק חדש מאפסת מצב קודם!
        matchState = { isActive: true, timerRunning: false, elapsedSeconds: 0, currentHalf: 1, scores: { myTeam1: 0, opp1: 0, myTeam2: 0, opp2: 0 }, events: [], lastTickTime: null };
        saveState();

        const matchData = {
            myTeam: document.getElementById('my-team-name').value || 'מ.ס רובי שפירא',
            opponent: document.getElementById('opponent-name').value,
            location: document.getElementById('match-location').value,
            homeAway: document.getElementById('home-away').value,
            date: document.getElementById('match-date').value,
            duration: parseInt(document.getElementById('match-duration').value)
        };

        const playersArray = [];
        const defaultRoster = [];
        
        document.querySelectorAll('.player-input-row').forEach((row, index) => {
            const name = row.querySelector('.p-name').value.trim();
            const number = row.querySelector('.p-number').value.trim();
            const arrived = row.querySelector('.p-arrived').checked;
            
            if(name && number) {
                const pData = { id: 'p_' + index, name, number, goals: 0, secondsPlayed: 0 };
                defaultRoster.push(pData); // שומר את כולם לסגל
                if(arrived) playersArray.push(pData); // רק מי שהגיע למשחק
            }
        });

        localStorage.setItem('tacticalMatchData', JSON.stringify(matchData));
        localStorage.setItem('tacticalPlayers', JSON.stringify(playersArray));
        localStorage.setItem('defaultRoster', JSON.stringify(defaultRoster)); 

        document.getElementById('btn-resume-match').classList.remove('hidden');
        initLineupBuilder();
        switchScreen('lineup');
    });

    // --- מערכת ההרכב (מועבר למסך לייב בהתחלה) ---
    function initLineupBuilder() {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers')) || [];
        const pitches = document.getElementById('pitches-container');
        const bench = document.getElementById('bench-players');
        pitches.innerHTML = ''; bench.innerHTML = '';

        players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'player-card'; card.id = p.id;
            card.innerHTML = `<div class="player-number">${p.number}</div><div class="player-name">${p.name}</div>`;
            enablePlayerClick(card, bench);
            bench.appendChild(card);
        });

        buildPitches(pitches, bench);
    }

    function buildPitches(container, bench) {
        for(let i = 1; i <= 2; i++) {
            const pitch = document.createElement('div');
            pitch.className = 'pitch-half'; pitch.id = `pitch_${i}`;
            const rows = [1, 2, 2, 1, 1];
            let zoneIdx = 0;
            rows.forEach(c => {
                const rowEl = document.createElement('div'); rowEl.className = 'pitch-row';
                for(let j=0; j<c; j++) {
                    const zone = document.createElement('div'); zone.className = 'drop-zone'; zone.id = `zone_${i}_${zoneIdx++}`;
                    enableZoneClick(zone, bench);
                    rowEl.appendChild(zone);
                }
                pitch.appendChild(rowEl);
            });
            container.appendChild(pitch);
        }
    }

    let selectedCard = null;
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
                        // חילוף - תיעוד חילוף אפשרי כאן בעתיד
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

    // --- מעבר למשחק חי ---
    document.getElementById('btn-go-live').addEventListener('click', () => {
        const livePitches = document.getElementById('live-pitches-container');
        const liveBench = document.getElementById('live-bench-players');
        
        // העברת כל ה-DOM למסך הלייב כדי לשמור על האובייקטים והאירועים
        while(document.getElementById('pitches-container').firstChild) livePitches.appendChild(document.getElementById('pitches-container').firstChild);
        while(document.getElementById('bench-players').firstChild) liveBench.appendChild(document.getElementById('bench-players').firstChild);
        
        switchScreen('live');
    });

    // --- שליטה בשעון המשחק ---
    const btnToggleTimer = document.getElementById('btn-toggle-timer');
    btnToggleTimer.addEventListener('click', () => {
        if(matchState.timerRunning) {
            matchState.timerRunning = false;
            matchState.lastTickTime = null;
            btnToggleTimer.textContent = 'המשך משחק';
            btnToggleTimer.classList.replace('secondary-action', 'primary-action');
        } else {
            matchState.timerRunning = true;
            matchState.lastTickTime = Date.now();
            btnToggleTimer.textContent = 'עצור שעון';
            btnToggleTimer.classList.replace('primary-action', 'secondary-action');
            btnToggleTimer.style.color = '#fff';
        }
        saveState();
    });

    // --- עדכון דקות משחק וחוק 40% ---
    function updatePlayerMinutes(secondsAdded) {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers')) || [];
        
        // מוצא מי נמצא עכשיו על המגרש ב-DOM הלייב
        const onPitchElements = document.querySelectorAll('#live-pitches-container .player-card');
        onPitchElements.forEach(el => {
            const pIdx = players.findIndex(p => p.id === el.id);
            if(pIdx > -1) players[pIdx].secondsPlayed += secondsAdded;
        });
        localStorage.setItem('tacticalPlayers', JSON.stringify(players));
    }

    function check40PercentRule() {
        const players = JSON.parse(localStorage.getItem('tacticalPlayers')) || [];
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData')) || { duration: 70 };
        const totalMatchSeconds = matchData.duration * 60;
        const requiredSeconds = totalMatchSeconds * 0.4;
        const secondsRemaining = totalMatchSeconds - matchState.elapsedSeconds;

        players.forEach(p => {
            const card = document.getElementById(p.id);
            if(card) {
                // אם מה שחסר לו כדי להגיע ליעד גדול ממה שנשאר במשחק, הוא בסכנה!
                if (p.secondsPlayed < requiredSeconds && (requiredSeconds - p.secondsPlayed) >= secondsRemaining) {
                    card.classList.add('alert-40');
                } else {
                    card.classList.remove('alert-40');
                }
            }
        });
    }

    // --- ניהול תוצאות ושערים ---
    function renderScores() {
        const s = matchState.scores;
        document.getElementById('live-score-1').textContent = `${s.myTeam1} - ${s.opp1}`;
        document.getElementById('live-score-2').textContent = `${s.myTeam2} - ${s.opp2}`;
        const totalMy = s.myTeam1 + s.myTeam2;
        const totalOpp = s.opp1 + s.opp2;
        const totalStr = `${totalMy} - ${totalOpp}`;
        document.getElementById('live-score-total').textContent = totalStr;
        document.getElementById('global-live-score').textContent = totalStr;
    }

    // שער ליריבה (פשוט מעלה счет)
    document.querySelectorAll('.btn-goal-opp').forEach(btn => {
        btn.addEventListener('click', function() {
            const isPitch1 = this.classList.contains('btn-pitch-1');
            const isAdd = this.textContent.includes('+');
            if(isPitch1) matchState.scores.opp1 = Math.max(0, matchState.scores.opp1 + (isAdd ? 1 : -1));
            else matchState.scores.opp2 = Math.max(0, matchState.scores.opp2 + (isAdd ? 1 : -1));
            saveState(); renderScores();
        });
    });

    // שער לנו - פותח מודאל לבחירת שחקן
    let pendingGoalPitch = 0;
    let pendingGoalIsAdd = true;
    const modal = document.getElementById('goal-modal');
    
    document.querySelectorAll('.btn-goal-mine').addEventListener = function() {}; // Reset
    
    document.querySelectorAll('.btn-goal-mine').forEach(btn => {
        btn.addEventListener('click', function() {
            pendingGoalPitch = this.classList.contains('btn-pitch-1') ? 1 : 2;
            pendingGoalIsAdd = this.textContent.includes('+');
            
            if(!pendingGoalIsAdd) {
                // ביטול גול - פשוט מוריד מהתוצאה, לא צריך לבחור שחקן
                if(pendingGoalPitch===1) matchState.scores.myTeam1 = Math.max(0, matchState.scores.myTeam1 - 1);
                else matchState.scores.myTeam2 = Math.max(0, matchState.scores.myTeam2 - 1);
                saveState(); renderScores();
                return;
            }

            // פתיחת מודאל והצגת שחקני המגרש הרלוונטי בלבד
            const pitchEl = document.getElementById(`pitch_${pendingGoalPitch}`);
            const playersOnPitch = pitchEl.querySelectorAll('.player-card');
            const listGrid = document.getElementById('goal-scorers-list');
            listGrid.innerHTML = '';
            
            if(playersOnPitch.length === 0) { alert('אין שחקנים במגרש זה!'); return; }

            playersOnPitch.forEach(card => {
                const btnScorer = document.createElement('button');
                btnScorer.className = 'ios-button-small';
                btnScorer.textContent = card.querySelector('.player-name').textContent + ` (${card.querySelector('.player-number').textContent})`;
                btnScorer.style.padding = '15px'; btnScorer.style.background = 'var(--ios-blue)';
                
                btnScorer.addEventListener('click', () => {
                    // עדכון גולים לשחקן
                    const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
                    const pIdx = players.findIndex(p => p.id === card.id);
                    if(pIdx > -1) {
                        players[pIdx].goals += 1;
                        localStorage.setItem('tacticalPlayers', JSON.stringify(players));
                        
                        // עדכון תוצאה
                        if(pendingGoalPitch===1) matchState.scores.myTeam1++; else matchState.scores.myTeam2++;
                        saveState(); renderScores();
                        modal.classList.add('hidden');
                    }
                });
                listGrid.appendChild(btnScorer);
            });
            modal.classList.remove('hidden');
        });
    });

    document.getElementById('btn-cancel-goal').addEventListener('click', () => modal.classList.add('hidden'));

    // --- סיכום מחצית / סיום וייצוא PDF ---
    const summaryModal = document.getElementById('summary-modal');
    
    document.getElementById('btn-end-half').addEventListener('click', () => {
        matchState.timerRunning = false; saveState();
        
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData'));
        const players = JSON.parse(localStorage.getItem('tacticalPlayers'));
        
        document.getElementById('rep-teams').textContent = `${matchData.myTeam} נגד ${matchData.opponent}`;
        document.getElementById('rep-details').textContent = `${matchData.date} | ${matchData.location} | ${matchData.homeAway === 'home'?'משחק בית':'משחק חוץ'}`;
        
        const s = matchState.scores;
        document.getElementById('rep-score').textContent = `תוצאה סופית: ${s.myTeam1+s.myTeam2} - ${s.opp1+s.opp2} (מגרש 1: ${s.myTeam1}-${s.opp1} | מגרש 2: ${s.myTeam2}-${s.opp2})`;

        const tbody = document.getElementById('summary-stats-body');
        tbody.innerHTML = '';
        
        const reqSeconds = (matchData.duration * 60) * 0.4;

        players.forEach(p => {
            const mins = Math.floor(p.secondsPlayed / 60);
            const percent = Math.round((p.secondsPlayed / (matchData.duration * 60)) * 100) || 0;
            const statusHtml = p.secondsPlayed >= reqSeconds ? '<span class="status-ok">תקין</span>' : '<span class="status-risk">חריגה</span>';
            
            tbody.innerHTML += `<tr>
                <td>${p.number}</td><td>${p.name}</td><td>${mins}</td><td>${percent}%</td><td>${statusHtml}</td><td>${p.goals}</td>
            </tr>`;
        });
        
        if(matchState.currentHalf === 1) {
            document.getElementById('btn-continue-match').style.display = 'inline-block';
            document.getElementById('summary-title').textContent = 'סיכום מחצית ראשונה';
        } else {
            document.getElementById('btn-continue-match').style.display = 'none';
            document.getElementById('summary-title').textContent = 'סיכום סיום משחק';
        }

        summaryModal.classList.remove('hidden');
    });

    document.getElementById('btn-close-summary').addEventListener('click', () => summaryModal.classList.add('hidden'));
    
    document.getElementById('btn-continue-match').addEventListener('click', () => {
        // מעבר למחצית שנייה
        matchState.currentHalf = 2;
        const matchData = JSON.parse(localStorage.getItem('tacticalMatchData'));
        matchState.elapsedSeconds = (matchData.duration / 2) * 60; // מדלג ישר לדקה 35 (או חצי מהזמן)
        saveState(); updateClocks();
        summaryModal.classList.add('hidden');
        document.getElementById('btn-end-half').textContent = 'סיום משחק';
    });

    // ייצוא ל-PDF
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        const element = document.getElementById('summary-content-area');
        const opt = {
            margin:       10,
            filename:     'סיכום_משחק.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        html2pdf().set(opt).from(element).save();
    });

    // מסך מלא מהיר
    document.getElementById('btn-fullscreen').addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{});
        else document.exitFullscreen();
    });
});
