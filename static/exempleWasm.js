// LS Functions that would be available in wasm code
const importObject = {
  my_namespace: { imported_func: (arg) => console.log('importedFunction Arg', arg) },
};

// Pointer to function to be found in wasm code
export let hw=false;

export function init(cb){
    // Import wasm code and, when ready, grab functions in it, and call cb to warn
    // who ever requested this init that it is ready
    WebAssembly.instantiateStreaming(fetch("testWasm.wasm"), importObject).then(
      (obj) => {
        hw=obj.instance.exports.hw;
        cb();
      },
    );
}
