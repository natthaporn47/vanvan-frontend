// script.js — Login page (PostgreSQL version)
import { toast } from "./Toast.js";

//const API = "http://localhost:3000/api";
const API = "https://vanvan-backend-a2qy.onrender.com/api";
// ═══════════════════════════════════════════
// FIELD VALIDATION UI
// ═══════════════════════════════════════════

function setError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add("input--error");
    el.classList.remove("input--success");
    el.parentElement.querySelector(".field-error-msg")?.remove();
    const span = document.createElement("span");
    span.className   = "field-error-msg";
    span.textContent = msg;
    el.parentElement.appendChild(span);
}

function setOk(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("input--error");
    el.classList.add("input--success");
    el.parentElement.querySelector(".field-error-msg")?.remove();
}

function clearField(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove("input--error", "input--success");
    el.parentElement.querySelector(".field-error-msg")?.remove();
}

// ═══════════════════════════════════════════
// VALIDATE
// ═══════════════════════════════════════════

function validate() {
    ["username", "password"].forEach(clearField);
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    let ok = true;

    if (!username) {
        setError("username", "⚠ กรุณากรอก Email");
        ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) {
        setError("username", "⚠ รูปแบบ Email ไม่ถูกต้อง");
        ok = false;
    } else {
        setOk("username");
    }

    if (!password) {
        setError("password", "⚠ กรุณากรอกรหัสผ่าน");
        ok = false;
    } else if (password.length < 6) {
        setError("password", "⚠ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
        ok = false;
    } else {
        setOk("password");
    }

    return ok;
}

// ═══════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════

async function doLogin() {
    if (!validate()) {
        toast("กรุณากรอกข้อมูลให้ครบและถูกต้อง", "warning");
        return;
    }

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const btn      = document.getElementById("btn-login");

    btn.disabled    = true;
    btn.textContent = "กำลังเข้าสู่ระบบ...";

    try {
        const res  = await fetch(`${API}/auth/login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ username, password }),
        });
        const data = await res.json();

        if (!res.ok) {
            if (data.message.includes("รหัสผ่าน")) {
                setError("password", "⚠ " + data.message);
            } else {
                setError("username", "⚠ " + data.message);
            }
            toast(data.message, "warning");
            return;
        }

        // บันทึก token และ user
        localStorage.setItem("token", data.token);
        localStorage.setItem("user",  JSON.stringify(data.user));

        toast("เข้าสู่ระบบสำเร็จ! 🎉", "success");

        // Redirect ตาม role
        setTimeout(() => {
            const role = data.user.role;
            if (role === "admin")  window.location.href = "admin/index.html";
            else if (role === "driver") window.location.href = "driver/index.html";
            else window.location.href = "index.html";
        }, 1500);

    } catch (err) {
        console.error("Login error:", err);
        toast("ไม่สามารถเชื่อมต่อ Server ได้ กรุณาตรวจสอบว่า Backend รันอยู่", "error");
    } finally {
        btn.disabled    = false;
        btn.textContent = "Sign In";
    }
}

// ═══════════════════════════════════════════
// PASSWORD TOGGLE (ลูกตา)
// ═══════════════════════════════════════════

const EYE_ON  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
</svg>`;

const EYE_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
</svg>`;

function initToggles() {
    document.querySelectorAll(".btn-eye[data-toggle]").forEach(btn => {
        const input = document.getElementById(btn.dataset.toggle);
        if (!input) return;
        btn.innerHTML = EYE_ON;
        btn.addEventListener("click", () => {
            const show    = input.type === "password";
            input.type    = show ? "text" : "password";
            btn.innerHTML = show ? EYE_OFF : EYE_ON;
            input.focus();
        });
    });
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
    initToggles();

    // ถ้า Login อยู่แล้ว ไปหน้าหลักเลย
    const token = localStorage.getItem("token");
    const user  = JSON.parse(localStorage.getItem("user") || "null");
    if (token && user) {
        if (user.role === "admin")       window.location.href = "admin/index.html";
        else if (user.role === "driver") window.location.href = "driver/index.html";
        else                             window.location.href = "index.html";
        return;
    }

    document.getElementById("btn-login")
        ?.addEventListener("click", doLogin);

    // Clear error เมื่อพิมพ์
    document.getElementById("username")
        ?.addEventListener("input", () => clearField("username"));
    document.getElementById("password")
        ?.addEventListener("input", () => clearField("password"));

    // กด Enter login ได้เลย
    ["username", "password"].forEach(id => {
        document.getElementById(id)
            ?.addEventListener("keydown", e => {
                if (e.key === "Enter") doLogin();
            });
    });
});