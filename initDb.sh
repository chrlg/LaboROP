#!/bin/bash

if [[ ! -d "DB" ]]
then
    mkdir DB
    chgrp www-data DB
    chmod g+wx DB
fi

if [[ -f "DB/base.sqlite3" ]] 
then
    sqlite3 ./DB/base.sqlite3 "delete from Dns;"
    sqlite3 ./DB/base.sqlite3 < sallesEnib.sql
fi
