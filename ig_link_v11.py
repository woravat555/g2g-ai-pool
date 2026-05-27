#!/usr/bin/env python3
"""
Playwright v11: Instagram-Facebook linking with proper 2FA wait loop
- After FB login, wait up to 3 minutes for 2FA page detection
- Poll /tmp/otp.txt every 5 seconds for OTP code
- Keep browser open until linking completes or timeout
"""
import time, sys, os
from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout

IG_USER = "aiboss.g2g"
IG_PASS = "G2Gaiboss2026!"
FB_EMAIL = "thailandnogmo@gmail.com"
FB_PASS = "2424@9Ko"

def login_instagram(page):
    page.goto("https://www.instagram.com/accounts/login/", wait_until="domcontentloaded")
    time.sleep(3)
    for txt in ["Allow all cookies", "อนุญาตคุกกี้ทั้งหมด", "Accept All"]:
        try:
            btn = page.get_by_text(txt).first
            if btn.is_visible(timeout=1000): btn.click(); time.sleep(1)
        except: pass
    user_input = page.locator('input[type="text"]').first
    user_input.wait_for(state="visible", timeout=10000)
    user_input.fill(IG_USER)
    page.locator('input[type="password"]').first.fill(IG_PASS)
    page.locator('input[type="password"]').first.press("Enter")
    time.sleep(8)
    for txt in ["Not Now", "ไม่บันทึก"]:
        try:
            btn = page.get_by_text(txt).first
            if btn.is_visible(timeout=2000): btn.click(); time.sleep(1)
        except: pass
    return "accounts/login" not in page.url

def wait_for_otp(timeout_seconds=300):
    """Wait for OTP in /tmp/otp.txt, polling every 5 seconds."""
    otp_file = "/tmp/otp.txt"

    # Clear any old OTP file
    if os.path.exists(otp_file):
        os.remove(otp_file)

    print("\n" + "="*60)
    print("[!] FACEBOOK 2FA REQUIRED")
    print(f"    Account: {FB_EMAIL}")
    print(f"    Phone for SMS: 0612391415")
    print("    Check SMS on phone 0612391415 for 6-digit code")
    print(f"    Then write code to: {otp_file}")
    print(f"    Command: echo '123456' > {otp_file}")
    print("="*60)
    print(f"[*] Waiting up to {timeout_seconds}s for OTP...")

    start = time.time()
    while time.time() - start < timeout_seconds:
        # Check command-line arg first
        if len(sys.argv) > 1:
            otp = sys.argv[1].strip()
            print(f"[*] Using OTP from argument: {otp}")
            return otp

        # Check file
        if os.path.exists(otp_file):
            try:
                with open(otp_file) as f:
                    otp = f.read().strip()
                if otp and len(otp) >= 4:
                    print(f"[*] Got OTP from file: {otp}")
                    os.remove(otp_file)
                    return otp
            except: pass

        elapsed = int(time.time() - start)
        if elapsed % 30 == 0 and elapsed > 0:
            print(f"[*] Still waiting for OTP... ({elapsed}s elapsed)")
        time.sleep(5)

    print("[!] Timeout waiting for OTP")
    return None

def enter_otp_on_page(page, otp):
    """Try to find OTP input and enter the code."""
    page.screenshot(path="/tmp/v11_2fa_page.png")
    body = page.inner_text("body")
    print(f"[*] 2FA page body: {body[:300]}")

    for sel in [
        'input[name="approvals_code"]',
        'input[name="otp"]',
        'input[type="number"]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"]',
        'input[maxlength="6"]',
        '#approvals_code',
        'input[name="code"]',
    ]:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=2000):
                print(f"[*] Found OTP input: {sel}")
                el.fill(otp)
                time.sleep(0.5)
                el.press("Enter")
                time.sleep(6)
                url = page.url
                print(f"[*] URL after OTP: {url}")
                page.screenshot(path="/tmp/v11_after_otp.png")

                # Handle save browser prompts
                body2 = page.inner_text("body")
                for phrase in ["Don't Save", "Not now", "ไม่บันทึก", "ข้ามตอนนี้", "Continue", "OK"]:
                    try:
                        btn = page.get_by_text(phrase).first
                        if btn.is_visible(timeout=2000): btn.click(); time.sleep(1)
                    except: pass
                return True
        except: pass

    # Fallback: find any input
    print("[*] Trying generic input approach...")
    try:
        inputs = page.locator("input").all()
        for inp in inputs:
            try:
                if inp.is_visible(timeout=1000):
                    inp_type = inp.get_attribute("type") or ""
                    if inp_type not in ["submit", "button", "checkbox", "radio", "hidden"]:
                        print(f"[*] Trying input type={inp_type}")
                        inp.fill(otp)
                        time.sleep(0.5)
                        inp.press("Enter")
                        time.sleep(6)
                        return True
            except: pass
    except: pass

    return False

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False,
            args=["--disable-blink-features=AutomationControlled", "--disable-popup-blocking"])
        context = browser.new_context(viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        new_pages = []
        context.on("page", lambda pg: new_pages.append(pg))
        page = context.new_page()

        # 1. Instagram login
        print("[*] Instagram login...")
        if not login_instagram(page):
            print("[!] IG login failed"); browser.close(); return
        print(f"[*] IG logged in: {page.url}")

        # 2. Accounts Center
        page.goto("https://accountscenter.instagram.com/manage/", wait_until="networkidle", timeout=30000)
        time.sleep(3)
        if "login" in page.url:
            print("[!] IG session lost"); browser.close(); return

        # 3. Click Add accounts
        add_btn = None
        for sel in ["text=Add accounts", "text=เพิ่มบัญชี"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000): add_btn = el; break
            except: pass
        if not add_btn:
            print("[!] Add accounts button not found"); browser.close(); return

        add_btn.click(); time.sleep(2)

        # 4. Click Add Facebook account
        fb_clicked = False
        for sel in ["text=เพิ่มบัญชี Facebook", "text=Add Facebook account"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=3000):
                    el.click(); fb_clicked = True; break
            except: pass
        if not fb_clicked:
            print("[!] FB option not found in modal"); browser.close(); return

        # 5. Wait for FB page
        print("[*] Waiting for Facebook page...")
        time.sleep(4)

        fb_page = None
        for _ in range(5):
            if "facebook.com" in page.url:
                fb_page = page; break
            for pg in context.pages:
                if "facebook.com" in pg.url:
                    fb_page = pg; break
            if fb_page: break
            time.sleep(2)

        if not fb_page:
            print("[!] No FB page found"); browser.close(); return

        print(f"[*] FB page: {fb_page.url}")
        time.sleep(2)

        # 6. Handle FB login form
        body = fb_page.inner_text("body")
        print(f"[*] FB body: {body[:300]}")

        if "email" in body.lower() or "log in" in body.lower() or "เข้าสู่ระบบ" in body:
            print(f"[*] Login form found. Filling {FB_EMAIL}...")
            try:
                email_input = fb_page.locator('input[type="email"], input[name="email"], input[id="email"]').first
                email_input.wait_for(state="visible", timeout=8000)
                email_input.fill(FB_EMAIL)
                pw_input = fb_page.locator('input[type="password"], input[name="pass"]').first
                pw_input.wait_for(state="visible", timeout=5000)
                pw_input.fill(FB_PASS)
                pw_input.press("Enter")
                print("[*] Submitted FB login, waiting for redirect...")
                time.sleep(10)  # Wait longer for redirect

                url_after = fb_page.url
                print(f"[*] URL after submit: {url_after}")

            except Exception as e:
                print(f"[!] FB login error: {e}")
                browser.close(); return
        elif "ดำเนินการต่อ" in body or "Continue as" in body:
            print("[*] Already logged in as FB user — clicking Continue...")
            for sel in ["button:has-text('ดำเนินการต่อ')", "button:has-text('Continue')"]:
                try:
                    el = fb_page.locator(sel).first
                    if el.is_visible(timeout=3000):
                        el.click(); time.sleep(5); break
                except: pass

        # 7. Wait for 2FA page and handle it
        print("[*] Checking for 2FA page...")
        time.sleep(3)

        # Check all pages for 2FA
        two_fa_page = None
        for _ in range(6):  # Check for up to 30 more seconds
            for pg in context.pages:
                if "two_step_verification" in pg.url or "checkpoint" in pg.url:
                    two_fa_page = pg
                    break
            if two_fa_page: break
            time.sleep(5)
            print(f"[*] Pages: {[pg.url[:60] for pg in context.pages]}")

        if two_fa_page:
            print(f"[*] 2FA page found: {two_fa_page.url[:80]}")

            # Wait for OTP
            otp = wait_for_otp(timeout_seconds=300)
            if not otp:
                print("[!] No OTP received"); browser.close(); return

            success = enter_otp_on_page(two_fa_page, otp)
            print(f"[*] OTP entry result: {success}")
            time.sleep(5)
        else:
            print("[*] No 2FA page detected - may have skipped 2FA")

        # 8. Final check - go back to accounts center
        print("[*] Checking final accounts center state...")
        time.sleep(5)

        for i, pg in enumerate(context.pages):
            print(f"[*] Page {i}: {pg.url[:80]}")
            try: pg.screenshot(path=f"/tmp/v11_final_{i}.png")
            except: pass

        try:
            page.goto("https://accountscenter.instagram.com/manage/", wait_until="domcontentloaded")
            time.sleep(4)
            final_body = page.inner_text("body")
            page.screenshot(path="/tmp/v11_final_accounts.png")
            print(f"\n[*] Final Accounts Center:\n{final_body[:800]}")

            if "Facebook" in final_body:
                print("\n[SUCCESS] Facebook appears in Accounts Center!")
            else:
                print("\n[?] Facebook not yet visible in Accounts Center")
        except Exception as e:
            print(f"[!] Final check error: {e}")

        time.sleep(5)
        browser.close()
        print("[*] Done")

if __name__ == "__main__":
    main()
