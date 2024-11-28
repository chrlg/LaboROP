#!/bin/bash

if [[ -d ../env ]]
then
    . ../env/bin/activate
elif [[ -d .env.nosync ]]
then
    . ./.env.nosync/bin/activate
else
    . ./.env/bin/activate
fi

ssh -N -R 5000:localhost:5000 tunnel@christophe.legal &
pid=$!

URL="https://laborop.christophe.legal" flask --app laborop --debug run

kill $pid
