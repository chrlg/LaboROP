import * as Env from "./environment.js";
import {evaluate, evaluateLVal} from "./expression.js";
import {regularCheck, print} from "./domcom.js";
import {evalSommet, evalGraphe, creerArc, creerArete} from "./graphe.js";
import {FALSE} from "./constants.js";
import Decimal from "./lib/decimal.mjs";

export let Line = 0; // Default line number for internal error log
let _instrCnt=0; // Number of executed instruction (for regular display refresh check)

// Affect l-value designated by ref with value val
export function setRef(ref, val, ln){
    // Cas des arcs et arêtes
    if(ref.length==6){
        if(val.t=="None"){ // Arc None (récupéré avec un filtrage, par ex) => tout à None
            setRef(ref.slice(0,2), val, ln);
            setRef(ref.slice(2,4), val, ln);
            setRef(ref.slice(4), val, ln);
            return;
        }
        if(val.t!="Arc" && val.t!="Arete") throw {error:"type", name:"Erreur de type",
            msg:"Impossible d'affecter un "+val.t+ " à un arc ou une arête", ln:ln};
        setRef(ref.slice(0,2), val.i, ln);
        setRef(ref.slice(2,4), val.a, ln);
        setRef(ref.slice(4), val, ln);
        return;
    }

   // Copy "profonde" pour les tableaux et structures (mais récursive, car si un item contient un truc qui ne
   // se copie pas, comme un sommet, y compris les attributs de ce sommet qui peuvent être toute une structure
   // alors la copie profonde s'arrête à ces trucs
   if(val.t=="array"){
      let leftval=[];
      ref[0][ref[1]] = {t:"array", val:leftval};
      for(let i=0; i<val.val.length; i++){
         setRef([leftval, i], val.val[i], ln);
      }
      return;
   }
   if(val.t=="struct"){
      let leftval={};
      ref[0][ref[1]] = {t:"struct", f:leftval};
      for(let x in val.f){
         setRef([leftval, x], val.f[x], ln);
      }
      return;
   }
   // Copie profonde bourrin pour les matrices (les champs d'une matrice sont tous des scalaires)
   if(val.t=="matrix"){
      ref[0][ref[1]] = JSON.parse(JSON.stringify(val));
      return;
   }
   // Case d'une matrice
   else if(typeof ref[0][0]=="number" && typeof ref[1]=="number"){
      if(val.t!="number") throw {error:"type", name:"Erreur de type",
               msg:"Un coefficient matriciel est un scalaire", ln:ln};
      ref[0][ref[1]] = val.val;
   }
   // Inutile de copier pour number, boolean, string
   // Et on veut garder la référence pour Sommet, Arete et Arc
   else ref[0][ref[1]] = val;
}

// This one is both an instruction and an expression, depending on return
export function interpCall(call){
    let fn=Env.get(call.f);
    if(fn===undefined) throw {error:"symbol", name: "Fonction non définie",
        msg:"La fonction "+call.f+" n'existe pas", ln: call.ln};
    if(fn.t=="predfn") return fn.f(call.args, call.named, call.ln, call.f);
    if(fn.t=="predvar" && fn.optarg) return fn.f(call.args, call.named, call.ln, call.f);
    if(fn.t!="DEF") throw {error:"type", name:"Pas une fonction",
        msg:"Tentative d'appeler "+call.f+", qui n'est pas une fonction", ln:call.ln};
    if(fn.args.length > call.args.length) throw {error: "type", name:"Mauvais nombre d'arguments",
        msg:"Appel de "+call.f+" avec "+call.args.length+" argument(s) alors que "+
            fn.args.length+" au moins sont attendus", ln:call.ln};
    if(fn.args.length+fn.opt.length < call.args.length) throw {error: "type", name:"Mauvais nombre d'arguments",
        msg:"Appel de "+call.f+" avec "+call.args.length+" argument(s) alors que "+
            (fn.args.length+fn.opt.length)+" au plus sont attendus", ln:call.ln};
    let newEnv = {};
    // Positional arguments
    for(let i=0; i<fn.args.length; i++){
        let v=evaluate(call.args[i]);
        newEnv[fn.args[i]] = v;
    }
    // Extra positional arguments are to fill named arguments
    for(let i=fn.args.length; i<call.args.length; i++){
        let v=evaluate(call.args[i]);
        newEnv[fn.opt[i-fn.args.length].name] = v;
    }
    // Optional arguments fill the environment (not needed to match a param. It is just in the env.
    // So function definition could be all without params, and function calls with named arguments
    for(let a of call.named){
        let v=evaluate(a.a);
        newEnv[a.name] = v;
    }
    // At last, all optional parameters that have no value yet are evaluated to their default
    for(let p of fn.opt){
        if(newEnv[p.name]) continue;
        let v=evaluate(p.v);
        newEnv[p.name]=v;
    }
    newEnv["*"]={t:"empty"};
    Env.push(newEnv);
    interpretWithEnv(fn.insts, false);
    let retval=newEnv["*"];
    Env.pop();
    return retval;
}

// Main interpret function
// Iterate a list of instruction and execute them
// isloop tells whether we are in a loop or not
// may be interupted before the end, in which case it returns "return", "break" or "continue" to tell why
export function interpretWithEnv(tree, isloop){
    for(let ti of tree){
        if(_instrCnt++>10000) {
            regularCheck();
            _instrCnt=0;
        }
        Line=ti.ln;
        if(ti.t=="SOMMET"){
            interpCreerSommets(ti);
            continue;
        }
        if(ti.t=="ARETE"){
            creerArete(ti);
            continue;
        }
        if(ti.t=="Arc"){
            creerArc(ti);
            continue;
        }
        if(ti.t=="="){
            interpAffect(ti);
            continue;
        }
        if(ti.t=="++" || ti.t=="--"){
            evaluate(ti);
            continue;
        }
        if(ti.t=="foreach"){
            let b=interpForeach(ti);
            if(b=="return") return "return";
            continue;
        }
        if(ti.t=="for"){
            let b=interpFor(ti);
            if(b=="return") return "return";
            continue;
        }
        if(ti.t=="if"){
            let b=interpIf(ti, isloop);
            if(isloop && b=="break") return "break";
            if(isloop && b=="continue") return "continue";
            if(b=="return") return "return";
            continue;
        }
        if(ti.t=="while"){
            let b=interpWhile(ti);
            if(b=="return") return "return";
            continue;
        }
        if(ti.t=="call"){
            interpCall(ti);
            continue;
        }
        if(ti.t=="DEF"){
            interpDef(ti);
            continue;
        }
        if(ti.t=="break"){
            if(!isloop) throw {error:"exec", name:"Break en dehors d'une boucle",
                msg:"'break' ne peut être utilisé que dans une boucle for ou while",
                ln:ti.ln};
            return "break";
        }
        if(ti.t=="continue"){
            if(!isloop) throw {error:"exec", name:"continue en dehors d'une boucle",
                msg:"'continue' ne peut être utilisé que dans une boucle for ou while",
                ln:ti.ln};
            return "continue";
        }
        if(ti.t=="pass"){
            continue;
        }
        if(ti.t=="return"){
            interpReturn(ti);
            return "return";
        }
        if(ti.t=="exit"){
            interpExit(ti.arg);
            return "exit";
        }
        if(ti.t=="+="){
            interpPlusEgal(ti);
            continue;
        }
        if(ti.t=="*="){
            interpFoisEgal(ti);
            continue;
        }
        if(ti.t=="Graphe"){
            evalGraphe(ti, true);
            continue;
        }
        if(ti.t=="$"){
            print(JSON.stringify(eval(ti.i.slice(1)))+"\n");
            continue;
        }
    }
    return false;
}

// Ajoute des sommets
function interpCreerSommets(ins){
    let liste=ins.args;
    let g=Env.getGraph(ins.g, ins.ln);
    for(let i=0; i<liste.length; i++){
        let ev=evalSommet(liste[i], false, g);
        // On a récupéré un sommet existant
        if(ev.t=="Sommet") throw {error:"env", name:"Sommet déjà existant", msg:"Le sommet "+ev.name+" existe déjà", ln:liste[i].ln};
        // Un nom de sommet inexistant
        if(typeof ev == "string") {
            g.addNode(ev, liste[i].ln);
        }
        // Autre chose ?
        else throw {error:"interne", name:"Erreur interne", msg:"Ni string, ni sommet dans creerSommet\nev:"+ev+"\nev.t="+ev.t, ln:liste[i].ln};
    }
    g.change=true;
}

// Affectation lvalue,lvalue,lvalue,...=expr,expr,expr,...
// Note le tuple expr,expr ne peut être que le résultat d'une fonction
function interpAffect(ins){
    let v=evaluate(ins.right);
    if(!v) throw {error:"type", name:"Valeur invalide", msg:"Valeur undefined invalide", ln:ins.right.ln};
    // Si c'est un tuple, il doit correspondre au nombre de lvalues. Sinon, il doit n'y avoir qu'une lvalue
    if(v.t=="tuple" && v.v.length != ins.left.length) throw {error:"type", name:"Nombre d'expressions invalide",
        msg:"Les nombres de valeurs à droite et à gauche du '=' ne correspondent pas", ln:ins.ln};
    if(v.t!="tuple" && ins.left.length!=1) throw {error:"type", name:"Nombre d'expressions invalide",
        msg:"Une seule expression pour remplir plusieurs destinations", ln:ins.ln};
    // Affectation de chaque lvalue
    for(let i=0; i<ins.left.length; i++){
        let o=evaluateLVal(ins.left[i]);
        if(v.t=="tuple") setRef(o, v.v[i], ins.left[i].ln);
        else setRef(o, v, ins.left[i].ln);
    }
}

// Function definition. Only in global env (even when inside function)
function interpDef(def){
   if(Env.getPredef(def.nom)) throw {error:"type",
      name: "Surdéfinition", msg: "Impossible de redéfinir le symbole prédéfini "+def.nom,
      ln:def.ln};
   if(Env.Global[def.nom]!==undefined) throw {error:"type", name: "Surdéfinition", msg: "Fonction "+def.nom+" déjà définie", ln: def.ln};
   Env.Global[def.nom] = def;
}

// For each aka for ... in ...
function interpForeach(ins){
   let range=evaluate(ins.range);
   if(range.t!="array"){
      throw {error:"type", name:"Mauvaise plage pour 'for'",
             msg:"Un "+range.t+" ne peut être une plage d'itération pour 'for'",
             ln:ins.range.ln};
   }
   let comptRef=evaluateLVal(ins.compteur);
   for(let i=0; i<range.val.length; i++){
      setRef(comptRef, range.val[i], ins.compteur.ln);
      let b=interpretWithEnv(ins.do, true);
      if(b=="break") break;
      if(b=="return") return "return";
   }
   return false;
}

// For i in range(...)
function interpFor(ins){
   let comptRef = evaluateLVal(ins.compteur);
   let start=evaluate(ins.start);
   let end=evaluate(ins.end);
   let step={t:"number", val:1};
   if(ins.step) step=evaluate(ins.step);
   if(start===undefined || start.t!="number") throw {error:"type", name:"Bornes du for non numériques",
	 msg:"Le point de départ d'un range doit être un nombre", ln:ins.start.ln};
   if(end===undefined || end.t!="number") throw {error:"type", name:"Bornes du for non numériques",
	 msg:"La fin d'un range doit être un nombre", ln:ins.end.ln};
   if(step===undefined || step.t!="number") throw {error:"type", name:"Bornes du for non numériques",
	 msg:"Le pas d'un range doit être un nombre", ln:ins.step.ln};
   for(let i=start.val; i<end.val; i+=step.val){
      setRef(comptRef, {t:"number", val:i});
      let b=interpretWithEnv(ins.do, true);
      if(b=="break") break;
      if(b=="return") return "return";
   }
   return false;
}

function interpIf(si, isloop){
   let c=evaluate(si.cond);
   if(c.t=='None') c=FALSE;
   if(c.t != "boolean") throw {error:"type", name: "Condition non booléenne",
           msg:"La condition du if n'est pas un booléen", ln:si.cond.ln};
   if(c.val) return interpretWithEnv(si["do"], isloop);
   else return interpretWithEnv(si["else"], isloop);
}

function interpReturn(ins){
   if(Env.Local==null || Env.Local['*']===undefined){
      throw {error:"exec", name:"Return en dehors d'une fonction",
             msg:"'return' ne peut être utilisé qu'à l'intérieur d'une fonction",
	     ln:ins.ln};
   }
   if(ins.val===undefined) return;
   let v=ins.val.map(evaluate);
   if(v.length==1) Env.Local["*"]=v[0];
   else Env.Local["*"]={t:"tuple", v:v};
   return;
}

function interpWhile(tant){
   for(;;){
      let c=evaluate(tant.cond);
      if(c.t=='None') c=FALSE;
      if(c.t!="boolean") throw {error:"type", name: "Condition non booléenne",
	    msg:"La condition du while n'est pas un booléen", ln:tant.ln};
      if(!c.val) break;
      var b=interpretWithEnv(tant["do"], true);
      if(b=="break") break;
      if(b=="return") return "return";
   }
   return false;
}

function interpPlusEgal(tree){
   let lv=evaluateLVal(tree.left);
   let lvv = lv[0][lv[1]];
   if (!lvv) throw {error:"semantic", name:"Destination inexistante", 
       msg:"La partie gauche de += n'existe pas", ln:tree.left.ln};
   if(lvv.t=="array"){ // Pour les tableaux on fait une modification in situ
      let r=evaluate(tree.right);
      if(r.t=="array") lvv.val = lvv.val.concat(r.val);
      else lvv.val.push(r);
   }else{ // Pour les autres (pour l'instant) on transforme ça en a=a+b
      let r=evaluate({t:"+", left:tree.left, right:tree.right, ln:tree.ln});
      setRef(lv, r, tree.ln);
   }
}

function interpFoisEgal(tree){
    let lv=evaluateLVal(tree.left);
    let r=evaluate({t:'*', left:tree.left, right:tree.right, ln:tree.ln});
    setRef(lv, r, tree.ln);
}

function interpExit(arg){
    let v=evaluate(arg);
    if(v.t=="boolean" || v.t=="string" || v.t=="number" || v.t=="decimal")
        throw {error:"exit", val:v.val, ln:arg.ln};
    if(v.t=="Sommet") throw {error:"exit", val:v.name, ln:arg.ln};
    if(v.t=="Arc") throw {error:"exit", val:v.i.name+"->"+v.a.name, ln:arg.ln};
    if(v.t=="Arete") throw {error:"exit", val:v.i.name+"--"+v.a.name, ln:arg.ln};
    throw {error:"type", name:"Mauvais type pour exit", msg:"", ln:arg.ln};
}


