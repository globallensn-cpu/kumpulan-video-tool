#!/bin/bash
# Test 2: try crawler user-agents and find a real Shopee product with video
UA_FB="facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
UA_GBOT="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
UA_TELEGRAM="TelegramBot (like TwitterBot)"

# A real popular Shopee product URL with video (from search results)
URL="https://shopee.co.id/XY-Items-Watch-i.102758533.24235893597"

for ua_name in FB GBOT TGRAM; do
  eval "UA=\$UA_$ua_name"
  echo "===== UA: $ua_name ====="
  curl -s -m 25 -L "https://shopee.co.id/product/102758533/24235893597" \
    -H "User-Agent: ${UA}" \
    -H "Accept: text/html,application/xhtml+xml" \
    -o "/tmp/shopee_ua_${ua_name}.html" -w "HTTP %{http_code}, size %{size_download}\n"
  grep -o 'og:image[^>]*content="[^"]*"' "/tmp/shopee_ua_${ua_name}.html" | head -2
  grep -o '"itemid":"[0-9]*"' "/tmp/shopee_ua_${ua_name}.html" | head -2
  grep -o 'videoInfo\|video_url\|BRM4tRr1WeWQ8\|error_notification' "/tmp/shopee_ua_${ua_name}.html" | sort | uniq -c | head
  echo
done
