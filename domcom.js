// Fonctions de communications avec le thread principal (en charge du DOM)

import * as Env from "./environment.js";

// String to be sent as stdout to console
let _str='';
let _strChange=false; // true iff _str has changed since last display of stdout
let timeout=false;

// Just un log
function myLog(msg){
    postMessage({"console":JSON.stringify(msg)});
}

// done regularly (if instruction count is over a threshold)
// Redraw graph is needed (or if force)
// Send stdout string to console
export function regularCheck(force=false){
    timeout=false;
    for(let i in Env.Graphes) Env.Graphes[i].redraw(force);
    
    if(_strChange || force){
        flush();
    }
}

function actualFlush(){
    if(!_strChange) return;
    _strChange=false;
    postMessage({print: _str});
}

export function flush(){
    if(timeout) return;
    actualFlush();
    timeout=true;
}

export function print(s){
    _str += s;
    _strChange=true;
    if(_str.length>11000) _str=_str.substring(_str.length-10000);
}
