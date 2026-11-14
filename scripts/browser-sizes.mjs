import { navigateView, viewPath } from './browser-addresses.mjs';
// Every existing view must fit its tile, even when the window is wide.
export async function browserSizes(page, check, shot, fixture, url) {
  const choices = ['Home','Global','Notifications','Search','Compose','Relays','Accounts','Settings'];
  const open = async label => {
    await page.locator('.brand').click();
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog').getByRole('button',{name:label,exact:true}).first().click();
  };
  const extra = [
    ['Thread',{kind:'thread',id:fixture.root,relays:[]}],
    ['Profile',{kind:'profile',pubkey:fixture.events[0].pubkey}],
    ['Image',{kind:'image',url:'https://media.fixture.invalid/harbor.svg'}],
    ['Website',{kind:'link',url:'https://example.org/reading-notes'}],
    ['New tab',{kind:'launcher'}],
    ['Nothing here',{kind:'not_found'}],
  ];
  for (const [label,view] of [...choices.map(label=>[label,null]),...extra]) {
    if (view) {
      await navigateView(page, url, view);
      await page.waitForSelector('.pane.focused');
    } else await open(label);
    const pane = page.locator('.pane.focused');
    for (const width of [160,200,320,520,900,1400]) {
      await pane.evaluate((el,width)=> { el.style.cssText=`position:fixed;left:0;top:38px;width:${width}px;height:160px;z-index:15;flex:none`; },width);
      await page.waitForTimeout(40);
      const overflow = await pane.locator('.body.shown').evaluate(el=>[el,...el.querySelectorAll('*')].filter(node=>node.clientWidth>0 && !node.closest('.strip') && getComputedStyle(node).overflowX !== 'hidden' && getComputedStyle(node).overflowX !== 'clip' && node.scrollWidth>node.clientWidth+1).map(node=>`${node.tagName}.${node.className} ${node.scrollWidth}/${node.clientWidth}`));
      check(`${label} ${width}x160 has no horizontal overflow`,overflow.length===0,overflow.join('; '));
      if (label==='Global') {
        const fills = await pane.locator('.body.shown .feed').evaluate(feed => {
          const note=feed.querySelector('.note');
          if(!note)return false;
          const body=note.querySelector('.note-main');
          const text=body?.querySelector('.content');
          return Math.abs(note.getBoundingClientRect().width-feed.clientWidth)<2 && (!text || Math.abs(text.getBoundingClientRect().width-body.clientWidth)<2);
        });
        check(`Global ${width} text fills available tile measure`,fills);
      }
      const inactive = pane.locator('.tab:not(.active) .x').first();
      if (await inactive.count()) {
        await inactive.scrollIntoViewIfNeeded();
        check(`${label} ${width} inactive close remains visible`,await inactive.isVisible());
      }
      if (label==='Global' && width!==160) {
        await pane.evaluate(el=>el.style.height='640px');
        await shot(`size-${width}-global`);
        await pane.evaluate(el=>el.style.height='160px');
      }
    }
    await pane.evaluate(el=>el.style.cssText='');
  }
}
