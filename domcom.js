// Fonctions de communications avec le thread principal (en charge du DOM)

import * as Env from "./environment.js";

// String to be sent as stdout to console
let _str='';
let _strChange=false; // true iff _str has changed since last display of stdout

// Just un log
function myLog(msg){
    postMessage({"console":JSON.stringify(msg)});
}

// done regularly (if instruction count is over a threshold)
// Redraw graph is needed (or if force)
// Send stdout string to console
export function regularCheck(force=false){
    _instrCnt=0;
    for(let i in Env.Graphes) Env.Graphes[i].redraw(force);
    
    if(_strChange || force){
        _strChange=false;
        postMessage({print: _str});
    }
}

export function print(s){
    _str += s;
    _strChange=true;
}
