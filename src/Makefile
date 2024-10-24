all: grlang.js


grlang.js: grlang.jison
	jison grlang.jison
	echo "export default grlang;" >> grlang.js
	cp grlang.js ../static/
