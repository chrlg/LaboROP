#!/bin/bash

. ../env/bin/activate

ssh -N -R 5000:localhost:5000 tunnel@christophe.legal &
pid=$!

URL="http://christophe.legal:5000" flask --app laborop --debug run

kill $pid
