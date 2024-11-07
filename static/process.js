// A "leaf" module to register function from numerous other modules. So far only for "reset" purpose

// Reset: a function that reset every state values (basically global "static" variables of each modules — but only those that
// may change during execution. So, for example, OpCount, but not list of predef functions, that are supposed to
// be initialized once for all. Or, not the present _resetListeners)
let _resetListeners = [];
export function reset(){
    for(let fn of _resetListeners){
        fn();
    }
}

// Called by other modules to register their reset functions
export function onreset(fn){
    _resetListeners.push(fn);
}
