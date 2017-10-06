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
   for i in *.html *.js *.css
   do
      if [[ $i -nt .installSentinelle ]]
      then
	 mark=1
      fi
   done

   if [[ $mark = 1 ]]
   then
      cp *.html *.js *.css /net/www/vrac/ROP/
      touch .installSentinelle
      echo "reinstall"
   else
      echo "."
   fi
done
