all: grlang.js testWasm.wasm


grlang.js: grlang.jison
	jison grlang.jison
	echo "export default grlang;" >> grlang.js
	cp grlang.js ../static/

testWasm.wasm: testWasm.c
	emcc -Os testWasm.c -o testWasm.wasm -s STANDALONE_WASM -s EXPORTED_FUNCTIONS='["_hw"]' -Wl, --no-entry
	cp testWasm.js testWasm.wasm ../static/
