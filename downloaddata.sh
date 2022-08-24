#!/bin/bash

START=`date '+%Y%m%d' --date="4 years ago"`
NOW=`date '+%Y%m%d'`
echo $START
echo $NOW
curl -o ./web/733339.json "https://app2.msci.com/products/service/index/indexmaster/getLevelDataForGraph?currency_symbol=EUR&index_variant=NETR&start_date=$START&end_date=$NOW&data_frequency=DAILY&index_codes=733339"
