// Fonctions de communications avec le thread principal (en charge du DOM)

import * as Process from "./process.js";
import * as Env from "./environment.js";

// String to be sent as stdout to console
let _str='';
let _strChange=false; // true iff _str has changed since last display of stdout
let lastPrint=0; // Date of last print (to avoid to flush too frequently)

// Just a log
function myLog(msg){
    postMessage({"console":JSON.stringify(msg)});
}

// done regularly (if instruction count is over a threshold)
// Redraw graph is needed (or if force)
// Send stdout string to console
export function regularCheck(force=false){
    for(let i in Env.Graphes) Env.Graphes[i].redraw(force);
    
    if(_strChange || force){
        actualFlush();
    }
}

function actualFlush(){
    if(!_strChange) return;
    _strChange=false;
    lastPrint=Date.now();
    postMessage({print: _str});
}

export function flush(){
    let t=Date.now();
    if(t-lastPrint<200) return;
    actualFlush();
}

export function print(s){
    _str += s;
    let lastR=_str.lastIndexOf('\r', _str.length-2);
    if(lastR>=0){
        let llR=_str.lastIndexOf('\r', lastR-1);
        let llN=_str.lastIndexOf('\n', lastR-1);
        if(llN>llR) llR=llN;
        _str = _str.slice(0,llR+1)+_str.slice(lastR+1);
    }
    _strChange=true;
    if(_str.length>11000) _str=_str.substring(_str.length-10000);
}

export function setProgress(p){
    postMessage({progress: p});
}

export function setUserStatus(t,c){
    postMessage({status: t, color:c});
}

// Reset state as it were when worker starts
function reset(){
    _str='';
    _strChange=false; 
    lastPrint=0;
}

Process.onreset(reset);
