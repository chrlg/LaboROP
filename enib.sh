#!/bin/bash

make

for i in *
do
    [[ -f "$i" ]] || continue
    [[ -L "$i" ]] && continue
    echo $i
done

#scp index.html interpret.js grlang.js grlang.jison script.js style.css mod_simple.js maths:W3/LaboROP/
