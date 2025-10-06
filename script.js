document.addEventListener('DOMContentLoaded', () => {

    // --- PASTE YOUR FIREBASE CONFIGURATION HERE ---
    const firebaseConfig = {
  apiKey: "AIzaSyDz-H8QiLpwA5llorczIBrCEY_SfsrF5qw",
  authDomain: "myworkreportapp-6bcf2.firebaseapp.com",
  projectId: "myworkreportapp-6bcf2",
  storageBucket: "myworkreportapp-6bcf2.firebasestorage.app",
  messagingSenderId: "645988529375",
  appId: "1:645988529375:web:a12d4d8a4615a0f005e56a",
  measurementId: "G-RRN3BNKERN"
};
    // ---------------------------------------------

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const entriesCollection = db.collection('workEntries');

    // DOM Elements
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

    let allEntries = []; // Local cache of all entries from Firebase

    // --- PAGE NAVIGATION ---
    const showPage = (pageToShow) => {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        if (pageToShow === 'entry') {
            entryPage.classList.add('active');
            navEntry.classList.add('active');
        } else {
            dashboardPage.classList.add('active');
            navDashboard.classList.add('active');
        }
    };
    navEntry.addEventListener('click', () => showPage('entry'));
    navDashboard.addEventListener('click', () => showPage('dashboard'));

    // --- DATA RENDERING ---
    const renderEntries = (filteredEntries = allEntries) => {
        entriesContainer.innerHTML = '';
        if (filteredEntries.length === 0) return;

        const groupedByDate = filteredEntries.reduce((acc, entry) => {
            if (!acc[entry.date]) acc[entry.date] = [];
            acc[entry.date].push(entry);
            return acc;
        }, {});

        const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(b) - new Date(a));
        
        const table = document.createElement('table');
        table.className = 'entries-table';
        table.innerHTML = `<thead><tr><th>Party Name</th><th>Work Description</th><th>Actions</th></tr></thead>`;
        const tbody = document.createElement('tbody');

        sortedDates.forEach(date => {
            const formattedDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric'
            });

            const dateRow = document.createElement('tr');
            dateRow.className = 'date-group-header';
            dateRow.innerHTML = `<td colspan="3">${formattedDate} <button class="report-btn" data-date="${date}">📋</button></td>`;
            tbody.appendChild(dateRow);

            groupedByDate[date].forEach(entry => {
                const entryRow = document.createElement('tr');
                entryRow.innerHTML = `
                    <td><strong>${entry.party}</strong></td>
                    <td>${entry.work}</td>
                    <td><button class="delete-btn" data-id="${entry.id}">❌</button></td>
                `;
                tbody.appendChild(entryRow);
            });
        });
        table.appendChild(tbody);
        entriesContainer.appendChild(table);
    };

    // --- FIREBASE REAL-TIME LISTENER ---
    entriesCollection.orderBy('timestamp', 'desc').onSnapshot(snapshot => {
        allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        applyFilters();
        updatePartySuggestions();
    }, error => {
        console.error("Error fetching entries: ", error);
        alert("Could not connect to the database.");
    });

    // --- FORM SUBMISSION ---
    workForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnText = submitBtn.querySelector('.btn-text');
        const loader = submitBtn.querySelector('.loader');

        btnText.style.display = 'none';
        loader.style.display = 'inline-block';
        submitBtn.disabled = true;

        try {
            await entriesCollection.add({
                date: entryDateInput.value,
                party: partyNameInput.value.trim(),
                work: workDescriptionInput.value.trim(),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            workForm.reset();
            entryDateInput.value = new Date().toISOString().split('T')[0]; // Reset date to today
            showPage('dashboard'); // Switch to dashboard after successful entry
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to save entry. Please try again.");
        } finally {
            btnText.style.display = 'inline-block';
            loader.style.display = 'none';
            submitBtn.disabled = false;
        }
    });

    // --- FILTER & SEARCH ---
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

    // --- DELETE & REPORT (EVENT DELEGATION) ---
    entriesContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const entryId = e.target.dataset.id;
            if (confirm('Are you sure you want to delete this entry?')) {
                try {
                    await entriesCollection.doc(entryId).delete();
                } catch (error) {
                    console.error("Error deleting entry: ", error);
                    alert("Could not delete the entry.");
                }
            }
        }
        if (e.target.classList.contains('report-btn')) {
            const date = e.target.dataset.date;
            generateReport(date);
        }
    });

    const updatePartySuggestions = () => {
        const uniqueParties = [...new Set(allEntries.map(entry => entry.party))];
        partySuggestions.innerHTML = uniqueParties.map(p => `<option value="${p}"></option>`).join('');
    };

    // --- MODAL & COPY LOGIC ---
    const generateReport = (date) => {
        const entriesForDate = allEntries.filter(e => e.date === date).sort((a, b) => a.timestamp - b.timestamp);
        const reportDate = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        let reportContent = `${reportDate}\n\n`;
        entriesForDate.forEach((entry, i) => {
            reportContent += `${i + 1}. ${entry.party} - ${entry.work}\n`;
        });
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

    // --- INITIALIZATION ---
    entryDateInput.value = new Date().toISOString().split('T')[0];
    showPage('entry');
});
