#!/bin/bash

while true
do
   sleep 1
   if [[ grlang.jison -nt grlang.js ]]
   then
      jison grlang.jison
      echo jison done
   fi
   mark=0
   for i in *.html *.jison *.js *.css .htaccess *.php
   do
      if [[ $i -nt .installSentinelle ]]
      then
         scp "$i" maths:W3/LaboROP/
	 mark=1
      fi
   done

   if [[ $mark = 1 ]]
   then
      touch .installSentinelle
      echo "reinstall"
   else
      echo "."
   fi
done
