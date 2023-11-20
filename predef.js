import * as Cst from "./constants.js";
import * as Env from "./environment.js";
import * as Mod from "./modules.js";
import * as Mat from "./matrix.js";
import {evaluate, evaluateLVal, isNumeric} from "./expression.js";
import {regularCheck, print} from "./domcom.js";

export default function populate(){
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
   Env.addPredfn("_grapheMode", preGraphMode);
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
            else if(isNumeric(o)) print(''+o.val);
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
                for(let i=0; i<o.val.length; i++){
                    print("[");
                    for(let j=0; j<o.val[i].length; j++){
                        if(j>0) print(" ");
                        print(o.val[i][j]);
                    }
                    print("]\n");
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
            else print("{"+o.t+"}");
        }
        else{
            print(o);
        }
    }

    let sep=(fname=='print')?' ':'';
    let end=(fname=='printnr')?'':'\n';
    for(let x of named){
        if(x.name=='sep'){
            let v=evaluate(x.a);
            if(v.t!='string') throw {error:"type", name:"Erreur de type", msg:"sep doit être une chaîne de caractères", ln:x.ln};
            sep=v.val;
        }else if(x.name=='end'){
            let v=evaluate(x.a);
            if(v.t!='string') throw {error:"type", name:"Erreur de type", msg:"end doit être une chaîne de caractères", ln:x.ln};
            end=v.val;
        }
    }

    for(let i=0; i<args.length; i++){
        if(i) print(sep);
        let a=evaluate(args[i]);
        printRec(a);
    }
    print(end);
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
      if(argidx.t!="number") throw {error:"args", name:"Mauvais type pour pop", 
         msg:"Le deuxième argument de pop, s'il existe, est un entier (indice de retrait)", ln:args[1].ln};
      index = argidx.val;
   }
   let r=lvv.val.splice(index,1);
   if(r.length==0) {
      if(lvv.val.length==0) throw {error:"exec", name:"Tableau vide", msg:"", ln:ln};
      throw {error:"exec", name:"Index invalide",
         msg:"L'élement d'index "+index+" n'existe pas", ln:ln};
   }
   return r[0];
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
    regularCheck();
    return {t:'string', val:g.name};
}

function preMaths1(args, named, ln, fname){
   if(args.length!=1) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction "+fname+" s'utilise avec un et un seul argument", ln:ln};
   let a=evaluate(args[0]);
   if(a.t!="number") throw {error:"type", name:"Mauvais type", 
      msg:"La fonction "+fname+" s'utilise avec un argument numérique", ln:ln};
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
   throw {error:"interne", name:"Erreur interne", msg:"preMaths avec fname="+fname,ln:ln};
}

function prePremier(args, named, ln, fname){
   if(args.length!=1) throw {error:"type", name:"Mauvais nombre d'arguments",
         msg:"Mauvais nombre d'arguments pour premier", ln:ln};
   var l=evaluate(args[0]);
   if(l.t!="array") throw {error:"type", name:"Erreur de type",
         msg:"'premier' attend un argument de type tableau", ln:args[0].ln};
   if(l.val.length<=0) return NULL;
   else return l.val[0];
}

function preDernier(args, named, ln, fname){
   if(args.length!=1) throw {error:"type", name:"Mauvais nombre d'arguments",
         msg:"Mauvais nombre d'arguments pour dernier", ln:ln};
   var l=evaluate(args[0]);
   if(l.t!="array") throw {error:"type", name:"Erreur de type",
         msg:"'dernier' attend un argument de type tableau", ln:args[0].ln};
   if(l.val.length<=0) return NULL;
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


function importReseau(g,v){
   for(let i=0; i<g[0].length; i++){
      let x={t:"number", val:g[0][i][0]};
      let y={t:"number", val:g[0][i][1]};
      Env.Gr.sommets["S"+i] = {t:"Sommet", name:"S"+i, marques:{x:x, y:y}};
   }
   for(let p of g[1]){
      let s1=env.Gr.sommets["S"+p[0]];
      let s2=env.Gr.sommets["S"+p[1]];
      let d={t:"number", val:0};
      if(p.length==3) d.val=p[2];
      else{
         let x1=s1.marques.x;
         let x2=s2.marques.x;
         let y1=s1.marques.x;
         let y2=s2.marques.x;
         d.val=Math.sqrt((x1-x2)**2 + (y1-y2)**2);
      }
      if (v=="noValues") Env.Gr.arcs.push({t:"Arc", i:s1, a:s2, marques:{}});
      else env.Gr.arcs.push({t:"Arc", i:s1, a:s2, marques:{t:"number",capacite:d}});
   }
   env.Gr.setOrient(TRUE);
   env.Gr.mode="dot";   
   env.Gr.change=true;
}


function importReseauValue(g,v){
   for(let i=0; i<g[0].length; i++){
      let x={t:"number", val:g[0][i][0]};
      let y={t:"number", val:g[0][i][1]};
      _grapheEnv["S"+i] = {t:"Sommet", name:"S"+i, marques:{x:x, y:y}};
   }
   for(let p of g[1]){
      let s1=_grapheEnv["S"+p[0]];
      let s2=_grapheEnv["S"+p[1]];
      let d={t:"number", val:0};
      d.val=p[2];
      let c={t:"number", val:0};
      c.val=p[3];
      _arcs.push({t:"Arc", i:s1, a:s2, marques:{t:"number",capacite:d,t:"number",cout:c}});
   }
   _env.setOrient(TRUE);
   _grapheMode="arrows";   
   _grapheChange=true;
}

