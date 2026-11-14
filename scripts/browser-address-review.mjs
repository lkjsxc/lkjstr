// Address bar and history checks run with a fresh local-only browser context.
import { fakeRelay } from './browser-relay.mjs';
export async function browserAddressReview(browser,url,check) {
  const fake=fakeRelay();
  const context=await browser.newContext({viewport:{width:1440,height:900},locale:'en-US'});
  await context.routeWebSocket(/.*/,fake.route);
  await context.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
  const page=await context.newPage();
  const errors=[],logs=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>logs.push(m.text()));
  const open=async label=>{await page.locator('.brand').click();await page.keyboard.press('Control+k');await page.getByRole('dialog').getByRole('button',{name:label,exact:true}).first().click();};
  try {
    await page.goto(url+'#view=%7B%22kind%22%3A%22welcome%22%7D');await page.waitForSelector('.pane');
    check('old JSON hashes are ignored and removed',new URL(page.url()).hash===''&&await page.title()==='Global · lkjstr');
    check('default workspace view has root address',new URL(page.url()).pathname==='/');
    const length=await page.evaluate(()=>history.length);
    await open('Accounts');await open('Relays');await open('Settings');
    check('focus changes replace browser state without history noise',await page.evaluate(()=>history.length)===length);
    check('document title follows focused view',await page.title()==='Settings · lkjstr');
    await open('Search');
    const text=page.locator('.pane.focused .body.shown input[type=search]');
    await text.fill('日本語 and English');await text.press('Enter');
    await page.waitForFunction(()=>new URLSearchParams(location.search).get('q')==='日本語 and English');
    check('in-tab navigation pushes a clean search address',await page.evaluate(()=>history.length)===length+1&&new URL(page.url()).pathname==='/search');
    const before=page.url();
    await text.fill('nsec1private-test-marker');await text.press('Enter');
    await page.locator('.toast').filter({hasText:'Secret keys cannot be searched'}).waitFor();
    check('pasted secret never enters URL, error text or relay requests',page.url()===before&&!(await page.locator('.toast').innerText()).includes('nsec1')&&!JSON.stringify(fake.searches).includes('nsec1private-test-marker'));
    await page.waitForTimeout(700);
    const tabs=await page.locator('.tab').count();
    await page.goto(new URL('/global',url).href);await page.waitForSelector('.pane');
    check('opening an address preserves saved layout and adds a tab',await page.locator('.tab').count()===tabs+1);
    await page.goto(new URL('/unknown',url).href);
    await page.locator('.pane.focused .body.shown h2').filter({hasText:'Nothing here'}).waitFor();
    check('unknown address offers a way home',await page.locator('.pane.focused .body.shown').getByRole('button',{name:'Browse Global',exact:true}).isVisible());
    await page.evaluate(()=>{window.nostr={getPublicKey:()=>Promise.reject('nsec1private-test-marker')};});
    await open('Accounts');
    await page.locator('.pane.focused .body.shown').getByRole('button',{name:'Use signer extension',exact:true}).click();
    await page.locator('.pane.focused .body.shown [role=status]').filter({hasText:'The signer extension refused.'}).waitFor();
    check('signer exceptions never echo secret text into errors or logs',!(await page.locator('.pane.focused .body.shown').innerText()).includes('nsec1private-test-marker')&&!logs.some(s=>s.includes('nsec1private-test-marker'))&&!page.url().includes('nsec1'));
    check('address review has no page errors',errors.length===0);
  } finally {await context.close();}
}
