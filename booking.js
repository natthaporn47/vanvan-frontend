// booking.js — แค่ดูข้อมูล ไม่แตะ DB เลย

//const API = "http://localhost:3000/api";
const API = "https://vanvan-backend-a2qy.onrender.com/api";
const getToken = () => localStorage.getItem("token");
const getUser  = () => { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } }

function isLoggedIn() {
    const token = getToken();
    const user  = getUser();
    if (!token || !user) return false;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            return false;
        }
    } catch { return false; }
    return true;
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString("th-TH", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
        timeZone: "Asia/Bangkok"
    });
}

function seatsBadge(available) {
    if (available === 0)  return `<span class="seats-badge seats-badge--cancelled">เต็มแล้ว</span>`;
    if (available <= 3)   return `<span class="seats-badge seats-badge--low">เหลือ ${available} ที่นั่ง</span>`;
    return `<span class="seats-badge">เหลือ ${available} ที่นั่ง</span>`;
}

document.addEventListener("DOMContentLoaded", async () => {
    const params     = new URLSearchParams(window.location.search);
    const scheduleId = params.get("schedule_id");
    const loadingEl  = document.getElementById("loading-state");
    const contentEl  = document.getElementById("booking-content");
    const errorEl    = document.getElementById("error-state");

    // ถ้าไม่มี schedule_id
    if (!scheduleId) {
        loadingEl.style.display = "none";
        errorEl.style.display   = "block";
        return;
    }

    // ถ้าไม่ได้ login → ไป login
    if (!isLoggedIn()) {
        window.location.href = "login.html";
        return;
    }

    try {
        const res  = await fetch(`${API}/schedules/${scheduleId}`);
        const data = await res.json();

        if (!res.ok || !data.data) {
            loadingEl.style.display = "none";
            errorEl.style.display   = "block";
            return;
        }

        const s = data.data;

        // ที่นั่งเต็ม
        if (s.available_seats <= 0) {
            loadingEl.style.display = "none";
            errorEl.style.display   = "block";
            document.getElementById("error-title").textContent = "ที่นั่งเต็มแล้ว";
            document.getElementById("error-msg").textContent   = "รอบนี้ไม่มีที่นั่งว่าง กรุณาเลือกรอบอื่น";
            return;
        }

        // ==========================================
        // ✅ ระบบเช็คราคา: อัปเดตจาก van_schedules ก่อน -> ถ้าไม่มีใช้จาก routes
        // ==========================================
        let finalPrice = 0;

        // 1. ลองดึงราคาจาก van_schedules (ถ้ามีและไม่เป็น null/undefined)
        if (s.van_schedules && s.van_schedules.price !== null && s.van_schedules.price !== undefined) {
            finalPrice = s.van_schedules.price;
        } 
        else if (s.price !== null && s.price !== undefined) {
             // กรณีที่ API ดึง van_schedules มาไว้ที่ root level แล้ว
            finalPrice = s.price;
        }
        // 2. ถ้าข้างบนไม่ได้ค่า ให้ดึงราคา default จาก routes (ถ้า API มีการ Join มาให้)
        else if (s.routes && s.routes.price !== null && s.routes.price !== undefined) {
             finalPrice = s.routes.price;
        }

        // กรณีฉุกเฉิน: ถ้าไม่ได้ราคาเลย (กันเหนียว)
        if (finalPrice === 0) {
            console.warn("ไม่พบข้อมูลราคาจากทั้ง van_schedules และ routes");
        }
        // ==========================================

        const user = getUser();
        
        // เช็คที่อยู่ปลายทาง/ต้นทาง เผื่อ API ส่งมาแบบ Join (s.routes.origin)
        const originName = s.origin || (s.routes && s.routes.origin) || "-";
        const destName = s.destination || (s.routes && s.routes.destination) || "-";

        document.getElementById("info-origin").textContent      = originName;
        document.getElementById("info-destination").textContent = destName;
        document.getElementById("info-depart").textContent      = formatDate(s.depart_time);
        document.getElementById("info-driver").textContent      = s.driver_name  || "-";
        document.getElementById("info-plate").textContent       = s.plate_number || "-";
        
        // ✅ นำตัวแปรราคาที่คำนวณแล้วมาแสดงผล
        document.getElementById("info-price").textContent       = `฿${Number(finalPrice).toLocaleString()}`;
        
        document.getElementById("info-seats").innerHTML         = seatsBadge(s.available_seats);
        document.getElementById("info-passenger").textContent   = user?.username || "-";

        loadingEl.style.display = "none";
        contentEl.style.display = "block";

        // ✅ กดยืนยัน → ส่งข้อมูลผ่าน sessionStorage ไปหน้า payment
        document.getElementById("btn-confirm").addEventListener("click", () => {
            sessionStorage.setItem("pendingBooking", JSON.stringify({
                schedule_id:  s.id,
                origin:       originName,
                destination:  destName,
                depart_time:  s.depart_time,
                
                // ✅ ส่งราคาสุดท้าย (Final Price) ไปหน้าชำระเงิน
                price:        finalPrice, 
                
                driver_name:  s.driver_name,
                plate_number: s.plate_number,
            }));
            window.location.href = "payment.html";
        });

    } catch (err) {
        console.error("Booking load error:", err);
        loadingEl.style.display = "none";
        errorEl.style.display   = "block";
    }
});
