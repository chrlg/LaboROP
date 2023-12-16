import * as Cst from "./constants.js";
import * as Env from "./environment.js";
import * as Mod from "./modules.js";
import * as Mat from "./matrix.js";
import {evaluate, evaluateLVal, isNumeric, numericValue} from "./expression.js";
import {regularCheck, print, flush} from "./domcom.js";
import Decimal from "./lib/decimal.mjs";

export default function populate(){
    // TODO : int, round, str
   Env.addPredfn("clear", preClear);
   Env.addPredfn("sommets", preSommets);
   Env.addPredfn("len", preLen);
   Env.addPredfn("random", preRandom);
   Env.addPredfn("premier", prePremier);
   Env.addPredfn("dernier", preDernier);
   Env.addPredfn("print", prePrint);
   Env.addPredfn("println", prePrint);
   Env.addPredfn("printnr", prePrint);
   Env.addPredfn("refresh", preRefresh);
   Env.addPredfn("arcs", preArcs);
   Env.addPredfn("aretes", preArcs);
   Env.addPredfn("import", preImport);
   Env.addPredfn("pop", prePop);
   Env.addPredfn("insert", preInsert);
   Env.addPredfn("type", preType);
   Env.addPredfn("_grapheMode", preGraphMode);
   Env.addPredfn("whoami", preWhoami);
   Env.addPredfn("sqrt", preMaths1);
   Env.addPredfn("sqr", preMaths1);
   Env.addPredfn("exp", preMaths1);
   Env.addPredfn("log", preMaths1);
   Env.addPredfn("log10", preMaths1);
   Env.addPredfn("log2", preMaths1);
   Env.addPredfn("sin", preMaths1);
   Env.addPredfn("cos", preMaths1);
   Env.addPredfn("tan", preMaths1);
   Env.addPredfn("asin", preMaths1);
   Env.addPredfn("acos", preMaths1);
   Env.addPredfn("atan", preMaths1);
   Env.addPredfn("abs", preMaths1);
   Env.addPredfn("min", preMin);
   Env.addPredfn("max", preMin);
   Env.addPredfn("int", preInt);
   Env.addPredvar("Adj", preM, true);
   Env.addPredvar("Id", preId, true);
   Env.addPredvar("Zero", preZero, true);
   Env.addPredvar("OpCount", () => { return {t:"number", val:Env.OpCnt}});
   Env.addPredvar("Time", () => {return {t:"number", val: (new Date()).valueOf()/1000.0}});
   Env.Predef["True"]=Cst.TRUE;
   Env.Predef["False"]=Cst.FALSE;
   Env.Predef["null"]=Cst.NULL;
   Env.Predef["pi"]=Cst.PI;
   Env.Predef["Infinity"]=Cst.INFINITY;
}

function preClear(args, named, ln, fname){
    if(args.length==1){
        console.log('clear args', args);
    }
    Env.Gr.sommets={};
    Env.Gr.arcs.length=0;
}

function preSommets(args, named, ln, fname){
   let g=Env.Gr;
   let idx=false;
   if(args.length>2) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction sommets s'utilise avec au plus 2 arguments (graphe et/ou index)", ln:ln};
   for(let a of args){
      let ev=evaluate(a);
      if(ev.t=="graphe") g=ev;
      else if(ev.t=="number"){
         if(idx!==false) throw {error:"args", name:"Mauvais arguments", 
            msg:"La fonction sommets s'utilise avec au plus un argument index", ln:ln};
         idx=ev.val;
      }
      else throw {error:"args", name:"Mauvais arguments",
            msg:"La fonction sommets s'utilise sans argument, ou des arguements de type entier et graphe", ln:ln};
   }
   let t=Object.values(g.sommets);

   if(g.discover && !idx) return {t:"array", val:t.filter(s=>s.marques.visible)};
   if(idx===false) return {t:"array", val:t};
   if(idx<0 || idx>=t.length) throw {error:"exec", name:"Indice invalide",
         msg:"Le sommet #"+idx+" n'existe pas", ln:ln};
   if(_grapheDisc && !t[idx].marques.visible) throw {error:"exec", name: "Sommet inaccessible", msg:"Le sommet #"+idx+" n'est pas encore visible", ln:ln};
   return t[idx];
}

function preLen(args, named, ln, fname){
   if(args.length!=1) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction len s'utilise avec un et un seul argument", ln:ln};
   let a=evaluate(args[0]);
   if(a.t=="array") return {t:"number", val:a.val.length};
   if(a.t=="matrix") return {t:"number", val:a.val.length};
   if(a.t=="string") return {t:"number", val:a.val.length};
   throw {error:"type", name:"Erreur de type", 
      msg:"Mauvais type "+a.t+" pour la fonction len", ln:ln};
}

// Random
// Can be used with no argument-> return a number between 0 and 1
// With 1 number -> an integer between 0 and that number
// With 2 numbers -> an integer between the 2 numbers
// With an array -> a choice
function preRandom(args, named, ln, fname){
    // No arg => U([0,1])
    if(args.length==0){
        return Math.random();
    }
    let a=evaluate(args[0]);
    // 1 or 2 numbers
    if(isNumeric(a)){
        if(args.length==2){
            let b=evaluate(args[1]);
            if(!isNumeric(b)) throw {error:"type", name:"Mauvais argument pour random",
                msg:"Un nombre et un "+a.t+" ne sont pas des arguments valides", 
                ln:args[1].ln};
            return numericValue(a)+Math.floor(Math.random()*(numericValue(b)-numericValue(a)));
        }
        return Math.floor(Math.random()*numericValue(a));
    }
    // Array -> an element of that array
    if(a.t=="array"){
        // Empty array -> null
        if(a.val.length<=0){
            return Cst.NULL;
        }
        // If no other argument, just choose the rth value of the array
        let r=Math.floor(Math.random()*a.val.length); // Index
        if(args.length==1){
            return a.val[r];
        }
        // If there is a second argument, treat it as a selection condition. So we return the
        // first element that math that condition.
        for(let ii=0; ii<a.val.length; ii++){
            let i=(r+ii)%a.val.length;
            let cur=a.val[i];
            // Environnement pour this
            let env=Env.push({"this":cur});
            let v=evaluate(args[1]);
            Env.pop();
            if(!v || v.t!="boolean") throw {error:"type", name:"Condition non booléenne",
                msg:"Mauvaise condition de filtrage pour random", ln:args[1].ln};
            if(v.val) return cur;
        }
        return Cst.NULL; // Rien ne correspond à la condition
    }
    throw {error:"type", name:"Mauvais argument pour random", 
        msg:"Un "+a.t+" n'est pas un argument valide pour random", ln:args[0].ln};
}

function prePrint(args, named, ln, fname){
    function printRec(o){
        if(typeof o=="object"){
            if(o.t=="Sommet") print(o.name);
            else if(o.t=="Arete") print("["+o.i.name+","+o.a.name+"]");
            else if(o.t=="Arc") print("("+o.i.name+","+o.a.name+")");
            else if(isNumeric(o)) print((''+o.val).replace('e','⏨'));
            else if(o.t=="string") print(o.val);
            else if(o.t=="boolean") print(o.val?"True":"False");
            else if(o.t=="array"){
                print("[");
                for(let i=0; i<o.val.length; i++){
                    printRec(o.val[i]);
                    if(i<o.val.length-1) print(",");
                }
                print("]");
            }
            else if(o.t=="matrix"){
                let n=o.val.length;
                let mx=0
                for(let i=0; i<n; i++){
                    for(let j=0; j<n; j++){
                        let s=''+o.val[i][j];
                        if(s.length>mx) mx=s.length;
                    }
                }
                for(let i=0; i<n; i++){
                    if(i==0) print("⎡");
                    else if(i==n-1) print("⎣");
                    else print("⎢");
                    for(let j=0; j<n; j++){
                        if(j>0) print(" ");
                        print(('                          '+o.val[i][j]).slice(-mx));
                    }
                    if(i==0) print("⎤\n");
                    else if(i==n-1) print("⎦\n");
                    else print("⎥\n");
                }
            }
            else if(o.t=="struct"){
                print("{");
                let first=true;
                for(let k in o.f){
                    if(first) first=false;
                    else print(" ");
                    print(k+":");
                    printRec(o.f[k]);
                }
                print("}");
            }
            else if(o.t=="null"){
                print("∅");
            }
            else print("{"+o.t+"}");
        }
        else{
            print(o);
        }
    }

    let sep=(fname=='print')?' ':'';
    let end=(fname=='printnr')?'':'\n';
    let fl=false;
    for(let x of named){
        if(x.name=='sep'){
            let v=evaluate(x.a);
            if(v.t!='string') throw {error:"type", name:"Erreur de type", msg:"sep doit être une chaîne de caractères", ln:x.ln};
            sep=v.val;
        }else if(x.name=='end'){
            let v=evaluate(x.a);
            if(v.t!='string') throw {error:"type", name:"Erreur de type", msg:"end doit être une chaîne de caractères", ln:x.ln};
            end=v.val;
        }else if(x.name=='flush'){
            let v=evaluate(x.a);
            if(v.t!='boolean') throw {error:"type", name:"Erreur de type", msg:"flush doit être un booléen", ln:x.ln};
            fl=v.val;
        }
    }

    for(let i=0; i<args.length; i++){
        if(i) print(sep);
        let a=evaluate(args[i]);
        printRec(a);
    }
    print(end);
    if(fl || end=='\n') flush();
}

function preRefresh(args, named, ln, fname){
   if(args.length!=0) throw{error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction refresh s'utilise sans argument", ln:ln};
   regularCheck(true);
}

function preArcs(args, named, ln, fname){
    if(args.length>2) throw {error:"args", name:"Mauvais nombre d'arguments",
        msg:"La fonction arcs s'utilise avec au plus 2 arguments (graphe et/ou sommet)", ln:ln};
    let s=false;
    let g=false;
    for(let a of args){
        let ev=evaluate(a);
        if(ev.t=="graphe") g=ev;
        else if(ev.t=="Sommet") s=ev;
        else throw {error:"args", name:"Mauvais argument", msg:"Argument de type "+ev.t+" invalide pour arcs", ln:ln};
    }
    if(!g){
        // Pas de graphe précisé. Mais puisqu'il y a un sommet de donné, on peut le trouver via le sommet
        if(s) g=Env.grapheContaining(s);
        else g=Env.Gr;
    }
    if(s===false) {
        if(g.discover){
            if(g.isOrient()){
                return {t:"array", val: g.arcs.filter(a=>a.i.marques.visible)};
            }
            else{
                return {t:"array", val: g.arcs.filter(a=>a.i.marques.visible || a.a.marques.visible)};
            }
        }
        else{
            return {t:"array", val:g.arcs};
        }
    }

    if(g.discover && !s.marques.visible) return Cst.NULL;
    let rep=[];
    for(let i=0; i<g.arcs.length; i++){
        if(g.arcs[i].i==s) rep.push(g.arcs[i]);
        else if(g.arcs[i].a==s && g.arcs[i].t=="Arete") {
            // Dans le cas précis de arete, on inverse les sommets
            // Avant de retourner le résultat. C'est un peu pourri comme méthode. Mais
            // le but est de garantir que [x,y] in aretes(A) retourne toujours un y!=A (sauf pour la boucle)
            let pivot=g.arcs[i].i;
            g.arcs[i].i=g.arcs[i].a;
            g.arcs[i].a=pivot;
            rep.push(g.arcs[i]);
        }
    }
    return {t:"array", val:rep};
}

function preImport(args, named, ln, fname){
    if(args.length!=1) throw {error:"args", name:"Mauvais nombre d'arguments",
        msg:"La fonction import s'utilise avec un argument", ln:ln};
    let e=evaluate(args[0]);
    if(e.t!="string") throw {error:"args", name:"Mauvais type d'argument",
        msg:"La fonction import attent une chaîne", ln:ln};
    Mod.load(e.val, args[0].ln);
}

function preType(args, named, ln, fname){
    if(args.length==0) throw {error:"args", name:"Mauvais nombre d'arguments", msg:"La fonction type s'utilise avec au moins un argument", ln:ln};
    if(args.length==1){
        let e=evaluate(args[0]);
        return {t:"string", val:e.t};
    }
    let r={t:"array", val:[]};
    for(let a of args){
        let e=evaluate(a);
        r.val.push({t:"string", val:e.t});
    }
    return r;
}


function prePop(args, named, ln, fname){
   if(args.length!=1 && args.length!=2) throw {error:"args", name:"Mauvais nombre d'arguments", 
      msg:"pop(tableau [,indice]) s'utilise avec un ou deux arguments", ln:ln};
   let ref=evaluateLVal(args[0]);
   let lvv=ref[0][ref[1]];
   if(lvv.t!="array") throw {error:"type", name:"Mauvais type pour pop", 
      msg:"Le premier argument de pop est obligatoirement un tableau", ln:args[0].ln};
   let index=lvv.val.length-1;
   if(args.length==2){
      let argidx=evaluate(args[1]);
      if(!isNumeric(argidx)) throw {error:"args", name:"Mauvais type pour pop", 
         msg:"Le deuxième argument de pop, s'il existe, est un entier (indice de retrait)", ln:args[1].ln};
      index = numericValue(argidx);
   }
   let r=lvv.val.splice(index,1);
   if(r.length==0) {
      if(lvv.val.length==0) throw {error:"exec", name:"Tableau vide", msg:"", ln:ln};
      throw {error:"exec", name:"Index invalide",
         msg:"L'élement d'index "+index+" n'existe pas", ln:ln};
   }
   return r[0];
}

function preInsert(args, named, ln, fname){
    if(args.length!=3) throw {error:"args", name:"Mauvais nombre d'arguments", msg:"insert(liste, position, valeur) s'utilise avec 3 arguments", ln:ln};
    let ref=evaluateLVal(args[0]);
    let lvv=ref[0][ref[1]];
    if(lvv.t!="array") throw {error:"type", name:"Mauvais type", msg:"Le premier argument de insert(liste, position, valeur) est obligatoirement un tableau", ln:args[0].ln};
    let argidx=evaluate(args[1]);
    if(!isNumeric(argidx)) throw {error:"args", name:"Mauvais type", msg:"Le deuxième argument de insert(liste, position, valeur) doit être un nombre", ln:args[1].ln};
    let v=evaluate(args[2]);
    lvv.val.splice(numericValue(argidx), 0, v);
    return v;
}

function preGraphMode(args, named, ln, fname){
    let g=Env.Gr;
    let m=undefined;
    for(let a of args){
        let e=evaluate(a);
        if(e.t=='graphe') g=e;
        else if(e.t=='string') m=e.val;
        else throw {error:"type", name:"Type incorrect pour _grapheMode", msg:`Le type ${e.t} est incorrect`, ln:ln};
    }
    if(m===undefined) return {t:"string", val:g.mode};
    g.mode=m;
    g.change=true;
    regularCheck(true);
    return {t:'string', val:g.name};
}

function preWhoami(args, named, ln, fname){
    let req=new XMLHttpRequest();
    req.responseType = 'json';
    req.open('POST', 'ajax.php', false);
    req.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    req.send(JSON.stringify({action:'whoami'}));
    let j=req.response;
    if(j.me===undefined) return Cst.NULL;
    return {t:'string', val:j.me};
}

function preMaths1(args, named, ln, fname){
    if(args.length!=1) throw {error:"args", name:"Mauvais nombre d'arguments",
        msg:"La fonction "+fname+" s'utilise avec un et un seul argument", ln:ln};
    let a=evaluate(args[0]);
    if(!isNumeric(a)) throw {error:"type", name:"Mauvais type", 
        msg:"La fonction "+fname+" s'utilise avec un argument numérique", ln:ln};
    if(a.t=='number'){
        if(fname=="sqrt") return {t:"number", val:Math.sqrt(a.val)};
        if(fname=="sqr") return {t:"number", val:a.val*a.val};
        if(fname=="exp") return {t:"number", val:Math.exp(a.val)};
        if(fname=="log") return {t:"number", val:Math.log(a.val)};
        if(fname=="log10") return {t:"number", val:Math.log10(a.val)};
        if(fname=="log2") return {t:"number", val:Math.log2(a.val)};
        if(fname=="sin") return {t:"number", val:Math.sin(a.val)};
        if(fname=="cos") return {t:"number", val:Math.cos(a.val)};
        if(fname=="tan") return {t:"number", val:Math.tan(a.val)};
        if(fname=="asin") return {t:"number", val:Math.asin(a.val)};
        if(fname=="acos") return {t:"number", val:Math.acos(a.val)};
        if(fname=="atan") return {t:"number", val:Math.atan(a.val)};
        if(fname=="abs") return {t:"number", val:Math.abs(a.val)};
    }else{
        if(fname=="sqrt") return {t:"decimal", val:a.val.sqrt()};
        if(fname=="sqr") return {t:"decimal", val:a.val.times(a.val)};
        if(fname=="exp") return {t:"decimal", val:Decimal.exp(a.val)};
        if(fname=="log") return {t:"decimal", val:Decimal.log(a.val, Decimal.exp(1))};
        if(fname=="log10") return {t:"decimal", val:Decimal.log10(a.val)};
        if(fname=="log2") return {t:"decimal", val:Decimal.log2(a.val)};
        if(fname=="sin") return {t:"decimal", val:Decimal.sin(a.val)};
        if(fname=="cos") return {t:"decimal", val:Decimal.cos(a.val)};
        if(fname=="tan") return {t:"decimal", val:Decimal.tan(a.val)};
        if(fname=="asin") return {t:"decimal", val:Decimal.asin(a.val)};
        if(fname=="acos") return {t:"decimal", val:Decimal.acos(a.val)};
        if(fname=="atan") return {t:"decimal", val:Decimal.atan(a.val)};
        if(fname=="abs") return {t:"decimal", val:Decimal.abs(a.val)};
    }
    throw {error:"interne", name:"Erreur interne", msg:"preMaths avec fname="+fname,ln:ln};
}

function preMin(args, named, ln, fname){
    let r=Cst.NULL;
    let fvv = (a,b)=>a<b;
    let fdd = (a,b)=>Decimal(a.val).lt(b.val);
    if(fname=='max'){
        fvv=(a,b)=>a>b;
        fdd=(a,b)=>Decimal(a.val).gt(b.val);
    }
    let ft = function(a){
        if(a.t=="array"){
            for(let y of a.val){
                ft(y);
            }
        }else if(a.t=='matrix'){
            let n=a.val.length;
            if(n>0 && r.t=='null') r={t:'number', val:a.val[0][0]};
            for(let i=0; i<n; i++){
                for(let j=0; j<n; j++){
                    if(fvv(a.val[i][j],r.val)) r={t:'number', val:a.val[i][j]};
                }
            }
        }else{
            if(r.t=="null"){
                r=a;
            }else if(a.t=='number' && r.t=='number'){
                if(fvv(a.val,r.val)) r=a;
            }else if(fdd(a,r)) r=a;
        }
    }
    for(let a of args){
        let v=evaluate(a);
        if(v.t!='array' && v.t!='matrix' && !isNumeric(v))
            throw {error:"type", name:"Mauvais type", msg:`Les arguments de ${fname} doivent être des nombre ou des tableaux, pas des ${a.t}`, ln:a.ln};
        ft(v);
    }
    return r;
}

function preInt(args, named, ln, fname){
    if(args.length!=1) throw {error:'args', name:"Mauvais nombre d'arguments", msg:"int s'utilise avec un argument", ln:ln};
    let v=evaluate(args[0]);
    if(!isNumeric(v) && v.t!='string') throw {error:'type', name:'Mauvais type', msg:"int(x) s'utilise avec un nombre ou une chaine", ln:ln};
    let num=Math.floor(v.val);
    if(isNaN(num)) return Cst.NULL;
    return {t:'number', val:Math.floor(v.val)};
}

function prePremier(args, named, ln, fname){
   if(args.length!=1) throw {error:"type", name:"Mauvais nombre d'arguments",
         msg:"Mauvais nombre d'arguments pour premier", ln:ln};
   let l=evaluate(args[0]);
   if(l.t!="array") throw {error:"type", name:"Erreur de type",
         msg:"'premier' attend un argument de type tableau", ln:args[0].ln};
   if(l.val.length<=0) return Cst.NULL;
   else return l.val[0];
}

function preDernier(args, named, ln, fname){
   if(args.length!=1) throw {error:"type", name:"Mauvais nombre d'arguments",
         msg:"Mauvais nombre d'arguments pour dernier", ln:ln};
   let l=evaluate(args[0]);
   if(l.t!="array") throw {error:"type", name:"Erreur de type",
         msg:"'dernier' attend un argument de type tableau", ln:args[0].ln};
   if(l.val.length<=0) return Cst.NULL;
   else return l.val[l.val.length-1];
}


function preM(args, named, ln, fname){
    let M={t:"matrix", val:[]};
    let g=Env.Gr;
    if(args){
        if(args.length!=1) throw {error:"env", ln:ln, name:"Mauvais nombre d'arguments", msg:"La variable Adj ne peut prendre qu'un argument optionnel, le graphe"};
        g=evaluate(args[0]);
        if(g.t!="Graphe") throw {error:"env", ln:ln, name:"Mauvais type d'argument", msg:"Quand la variable Adj est utilisée avec un argument optionnel, cet argument doit être un graphe"};
    };

    let k=Object.keys(g.sommets);
    let arcs=g.arcs;
    for(let i=0; i<k.length; i++){
        M.val[i]=new Array(k.length).fill(0);
        for(let j=0; j<k.length; j++){
            M.val[i][j]=0;
            for(let ai=0; ai<arcs.length; ai++){
                if(arcs[ai].i.name == k[i] && arcs[ai].a.name==k[j]) {;}
                else if(g.isOrient()) continue;
                else if(arcs[ai].a.name==k[i] && arcs[ai].i.name==k[j]) {;}
                else continue;
                M.val[i][j]++;
            }
        }
    }
    return M;
}


function preId(args, named, ln, fname){
    let n=0;
    let g=Env.Gr;
    if(args){
        if(args.length!=1) throw {error:"env", ln:ln, name:"Mauvais nombre d'arguments", msg:"La variable Id ne peut prendre qu'un argument optionnel, le graphe"};
        g=evaluate(args[0]);
        if(g.t!="Graphe") throw {error:"env", ln:ln, name:"Mauvais type d'argument", msg:"Quand la variable Id est utilisée avec un argument optionnel, cet argument doit être un graphe"};
    }
    n=Object.keys(g.sommets).length;
    return Mat.id(n);
}


function preZero(args, named, ln, fname){
    let g=Env.Gr;
    if(args){
        if(args.length!=1) throw {error:"env", ln:ln, name:"Mauvais nombre d'arguments", msg:"La variable Zero ne peut prendre qu'un argument optionnel, le graphe"};
        g=evaluate(args[0]);
        if(g.t!="Graphe") throw {error:"env", ln:ln, name:"Mauvais type d'argument", msg:"Quand la variable Zero est utilisée avec un argument optionnel, cet argument doit être un graphe"};
    }
    let n=Object.keys(g.sommets).length;
    return Mat.zeroDim(n);
}
