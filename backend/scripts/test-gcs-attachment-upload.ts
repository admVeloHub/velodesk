/** test-gcs-attachment-upload.ts v1.1.0 — smoke test flat no prefixo inbound */
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { loadEmailTransport, isEmailTransportReady } from '../src/services/emailTransport.service';
import {
  uploadInboundAttachmentToGcs,
  readInboundAttachmentFromGcs,
} from '../src/services/gcsAttachmentStorage.service';
import { env } from '../src/config/env';

async function main() {
  console.log('bucket:', env.gcpStorageBucket);
  console.log('prefix inbound:', env.gcpStorageInboundAttachmentsPrefix);
  console.log('prefix sent:', env.gcpStorageSentAttachmentsPrefix);

  await connectDatabase();
  await loadEmailTransport();
  console.log('transport ready:', isEmailTransportReady());

  const key = `verify-upload-${Date.now()}.txt`;
  const buf = Buffer.from(`teste velodesk anexo ${Date.now()}`);
  const ok = await uploadInboundAttachmentToGcs(key, buf, 'text/plain');
  console.log('upload result:', ok);

  const read = await readInboundAttachmentFromGcs(key);
  console.log('read result:', read ? 'ok' : 'null');

  await disconnectDatabase();
  if (!ok || !read) process.exit(1);
}

main().catch((err) => {
  console.error('ERR', err);
  process.exit(1);
});
