// Every existing view must fit its tile, even when the window is wide.
export async function browserSizes(page, check, shot, fixture, url) {
  const choices = ['Home','Global','Notifications','Search','Compose','Relays','Accounts','Settings','Welcome'];
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
  ];
  for (const [label,view] of [...choices.map(label=>[label,null]),...extra]) {
    if (view) {
      await page.goto(url+'#view='+encodeURIComponent(JSON.stringify(view)));
      await page.waitForSelector('.pane.focused');
    } else await open(label);
    const pane = page.locator('.pane.focused');
    for (const width of [160,200,320,520,900]) {
      await pane.evaluate((el,width)=> { el.style.cssText=`position:fixed;left:0;top:38px;width:${width}px;height:160px;z-index:15;flex:none`; },width);
      await page.waitForTimeout(40);
      const overflow = await pane.locator('.body.shown').evaluate(el=>[el,...el.querySelectorAll('*')].filter(node=>node.clientWidth>0 && !node.closest('.strip') && getComputedStyle(node).overflowX !== 'hidden' && getComputedStyle(node).overflowX !== 'clip' && node.scrollWidth>node.clientWidth+1).map(node=>`${node.tagName}.${node.className} ${node.scrollWidth}/${node.clientWidth}`));
      check(`${label} ${width}x160 has no horizontal overflow`,overflow.length===0,overflow.join('; '));
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
