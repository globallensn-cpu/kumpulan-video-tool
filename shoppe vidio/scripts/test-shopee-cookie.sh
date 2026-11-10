#!/bin/bash
# Advanced test: cookie session approach + verify video CDN access
UA_TELEGRAM="TelegramBot (like TwitterBot)"
UA_BROWSER="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
PROD_URL="https://shopee.co.id/2500-super-video-konten-affiliate-plus-link-produk-i.230520826.50307364546"
SHOPID=230520826
ITEMID=50307364546

echo "== 1. Get cookies from homepage (with Telegram UA) =="
curl -s -m 20 -c /tmp/ck.txt "https://shopee.co.id/" -H "User-Agent: ${UA_TELEGRAM}" -o /dev/null -w "HTTP %{http_code}\n"
grep -c . /tmp/ck.txt && echo "cookies saved"

echo "== 2. Product page WITH cookies =="
curl -s -m 20 -b /tmp/ck.txt -c /tmp/ck.txt "${PROD_URL}" -H "User-Agent: ${UA_TELEGRAM}" -H "Accept: text/html" -o /tmp/prod2.html -w "HTTP %{http_code}, size %{size_download}\n"
grep -o '<title[^>]*>[^<]*</title>' /tmp/prod2.html | head -1

echo "== 3. API v4/item/get WITH cookies + referer =="
curl -s -m 20 -b /tmp/ck.txt "https://shopee.co.id/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" -H "User-Agent: ${UA_TELEGRAM}" -H "Referer: ${PROD_URL}" -H "X-API-SOURCE: pc" -o /tmp/api2.json -w "HTTP %{http_code}, size %{size_download}\n"
head -c 300 /tmp/api2.json; echo

echo "== 4. Video CDN accessibility test =="
for host in video.v.shopee.vn hd.v.shopee.vn vod.v.shopee.sg depot.v.shopee.sg video.dr.shopee.vn; do
  code=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "https://${host}/" -H "User-Agent: ${UA_BROWSER}")
  echo "  ${host} -> HTTP ${code}"
done

echo "== 5. s.shopee.co.id short link resolve test =="
curl -s -m 15 -I -L "https://s.shopee.co.id/" -H "User-Agent: ${UA_BROWSER}" -o /dev/null -w "HTTP %{http_code}, final: %{url_effective}\n" 2>&1 | tail -1
