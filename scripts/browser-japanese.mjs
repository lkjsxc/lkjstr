// Japanese-browser review, using the same signed mixed-language fake relay.
import { fakeRelay } from './browser-relay.mjs';
import { navigateView } from './browser-addresses.mjs';
export async function browserJapanese(browser,url,data,check,shotFor,routeMedia) {
  const labels={Home:'ホーム',Global:'グローバル',Notifications:'通知',Search:'検索',Compose:'投稿',Relays:'リレー',Accounts:'アカウント',Settings:'設定'};
  for (const [size,viewport] of [['desktop',{width:1440,height:900}],['phone',{width:390,height:844}]]) {
    for (const theme of ['light','dark']) {
      const fake=fakeRelay(); data.events.forEach(e=>fake.add(e));
      const context=await browser.newContext({viewport,colorScheme:theme,locale:'ja-JP'});
      await context.routeWebSocket(/.*/,fake.route);
      await context.route('**/*',routeMedia);
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(String(e)));
      const shot=name=>shotFor(page,`${size}-${theme}-japanese-${name}`);
      const open=async name=>{await page.locator('.brand').click();await page.keyboard.press('Control+k');await page.getByRole('dialog').getByRole('button',{name:labels[name],exact:true}).first().click();};
      try {
        await page.goto(url);await page.waitForSelector('.pane');
        await page.locator('.pane.focused .body.shown .note').first().waitFor();
        check(`${size} ${theme} Japanese first run opens real Global without Welcome`,await page.locator('html').getAttribute('lang')==='ja' && !(await page.locator('.tab').allTextContents()).some(s=>/Welcome|ようこそ/.test(s)));
        await shot('first-run');
        for(const name of Object.keys(labels)) {
          await open(name);
          await shot(name.toLowerCase());
          await page.keyboard.press('Tab');
          check(`${size} ${theme} Japanese ${name} keyboard target is named`,await page.evaluate(()=>{const e=document.activeElement;return e!==document.body&&!!(e.getAttribute('aria-label')||e.textContent?.trim()||e.getAttribute('title'));}));
          const body=await page.locator('.pane.focused .body.shown').innerText();
          check(`${size} ${theme} Japanese ${name} has no old English labels`,!/Open Accounts|Your relay list|What's happening\?|No account yet|To post,|Post\b|Content warning/.test(body));
          check(`${size} ${theme} ${name} clean focused address`,!/%7B|#view|\./i.test(new URL(page.url()).pathname)&&(!new URL(page.url()).search||new URL(page.url()).pathname==='/search'));
        }
        for(const [name,view] of [['thread',{kind:'thread',id:data.root}],['profile',{kind:'profile',pubkey:data.events[0].pubkey}],['image',{kind:'image',url:'https://media.fixture.invalid/harbor.svg'}],['website',{kind:'link',url:'https://example.org/reading-notes'}],['nothing-here',{kind:'not_found'}],['launcher',{kind:'launcher'}]]) {
          await navigateView(page,url,view);await page.waitForSelector('.pane.focused');await shot(name);
        }
        await page.keyboard.press('Control+k');await shot('palette');await page.keyboard.press('Escape');
        await page.locator('.brand').click();await page.keyboard.press('?');await shot('shortcuts');await page.keyboard.press('Escape');
        if(size==='phone')await page.getByRole('button',{name:'その他',exact:true}).click();else await page.locator('.topbar .account').click();
        await shot('account-menu');await page.keyboard.press('Escape');
        // Keyboard access, zoom and reduced motion use the actual focused tile.
        await open('Settings');
        await page.keyboard.press('Tab');
        check(`${size} ${theme} keyboard focus remains visible`,await page.evaluate(()=>document.activeElement!==document.body));
        await page.locator('.brand').click();await page.keyboard.press('Alt+Enter');
        check(`${size} ${theme} Alt Enter zooms focused tile`,await page.locator('.pane.zoomed').count()===1);
        await page.keyboard.press('Alt+Enter');
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.evaluate(()=>document.documentElement.style.zoom='2');
        check(`${size} ${theme} 200 percent settings has no sideways overflow`,await page.locator('.pane.focused .body.shown').evaluate(el=>el.scrollWidth<=el.clientWidth+1) && await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
        await shot('settings-200pct');
        check(`${size} ${theme} Japanese review has no page errors`,errors.length===0);
      } finally {await context.close();}
    }
  }
}
