// Fonctions de communications avec le thread principal (en charge du DOM)

import * as Process from "./process.js";
import * as Env from "./environment.js";
import {isNumeric, numericValue} from "./expression.js";

// String to be sent as stdout to console
let _str='';
let _strChange=false; // true iff _str has changed since last display of stdout
let lastPrint=0; // Date of last print (to avoid to flush too frequently)
let pauseSem; // Semaphore for play/pause, sleep, etc.
let ignoreBreakpoints=false;

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

export function setSabs(sabp){
    pauseSem=new Int32Array(sabp);
}

export function timeoutResume(dt){
    Atomics.store(pauseSem, 0, 0);
    postMessage({sleep: dt});
    Atomics.wait(pauseSem, 0, 0);
}

export function wait(dt){
    Atomics.store(pauseSem, 0, 0);
    postMessage({wait: dt});
    Atomics.wait(pauseSem, 0, 0);
}

function debugPrint(v){
    let vv;
    if(isNumeric(v)) return numericValue(v);
    else if(v.t=="string" || v.t=="boolean") return v.val;
    else if(v.t=="matrix") {
        let n=v.val.length;
        vv=`${n}×${n} [`;
        let npr=0;
        for(let i=0; i<n; i++){
            vv+='[';
            for(let j=0; j<n; j++){
                if(npr>5) { vv+='…'; break; }
                vv+=v.val[i][j]+' ';
                npr++;
            }
            vv+=']';
            if(npr>5) { vv+='…'; break; }
        }
        vv+=']';
        return vv;
    }
    else if(v.t=='Sommet'){
        return Env.grapheContaining(v).name+'.'+v.name;
    }
    else if(v.t=='Arete'){
        if(v.i) return Env.grapheContaining(v.i).name+'.['+v.i.name+','+v.a.name+']';
        else return 'None';
    }
    else if(v.t=='array'){
        vv='[';
        for(let i=0; i<v.val.length; i++){
            if(i) vv+=',';
            vv+=debugPrint(v.val[i]);
            if(i>5) {vv+='…'; break; }
        }
        vv+=']';
        return vv;
    }
    else return "non sérialisable";
}

function envToDict(e){
    let ans={};
    for(let k in e){
        let v=e[k];
        let name=k;
        let vv=null;
        if(v.t=='DEF') continue;
        else if(k=='*') continue;
        if(k[0]=='-'){
            name=`[${k.slice(1)}]`;
        }
        ans[name]=[v.t, debugPrint(v)];
    }
    return ans;
}

export function breakpoint(ln){
    if(ignoreBreakpoints) return;
    regularCheck(); // Flush stdout, draw graphs
    let info={};
    info.global = envToDict(Env.Global);
    info.current = envToDict(Env.Current);
    info.stack=[];
    for(let e of Env.LocalEnvStack) info.stack.push(envToDict(e));
    postMessage({breakpoint: info, ln:ln});

    // Wait for user to click on continue or step, or for debugger to ask for value
    Atomics.store(pauseSem, 0, 0);
    for(let ix=0;;ix++){ // Loop is just for future, when there will be many back/forth in breakpoint pause. ix is for debug. For now that loop is executed once only
        Atomics.wait(pauseSem, 0, 0);
        if(pauseSem[0]==1) return;
        // 2 means, stop break, and ignore breakpoints for now on
        if(pauseSem[0]==2){
            Atomics.store(pauseSem,0,1);
            ignoreBreakpoints=true;
            return;
        }
        // Future usage: is sem is 3, that means that we want specific of row and col
        // postMessage({debugInfo: `row=${pauseSem[1]}, col=${pauseSem[2]}`, row:pauseSem[1], col:pauseSem[2]});
        Atomics.store(pauseSem, 0, 0);
    }
}

// Reset state as it were when worker starts
function reset(){
    _str='';
    _strChange=false; 
    lastPrint=0;
    ignoreBreakpoints=false;
}

Process.onreset(reset);
