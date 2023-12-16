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
    scp ${topush[@]} "$target/"
fi

for e in "${extra[@]}"
do
    [[ ".installSentinelle" -nt "$e" ]] && continue
    scp "$e" "$target/$e"
done

topush=()
for i in Modules/*.json
do
    [[ ".installSentinelle" -nt "$i" ]] && continue
    topush+=("$i")
done

if [[ "${#topush[@]}" != "0" ]]
then
    scp ${topush[@]} "$target/Modules/"
fi

touch .installSentinelle
