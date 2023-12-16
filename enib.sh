#!/bin/bash

make

scp index.html interpret.js grlang.js grlang.jison script.js style.css mod_simple.js maths:W3/LaboROP/
