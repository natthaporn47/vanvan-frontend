// register.js — Register page (PostgreSQL version)
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

function shakeCard() {
    const card = document.getElementById("register-card");
    if (!card) return;
    card.classList.remove("card--shake");
    void card.offsetWidth;
    card.classList.add("card--shake");
    card.addEventListener("animationend", () => card.classList.remove("card--shake"), { once: true });
}

// ═══════════════════════════════════════════
// VALIDATE
// ═══════════════════════════════════════════

function validate() {
    ["reg-username","reg-email","reg-password","reg-confirm-password"].forEach(clearField);
    const username = document.getElementById("reg-username").value.trim();
    const email    = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirm  = document.getElementById("reg-confirm-password").value;
    let ok = true;

    if (!username) {
        setError("reg-username", "⚠ กรุณากรอก Username"); ok = false;
    } else if (username.length < 3) {
        setError("reg-username", "⚠ Username ต้องมีอย่างน้อย 3 ตัวอักษร"); ok = false;
    } else if (username.length > 20) {
        setError("reg-username", "⚠ Username ยาวเกินไป (สูงสุด 20 ตัว)"); ok = false;
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setError("reg-username", "⚠ ใช้ได้เฉพาะ a-z, A-Z, 0-9 และ _ เท่านั้น"); ok = false;
    } else { setOk("reg-username"); }

    if (!email) {
        setError("reg-email", "⚠ กรุณากรอก Email"); ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("reg-email", "⚠ รูปแบบ Email ไม่ถูกต้อง"); ok = false;
    } else { setOk("reg-email"); }

    if (!password) {
        setError("reg-password", "⚠ กรุณากรอกรหัสผ่าน"); ok = false;
    } else if (password.length < 6) {
        setError("reg-password", "⚠ รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"); ok = false;
    } else { setOk("reg-password"); }

    if (!confirm) {
        setError("reg-confirm-password", "⚠ กรุณายืนยันรหัสผ่าน"); ok = false;
    } else if (confirm !== password) {
        setError("reg-confirm-password", "⚠ รหัสผ่านไม่ตรงกัน"); ok = false;
    } else if (password.length >= 6) { setOk("reg-confirm-password"); }

    return ok;
}

// ═══════════════════════════════════════════
// PASSWORD STRENGTH
// ═══════════════════════════════════════════

function updateStrength(val) {
    const wrapper = document.getElementById("strength-wrapper");
    const fill    = document.getElementById("strength-fill");
    const label   = document.getElementById("strength-label");
    if (!wrapper || !fill || !label) return;

    if (!val) { wrapper.style.display = "none"; return; }
    wrapper.style.display = "flex";

    const score = [
        val.length >= 6,
        val.length >= 10,
        /[A-Z]/.test(val) && /[0-9]/.test(val),
        /[^A-Za-z0-9]/.test(val),
    ].filter(Boolean).length;

    const lv = [
        null,
        { p: "25%",  c: "#e53935", t: "อ่อนมาก"  },
        { p: "50%",  c: "#fb8c00", t: "พอใช้"     },
        { p: "75%",  c: "#fdd835", t: "ดี"         },
        { p: "100%", c: "#43a047", t: "แข็งแกร่ง" },
    ][Math.max(1, score)];

    fill.style.cssText = `width:${lv.p}; background:${lv.c}`;
    label.textContent  = lv.t;
    label.style.color  = lv.c;
}

// ═══════════════════════════════════════════
// REGISTER
// ═══════════════════════════════════════════

async function doRegister() {
    if (!validate()) {
        shakeCard();
        toast("กรุณากรอกข้อมูลให้ครบและถูกต้อง", "warning");
        return;
    }

    const username = document.getElementById("reg-username").value.trim();
    const email    = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const btn      = document.getElementById("btn-register");

    btn.disabled    = true;
    btn.textContent = "กำลังสมัคร...";

    try {
        const res  = await fetch(`${API}/auth/register`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ username, email, password }),
        });
        const data = await res.json();

        if (!res.ok) {
            if (data.field === 'email' || data.message?.includes("Email")) {
                setError("reg-email", "⚠ " + data.message);
                toast(data.message, "warning");
            } else {
                toast(data.message, "error");
            }
            shakeCard();
            return;
        }

        toast("สมัครสมาชิกสำเร็จ! 🎉 กำลังพาไปหน้า Login...", "success");
        setTimeout(() => { window.location.href = "login.html"; }, 1200);

    } catch (err) {
        console.error("Register error:", err);
        toast("ไม่สามารถเชื่อมต่อ Server ได้ กรุณาตรวจสอบว่า Backend รันอยู่", "error");
        shakeCard();
    } finally {
        btn.disabled    = false;
        btn.textContent = "Register";
    }
}

// ═══════════════════════════════════════════
// PASSWORD TOGGLE
// ═══════════════════════════════════════════

const EYE_ON  = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

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

    document.getElementById("btn-register")
        ?.addEventListener("click", doRegister);

    document.getElementById("reg-confirm-password")
        ?.addEventListener("keydown", e => {
            if (e.key === "Enter") doRegister();
        });

    ["reg-username","reg-email","reg-password","reg-confirm-password"]
        .forEach(id => document.getElementById(id)
            ?.addEventListener("input", () => clearField(id)));

    document.getElementById("reg-password")
        ?.addEventListener("input", e => updateStrength(e.target.value));

    document.getElementById("reg-confirm-password")
        ?.addEventListener("input", e => {
            const pw = document.getElementById("reg-password").value;
            if (!e.target.value) { clearField("reg-confirm-password"); return; }
            e.target.value !== pw
                ? setError("reg-confirm-password", "⚠ รหัสผ่านไม่ตรงกัน")
                : setOk("reg-confirm-password");
        });
});