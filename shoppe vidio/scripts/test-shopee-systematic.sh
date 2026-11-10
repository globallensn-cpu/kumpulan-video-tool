#!/bin/bash
# Systematic test of Shopee endpoints & regions
SHOPID=230520826
ITEMID=50307364546
UA_BROWSER="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
UA_APP="ShopeeID/2.99.20 (com.shopee.id; build=2.99.20; iOS 17.5.0) iOS/17.5.0 Apple/iPhone15_3"

test_url() {
  local name="$1"; local url="$2"; local ua="$3"
  local code=$(curl -s -m 15 -o /tmp/t.json -w "%{http_code}" "$url" -H "User-Agent: $ua" -H "Accept: application/json" -H "X-API-SOURCE: pc" -H "If-None-Match: ")
  local size=$(stat -c%s /tmp/t.json 2>/dev/null || echo 0)
  local err=$(head -c 200 /tmp/t.json | grep -o 'error[^,}]*' | head -1)
  echo "[$name] HTTP=$code size=$size $err"
}

echo "== Mobile app API hosts (ID) =="
test_url "mall.shopee.co.id/v4/item/get" "https://mall.shopee.co.id/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_APP"
test_url "shopee.co.id/v2/item/get" "https://shopee.co.id/api/v2/item/get?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_APP"
test_url "live.shopee.co.id" "https://live.shopee.co.id/api/v1/item/get?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_APP"

echo "== Region mall hosts =="
test_url "mall.sg" "https://mall.shopee.sg/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_APP"
test_url "mall.vn" "https://mall.shopee.vn/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_APP"
test_url "mall.th" "https://mall.shopee.co.th/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_APP"
test_url "mall.my" "https://mall.shopee.com.my/api/v4/item/get?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_APP"

echo "== PDP variants =="
test_url "pdp/get_pc itemid" "https://shopee.co.id/api/v4/pdp/get_pc?item_id=${ITEMID}&shop_id=${SHOPID}" "$UA_BROWSER"
test_url "v4/item/basic" "https://shopee.co.id/api/v4/item/basic?itemid=${ITEMID}&shopid=${SHOPID}" "$UA_BROWSER"

echo "== Test image CDN accessibility (down-id.img.susercontent.com) =="
curl -s -m 15 -o /dev/null -w "img CDN: HTTP %{http_code}\n" "https://down-id.img.susercontent.com/file/cdfaa49f5965d786e2cae19b4334d2f6" -H "User-Agent: $UA_BROWSER"
