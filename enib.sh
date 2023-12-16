#!/bin/bash

target="maths:W3/LaboROP-ng"
extra=("lib/ace-builds-master/src-noconflict/mode-python.js")

make

topush=()

for i in *
do
    [[ -f "$i" ]] || continue
    [[ -L "$i" ]] && continue
    [[ ".installSentinelle" -nt "$i" ]] && continue
    topush+=("$i")
done

if [[ "${#topush[@]}" != "0" ]]
then
    echo scp ${topush[@]} "$target/"
fi

for e in "${extra[@]}"
do
    [[ ".installSentinelle" -nt "$e" ]] && continue
    echo scp "$e" "$target/$e"
done

topush=()
for i in Modules/*.json
do
    [[ ".installSentinelle" -nt "$i" ]] && continue
    topush+=("$i")
done

if [[ "${#topush[@]}" != "0" ]]
then
    echo scp ${topush[@]} "$target/Modules/"
fi

touch .installSentinelle
#scp index.html interpret.js grlang.js grlang.jison script.js style.css mod_simple.js maths:W3/LaboROP/
