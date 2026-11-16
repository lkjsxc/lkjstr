import { readFileSync } from 'node:fs';

const [kind, path, archive, index, expectedBefore = ''] = process.argv.slice(2);
try {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  const health = kind === 'deploy' ? value.health : value;
  if (!health || health.edge_https_content_headers_spa_compression !== true ||
      health.external_dns_tls_browser_verified !== false || health.served_index_sha256 !== index) {
    throw new Error('the exact served index was not verified');
  }
  if (kind === 'deploy') {
    if (value.action !== 'deploy' || value.status !== 'passed' || value.archive_sha256 !== archive ||
        !/^[a-f0-9]{32}$/.test(value.after ?? '') ||
        (expectedBefore && value.before !== expectedBefore)) {
      throw new Error('the deployment receipt does not identify the tested release');
    }
    process.stdout.write(`${value.after}\n`);
  } else if (kind !== 'verify') {
    throw new Error('unknown receipt kind');
  }
} catch (error) {
  // Never echo file contents or a remote exception; receipts can be inspected locally.
  process.stderr.write(`ship receipt rejected: ${error instanceof SyntaxError ? 'invalid JSON' : error.message}\n`);
  process.exitCode = 1;
}
