#!/bin/bash
# Test Shopee API endpoints for video extraction research
# Usage: bash test-shopee-api.sh <shopid> <itemid>

SHOPID=${1:-373179248}
ITEMID=${2:-28063825307}

UA_BROWSER="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
UA_MOBILE="Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"

echo "===== TEST 1: api/v4/item/get (desktop UA) ====="
curl -s -m 20 "https://shopee.co.id/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" \
  -H "User-Agent: ${UA_BROWSER}" \
  -H "Accept: application/json" \
  -H "Referer: https://shopee.co.id/" \
  -H "X-API-SOURCE: pc" \
  -H "X-Shopee-Client: ver=1" \
  -o /tmp/shopee_test1.json -w "HTTP %{http_code}, size %{size_download}\n"
head -c 500 /tmp/shopee_test1.json; echo; echo

echo "===== TEST 2: api/v4/pdp/get_pc (desktop UA) ====="
curl -s -m 20 "https://shopee.co.id/api/v4/pdp/get_pc?item_id=${ITEMID}&shop_id=${SHOPID}&detail_level=0" \
  -H "User-Agent: ${UA_BROWSER}" \
  -H "Accept: application/json" \
  -H "Referer: https://shopee.co.id/" \
  -H "X-API-SOURCE: pc" \
  -o /tmp/shopee_test2.json -w "HTTP %{http_code}, size %{size_download}\n"
head -c 500 /tmp/shopee_test2.json; echo; echo

echo "===== TEST 3: item page HTML (mobile UA, look for video) ====="
curl -s -m 20 -L "https://shopee.co.id/test-i.${SHOPID}.${ITEMID}" \
  -H "User-Agent: ${UA_MOBILE}" \
  -H "Accept: text/html" \
  -o /tmp/shopee_test3.html -w "HTTP %{http_code}, size %{size_download}\n"
grep -o 'video[^"]*url[^"]*"' /tmp/shopee_test3.html | head -5
grep -o 'https://vod[^"]*' /tmp/shopee_test3.html | head -5
echo

echo "===== TEST 4: non-Indo region check (shopee.sg) ====="
curl -s -m 20 "https://shopee.sg/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" \
  -H "User-Agent: ${UA_BROWSER}" \
  -o /tmp/shopee_test4.json -w "HTTP %{http_code}, size %{size_download}\n"
head -c 300 /tmp/shopee_test4.json; echo
