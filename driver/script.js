//const API   = "http://localhost:3000/api/driver";
const API = "https://vanvan-backend-a2qy.onrender.com/api/driver";
const token = localStorage.getItem("token");

let currentTrips   = [];
let allTrips       = [];
let driverProfile  = null;
let activeTab      = 'home';
let selectedTripId = null;
let prevTripIds    = null;
let prevPaxCounts  = {};
let refreshTimer   = null;
let notifications  = [];
let activeToast    = null;
let toastTimer     = null;

const headerTitle = document.getElementById('header-title');
const backBtn     = document.getElementById('back-btn');
const detailView  = document.getElementById('detail-view');
const mainHeader  = document.getElementById('main-header');
const bottomNav   = document.querySelector('.bottom-nav');

// ── Auth Header ───────────────────────────────────────────
function authHeader() {
    return { "Content-Type": "application/json", "Authorization": "Bearer " + token };
}

// ── เช็คว่าแก้สถานะได้ไหม ────────────────────────────────
function canEditStatus(trip) {
    if (trip.status === 'completed' || trip.status === 'cancelled') return false;
    const depart = new Date(trip.depart_time);
    const now    = new Date();
    return depart.getFullYear() === now.getFullYear()
        && depart.getMonth()    === now.getMonth()
        && depart.getDate()     === now.getDate();
}

// ── เช็ค transition ที่อนุญาต ────────────────────────────
function isValidTransition(currentStatus, newStatus) {
    if (newStatus === 'cancelled') return true;
    if (currentStatus === 'available' && newStatus === 'traveling') return true;
    if (currentStatus === 'traveling' && newStatus === 'completed') return true;
    if (currentStatus === newStatus) return false;
    return false;
}

// ── Notification Toast ────────────────────────────────────
function showNotifToast(type, title, desc) {
    if (activeToast) { activeToast.remove(); activeToast = null; }
    if (toastTimer)  { clearTimeout(toastTimer); toastTimer = null; }

    const el = document.createElement('div');
    el.className = `notif-toast ${type}`;
    el.innerHTML = `
        <div class="toast-icon">${type === 'job' ? '📋' : '👥'}</div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-desc">${desc}</div>
        </div>
        <button class="toast-close" onclick="dismissToast()">✕</button>`;

    document.querySelector('.mobile-container').appendChild(el);
    activeToast = el;
    toastTimer  = setTimeout(() => dismissToast(), 5000);
}

function dismissToast() {
    if (!activeToast) return;
    activeToast.classList.add('hiding');
    setTimeout(() => { if (activeToast) { activeToast.remove(); activeToast = null; } }, 300);
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

function addNotification(type, title, desc) {
    const now     = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    notifications.unshift({ type, title, desc, time: timeStr, unread: true });
    if (notifications.length > 30) notifications.pop();
    updateNotifBadge();
    showNotifToast(type, title, desc);
}

function updateNotifBadge() {
    const unread = notifications.filter(n => n.unread).length;
    const badge  = document.getElementById('notification-badge');
    if (!badge) return;
    if (unread > 0) {
        badge.style.display = 'flex';
        badge.textContent   = unread > 9 ? '9+' : String(unread);
    } else {
        badge.style.display = 'none';
    }
}

function renderNotifList() {
    const list = document.getElementById('notif-list');
    if (!list) return;
    if (notifications.length === 0) {
        list.innerHTML = '<div class="notif-empty">ยังไม่มีการแจ้งเตือน</div>';
        return;
    }
    list.innerHTML = notifications.map(n => `
        <div class="notif-item ${n.unread ? 'unread' : ''}">
            <div class="notif-icon-sm">${n.type === 'job' ? '📋' : '👥'}</div>
            <div class="notif-body">
                <div class="notif-title">${n.title}</div>
                <div class="notif-desc">${n.desc}</div>
                <div class="notif-time">${n.time}</div>
            </div>
        </div>`).join('');
}

function openNotifPanel() {
    dismissToast();
    document.getElementById('notification-panel').classList.add('open');
    document.getElementById('notif-overlay').classList.add('open');
    notifications.forEach(n => n.unread = false);
    updateNotifBadge();
    renderNotifList();
}

function closeNotifPanel() {
    document.getElementById('notification-panel').classList.remove('open');
    document.getElementById('notif-overlay').classList.remove('open');
}

// ── แสดงข้อมูลจาก localStorage ทันที ────────────────────
function renderFromLocalStorage() {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user) return;
    const name     = user.full_name || user.username || "คนขับ";
    const username = user.username  || name;
    const initials = name.charAt(0).toUpperCase();

    const avatarEl = document.getElementById("profile-avatar");
    const nameEl   = document.getElementById("profile-name");
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = username;

    const avatarBig = document.getElementById("profile-avatar-big");
    const fullname  = document.getElementById("profile-fullname");
    const email     = document.getElementById("profile-email");
    if (avatarBig) avatarBig.textContent = initials;
    if (fullname)  fullname.textContent  = name;
    if (email)     email.textContent     = user.email || "-";
}

// ── Load Driver Profile ───────────────────────────────────
async function loadProfile() {
    try {
        const res = await fetch(API + "/profile", { headers: authHeader() });
        if (res.status === 401) { doLogout(); return; }
        if (!res.ok) return;
        const data = await res.json();
        driverProfile = data.data;
        renderProfileData();
    } catch (err) {
        console.error("loadProfile error:", err);
    }
}

function renderProfileData() {
    if (!driverProfile) return;
    const p        = driverProfile;
    const initials = (p.full_name || p.username || "?").charAt(0).toUpperCase();
    const username = p.username || p.full_name || "-";

    const avatarEl = document.getElementById("profile-avatar");
    const nameEl   = document.getElementById("profile-name");
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl)   nameEl.textContent   = username;

    const statToday = document.getElementById("stat-today-trips");
    const statPax   = document.getElementById("stat-total-passengers");
    if (statToday) statToday.textContent = p.trips_today      ?? "0";
    if (statPax)   statPax.textContent   = p.passengers_today ?? "0";

    const avatarBig  = document.getElementById("profile-avatar-big");
    const fullname   = document.getElementById("profile-fullname");
    const email      = document.getElementById("profile-email");
    const license    = document.getElementById("profile-license");
    const phone      = document.getElementById("profile-phone");
    const totalTrips = document.getElementById("profile-total-trips");

    if (avatarBig)  avatarBig.textContent  = initials;
    if (fullname)   fullname.textContent   = p.full_name || p.username || "-";
    if (email)      email.textContent      = p.email     || "-";
    if (license)    license.textContent    = "ใบขับขี่: " + (p.license_no || "-");
    if (phone)      phone.textContent      = p.phone     || "-";
    if (totalTrips) totalTrips.textContent = p.total_trips ?? "0";
}

// ── Load วันนี้ (หน้าแรก) ────────────────────────────────
async function loadSchedules(silent = false) {
    try {
        const res      = await fetch(API + "/schedules?date=today", { headers: authHeader() });
        if (res.status === 401) { doLogout(); return; }
        const data     = await res.json();
        const newTrips = data.data || [];

        if (prevTripIds !== null) {
            newTrips.forEach(t => {
                if (!prevTripIds.has(t.id)) {
                    addNotification('job',
                        'มีงานใหม่จาก Admin',
                        `${t.origin} → ${t.destination}  เวลา ${formatTime(t.depart_time)} น.`
                    );
                }
            });
        }
        prevTripIds  = new Set(newTrips.map(t => t.id));
        currentTrips = newTrips;

        renderHome();
        if (!silent) loadProfile();
    } catch (err) {
        console.error("loadSchedules error:", err);
        if (!silent) showToast("ไม่สามารถโหลดข้อมูลได้", "#c62828");
    }
}

// ── Load ทั้งหมด (ประวัติ) ────────────────────────────────
async function loadAllSchedules() {
    const container = document.getElementById('schedule-list');
    if (container) container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-soft)">กำลังโหลด...</div>`;
    try {
        const res  = await fetch(API + "/schedules", { headers: authHeader() });
        if (res.status === 401) { doLogout(); return; }
        const data = await res.json();
        allTrips   = data.data || [];
        await checkNewPassengers(allTrips);
        renderSchedule();
    } catch (err) {
        console.error("loadAllSchedules error:", err);
    }
}

async function checkNewPassengers(trips) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const active = trips.filter(t =>
        new Date(t.depart_time) >= todayStart &&
        t.status !== 'completed' && t.status !== 'cancelled'
    );
    for (const trip of active) {
        try {
            const res   = await fetch(`${API}/schedules/${trip.id}/passengers`, { headers: authHeader() });
            const data  = await res.json();
            const count = (data.data || []).length;
            const prev  = prevPaxCounts[trip.id];
            if (prev !== undefined && count > prev) {
                addNotification('pax',
                    'มีผู้โดยสารได้รับการยืนยันใหม่',
                    `${trip.origin} → ${trip.destination}  (${count}/${trip.total_seats} คน)`
                );
            }
            prevPaxCounts[trip.id] = count;
        } catch (_) {}
    }
}

function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(async () => {
        await loadSchedules(true);
        if (activeTab === 'schedule') await loadAllSchedules();
        else await checkNewPassengers(allTrips);
    }, 30000);
}

async function loadPassengers(scheduleId) {
    try {
        const res  = await fetch(`${API}/schedules/${scheduleId}/passengers`, { headers: authHeader() });
        const data = await res.json();
        return data.data || [];
    } catch (_) { return []; }
}

async function loadPendingBookings(scheduleId) {
    try {
        const res  = await fetch(`${API}/schedules/${scheduleId}/pending`, { headers: authHeader() });
        const data = await res.json();
        return data.data || [];
    } catch (_) { return []; }
}

// ── Update Schedule Status ────────────────────────────────
async function updateStatus(tripId, newStatus) {
    const trip = currentTrips.find(t => t.id === tripId) || allTrips.find(t => t.id === tripId);
    if (!trip) return;

    const resetSelect = () => {
        const sel = document.querySelector(`select[onchange*="${tripId}"]`);
        if (sel) sel.value = trip.status;
    };

    // เช็ค transition
    if (!isValidTransition(trip.status, newStatus)) {
        const msg = newStatus === 'completed' && trip.status === 'available'
            ? "ต้องกด 'ออกเดินทาง' ก่อน แล้วค่อยกด 'ถึงที่หมาย'"
            : "ไม่สามารถเปลี่ยนสถานะนี้ได้";
        showToast(msg, "#c62828");
        resetSelect();
        return;
    }

    // เช็คเพิ่มเติมเฉพาะตอนออกเดินทาง
    if (newStatus === 'traveling') {
        const depart  = new Date(trip.depart_time);
        const now     = new Date();
        const diffMin = (depart - now) / 60000;

        if (diffMin > 15) {
            showToast(`ยังออกรถไม่ได้ เหลืออีก ${Math.round(diffMin)} นาที`, "#c62828");
            resetSelect();
            return;
        }

        const [passengers, pending] = await Promise.all([
            loadPassengers(tripId),
            loadPendingBookings(tripId)
        ]);

        // สร้าง summary message
        const confirmedCount = passengers.length;
        const pendingCount   = pending.length;
        const totalCount     = confirmedCount + pendingCount;

        if (totalCount === 0) {
            const ok = window.confirm("⚠️ ยังไม่มีผู้โดยสารในรอบนี้เลย\nต้องการออกรถเลยหรือไม่?");
            if (!ok) { resetSelect(); return; }
        } else if (pendingCount > 0) {
            const pendingNames = pending.map(b => b.passenger_name).join(', ');
            const ok = window.confirm(
                `📋 สรุปผู้โดยสารรอบนี้\n\n` +
                `✅ ยืนยันแล้ว: ${confirmedCount} คน\n` +
                `⏳ รอ Admin ยืนยัน: ${pendingCount} คน\n` +
                `   (${pendingNames})\n\n` +
                `หากออกรถตอนนี้ คนที่รออยู่อาจตกรถ\n` +
                `กด "ตกลง" เพื่อออกรถเลย หรือ "ยกเลิก" เพื่อรอ Admin`
            );
            if (!ok) { resetSelect(); return; }
        }
        // ถ้า confirmedCount > 0 และ pendingCount === 0 → ออกได้เลย ไม่ต้องถาม
    }

    try {
        const res  = await fetch(`${API}/schedules/${tripId}/status`, {
            method: "PATCH",
            headers: authHeader(),
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || "อัปเดตสถานะไม่สำเร็จ", "#c62828");
            resetSelect();
            return;
        }
        showToast("อัปเดตสถานะเรียบร้อย ✓", "#27ae60");
        await loadSchedules(true);
        await loadAllSchedules();
        if (selectedTripId === tripId) {
            const updated = currentTrips.find(t => t.id === tripId) || allTrips.find(t => t.id === tripId);
            if (updated) await _showDetail(updated);
        }
    } catch (err) {
        showToast("เกิดข้อผิดพลาด", "#c62828");
    }
}

// ── Format helpers ────────────────────────────────────────
function formatTime(isoStr) {
    return new Date(isoStr).toLocaleTimeString("th-TH", {
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok"
    });
}
function formatDate(isoStr) {
    return new Date(isoStr).toLocaleDateString("th-TH", {
        year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Bangkok"
    });
}
function formatDateKey(isoStr) {
    const d = new Date(isoStr);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function isToday(isoStr) {
    const d = new Date(isoStr), n = new Date();
    return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}

const STATUS_MAP = {
    available: { cls: 'yellow', text: 'รอออกรถ' },
    traveling: { cls: 'blue',   text: 'กำลังเดินทาง' },
    completed: { cls: 'green',  text: 'ถึงแล้ว' },
    cancelled: { cls: 'red',    text: 'ยกเลิก' },
    scheduled: { cls: 'yellow', text: 'รอออกรถ' },
};

// ── Render Home ───────────────────────────────────────────
function renderHome() {
    const nextTrip  = currentTrips.find(t => canEditStatus(t));
    const container = document.getElementById('next-trip-container');
    if (!container) return;

    if (!nextTrip) {
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:40px 20px;margin-bottom:24px;">
                <i data-lucide="check-circle-2" style="width:48px;height:48px;color:#27ae60;margin-bottom:12px;"></i>
                <p style="font-weight:700;">ไม่มีงานค้างวันนี้แล้ว</p>
                <p style="color:var(--color-text-soft);font-size:13px;">พักผ่อนให้เต็มที่นะ!</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    const canDepart = nextTrip.status === 'available';
    const canArrive = nextTrip.status === 'traveling';

    container.innerHTML = `
        <div class="card trip-card">
            <div class="trip-card-header">
                <span class="tag">เที่ยววันนี้</span>
                <span style="font-size:12px;color:var(--color-text-soft);font-weight:500;">${formatDate(nextTrip.depart_time)}</span>
            </div>
            <div class="trip-info">
                <div class="info-item">
                    <div class="info-icon"><i data-lucide="map-pin" style="width:18px;height:18px;"></i></div>
                    <div class="info-content"><p>เส้นทาง</p><p>${nextTrip.origin} → ${nextTrip.destination}</p></div>
                </div>
                <div class="info-item">
                    <div class="info-icon"><i data-lucide="clock" style="width:18px;height:18px;"></i></div>
                    <div class="info-content"><p>เวลาออกเดินทาง</p><p>${formatTime(nextTrip.depart_time)} น.</p></div>
                </div>
            </div>
            <div class="btn-group">
                <button class="btn-primary" onclick="openDetail('${nextTrip.id}')">ดูรายละเอียด</button>
                <button class="btn-secondary" onclick="switchTab('scan')">
                    <i data-lucide="qr-code" style="width:20px;height:20px;"></i>
                </button>
            </div>
        </div>
        <div style="margin-bottom:24px;">
            <h3 style="font-size:16px;font-weight:700;margin-bottom:12px;">อัปเดตสถานะรถ</h3>
            <div class="status-grid">
                <button class="status-btn ${nextTrip.status === 'traveling' ? 'active-blue' : ''}"
                        style="${!canDepart ? 'opacity:0.4;cursor:not-allowed;' : ''}"
                        onclick="${canDepart ? `updateStatus('${nextTrip.id}', 'traveling')` : `showToast('ต้องอยู่ในสถานะรอออกรถก่อน', '#c62828')`}">
                    <i data-lucide="truck" style="width:20px;height:20px;"></i>
                    <span>ออกเดินทาง</span>
                </button>
                <button class="status-btn ${nextTrip.status === 'completed' ? 'active-green' : ''}"
                        style="${!canArrive ? 'opacity:0.4;cursor:not-allowed;' : ''}"
                        onclick="${canArrive ? `updateStatus('${nextTrip.id}', 'completed')` : `showToast('ต้องออกเดินทางก่อน', '#c62828')`}">
                    <i data-lucide="check-circle-2" style="width:20px;height:20px;"></i>
                    <span>ถึงที่หมาย</span>
                </button>
            </div>
        </div>`;
    lucide.createIcons();
}

// ── Render Schedule ───────────────────────────────────────
function renderSchedule() {
    const container = document.getElementById('schedule-list');
    if (!container) return;
    container.innerHTML = '';

    if (allTrips.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--color-text-soft)">ไม่มีประวัติการวิ่ง</div>`;
        return;
    }

    const sorted = [...allTrips].sort((a, b) => new Date(b.depart_time) - new Date(a.depart_time));
    const groups = {};
    sorted.forEach(trip => {
        const key = formatDateKey(trip.depart_time);
        if (!groups[key]) groups[key] = [];
        groups[key].push(trip);
    });

    Object.keys(groups).forEach(dateKey => {
        const trips     = groups[dateKey];
        const todayMark = isToday(trips[0].depart_time) ? '  (วันนี้)' : '';
        const header    = document.createElement('p');
        header.className   = 'schedule-date-group';
        header.textContent = formatDate(trips[0].depart_time) + todayMark;
        container.appendChild(header);

        trips.forEach(trip => {
            const s   = STATUS_MAP[trip.status] || STATUS_MAP.scheduled;
            const div = document.createElement('div');
            div.className = 'schedule-item';
            div.onclick   = () => _showDetail(trip);
            div.innerHTML = `
                <div class="schedule-left">
                    <div class="time-box"><p>${formatTime(trip.depart_time)}</p></div>
                    <div class="divider"></div>
                    <div class="route-info">
                        <h3>${trip.origin} → ${trip.destination}</h3>
                        <div class="route-meta">
                            <span class="status-tag ${s.cls}">${s.text}</span>
                            <span style="font-size:10px;color:var(--color-text-soft);display:flex;align-items:center;gap:4px;">
                                <i data-lucide="users" style="width:10px;height:10px;"></i>
                                ${trip.total_seats - trip.available_seats}/${trip.total_seats} คน
                            </span>
                        </div>
                    </div>
                </div>
                <i data-lucide="chevron-right" style="width:20px;height:20px;color:var(--color-text-soft);"></i>`;
            container.appendChild(div);
        });
    });
    lucide.createIcons();
}

// ── Open / Show Detail ────────────────────────────────────
async function openDetail(tripId) {
    const trip = currentTrips.find(t => t.id === tripId) || allTrips.find(t => t.id === tripId);
    if (trip) await _showDetail(trip);
}

async function _showDetail(trip) {
    if (!trip) return;
    selectedTripId = trip.id;

    document.getElementById('detail-content').innerHTML =
        `<div style="text-align:center;padding:40px;color:var(--color-text-soft)">กำลังโหลด...</div>`;
    detailView.classList.add('active');

    const [passengers, pending] = await Promise.all([
        loadPassengers(trip.id),
        loadPendingBookings(trip.id)
    ]);

    const editable = canEditStatus(trip);
    const s        = STATUS_MAP[trip.status] || STATUS_MAP.scheduled;

    // pending warning banner
    const pendingWarning = (pending.length > 0) ? `
        <div style="background:#fff8e1;border:1px solid #ffe082;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;gap:10px;align-items:flex-start;">
            <span style="font-size:18px;">⚠️</span>
            <div>
                <p style="font-size:13px;font-weight:700;color:#f57f17;margin-bottom:4px;">มี ${pending.length} รายการรอ Admin ยืนยัน</p>
                <p style="font-size:12px;color:#795548;line-height:1.5;">${pending.map(b => b.passenger_name).join(', ')}<br>กรุณาติดต่อ Admin ก่อนออกรถ</p>
            </div>
        </div>` : '';

    // dropdown เฉพาะ option ที่ valid
    const statusDropdown = () => {
        const opts = [
            { val: 'available', label: 'รอออกรถ' },
            { val: 'traveling', label: 'กำลังเดินทาง' },
            { val: 'completed', label: 'ถึงแล้ว' },
            { val: 'cancelled', label: 'ยกเลิก' },
        ];
        return `<select onchange="updateStatus('${trip.id}', this.value)">
            ${opts.map(o => {
                const valid    = o.val === trip.status || isValidTransition(trip.status, o.val);
                const selected = o.val === trip.status ? 'selected' : '';
                const disabled = !valid ? 'disabled style="color:#ccc"' : '';
                return `<option value="${o.val}" ${selected} ${disabled}>${o.label}</option>`;
            }).join('')}
        </select>`;
    };

    // passenger list HTML
    const confirmedHtml = passengers.length === 0
        ? ''
        : passengers.map(p => `
            <div class="passenger-item">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div class="seat-badge verified">${p.ticket_code?.slice(-4) || '??'}</div>
                    <div>
                        <p style="font-size:14px;font-weight:700;">${p.passenger_name}</p>
                        <p style="font-size:10px;color:var(--color-text-soft);">${p.ticket_code || '-'}</p>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:4px;color:#27ae60;font-size:12px;font-weight:700;">
                    <i data-lucide="check-circle-2" style="width:16px;height:16px;"></i> ยืนยันแล้ว
                </div>
            </div>`).join('');

    const pendingHtml = pending.length === 0
        ? ''
        : `<div style="margin-top:${passengers.length > 0 ? '12px' : '0'};margin-bottom:8px;">
                <p style="font-size:12px;font-weight:700;color:#f57f17;padding:0 4px;">⏳ รอ Admin ยืนยัน</p>
           </div>
           ${pending.map(p => `
            <div class="passenger-item" style="border-left:3px solid #ffe082;opacity:0.85;">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div class="seat-badge" style="background:#fff8e1;color:#f57f17;font-size:16px;">?</div>
                    <div>
                        <p style="font-size:14px;font-weight:700;">${p.passenger_name}</p>
                        <p style="font-size:10px;color:var(--color-text-soft);">รอการยืนยันจาก Admin</p>
                    </div>
                </div>
                <span style="font-size:11px;color:#f57f17;font-weight:700;background:#fff8e1;padding:3px 8px;border-radius:8px;">รอยืนยัน</span>
            </div>`).join('')}`;

    const emptyHtml = (passengers.length === 0 && pending.length === 0)
        ? `<div style="text-align:center;padding:24px;color:var(--color-text-soft)">ยังไม่มีผู้โดยสารในรอบนี้</div>`
        : '';

    document.getElementById('detail-content').innerHTML = `
        ${pendingWarning}
        <div class="card" style="margin-bottom:24px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="font-weight:700;color:var(--color-blue-dark);">${trip.origin} → ${trip.destination}</h3>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div>
                    <p style="font-size:10px;color:var(--color-text-soft);text-transform:uppercase;">เวลาออก</p>
                    <p style="font-weight:700;">${formatTime(trip.depart_time)} น.</p>
                </div>
                <div>
                    <p style="font-size:10px;color:var(--color-text-soft);text-transform:uppercase;">วันที่</p>
                    <p style="font-weight:700;">${formatDate(trip.depart_time)}</p>
                </div>
                <div>
                    <p style="font-size:10px;color:var(--color-text-soft);text-transform:uppercase;">ที่นั่ง</p>
                    <p style="font-weight:700;">${trip.total_seats - trip.available_seats}/${trip.total_seats} คน</p>
                </div>
                <div>
                    <p style="font-size:10px;color:var(--color-text-soft);text-transform:uppercase;">ทะเบียนรถ</p>
                    <p style="font-weight:700;">${trip.plate_number || '-'}</p>
                </div>
            </div>
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--color-border-light);display:flex;justify-content:space-between;align-items:center;">
                <p style="font-size:14px;font-weight:700;">สถานะ</p>
                ${editable
                    ? statusDropdown()
                    : `<span class="status-tag ${s.cls}" style="font-size:12px;padding:4px 12px;">${s.text}</span>`
                }
            </div>
        </div>

        <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
            <h3 style="font-weight:700;">รายชื่อผู้โดยสาร</h3>
            <div style="display:flex;gap:6px;">
                <span style="background:#eafaf1;color:#27ae60;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">
                    ✅ ยืนยัน ${passengers.length}
                </span>
                ${pending.length > 0 ? `
                <span style="background:#fff8e1;color:#f57f17;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">
                    ⏳ รอ ${pending.length}
                </span>` : ''}
            </div>
        </div>

        <div id="passenger-list">
            ${emptyHtml}
            ${confirmedHtml}
            ${pendingHtml}
        </div>`;

    lucide.createIcons();
}

// ── Close Detail ──────────────────────────────────────────
function closeDetail() {
    detailView.classList.remove('active');
    selectedTripId = null;
}

// ── Switch Tab ────────────────────────────────────────────
function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tab);
    });
    document.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('active', page.id === `${tab}-page`);
    });
    const titles = { home: 'หน้าแรก', schedule: 'ประวัติการวิ่ง', scan: 'สแกนตั๋ว', profile: 'โปรไฟล์' };
    headerTitle.textContent = titles[tab] || '';
    const isScan = tab === 'scan';
    mainHeader.style.display = isScan ? 'none' : 'flex';
    bottomNav.style.display  = isScan ? 'none' : 'flex';
    if (tab === 'schedule') loadAllSchedules();
    lucide.createIcons();
}

function simulateScan() {
    showToast("ฟีเจอร์นี้ต้องการกล้อง จะพัฒนาเพิ่มในภายหลัง", "#2E86C1");
    setTimeout(() => switchTab('home'), 1500);
}

function showToast(msg, color = "#2E86C1") {
    const el = document.createElement("div");
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
        background:white;border-left:4px solid ${color};color:${color};padding:12px 20px;
        border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.15);font-size:14px;font-weight:500;
        z-index:9999;max-width:320px;text-align:center;white-space:nowrap;`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

function doLogout() {
    clearInterval(refreshTimer);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.replace("../login.html");
}

// ── Init ──────────────────────────────────────────────────
window.onload = function () {
    if (!token) { doLogout(); return; }

    renderFromLocalStorage();
    loadSchedules();
    startAutoRefresh();

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchTab(item.getAttribute('data-tab')));
    });
    backBtn.addEventListener('click', closeDetail);
    document.getElementById('detail-back-btn').addEventListener('click', closeDetail);
    document.getElementById('simulate-scan-btn').addEventListener('click', simulateScan);
    document.getElementById('cancel-scan-btn').addEventListener('click', () => switchTab('home'));
    document.getElementById('btn-logout')?.addEventListener('click', doLogout);

    document.getElementById('notification-btn').addEventListener('click', openNotifPanel);
    document.getElementById('notif-overlay').addEventListener('click', closeNotifPanel);
    document.getElementById('notif-clear-btn').addEventListener('click', () => {
        notifications = [];
        updateNotifBadge();
        renderNotifList();
    });

    lucide.createIcons();
};

window.openDetail   = openDetail;
window.updateStatus = updateStatus;
window.switchTab    = switchTab;
window.dismissToast = dismissToast;
window.showToast    = showToast;