// These keys exist only in this owned browser and the fixture is restricted to loopback.
export const privateMarker = 'Owned private cache fixture';
const fixturePassword = 'owned cache fixture password';
export async function privateAct(page, action) {
  const okay = await page.evaluate(async value => Boolean((await window.dmUiAct(value)).ok), action);
  if (!okay) throw Error('Owned private fixture action failed');
}
export async function setupPrivateReader(page, relayUrl) {
  const account = async name => {
    await privateAct(page, { a: 'account.add', how: 'create' });
    const pubkey = await page.evaluate(() => window.dmUi.accounts.active);
    if (!/^[0-9a-f]{64}$/.test(pubkey ?? '')) throw Error('Owned fixture public identity missing');
    await privateAct(page, { a: 'profile.save', as: pubkey, profile: { name, about: '' } });
    await privateAct(page, { a: 'dm.relays.save', as: pubkey, relays: [relayUrl] });
    return pubkey;
  };
  const owner = await account('Private cache owner'), peer = await account('Private cache peer');
  await privateAct(page, { a: 'account.use', pubkey: owner });
  await privateAct(page, { a: 'dm.send', as: peer, draft: { recipients: [owner], text: privateMarker } });
  for (const pubkey of [owner, peer]) {
    const okay = await page.evaluate(async ({ pubkey, password }) => {
      const backup = await window.dmUiAct({ a: 'account.exportEncrypted', pubkey, password, logN: 16 });
      if (!backup.ok || !backup.encryptedKey) return false;
      const restored = await window.dmUiAct({ a: 'account.importEncrypted', key: backup.encryptedKey, password });
      backup.encryptedKey = undefined;
      return Boolean(restored.ok);
    }, { pubkey, password: fixturePassword });
    if (!okay) throw Error('Owned private key protection failed');
  }
  await privateAct(page, { a: 'account.use', pubkey: owner });
  await page.keyboard.press('Alt+Shift+M');
  await page.waitForFunction(marker => [...document.querySelectorAll('.view[data-kind="messages"] .chan')]
    .some(row => row.getClientRects().length && row.textContent.includes(marker)), privateMarker);
  return { owner, peer };
}
export async function openPrivateConversation(page) {
  return page.evaluate(marker => {
    const row = [...document.querySelectorAll('.view[data-kind="messages"] .chan')]
      .find(row => row.getClientRects().length && row.textContent.includes(marker));
    if (!row) return false;
    window.__privateCacheProbe.begin('message', marker); row.click(); return true;
  }, privateMarker);
}
export async function closePrivateConversation(page) {
  return page.evaluate(marker => {
    const button = document.querySelector('.pane.cur .tab.active > .x');
    if (!button) return false;
    window.__privateCacheProbe.begin('messages', marker); button.click(); return true;
  }, privateMarker);
}
export async function unlockPrivateReader(page, owner) {
  return page.evaluate(async ({ owner, password, marker }) => {
    const result = await window.dmUiAct({ a: 'account.unlock', pubkey: owner, password });
    if (!result.ok) return false;
    // The clock starts at unlock acknowledgement; it excludes password derivation.
    window.__privateCacheProbe.begin('message', marker);
    return true;
  }, { owner, password: fixturePassword, marker: privateMarker });
}
export async function privateLocked(page, owner) {
  return page.evaluate(({ owner, marker }) => ({
    locked: window.dmUi?.accounts?.accounts.find(account => account.author.pubkey === owner)?.locked === true,
    plaintextVisible: [...document.querySelectorAll('.view')]
      .some(view => view.getClientRects().length && view.textContent.includes(marker)),
  }), { owner, marker: privateMarker });
}

export async function privateKeysProtected(page, pubkeys) {
  return page.evaluate(pubkeys => new Promise((resolve, reject) => {
    const open = indexedDB.open('lkjstr-wasm'); open.onerror = () => reject(Error('Owned account inspection failed'));
    open.onsuccess = () => {
      const db = open.result, request = db.transaction('kv').objectStore('kv').get('engine-accounts');
      request.onerror = () => { db.close(); reject(Error('Owned account read failed')); };
      request.onsuccess = () => {
        let entries; try { entries = JSON.parse(request.result).entries; } catch { entries = []; }
        const accounts = entries.filter(account => pubkeys.includes(account.pubkey));
        const okay = accounts.length === pubkeys.length && accounts.every(account => !account.secret &&
          typeof account.encrypted_key === 'string' && account.encrypted_key.length > 0);
        db.close(); resolve(okay);
      };
    };
  }), pubkeys);
}
