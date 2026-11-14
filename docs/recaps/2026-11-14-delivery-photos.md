# Delivery photos kept on R2, recap, 2026-11-14

Written in step 2, unfinished: the signer and the platform's own words are here; what shipped is not yet known.

## The platform's own words, read 2026-11-14

Cloudflare's page on signed addresses (https://developers.cloudflare.com/r2/api/s3/presigned-urls/):

- "Presigned URLs are generated server-side with no communication with R2": signing opens no connection, so the back end's closed network does not stop it.
- Region: "Required by SDK but not used by R2".
- Expiry: "Timeout from 1 second to 7 days (604,800 seconds)".
- A signed type is enforced: "The signature will include this header, so uploads will fail with a" `403/SignatureDoesNotMatch` error if the client sends a different value.
- Presigned URLs "cannot be used with custom domains".
- Not found on the page: whether a body length different from a signed one is refused (the page never mentions content length), and a general rule for path-style against bucket-in-the-host addresses; it says "Generate URLs using that endpoint and path-style addressing" only for local development. Step 6's probe on the real bucket decides both; if a longer body is accepted, a larger picture is bounded only by one object a request and five minutes.

The page on the cross-origin rule (https://developers.cloudflare.com/r2/buckets/cors/): "Without a CORS policy, browser-based uploads and downloads using presigned URLs will fail". Its example rule allows one origin, the method PUT, the header `Content-Type`. Dashboard path: R2 object storage, the bucket, Settings, under CORS Policy select Add CORS policy, the JSON tab, Save.

The page on object lifecycles (https://developers.cloudflare.com/r2/buckets/object-lifecycles/): "you can create an object lifecycle rule to delete objects after 90 days." Dashboard path: the bucket, Settings, under Object Lifecycle Rules, Add rule, Save changes. Not used by this piece (open item 267).

The price (https://developers.cloudflare.com/r2/pricing/): storage "$0.015 / GB-month", Class A "$4.50 / million requests", Class B "$0.36 / million requests", free tier "10 GB-month / month", egress "Free". No minimum monthly charge on the page.

AWS's published example of a signed address: the page (https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html) returned 9 characters ("Amazon S3") to every fetch, its `.md` form and the China mirror the same, and a raw copy on GitHub was a 404. The example's address and signature were read from a web search result that quotes the page; the signer reproduces that signature exactly with the documented example key, which is the check that the quotation is whole.

## Still to write

What shipped, the review's findings, what stays the human's.
