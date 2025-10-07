document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
      apiKey: "AIzaSyDz-H8QiLpwA5llorczIBrCEY_SfsrF5qw",
      authDomain: "myworkreportapp-6bcf2.firebaseapp.com",
      projectId: "myworkreportapp-6bcf2",
      storageBucket: "myworkreportapp-6bcf2.firebasestorage.app",
      messagingSenderId: "645988529375",
      appId: "1:645988529375:web:a12d4d8a4615a0f005e56a",
      measurementId: "G-RRN3BNKERN"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const auth = firebase.auth();

    const appContainer = document.getElementById('app-container');
    const loginContainer = document.getElementById('login-container');
    const pageTitle = document.getElementById('page-title');
    const signInBtn = document.getElementById('sign-in-btn');
    const signOutBtn = document.getElementById('sign-out-btn');
    const userNameEl = document.getElementById('user-name');
    const navEntry = document.getElementById('nav-entry');
    const navDashboard = document.getElementById('nav-dashboard');
    const entryPage = document.getElementById('entry-page');
    const dashboardPage = document.getElementById('dashboard-page');
    const workForm = document.getElementById('work-form');
    const entryDateInput = document.getElementById('entry-date');
    const partyNameInput = document.getElementById('party-name');
    const workDescriptionInput = document.getElementById('work-description');
    const partySuggestions = document.getElementById('party-suggestions');
    const entriesContainer = document.getElementById('entries-container');
    const searchPartyInput = document.getElementById('search-party');
    const searchDateInput = document.getElementById('search-date');
    const submitBtn = workForm.querySelector('button[type="submit"]');
    const reportModal = document.getElementById('report-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const reportTextarea = document.getElementById('report-text');
    const copyReportBtn = document.getElementById('copy-report-btn');

    let allEntries = [];
    let unsubscribe;

    auth.onAuthStateChanged(user => {
        if (user) {
            loginContainer.style.display = 'none';
            appContainer.style.display = 'flex'; // Changed to flex to enable layout
            userNameEl.textContent = user.displayName;
            listenForEntries(user.uid);
        } else {
            loginContainer.style.display = 'flex';
            appContainer.style.display = 'none';
            if (unsubscribe) unsubscribe();
            allEntries = [];
            renderEntries();
        }
    });
    
    signInBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => console.error("Sign in error:", error));
    });
    signOutBtn.addEventListener('click', () => auth.signOut());

    const showPage = (pageToShow) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        if (pageToShow === 'entry') {
            entryPage.classList.add('active');
            navEntry.classList.add('active');
            pageTitle.textContent = "Add Entry";
        } else {
            dashboardPage.classList.add('active');
            navDashboard.classList.add('active');
            pageTitle.textContent = "Dashboard";
        }
    };
    navEntry.addEventListener('click', () => showPage('entry'));
    navDashboard.addEventListener('click', () => showPage('dashboard'));

    const renderEntries = (filteredEntries = allEntries) => {
        entriesContainer.innerHTML = '';
        if (filteredEntries.length === 0) return;

        const groupedByDate = filteredEntries.reduce((acc, entry) => {
            if (!acc[entry.date]) acc[entry.date] = [];
            acc[entry.date].push(entry);
            return acc;
        }, {});

        const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
        
        sortedDates.forEach(date => {
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            dateGroup.innerHTML = `<div class="date-header"><span>${formattedDate}</span><button class="report-btn" data-date="${date}">📋</button></div>`;
            
            groupedByDate[date].forEach(entry => {
                const entryCard = document.createElement('div');
                entryCard.className = 'entry-card';
                entryCard.innerHTML = `
                    <div class="entry-details">
                        <strong>${entry.party}</strong>
                        <p>${entry.work}</p>
                    </div>
                    <button class="delete-btn" data-id="${entry.id}">❌</button>
                `;
                dateGroup.appendChild(entryCard);
            });
            entriesContainer.appendChild(dateGroup);
        });
    };

    function listenForEntries(userId) {
        const entriesCollection = db.collection('workEntries');
        unsubscribe = entriesCollection.where('userId', '==', userId).orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                applyFilters();
                updatePartySuggestions();
            }, error => console.error("Error fetching entries: ", error));
    }

    workForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) { alert("You must be logged in to add an entry."); return; }
        const btnText = submitBtn.querySelector('.btn-text');
        const loader = submitBtn.querySelector('.loader');
        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        submitBtn.disabled = true;
        try {
            await db.collection('workEntries').add({
                userId: user.uid, date: entryDateInput.value,
                party: partyNameInput.value.trim(), work: workDescriptionInput.value.trim(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            workForm.reset();
            entryDateInput.value = new Date().toISOString().split('T')[0];
            showPage('dashboard');
        } catch (error) { console.error("Error adding document: ", error); } 
        finally {
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
            submitBtn.disabled = false;
        }
    });

    const applyFilters = () => {
        const partyQuery = searchPartyInput.value.toLowerCase();
        const dateQuery = searchDateInput.value;
        const filtered = allEntries.filter(entry => {
            const partyMatch = entry.party.toLowerCase().includes(partyQuery);
            const dateMatch = dateQuery ? entry.date === dateQuery : true;
            return partyMatch && dateMatch;
        });
        renderEntries(filtered);
    };
    searchPartyInput.addEventListener('input', applyFilters);
    searchDateInput.addEventListener('input', applyFilters);

    entriesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const entryId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this entry?')) {
                try { await db.collection('workEntries').doc(entryId).delete(); } catch (error) { console.error("Error deleting entry: ", error); }
            }
        }
        if (e.target.classList.contains('report-btn') || e.target.parentElement.classList.contains('report-btn')) {
             const button = e.target.closest('.report-btn');
             generateReport(button.dataset.date);
        }
    });

    const updatePartySuggestions = () => {
        const uniqueParties = [...new Set(allEntries.map(entry => entry.party))];
        partySuggestions.innerHTML = uniqueParties.map(p => `<option value="${p}"></option>`).join('');
    };

    const generateReport = (date) => {
        const entriesForDate = allEntries.filter(e => e.date === date).sort((a, b) => (a.timestamp && b.timestamp) ? a.timestamp.seconds - b.timestamp.seconds : 0);
        const reportDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        let reportContent = `${reportDate}\n\n`;
        entriesForDate.forEach((entry, i) => { reportContent += `${i + 1}. ${entry.party} - ${entry.work}\n`; });
        reportContent += `\nAll done ✅`;
        reportTextarea.value = reportContent;
        reportModal.classList.add('visible');
    };
    copyReportBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(reportTextarea.value).then(() => {
            copyReportBtn.textContent = 'Copied!';
            setTimeout(() => { copyReportBtn.textContent = 'Copy to Clipboard'; }, 2000);
        });
    });
    modalCloseBtn.addEventListener('click', () => reportModal.classList.remove('visible'));
    reportModal.addEventListener('click', (e) => { if (e.target === reportModal) reportModal.classList.remove('visible'); });

    entryDateInput.value = new Date().toISOString().split('T')[0];
    showPage('entry'); // Start on the entry page
});
