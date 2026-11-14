// Workspaces keep independent layouts; storage seeds a fresh page.
export async function browserSpaces(page,check,prefix) {
  const paneIds = () => page.locator('.pane').evaluateAll(els=>els.map(e=>e.dataset.pane).join(','));
  await page.locator('.brand').click();
  const one=await paneIds();
  await page.keyboard.press('Alt+Shift+2');
  const two=await paneIds();
  check(`${prefix} workspace shortcut switches layout`,two!==one);
  await page.keyboard.press('Alt+t');
  const count=await page.locator('.tab').count();
  await page.keyboard.press('Alt+Shift+1');
  check(`${prefix} workspace one layout stays independent`,await paneIds()===one);
  await page.keyboard.press('Alt+Shift+2');
  check(`${prefix} workspace two keeps added tab`,await page.locator('.tab').count()===count);
  await page.waitForTimeout(700);
  await page.reload(); await page.waitForSelector('.pane');
  check(`${prefix} active workspace and layout survive reload`,await page.locator('.tab').count()===count && await paneIds()===two);
  await page.locator('.brand').click();
  await page.keyboard.press('Alt+Shift+1');
  check(`${prefix} return to original layout after reload`,await paneIds()===one);
  const chip=page.locator('.topbar .workspaces');
  if(await chip.isVisible()) {
    const boxes=await page.locator('.topbar').evaluate(el=>({brand:el.querySelector('.brand').getBoundingClientRect().right, status:el.querySelector('.status').getBoundingClientRect().right,chips:el.querySelector('.workspaces').getBoundingClientRect().left,search:el.querySelector('.palette-trigger').getBoundingClientRect().left,end:el.querySelector('.workspaces').getBoundingClientRect().right}));
    check(`${prefix} switcher sits after status before search`,boxes.chips>=boxes.status&&boxes.end<=boxes.search);
  }
  const current=await page.locator('.pane.focused .tab.active').getAttribute('data-tab');
  await page.keyboard.press('Control+Alt+Shift+4');
  check(`${prefix} move tab removes it from source`,await page.locator(`.tab[data-tab="${current}"]`).count()===0);
  await page.keyboard.press('Alt+Shift+4');
  check(`${prefix} moved tab retains identity in destination`,await page.locator(`.tab[data-tab="${current}"]`).count()===1);
  await page.keyboard.press('Alt+Shift+1');
}
