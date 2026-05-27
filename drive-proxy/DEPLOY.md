# G2G Drive Proxy — Deploy Instructions

## One-time setup (5 minutes):

1. Go to https://script.google.com
2. Click "New project"
3. Name it: "G2G Drive Proxy"
4. Delete default code, paste contents of Code.gs
5. Click Deploy → New deployment
6. Type: Web app
7. Execute as: Me (woravat.a@gmail.com)
8. Who has access: Anyone
9. Click Deploy → Copy the Web App URL
10. Run this command:
    fly secrets set DRIVE_PROXY_URL=<paste URL here> DRIVE_PROXY_SECRET=g2g-drive-2026 --app g2g-ai-pool

That's it! Drive integration is active.
