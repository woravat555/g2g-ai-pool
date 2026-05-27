#!/usr/bin/env python3
"""
Playwright v10: Handle 2FA for thailandnogmo@gmail.com
- After FB login, if 2FA page appears, print instructions and wait for OTP input
- Enter OTP, continue flow
"""
import time, sys
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

def handle_2fa(page):
    """Handle Facebook 2FA page - prompt user for code."""
    body = page.inner_text("body")
    print(f"[*] 2FA page body: {body[:600]}")
    page.screenshot(path="/tmp/v10_2fa.png")
    
    print("\n" + "="*60)
    print("[!] FACEBOOK 2FA REQUIRED")
    print(f"    Account: {FB_EMAIL}")
    print("    Check SMS, Authenticator App, or Email for code")
    print("="*60)
    
    # Try to read OTP from stdin or a file
    # Check if code was passed as argument
    otp = None
    if len(sys.argv) > 1:
        otp = sys.argv[1].strip()
        print(f"[*] Using OTP from argument: {otp}")
    else:
        # Try reading from /tmp/otp.txt
        try:
            with open("/tmp/otp.txt") as f:
                otp = f.read().strip()
            print(f"[*] Read OTP from /tmp/otp.txt: {otp}")
        except:
            print("[!] No OTP provided. Write code to /tmp/otp.txt and restart script")
            print("[!] Or run: python3 ig_link_v10.py <OTP_CODE>")
            return False
    
    if not otp:
        print("[!] OTP is empty")
        return False
    
    # Try to find code input field
    for sel in [
        'input[name="approvals_code"]',
        'input[name="otp"]',
        'input[type="number"]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"]',
        'input[maxlength="6"]',
        '#approvals_code',
    ]:
        try:
            el = page.locator(sel).first
            if el.is_visible(timeout=2000):
                print(f"[*] Found OTP input with: {sel}")
                el.fill(otp)
                time.sleep(0.5)
                el.press("Enter")
                time.sleep(5)
                print(f"[*] URL after OTP: {page.url}")
                page.screenshot(path="/tmp/v10_after_otp.png")
                
                # Handle "Save browser" / "Don't save" prompts
                body2 = page.inner_text("body")
                print(f"[*] After OTP body: {body2[:400]}")
                for dont_save in ["Don't Save", "Not now", "ไม่บันทึก", "ข้ามตอนนี้"]:
                    try:
                        btn = page.get_by_text(dont_save).first
                        if btn.is_visible(timeout=2000): btn.click(); time.sleep(1)
                    except: pass
                return True
        except: pass
    
    # Fallback: try clicking into any input and typing
    print("[*] Trying generic input approach...")
    try:
        inputs = page.locator("input").all()
        for inp in inputs:
            try:
                if inp.is_visible(timeout=1000):
                    inp_type = inp.get_attribute("type") or ""
                    if inp_type not in ["submit", "button", "checkbox", "radio"]:
                        inp.fill(otp)
                        time.sleep(0.5)
                        inp.press("Enter")
                        time.sleep(5)
                        print(f"[*] URL after OTP attempt: {page.url}")
                        return True
            except: pass
    except: pass
    
    return False

def handle_facebook_flow(page):
    """Handle all Facebook states: login, 2FA, Continue as."""
    url = page.url
    print(f"[*] FB page: {url}")
    time.sleep(2)
    body = page.inner_text("body")
    print(f"[*] Body: {body[:400]}")

    # 2FA
    if "two_step_verification" in url or "checkpoint" in url:
        print("[*] 2FA/checkpoint detected")
        return handle_2fa(page)

    # "Continue as" screen
    if "ดำเนินการต่อในชื่อ" in body or "Continue as" in body:
        print("[*] 'Continue as' screen!")
        for sel in ["button:has-text('ดำเนินการต่อ')", "button:has-text('Continue')", "[role='button']:has-text('Continue')"]:
            try:
                el = page.locator(sel).first
                if el.is_visible(timeout=3000):
                    el.click(); time.sleep(5); return True
            except: pass

    # Login form
    if "email" in body.lower() or "log in" in body.lower() or "เข้าสู่ระบบ" in body:
        print(f"[*] Login form detected. Filling {FB_EMAIL}...")
        try:
            email_input = page.locator('input[type="email"], input[name="email"], input[id="email"]').first
            email_input.wait_for(state="visible", timeout=8000)
            email_input.fill(FB_EMAIL)
            pw_input = page.locator('input[type="password"], input[name="pass"]').first
            pw_input.wait_for(state="visible", timeout=5000)
            pw_input.fill(FB_PASS)
            pw_input.press("Enter")
            time.sleep(8)
            
            url2 = page.url
            body2 = page.inner_text("body")
            print(f"[*] After login URL: {url2}")
            print(f"[*] After login body: {body2[:300]}")
            
            if "two_step_verification" in url2 or "checkpoint" in url2:
                return handle_2fa(page)
            if "ดำเนินการต่อ" in body2 or "Continue as" in body2:
                return handle_facebook_flow(page)
            if "incorrect" in body2.lower() or "wrong" in body2.lower():
                print("[!] Wrong FB credentials")
                return False
            return True
        except Exception as e:
            print(f"[!] Login error: {e}")
            return False
    
    return False

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False,
            args=["--disable-blink-features=AutomationControlled", "--disable-popup-blocking"])
        context = browser.new_context(viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        new_pages = []
        context.on("page", lambda p: new_pages.append(p))
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
        time.sleep(4)
        fb_page = None
        if "facebook.com" in page.url:
            fb_page = page
        else:
            for pg in context.pages:
                if "facebook.com" in pg.url: fb_page = pg; break
        if not fb_page:
            print("[!] No FB page found"); browser.close(); return

        # 6. Handle FB flow (login + 2FA)
        success = handle_facebook_flow(fb_page)
        print(f"[*] FB flow result: {success}")

        # 7. After 2FA - wait a bit then check if link completes
        if success:
            time.sleep(5)
            # Check all pages
            for i, pg in enumerate(context.pages):
                print(f"[*] Page {i}: {pg.url}")
                try: pg.screenshot(path=f"/tmp/v10_final_{i}.png")
                except: pass
            
            # Go back to accounts center
            try:
                page.goto("https://accountscenter.instagram.com/manage/", wait_until="domcontentloaded")
                time.sleep(3)
                body = page.inner_text("body")
                page.screenshot(path="/tmp/v10_final_accounts.png")
                print(f"[*] Final Accounts Center:\n{body[:600]}")
            except Exception as e:
                print(f"[!] Final check error: {e}")

        time.sleep(5)
        browser.close()
        print("[*] Done")

if __name__ == "__main__":
    main()
