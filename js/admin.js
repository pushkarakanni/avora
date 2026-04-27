// admin.js — depends on firebase-init.js (globals: db, auth)

// ── Section config ────────────────────────────────────────────
const SECTIONS = {
    'avora-enquiries': {
        title:      'Event Enquiries',
        brand:      'avora',
        collection: 'avora_enquiries',
        tableHeads: ['ID', 'Name', 'Email', 'Phone', 'Service', 'Message', 'Date'],
        tableRow:   rowAvoraEnquiry,
        cardRender: cardAvoraEnquiry
    },
    'ch-tickets': {
        title:      'Ticket Bookings',
        brand:      'ch',
        collection: 'ch_tickets',
        tableHeads: ['ID', 'Name', 'Event', 'Ticket Type', 'Referral Code', 'Date'],
        tableRow:   rowChTicket,
        cardRender: cardChTicket
    },
    'ch-partners': {
        title:      'College Partners',
        brand:      'ch',
        collection: 'ch_partners',
        tableHeads: ['ID', 'College', 'Location', 'Footfall', 'Role', 'Date'],
        tableRow:   rowChPartner,
        cardRender: cardChPartner
    },
    'ch-ambassadors': {
        title:      'Ambassador Applications',
        brand:      'ch',
        collection: 'ch_ambassadors',
        tableHeads: ['ID', 'Name', 'College', 'Location', 'Instagram', 'Followers', 'Referral Code', 'Date'],
        tableRow:   rowChAmbassador,
        cardRender: cardChAmbassador
    },
    'ch-events': {
        title:      'Events',
        brand:      'ch',
        collection: 'ch_events',
        tableHeads: ['#', 'Event', 'Date', 'Venue', 'Status', 'Prices', 'Actions'],
        tableRow:   rowChEvent,
        cardRender: cardChEvent
    }
};

// ── State ─────────────────────────────────────────────────────
var currentSection = null;
var currentView    = 'table';
var currentData    = [];
var referralMap    = {};
var currentFilter  = '';

// ── DOM refs ──────────────────────────────────────────────────
var sidebar       = document.getElementById('sidebar');
var sidebarToggle = document.getElementById('sidebarToggle');
var topbarTitle   = document.getElementById('topbarTitle');
var topbarCount   = document.getElementById('topbarCount');
var emptyState    = document.getElementById('emptyState');
var tableWrap     = document.getElementById('tableWrap');
var tableHead     = document.getElementById('tableHead');
var tableBody     = document.getElementById('tableBody');
var noDataMsg     = document.getElementById('noDataMsg');
var cardsGrid     = document.getElementById('cardsGrid');
var viewToggle    = document.getElementById('viewToggle');
var exportBtn     = document.getElementById('exportBtn');
var loginScreen   = document.getElementById('loginScreen');
var loginEmailEl  = document.getElementById('loginEmail');
var loginPassEl   = document.getElementById('loginPassword');
var loginErrorEl  = document.getElementById('loginError');
var loginBtn      = document.getElementById('loginBtn');

// ── Auth gate ─────────────────────────────────────────────────
document.body.classList.add('auth-pending');

auth.onAuthStateChanged(function(user) {
    if (user) {
        loginScreen.classList.add('hidden');
        document.body.classList.remove('auth-pending');
        loadBadgeCounts();
    } else {
        loginScreen.classList.remove('hidden');
        document.body.classList.add('auth-pending');
    }
});

loginBtn.addEventListener('click', function() {
    var email = loginEmailEl.value.trim();
    var pass  = loginPassEl.value;
    if (!email || !pass) { loginErrorEl.textContent = 'Please enter email and password.'; return; }
    loginBtn.disabled = true;
    loginErrorEl.textContent = '';
    auth.signInWithEmailAndPassword(email, pass).catch(function(err) {
        var msgs = {
            'auth/user-not-found':    'No account found with this email.',
            'auth/wrong-password':    'Incorrect password.',
            'auth/invalid-email':     'Invalid email address.',
            'auth/invalid-credential':'Invalid email or password.',
            'auth/too-many-requests': 'Too many attempts. Try again later.'
        };
        loginErrorEl.textContent = msgs[err.code] || 'Sign in failed: ' + err.message;
        loginBtn.disabled = false;
    });
});
loginPassEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') loginBtn.click(); });

// Sign-out button in topbar
var signOutBtn = document.createElement('button');
signOutBtn.className = 'export-btn';
signOutBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Sign Out';
signOutBtn.style.marginLeft = '0.5rem';
document.querySelector('.topbar-right').appendChild(signOutBtn);
signOutBtn.addEventListener('click', function() { auth.signOut(); });

// ── Mobile sidebar ────────────────────────────────────────────
var overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

function openSidebar()  { sidebar.classList.add('open');     overlay.classList.add('visible'); }
function closeSidebar() { sidebar.classList.remove('open');  overlay.classList.remove('visible'); }

sidebarToggle.addEventListener('click', function() {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
});
overlay.addEventListener('click', closeSidebar);

// ── Sidebar item clicks ───────────────────────────────────────
document.querySelectorAll('.sidebar-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var sec = btn.dataset.section;
        document.querySelectorAll('.sidebar-item').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        closeSidebar();
        loadSection(sec);
    });
});

// ── View toggle ───────────────────────────────────────────────
document.querySelectorAll('.vt-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.vt-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentView = btn.dataset.view;
        renderData();
    });
});

// ── Export CSV ────────────────────────────────────────────────
exportBtn.addEventListener('click', function() {
    if (!currentSection || !currentData.length) return;
    var sec  = SECTIONS[currentSection];
    var keys = sec.tableHeads.filter(function(h) { return h !== 'ID'; });
    var rows = currentData.map(function(d) {
        var fields = getExportFields(currentSection, d);
        return fields.map(function(f) { return '"' + String(f || '').replace(/"/g, '""') + '"'; }).join(',');
    });
    var csv  = [keys.join(',')].concat(rows).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = currentSection + '-' + Date.now() + '.csv'; a.click();
    URL.revokeObjectURL(url);
});

// ── Load section from Firestore ───────────────────────────────
function loadSection(sectionKey) {
    currentSection = sectionKey;
    if (sectionKey !== 'ch-events') currentFilter = '';
    var sec = SECTIONS[sectionKey];
    topbarTitle.textContent = sec.title;
    topbarCount.textContent = '';
    emptyState.style.display = 'none';
    tableWrap.style.display  = 'none';
    cardsGrid.style.display  = 'none';

    var eventsToolbar = document.getElementById('eventsToolbar');
    if (eventsToolbar) eventsToolbar.style.display = (sectionKey === 'ch-events') ? 'flex' : 'none';
    document.querySelectorAll('.evt-chip').forEach(function(c) { c.classList.toggle('active', c.dataset.filter === currentFilter); });

    var loadEl = document.createElement('div');
    loadEl.className = 'loading-spinner';
    loadEl.innerHTML = '<div class="spinner-ring"></div><span>Loading...</span>';
    document.getElementById('contentArea').appendChild(loadEl);

    var fetchMain = db.collection(sec.collection).orderBy('createdAt', 'desc').get();
    var fetchRefs = (sectionKey === 'ch-tickets')
        ? db.collection('ch_referrals').get()
        : Promise.resolve(null);

    Promise.all([fetchMain, fetchRefs])
        .then(function(results) {
            var snap    = results[0];
            var refSnap = results[1];

            if (refSnap) {
                referralMap = {};
                refSnap.docs.forEach(function(rd) {
                    var r = rd.data();
                    if (r.referralCode) referralMap[r.referralCode] = r.ambassadorName || '—';
                });
            }

            currentData = snap.docs.map(function(d) {
                var data = d.data();
                data._id = d.id;
                return data;
            });
            loadEl.remove();
            topbarCount.textContent = currentData.length
                ? currentData.length + ' ' + (currentData.length === 1 ? 'entry' : 'entries')
                : '';
            updateBadge(sectionKey, currentData.length);
            renderData();
        })
        .catch(function(err) {
            console.error('[Firestore] read error:', err);
            loadEl.remove();
            currentData = [];
            topbarCount.textContent = 'Error loading data';
            renderData();
        });
}

function updateBadge(sectionKey, count) {
    var el = document.getElementById('badge-' + sectionKey);
    if (el) el.textContent = count;
}

// ── Render ────────────────────────────────────────────────────
function renderData() {
    tableWrap.style.display = 'none';
    cardsGrid.style.display = 'none';
    noDataMsg.style.display = 'none';
    cardsGrid.innerHTML     = '';

    if (!currentSection) return;
    var sec = SECTIONS[currentSection];

    // Filter for events section
    var dataToRender = currentData;
    if (currentSection === 'ch-events' && currentFilter) {
        dataToRender = currentData.filter(function(d) { return d.status === currentFilter; });
    }

    if (!dataToRender.length) {
        if (currentView === 'table') {
            tableWrap.style.display = 'block';
            tableHead.innerHTML = buildTableHead(sec.tableHeads);
            tableBody.innerHTML = '';
            noDataMsg.style.display = 'block';
        } else {
            cardsGrid.style.display = 'grid';
            cardsGrid.innerHTML = '<div class="no-data">No entries yet.</div>';
        }
        return;
    }

    if (currentView === 'table') {
        tableWrap.style.display = 'block';
        tableHead.innerHTML = buildTableHead(sec.tableHeads);
        // For submission sections (not events), group rows by date
        if (currentSection !== 'ch-events') {
            tableBody.innerHTML = buildGroupedRows(dataToRender, sec.tableRow);
        } else {
            tableBody.innerHTML = dataToRender.map(function(row, i) { return sec.tableRow(row, i); }).join('');
        }
    } else {
        cardsGrid.style.display = 'grid';
        if (currentSection !== 'ch-events') {
            cardsGrid.innerHTML = buildGroupedCards(dataToRender, sec.cardRender);
        } else {
            cardsGrid.innerHTML = dataToRender.map(function(row) { return sec.cardRender(row); }).join('');
        }
    }
}

function dateKey(ts) {
    if (!ts) return 'Unknown Date';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function buildGroupedRows(data, rowFn) {
    var groups = {};
    var order  = [];
    data.forEach(function(d) {
        var key = dateKey(d.createdAt);
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(d);
    });
    return order.map(function(key) {
        var colCount = document.querySelectorAll('#tableHead th').length;
        var header = '<tr class="date-group-row"><td colspan="' + colCount + '">' + key + '</td></tr>';
        return header + groups[key].map(rowFn).join('');
    }).join('');
}

function buildGroupedCards(data, cardFn) {
    var groups = {};
    var order  = [];
    data.forEach(function(d) {
        var key = dateKey(d.createdAt);
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(d);
    });
    return order.map(function(key) {
        var header = '<div style="grid-column:1/-1;font-size:.58rem;letter-spacing:.22em;text-transform:uppercase;color:var(--text-muted);font-weight:600;padding:.2rem 0 .4rem;border-bottom:1px solid var(--border);margin-bottom:.2rem">' + key + '</div>';
        return header + groups[key].map(cardFn).join('');
    }).join('');
}

function buildTableHead(heads) {
    return '<tr>' + heads.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';
}

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
         + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
function shortId(id) { return id ? id.slice(0, 8).toUpperCase() : '—'; }
function trunc(str, n) { n = n || 60; if (!str) return '—'; return str.length > n ? str.slice(0, n) + '…' : str; }
function capFirst(s)  { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }

// ── Table rows ────────────────────────────────────────────────
function rowAvoraEnquiry(d) {
    return '<tr>'
        + '<td class="td-id">' + shortId(d._id) + '</td>'
        + '<td class="td-name">' + (d.name || '—') + '</td>'
        + '<td>' + (d.email || '—') + '</td>'
        + '<td>' + (d.phone || '—') + '</td>'
        + '<td><span class="badge badge-service">' + (d.service || '—') + '</span></td>'
        + '<td title="' + (d.message || '') + '">' + trunc(d.message) + '</td>'
        + '<td class="td-date">' + fmtDate(d.createdAt) + '</td>'
        + '</tr>';
}

function rowChTicket(d) {
    var typeCls  = { normal: 'badge-normal', premium: 'badge-premium', luxury: 'badge-luxury' };
    var refCell  = d.referral
        ? d.referral + (referralMap[d.referral] ? ' <span style="color:#a78bfa;font-size:.72rem">(' + referralMap[d.referral] + ')</span>' : '')
        : '—';
    return '<tr>'
        + '<td class="td-id">' + shortId(d._id) + '</td>'
        + '<td class="td-name">' + (d.name || '—') + '</td>'
        + '<td>' + (d.event || '—') + '</td>'
        + '<td><span class="badge ' + (typeCls[d.ticketType] || 'badge-normal') + '">' + capFirst(d.ticketType || 'normal') + '</span></td>'
        + '<td>' + refCell + '</td>'
        + '<td class="td-date">' + fmtDate(d.createdAt) + '</td>'
        + '</tr>';
}

function rowChPartner(d) {
    var roleCls   = { committee: 'badge-committee', ambassador: 'badge-ambassador', other: 'badge-other' };
    var roleLabel = { committee: 'College Committee', ambassador: 'Ambassador', other: 'Other' };
    return '<tr>'
        + '<td class="td-id">' + shortId(d._id) + '</td>'
        + '<td class="td-name">' + (d.college || '—') + '</td>'
        + '<td>' + (d.location || '—') + '</td>'
        + '<td>' + (d.footfall ? Number(d.footfall).toLocaleString('en-IN') : '—') + '</td>'
        + '<td><span class="badge ' + (roleCls[d.role] || 'badge-other') + '">' + (roleLabel[d.role] || d.role || '—') + '</span></td>'
        + '<td class="td-date">' + fmtDate(d.createdAt) + '</td>'
        + '</tr>';
}

function rowChAmbassador(d) {
    return '<tr>'
        + '<td class="td-id">' + shortId(d._id) + '</td>'
        + '<td class="td-name">' + (d.name || '—') + '</td>'
        + '<td>' + (d.college || '—') + '</td>'
        + '<td>' + (d.location || '—') + '</td>'
        + '<td>' + (d.instagram || '—') + '</td>'
        + '<td>' + (d.followers ? Number(d.followers).toLocaleString('en-IN') : '—') + '</td>'
        + '<td><span style="font-family:\'Cinzel\',serif;letter-spacing:.06em;color:#a78bfa;font-size:.78rem">' + (d.referralCode || '—') + '</span></td>'
        + '<td class="td-date">' + fmtDate(d.createdAt) + '</td>'
        + '</tr>';
}

// ── Card renderers ────────────────────────────────────────────
function cardAvoraEnquiry(d) {
    return '<div class="admin-card avora-card">'
        + '<div class="ac-top"><span class="ac-id">' + shortId(d._id) + '</span><span class="badge badge-service">' + (d.service || 'No service') + '</span></div>'
        + '<div class="ac-name">' + (d.name || '—') + '</div>'
        + '<div class="ac-details">'
        + '<div class="ac-row"><span class="ac-row-label">Email</span><span class="ac-row-val">' + (d.email || '—') + '</span></div>'
        + '<div class="ac-row"><span class="ac-row-label">Phone</span><span class="ac-row-val">' + (d.phone || '—') + '</span></div>'
        + '<div class="ac-row"><span class="ac-row-label">Message</span><span class="ac-row-val">' + trunc(d.message, 100) + '</span></div>'
        + '</div>'
        + '<div class="ac-footer"><span class="ac-date">' + fmtDate(d.createdAt) + '</span></div>'
        + '</div>';
}

function cardChTicket(d) {
    var typeCls   = { normal: 'badge-normal', premium: 'badge-premium', luxury: 'badge-luxury' };
    var refAmbass = d.referral && referralMap[d.referral] ? referralMap[d.referral] : null;
    return '<div class="admin-card ch-card">'
        + '<div class="ac-top"><span class="ac-id">' + shortId(d._id) + '</span><span class="badge ' + (typeCls[d.ticketType] || 'badge-normal') + '">' + capFirst(d.ticketType || 'normal') + '</span></div>'
        + '<div class="ac-name">' + (d.name || '—') + '</div>'
        + '<div class="ac-sub">' + (d.event || '—') + '</div>'
        + '<div class="ac-details">'
        + (d.referral
            ? '<div class="ac-row"><span class="ac-row-label">Referral Code</span><span class="ac-row-val">' + d.referral + '</span></div>'
              + (refAmbass ? '<div class="ac-row"><span class="ac-row-label">Ambassador</span><span class="ac-row-val" style="color:#a78bfa">' + refAmbass + '</span></div>' : '')
            : '')
        + '</div>'
        + '<div class="ac-footer"><span class="ac-date">' + fmtDate(d.createdAt) + '</span></div>'
        + '</div>';
}

function cardChPartner(d) {
    var roleCls   = { committee: 'badge-committee', ambassador: 'badge-ambassador', other: 'badge-other' };
    var roleLabel = { committee: 'College Committee', ambassador: 'Ambassador', other: 'Other' };
    return '<div class="admin-card ch-card">'
        + '<div class="ac-top"><span class="ac-id">' + shortId(d._id) + '</span><span class="badge ' + (roleCls[d.role] || 'badge-other') + '">' + (roleLabel[d.role] || d.role || '—') + '</span></div>'
        + '<div class="ac-name">' + (d.college || '—') + '</div>'
        + '<div class="ac-sub">' + (d.location || '—') + '</div>'
        + '<div class="ac-details">'
        + '<div class="ac-row"><span class="ac-row-label">Footfall</span><span class="ac-row-val">' + (d.footfall ? Number(d.footfall).toLocaleString('en-IN') : '—') + '</span></div>'
        + '<div class="ac-row"><span class="ac-row-label">About</span><span class="ac-row-val">' + trunc(d.description, 80) + '</span></div>'
        + '<div class="ac-row"><span class="ac-row-label">Reason</span><span class="ac-row-val">' + trunc(d.reason, 80) + '</span></div>'
        + '</div>'
        + '<div class="ac-footer"><span class="ac-date">' + fmtDate(d.createdAt) + '</span></div>'
        + '</div>';
}

function cardChAmbassador(d) {
    return '<div class="admin-card ch-card">'
        + '<div class="ac-top"><span class="ac-id">' + shortId(d._id) + '</span>'
        + (d.followers ? '<span class="badge badge-ambassador">' + Number(d.followers).toLocaleString('en-IN') + ' followers</span>' : '')
        + '</div>'
        + '<div class="ac-name">' + (d.name || '—') + '</div>'
        + '<div class="ac-sub">' + (d.college || '—') + (d.location ? ', ' + d.location : '') + '</div>'
        + '<div class="ac-details">'
        + '<div class="ac-row"><span class="ac-row-label">Contact</span><span class="ac-row-val">' + (d.email || '—') + ' · ' + (d.phone || '—') + '</span></div>'
        + '<div class="ac-row"><span class="ac-row-label">Instagram</span><span class="ac-row-val">' + (d.instagram || '—') + '</span></div>'
        + '<div class="ac-row"><span class="ac-row-label">Committees</span><span class="ac-row-val">' + trunc(d.committees, 80) + '</span></div>'
        + '<div class="ac-row"><span class="ac-row-label">Reason</span><span class="ac-row-val">' + trunc(d.reason, 80) + '</span></div>'
        + (d.referralCode ? '<div class="ac-row"><span class="ac-row-label">Referral Code</span><span class="ac-row-val" style="font-family:\'Cinzel\',serif;letter-spacing:.06em;color:#a78bfa">' + d.referralCode + '</span></div>' : '')
        + '</div>'
        + '<div class="ac-footer"><span class="ac-date">' + fmtDate(d.createdAt) + '</span></div>'
        + '</div>';
}

// ── Events renderers ─────────────────────────────────────────
function rowChEvent(d) {
    var statusCls = { past: 'badge-other', present: 'badge-premium', upcoming: 'badge-committee' };
    var price = d.normalPrice ? '₹' + Number(d.normalPrice).toLocaleString('en-IN') + '+' : '—';
    return '<tr>'
        + '<td class="td-id">' + (d.stubNum || shortId(d._id)) + '</td>'
        + '<td class="td-name">' + (d.name || '—')
            + (d.subname ? '<br><span style="font-size:.65rem;color:#555;font-weight:300">' + d.subname + '</span>' : '')
            + '</td>'
        + '<td>' + (d.date || '—') + '</td>'
        + '<td>' + (d.venue || '—') + '</td>'
        + '<td><span class="badge ' + (statusCls[d.status] || 'badge-other') + '">' + capFirst(d.status || '') + '</span></td>'
        + '<td>' + price + '</td>'
        + '<td class="td-actions">'
            + '<button class="ac-btn ac-edit" onclick="openEditEvent(\'' + d._id + '\')">Edit</button> '
            + '<button class="ac-btn ac-del" onclick="confirmDeleteEvent(\'' + d._id + '\')">Delete</button>'
            + '</td>'
        + '</tr>';
}

function cardChEvent(d) {
    var statusCls = { past: 'badge-other', present: 'badge-premium', upcoming: 'badge-committee' };
    return '<div class="admin-card ch-card">'
        + '<div class="ac-top">'
            + '<span class="ac-id">' + (d.stubNum || shortId(d._id)) + '</span>'
            + '<span class="badge ' + (statusCls[d.status] || 'badge-other') + '">' + capFirst(d.status || '') + '</span>'
            + '</div>'
        + '<div class="ac-name">' + (d.name || '—') + '</div>'
        + '<div class="ac-sub">' + (d.subname || '') + (d.date ? ' · ' + d.date : '') + '</div>'
        + '<div class="ac-details">'
            + '<div class="ac-row"><span class="ac-row-label">Venue</span><span class="ac-row-val">' + (d.venue || '—') + '</span></div>'
            + '<div class="ac-row"><span class="ac-row-label">Genre</span><span class="ac-row-val">' + (d.genre || '—') + '</span></div>'
            + (d.normalPrice
                ? '<div class="ac-row"><span class="ac-row-label">Prices</span><span class="ac-row-val">₹' + Number(d.normalPrice).toLocaleString('en-IN') + ' / ₹' + Number(d.premiumPrice || 0).toLocaleString('en-IN') + ' / ₹' + Number(d.luxuryPrice || 0).toLocaleString('en-IN') + '</span></div>'
                : '')
            + '</div>'
        + '<div class="ac-footer">'
            + '<span class="ac-date">' + fmtDate(d.createdAt) + '</span>'
            + '<div class="ac-actions">'
                + '<button class="ac-btn ac-edit" onclick="openEditEvent(\'' + d._id + '\')">Edit</button>'
                + '<button class="ac-btn ac-del" onclick="confirmDeleteEvent(\'' + d._id + '\')">Del</button>'
                + '</div>'
            + '</div>'
        + '</div>';
}

// ── Events CRUD ───────────────────────────────────────────────
var eventModalOverlay = document.getElementById('eventModalOverlay');

function openEventModal(docId) {
    var d = docId ? currentData.find(function(x) { return x._id === docId; }) : null;
    document.getElementById('amTitle').textContent    = d ? 'Edit Event' : 'New Event';
    document.getElementById('amDocId').value          = d ? d._id : '';
    document.getElementById('amName').value           = d ? (d.name || '') : '';
    document.getElementById('amSubname').value        = d ? (d.subname || '') : '';
    document.getElementById('amDate').value           = d ? (d.date || '') : '';
    document.getElementById('amStatus').value         = d ? (d.status || 'upcoming') : 'upcoming';
    document.getElementById('amVenue').value          = d ? (d.venue || '') : '';
    document.getElementById('amGenre').value          = d ? (d.genre || '') : '';
    document.getElementById('amCapacity').value       = d ? (d.capacity || '') : '';
    document.getElementById('amStatusLabel').value    = d ? (d.statusLabel || '') : '';
    document.getElementById('amNormal').value         = d ? (d.normalPrice || '') : '';
    document.getElementById('amPremium').value        = d ? (d.premiumPrice || '') : '';
    document.getElementById('amLuxury').value         = d ? (d.luxuryPrice || '') : '';
    document.getElementById('amStub').value           = d ? (d.stubNum || '') : '';
    document.getElementById('amError').textContent    = '';
    document.getElementById('amSave').disabled        = false;
    document.getElementById('amSave').textContent     = 'Save Event →';
    eventModalOverlay.classList.add('open');
}

function closeEventModal() { eventModalOverlay.classList.remove('open'); }

function openEditEvent(id)        { openEventModal(id); }
function confirmDeleteEvent(id) {
    if (!confirm('Delete this event? This cannot be undone.')) return;
    db.collection('ch_events').doc(id).delete()
        .then(function() { loadSection('ch-events'); })
        .catch(function(err) { alert('Delete failed: ' + (err.message || err.code)); });
}

document.getElementById('addEventBtn').addEventListener('click', function() { openEventModal(null); });
document.getElementById('amClose').addEventListener('click', closeEventModal);
document.getElementById('amCancel').addEventListener('click', closeEventModal);
eventModalOverlay.addEventListener('click', function(e) { if (e.target === eventModalOverlay) closeEventModal(); });

document.getElementById('amSave').addEventListener('click', function() {
    var name = document.getElementById('amName').value.trim();
    if (!name) { document.getElementById('amError').textContent = 'Event name is required.'; return; }
    var docId = document.getElementById('amDocId').value;
    var data = {
        name:        name,
        subname:     document.getElementById('amSubname').value.trim(),
        date:        document.getElementById('amDate').value.trim(),
        status:      document.getElementById('amStatus').value,
        venue:       document.getElementById('amVenue').value.trim(),
        genre:       document.getElementById('amGenre').value.trim(),
        capacity:    document.getElementById('amCapacity').value,
        statusLabel: document.getElementById('amStatusLabel').value.trim(),
        normalPrice: document.getElementById('amNormal').value,
        premiumPrice:document.getElementById('amPremium').value,
        luxuryPrice: document.getElementById('amLuxury').value,
        stubNum:     document.getElementById('amStub').value.trim()
    };
    var saveBtn = document.getElementById('amSave');
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    document.getElementById('amError').textContent = '';

    var op = docId
        ? db.collection('ch_events').doc(docId).update(data)
        : db.collection('ch_events').add(Object.assign({}, data, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));

    op.then(function() {
        closeEventModal();
        loadSection('ch-events');
    }).catch(function(err) {
        document.getElementById('amError').textContent = 'Save failed: ' + (err.message || err.code);
        saveBtn.disabled = false; saveBtn.textContent = 'Save Event →';
    });
});

// Events filter chips
document.querySelectorAll('.evt-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
        currentFilter = chip.dataset.filter;
        document.querySelectorAll('.evt-chip').forEach(function(c) { c.classList.toggle('active', c.dataset.filter === currentFilter); });
        renderData();
    });
});

// ── CSV export field extractor ────────────────────────────────
function getExportFields(sectionKey, d) {
    var dt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : '';
    switch (sectionKey) {
        case 'avora-enquiries':  return [d.name, d.email, d.phone, d.service, d.message, dt];
        case 'ch-tickets':       return [d.name, d.event, d.ticketType, d.referral, dt];
        case 'ch-partners':      return [d.college, d.location, d.footfall, d.role, d.description, d.reason, dt];
        case 'ch-ambassadors':   return [d.name, d.college, d.location, d.address, d.phone, d.email, d.instagram, d.followers, d.committees, d.reason, d.referralCode, dt];
        case 'ch-events':        return [d.stubNum, d.name, d.subname, d.date, d.venue, d.genre, d.status, d.normalPrice, d.premiumPrice, d.luxuryPrice, d.capacity];
        default: return [];
    }
}

// ── Load badge counts ─────────────────────────────────────────
function loadBadgeCounts() {
    Object.keys(SECTIONS).forEach(function(key) {
        db.collection(SECTIONS[key].collection).get()
            .then(function(snap) { updateBadge(key, snap.size); })
            .catch(function() {});
    });
}
