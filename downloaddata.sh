#!/bin/bash

INDEXHTML="web/index.html"

echo "<ul>" > $INDEXHTML


export INDEXSTART=`date '+%Y%m%d' --date="4 years ago"`
export INDEXEND=`date '+%Y%m%d'`
export INDEXID="733339"
export INDEXNAME="MSCI World Visualization"
export INDEXCURRENCY="EUR"
export INDEXVARIANT="NETR"
curl -o ./web/$INDEXID.json "https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=$INDEXCURRENCY&index_variant=NETR&start_date=$INDEXSTART&end_date=$INDEXEND&data_frequency=DAILY&index_codes=$INDEXID"
envsubst < template.html > web/$INDEXID.html
echo "  <li><a href=\"$INDEXID.html\">${INDEXID} ${INDEXNAME} (${INDEXCURRENCY}/${INDEXVARIANT})</a></li>" >> $INDEXHTML

echo "</ul>" >> $INDEXHTML