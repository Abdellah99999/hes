const http = require('http');

const storage = new Map();

const listBucketsXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListAllMyBucketsResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Buckets>
    <Bucket>
      <Name>hes-documents</Name>
      <CreationDate>2026-01-01T00:00:00.000Z</CreationDate>
    </Bucket>
    <Bucket>
      <Name>hes-proof-of-delivery</Name>
      <CreationDate>2026-01-01T00:00:00.000Z</CreationDate>
    </Bucket>
  </Buckets>
  <Owner>
    <ID>hes_minio_admin</ID>
    <DisplayName>hes_minio_admin</DisplayName>
  </Owner>
</ListAllMyBucketsResult>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/xml' });
    res.end(listBucketsXml);
    return;
  }

  if (req.method === 'HEAD' && (url.pathname === '/hes-documents' || url.pathname === '/hes-proof-of-delivery')) {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'PUT') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      storage.set(url.pathname, { body, headers: req.headers });
      res.writeHead(200, { 'ETag': '"mock-etag-12345"' });
      res.end();
    });
    return;
  }

  if (req.method === 'GET') {
    const item = storage.get(url.pathname);
    if (item) {
      res.writeHead(200, { 'Content-Type': item.headers['content-type'] || 'application/octet-stream' });
      res.end(item.body);
    } else {
      res.writeHead(404);
      res.end('<Error><Code>NoSuchKey</Code></Error>');
    }
    return;
  }

  res.writeHead(200);
  res.end();
});

server.listen(9000, '0.0.0.0', () => {
  console.log('S3 / MinIO Mock server running on port 9000');
});
