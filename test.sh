#!/data/data/com.termux/files/usr/bin/bash

if [ ! -f proxies.txt ]; then
 echo "ERROR: proxies.txt not found!"
 exit 1
fi

touch working.txt dead.txt
> working.txt
> dead.txt

total=$(grep -cve '^[[:space:]]*$' proxies.txt)
count=0

while IFS= read -r proxy; do
 [[ -z "$proxy" ]] && continue
 count=$((count+1))

 echo "[$count/$total] Testing $proxy"

 if curl -sS -o /dev/null \
 --connect-timeout 5 --max-time 10 \
 --socks5-hostname "$proxy" \
 -w "%{http_code}" https://api.ipify.org 2>/dev/null | grep -q '^200$'; then
   echo "$proxy" >> working.txt
   echo "WORKING: $proxy"
 else
   echo "$proxy" >> dead.txt
   echo "FAILED: $proxy"
 fi

done < proxies.txt

echo "======================"
echo "TEST FINISHED"
echo "Working: $(wc -l < working.txt)"
echo "Failed: $(wc -l < dead.txt)"
