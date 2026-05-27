#!/usr/bin/env python3
"""
Playwright v12: Proper wait_for_url + 2FA OTP polling loop
- Uses wait_for_url to catch the 2FA redirect reliably
- Waits up to 5 minutes for OTP in /tmp/otp.txt
"""
import time, sys, os
from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout

IG_USER   = "aiboss.g2g"
IG_PASS   = "G2Gaiboss2026!"
FB_PHONE  = "0612391415"    # เบอร์โทรที่ใช้สมัคร FB
FB_EMAIL  = "thailandnogmo@gmail.com"
FB_PASS   = "i8n598u"       # password ที่ CEO ให้มา

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
    """Poll /tmp/otp.txt or cmd arg for OTP code."""
    otp_file = "/tmp/otp.txt"
    if os.path.exists(otp_file):
        os.remove(otp_file)

    print("\n" + "="*60)
    print("[!] FACEBOOK 2FA REQUIRED")
    print(f"    Account  : {FB_PHONE} (เบอร์โทร)")
    print(f"    SMS OTP จะส่งไปที่: {FB_PHONE}")
    print(f"    Write OTP: echo '123456' > {otp_file}")
    print("="*60)
    print(f"[*] Waiting up to {timeout_seconds}s for OTP...")

    start = time.time()
    while time.time() - start < timeout_seconds:
        if len(sys.argv) > 1:
            otp = sys.argv[1].strip()
            print(f"[*] OTP from arg: {otp}"); return otp
        if os.path.exists(otp_file):
            try:
                with open(otp_file) as f:
                    otp = f.read().strip()
                if otp and len(otp) >= 4:
                    os.remove(otp_file)
                    print(f"[*] OTP from file: {otp}"); return otp
            except: pass
        elapsed = int(time.time() - start)
        if elapsed % 30 == 0 and elapsed > 0:
            print(f"[*] Waiting... {elapsed}s elapsed, browser still open")
        time.sleep(3)
    return None

def enter_otp(page, otp):
    """Enter OTP on the 2FA page."""
    page.screenshot(path="/tmp/v12_2fa.png")
    print(f"[*] 2FA page: {page.url[:80]}")
    body = page.inner_text("body")
    print(f"[*] 2FA body: {body[:200]}")

    for sel in [
        'input[name="approvals_code"]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"]',
        'input[type="number"]',
        'input[maxlength="6"]',
        'input[name="code"]',
        '#approvals_code',
    ]:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=2000):
                print(f"[*] OTP input found: {sel}")
                el.fill(otp)
                time.sleep(0.5)
                # Try clicking Continue/Submit button too
                for btn_sel in ["button[type='submit']", "button:has-text('Continue')",
                                 "button:has-text('Submit')", "button:has-text('ยืนยัน')"]:
                    try:
                        btn = page.locator(btn_sel).first
                        if btn.is_visible(timeout=1000):
                            btn.click(); break
                    except: pass
                else:
                    el.press("Enter")
                time.sleep(6)
                page.screenshot(path="/tmp/v12_after_otp.png")
                print(f"[*] After OTP URL: {page.url[:80]}")
                # Handle save prompts
                for phrase in ["Don't Save", "Not now", "ไม่บันทึก", "ข้ามตอนนี้"]:
                    try:
                        btn = page.get_by_text(phrase).first
                        if btn.is_visible(timeout=2000): btn.click(); time.sleep(1)
                    except: pass
                return True
        except: pass

    # Fallback: find any visible non-button input
    print("[*] Fallback: scanning all inputs...")
    try:
        for inp in page.locator("input").all():
            try:
                if inp.is_visible(timeout=500):
                    t = (inp.get_attribute("type") or "").lower()
                    if t not in ["submit","button","checkbox","radio","hidden"]:
                        inp.fill(otp); time.sleep(0.5); inp.press("Enter")
                        time.sleep(6); return True
            except: pass
    except: pass
    return False

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False,
            args=["--disable-blink-features=AutomationControlled","--disable-popup-blocking"])
        context = browser.new_context(viewport={"width":1280,"height":900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        new_pages = []
        context.on("page", lambda pg: new_pages.append(pg))
        page = context.new_page()

        # 1. IG login
        print("[*] Instagram login...")
        if not login_instagram(page):
            print("[!] IG login failed"); browser.close(); return
        print(f"[*] IG logged in: {page.url}")

        # 2. Accounts Center
        page.goto("https://accountscenter.instagram.com/manage/", wait_until="networkidle", timeout=30000)
        time.sleep(3)
        if "login" in page.url:
            print("[!] IG session expired"); browser.close(); return

        # 3. Add accounts
        add_btn = None
        for sel in ["text=Add accounts", "text=เพิ่มบัญชี"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=2000): add_btn = el; break
            except: pass
        if not add_btn:
            print("[!] Add accounts button not found"); browser.close(); return
        add_btn.click(); time.sleep(2)

        # 4. Add Facebook account
        fb_clicked = False
        for sel in ["text=เพิ่มบัญชี Facebook", "text=Add Facebook account"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=3000):
                    el.click(); fb_clicked = True; break
            except: pass
        if not fb_clicked:
            print("[!] FB option not found"); browser.close(); return

        # 5. Find FB page
        print("[*] Waiting for Facebook page to load...")
        time.sleep(5)
        fb_page = None
        for attempt in range(10):
            pages_now = context.pages
            for pg in pages_now:
                if "facebook.com" in pg.url:
                    fb_page = pg; break
            if fb_page: break
            time.sleep(2)
            print(f"[*] Attempt {attempt+1}: pages={[pg.url[:50] for pg in pages_now]}")

        if not fb_page:
            # Sometimes FB loads in the same page after redirect
            if "facebook.com" in page.url:
                fb_page = page
            else:
                print("[!] No Facebook page found")
                page.screenshot(path="/tmp/v12_no_fb.png")
                browser.close(); return

        print(f"[*] FB page found: {fb_page.url[:80]}")
        time.sleep(2)

        # 6. Handle FB state
        body = fb_page.inner_text("body")
        print(f"[*] FB body: {body[:300]}")

        if "two_step_verification" in fb_page.url or "checkpoint" in fb_page.url:
            print("[*] Already at 2FA page!")
        elif "ดำเนินการต่อ" in body or "Continue as" in body:
            print("[*] 'Continue as' screen — clicking Continue...")
            for sel in ["button:has-text('ดำเนินการต่อ')", "button:has-text('Continue')"]:
                try:
                    el = fb_page.locator(sel).first
                    if el.is_visible(timeout=3000): el.click(); time.sleep(5); break
                except: pass
        elif "email" in body.lower() or "log in" in body.lower() or "เข้าสู่ระบบ" in body:
            print(f"[*] FB login form — filling phone {FB_PHONE}...")
            try:
                email_input = fb_page.locator('input[type="email"],input[name="email"],#email,input[type="text"]').first
                email_input.wait_for(state="visible", timeout=8000)
                email_input.fill(FB_PHONE)   # ใช้เบอร์โทร ไม่ใช่อีเมล
                pw = fb_page.locator('input[type="password"],input[name="pass"]').first
                pw.wait_for(state="visible", timeout=5000)
                pw.fill(FB_PASS)
                pw.press("Enter")
                print("[*] FB credentials submitted. Waiting for redirect (up to 20s)...")

                # Use wait_for_url to catch redirect to 2FA or success
                try:
                    fb_page.wait_for_url(
                        lambda url: ("two_step_verification" in url or
                                     "checkpoint" in url or
                                     "accountscenter" in url or
                                     "native_sso" in url or
                                     ("facebook.com" in url and "login/?app_id" not in url)),
                        timeout=20000
                    )
                    print(f"[*] Redirected to: {fb_page.url[:80]}")
                except PwTimeout:
                    print(f"[*] No redirect in 20s. Current URL: {fb_page.url[:80]}")

                # Always check body after submit regardless of URL
                fb_page.screenshot(path="/tmp/v12_fb_after_submit.png")
                body2 = fb_page.inner_text("body")
                print(f"[*] Body after submit: {body2[:400]}")

                # Handle "Continue as" screen (native_sso)
                if "ดำเนินการต่อ" in body2 or "Continue as" in body2 or "native_sso" in fb_page.url:
                    print("[*] 'Continue as' screen detected — clicking Continue...")
                    clicked = False
                    for sel in [
                        "button:has-text('ดำเนินการต่อในชื่อ')",
                        "button:has-text('ดำเนินการต่อ')",
                        "button:has-text('Continue as')",
                        "button:has-text('Continue')",
                        "[role='button']:has-text('ดำเนินการต่อ')",
                        "[role='button']:has-text('Continue')",
                    ]:
                        try:
                            el = fb_page.locator(sel).first
                            if el.is_visible(timeout=3000):
                                print(f"[*] Clicking: {sel}")
                                el.click()
                                time.sleep(6)
                                print(f"[*] After Continue URL: {fb_page.url[:80]}")
                                clicked = True
                                break
                        except: pass

                    if not clicked:
                        # Fallback: find first big blue button
                        print("[*] Fallback: click first visible button...")
                        btns = fb_page.locator("button").all()
                        for btn in btns:
                            try:
                                txt = btn.inner_text()
                                if ("ดำเนิน" in txt or "Continue" in txt) and "ไม่ใช่" not in txt and "Not" not in txt:
                                    print(f"[*] Clicking button: '{txt[:40]}'")
                                    btn.click(); time.sleep(6); clicked = True; break
                            except: pass

                    if clicked:
                        body3 = fb_page.inner_text("body")
                        print(f"[*] After Continue body: {body3[:300]}")

            except Exception as e:
                print(f"[!] FB login error: {e}")
                browser.close(); return

        # 7. Detect 2FA page (check all pages)
        print("[*] Scanning for 2FA page across all browser tabs...")
        two_fa_page = None
        for _ in range(12):  # Poll for 60 seconds
            for pg in context.pages:
                if "two_step_verification" in pg.url or "checkpoint" in pg.url:
                    two_fa_page = pg; break
            if two_fa_page:
                print(f"[*] 2FA page: {two_fa_page.url[:80]}")
                break
            time.sleep(5)
            print(f"[*] Pages: {[pg.url[:60] for pg in context.pages]}")

        if two_fa_page:
            otp = wait_for_otp(timeout_seconds=300)
            if not otp:
                print("[!] No OTP received"); browser.close(); return
            success = enter_otp(two_fa_page, otp)
            print(f"[*] OTP entry: {'SUCCESS' if success else 'FAILED'}")
            time.sleep(8)
        else:
            print("[*] No 2FA page found — checking if already linked...")

        # 8. Final verification
        print("\n[*] Final Accounts Center check...")
        for i, pg in enumerate(context.pages):
            print(f"[*] Page {i}: {pg.url[:80]}")
            try: pg.screenshot(path=f"/tmp/v12_final_{i}.png")
            except: pass

        try:
            page.goto("https://accountscenter.instagram.com/manage/", wait_until="domcontentloaded", timeout=15000)
            time.sleep(4)
            body = page.inner_text("body")
            page.screenshot(path="/tmp/v12_accounts_center.png")
            print(f"\n[*] Accounts Center body:\n{body[:800]}")

            # Check for actual FB account in Manage section (not just description text)
            lines = [l.strip() for l in body.split('\n') if l.strip()]
            # Look for "Facebook" + "Manage" section (linked accounts have a Manage button)
            manage_idx = [i for i, l in enumerate(lines) if l == "Manage"]
            fb_linked = False
            for idx in manage_idx:
                # Check surrounding lines for Facebook
                context_lines = lines[max(0,idx-3):idx+3]
                if any("facebook" in l.lower() or "AI Boss" in l or "Ai Boss" in l for l in context_lines):
                    fb_linked = True
                    break

            if fb_linked:
                print("\n✅ [SUCCESS] Facebook account IS linked in Accounts Center!")
            else:
                # Show the manage sections to debug
                print(f"\n❌ Facebook NOT linked yet")
                print(f"[*] Manage items found: {[lines[max(0,i-2):i+2] for i in manage_idx]}")
        except Exception as e:
            print(f"[!] Final check error: {e}")

        time.sleep(5)
        browser.close()
        print("[*] Done")

if __name__ == "__main__":
    main()
