#!/bin/bash

export INDEXSTART=`date '+%Y%m%d' --date="4 years ago"`
export INDEXEND=`date '+%Y%m%d'`


INDEXHTML="web/index.html"

echo "<ul>" > $INDEXHTML

while IFS="," read -r col1 col2 col3 col4
do
  echo "$col1 $col2 $col3 $col4"
  export INDEXID=$col1
  export INDEXNAME=$col2
  export INDEXCURRENCY=$col3
  export INDEXVARIANT=$col4
  curl -o ./web/$INDEXID.json "https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=$INDEXCURRENCY&index_variant=NETR&start_date=$INDEXSTART&end_date=$INDEXEND&data_frequency=DAILY&index_codes=$INDEXID"
  envsubst < template.html > web/$INDEXID.html
  echo "  <li><a href=\"$INDEXID.html\">${INDEXID} ${INDEXNAME} (${INDEXCURRENCY}/${INDEXVARIANT})</a></li>" >> $INDEXHTML
done < <(tail -n +2 indexlist.csv)

echo "</ul>" >> $INDEXHTML