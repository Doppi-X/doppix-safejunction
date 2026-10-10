import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright
HERE = Path(__file__).resolve().parent
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel="chrome")
        pg = await b.new_page(viewport={"width": 1280, "height": 720})
        await pg.goto((HERE / "deck.html").as_uri(), wait_until="networkidle")
        await pg.wait_for_timeout(1500)
        await pg.pdf(path=str(HERE / "DoppiX_SafeJunction_deck.pdf"), width="1280px", height="720px", print_background=True)
        n = await pg.evaluate("document.querySelectorAll('section.s').length")
        (HERE / "png").mkdir(exist_ok=True)
        for i in range(n):
            el = pg.locator("section.s").nth(i)
            await el.screenshot(path=str(HERE / "png" / f"s{i+1:02d}.png"))
        # overflow check: any element whose right/bottom exceeds its slide
        bad = await pg.evaluate("""[...document.querySelectorAll('section.s')].map((s,i)=>{const r=s.getBoundingClientRect();
          const o=[...s.querySelectorAll('*')].filter(e=>{const q=e.getBoundingClientRect();return q.width>0&&(q.right>r.right+1||q.bottom>r.bottom+1)}).map(e=>e.tagName+':'+(e.textContent||'').slice(0,30));
          return o.length?[i+1,o.slice(0,3)]:null}).filter(Boolean)""")
        print("slides", n, "overflow", bad)
        await b.close()
asyncio.run(main())
