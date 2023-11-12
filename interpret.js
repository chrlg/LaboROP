// © C. Le Gal, 2017-2018
import {TRUE, FALSE, NULL} from "./constants.js";
import grlang from "./grlang.js";
import * as Env from "./environment.js";
import {isNumeric, evaluate, evaluateLVal} from "./expression.js";
import {regularCheck} from "./domcom.js";

let _env = null;

let _modules = {}; // Modules importés

let _instrCnt=0; // Nombre d'instruction exécutées (histoire de faire des vérifications régulières)

// Fonction levant une erreur de syntaxe ou lexicale (call back de l'analyseur syntaxique généré par jison)
grlang.yy.parseError = function(e, h){
   let hh=h;
   hh.msg=e;
   if(hh.token && hh.token=="INVALID"){
      hh.error="lexico";
      hh.name="Erreur lexicale";
      hh.msg="Symbole illégal "+h.text;
   }
   if(hh.line !== undefined){
      hh.ln = hh.line+1;
   }
   throw(hh);
}

// Comme on fait un langage python-like, les tabulations ont un sens syntaxique.
// Mais l'analyseur lexical n'est pas vraiment adapté à cela (la simple présence d'une tabulation
// ne signifie rien hors contexte. Ce qui compte, c'est "y en a-t-il plus, moins ou autant que sur la ligne d'avant")
// Cette fonction, appelée avant l'analyse syntaxique, se charge d'ajouter des symboles §{ et $} quand le nombre
// de tabulations augmente ou baisse dans une ligne
// Ce qui permettra à l'analyseur syntaxique de fonction comme pour un langage normal. En traitant §{ et §} comme
// le begin/end de pascal ou le { } de C/C++/Java/etc
function parseTabulation(str){
   let out=""; // Variable contenant le code transformé
   let startLine=true; // Indique si on vient de commencer une ligne (au début, c'est forcément le cas)
   let indents=[0]; // Nombre d'espace en début de ligne pour le bloc courant
   let ln=1; // Numéro de ligne
   str+="§;\n§;\n"; // Juste pour forcer à finir tous les blocs commencés
   while(str!=""){
      if(startLine){ // Si on vient de commencer une ligne (on vient de commencer le fichier ou de voir un retour charriot)
	 startLine=false;  // on génère potentiellement des §{/§}.   
	 let m=str.match(/[^ ]/).index; // m=nombre d'espaces au début de cette ligne
	 str=str.slice(m);// Maintenant qu'on sait combien il y en a on peut les virer
	 if(str[0]=="\n"){ // Si le premier caractère non espace de la ligne est un \n, on ignore juste cette ligne
	    continue;
	 }
	 let expected=indents[indents.length-1]; // expected: le nombre d'espace du bloc en cours
	 if(m==expected) continue; // C'est le même, donc rien à faire de spécial. Ni §{ ni §}
	 if(m>expected){ // Il y en a plus. Donc on vient de commencer un bloc indenté. 
	    out+="§{"; // On génère un §{ pour l'analyseur syntaxique
	    indents.push(m); // On note que le bloc courant fait maintenant cette taille d'indentation
	    continue; 
	 }
	 while(m<expected){ // Il y en a moins. Donc on va générer un certain nombre de "end" (pas forcément 1 seul)
	    out += "§}§;";  // ça dépend de combien de niveau au redescend d'un seul coup (est-ce qu'on revient à la taille
	    indents.pop();  // d'indentation précédente ? La précédente de la précédente ? Etc.
	    expected=indents[indents.length-1]; // Note: on ajoute un §;, parce que c'est aussi une fin de ligne
	 }
	 if(m>expected){ // une fois tout ça fait, normalement on est donc sorti des blocs. Mais peut-être que l'indentation
	    throw {error: "indent", msg: false, name: "Erreur d'indentation", ln:ln}; // à la quelle on vient de revenir ne
	 } // correspond à aucune indentation précédente. Genre on est sans indentation → on ouvre un bloc en indentant de 4 espaces
	 // puis on indente de 2 espaces. Ça n'est ni franchement une sortie (on ne revient pas à 0) ni la suite du bloc
	 // (on ne reste pas à 4), ni un nouveau bloc (on ne passe pas à plus que 4). Bref, c'est rien de légal
	 continue;
      }
      else if(str[0]=='\n'){ //Un \n augmente le compteur de numéro de ligne (utilisé uniquement pour les messages d'erreur
	 ln ++; // d'indentation), et signale au présent code que la prochaine lecture correspondra au début d'une ligne
	 out += "\n"; // cad là où on compte les indentations.
	 str=str.slice(1);
	 startLine=true;
	 continue;
      }else{ // Sinon, on se contente de prendre tout ce qui est jusqu'à la fin de la ligne et l'ajouter à la sortie
	 let m=str.match(/^[^\n]+/)[0];
	 out += m;
	 str=str.slice(m.length);
	 continue;
      }
   }
   return out;
}



function multMat(a, b){
   let R={t:"matrix", val:new Array(a.val.length)};
   let n=a.val.length;
   for(let i=0; i<n; i++){
      R.val[i]=new Array(n).fill(0);
      for(let j=0; j<n; j++){
         for(let k=0; k<n; k++){
            R.val[i][j] += a.val[i][k]*b.val[k][j];
         }
      }
   }
   Env.OpCnt += 2*n*n*n;
   return R;
}

function boolMultMat(a,b){
   let n=a.val.length;
   let R=zeroDim(n);
   for(let i=0; i<n; i++){
      for(let j=0; j<n; j++){
         for(let k=0; k<n; k++){
            if(a.val[i][k]!=0 && b.val[k][j]!=0){
               R.val[i][j]=1;
               break;
            }
         }
      }
   }
   Env.addCnt(2*n*n*n);
   return R;
}

function powMat(a, k){
   if(k==0) return preId();
   if(k==1) return a;
   var H=powMat(a, Math.trunc(k/2));
   var HH=multMat(H,H);
   if(k%2) return multMat(HH,a);
   return HH;
}

function boolPowMat(a,k){
   if(k==0) return preId();
   if(k==1) return a;
   var H=boolPowMat(a, Math.trunc(k/2));
   var HH=boolMultMat(H,H);
   if(k%2) return boolMultMat(HH,a);
   return HH;
}


// Fonction interne d'ajout de sommet
function addSommet(name, graphe, ln){
    if(graphe===Env.Gr && Env.Graphes[name]) throw{error:"env", name:"Nom de sommet illégal", msg:"Un sommet du graphe Gr ne peut porter le nom d'un graphe", ln:ln};
    graphe.sommets[name] = {t:"Sommet", name:name, marques:{}};
}

// Récupère la valeur d'un sommet à partir d'une chaine ou d'une variable non identifiée
// Si creer est true, crée le sommet s'il n'existe pas
// Si le sommet n'existe pas, et n'a pas été créé, retourne le nom à la place
function evalSommet(som, creer, graphe){
    let str=null;
    let S=null;
    if(som.t=="id"){
        if(graphe.sommets[som.name]!==undefined) return graphe.sommets[som.name]; // Sommet déjà existant (dans ce graphe)
        if(Env.get(som.name)===undefined) str=som.name; // Identifiant non existant. Traité comme une chaîne
    }

    if(str===null){
        let ev=evaluate(som); // Y compris un "id", mais qui peut être une variable de type chaine
        if(ev===undefined) throw {error:"type", name:"Sommet indéfini", msg: "", ln:som.ln};
        if(ev.t=="string") str=ev.val;
        else if(ev.t=="Sommet") str=ev.name; // Note : c'est forcément d'un autre graphe, sinon on ne serait plus là
        else throw {error:"type", name:"Ce n'est pas un sommet", msg:"Une expression de type '"+ev.t+"' n'est pas un sommet légal", ln:som.ln};
    }
    if(str===null) throw {error:"internal", name:"Sommet non défini", msg:"Erreur interne : le sommet est indéfini", ln:som.ln};
    if(!str.match(/^[A-Za-z0-9_]*$/)){
        throw{error: "type", name: "Nom de sommet illégal", 
            msg: "Le nom d'un sommet ne doit contenir que\ndes caractères alphanumériques\nnom:"+str, ln: som.ln};
    }
    if(graphe.sommets[str]) return graphe.sommets[str];
    if(creer) {
        addSommet(str, graphe, som.ln);
        return graphe.sommets[str];
    }
    return str;
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
	 addSommet(ev, g, liste[i].ln);
      }
      // Autre chose ?
      else throw {error:"interne", name:"Erreur interne", msg:"Ni string, ni sommet dans creerSommet\nev:"+ev+"\nev.t="+ev.t, ln:liste[i].ln};
   }
   g.change=true;
}

function getRef(ref){
   // Cas matriciel
   if(typeof ref[0][ref[1]] == "number") return {t:"number", val:ref[0][ref[1]]};
   return ref[0][ref[1]];
}

function setRef(ref, val, ln){
    // Cas des arcs et arêtes
    if(ref.length==6){
        if(ref[0]==Env.Gr.sommets || ref[2]==Env.Gr.sommets){ // Arc constitué d'un sommet immutable
            throw {error:"env", name:"Surdéfinition d'un arc", msg:"Impossible d'écraser l'arc ou l'arête ("+ref[1]+","+ref[3]+")", ln:ln};
        }
        if(val.t=="null"){ // Arc null (récupéré avec un filtrage, par ex) => tout à null
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
    if(ref[0]==Env.Gr.sommets) throw {error:"env", name:"Surdéfinition d'un sommet", 
        msg:"Impossible d'écraser le sommet "+ref[1], ln:ln};

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

function creerArete(ins){
   let left=ins.left;
   let right=ins.right;

   // Graphe concerné
   let g=Env.getGraph(ins.g, ins.ln);
   // Une arête implique un graphe non orienté. Fixer l'orientation si pas encore fait. Sinon, lever une erreur si contradictoire
   if(g.isOrient()) throw {error:"graphe", name: "Erreur de graphe", msg: "Un graphe orienté ne peut contenir d'arêtes", ln: ins.ln};
   if(g.isOrient()===undefined) g.setOrient(FALSE);

   let l=evalSommet(left, true, g);
   let r=evalSommet(right, true, g);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour une arête", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour une arête", ln:right.ln};

   let na={t:"Arete", i:l, a:r, marques:{}};
   if(g.arcs.length>10000) throw {error:"memory", name:"Too many arcs", msg:"oom", ln:left.ln};
   g.arcs.push(na);
   g.change=true;
   return na;
}

function creerArc(ins){
   let left=ins.left;
   let right=ins.right;

   let g=Env.getGraph(ins.g, ins.ln); // Graphe concerné
   // Un arc implique un graphe orienté
   if(g.isOrient()===undefined) g.setOrient(TRUE);
   if(!g.isOrient()) throw {error:"graphe", name:"Erreur de graphe", msg:"Un graphe non orienté ne peut contenir d'arcs", ln:left.ln};

   let l=evalSommet(left, true, g);
   let r=evalSommet(right, true, g);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour un arc", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour un arc", ln:right.ln};

   let na={t:"Arc", i:l, a:r, marques:{}};
   if(g.arcs.length>10000) throw {error:"memory", name:"Too many arcs", msg:"oom", ln:left.ln};
   g.arcs.push(na);
   g.change=true;
   return na;
}

function interpDef(def){
   if(Env.getPredef(def.nom)) throw {error:"type",
      name: "Surdéfinition", msg: "Impossible de redéfinir le symbole prédéfini "+def.nom,
      ln:def.ln};
   if(Env.Global[def.nom]!==undefined) throw {error:"type", name: "Surdéfinition", msg: "Fonction "+def.nom+" déjà définie", ln: def.ln};
   Env.Global[def.nom] = def;
}

function interpCall(call){
   let fn=Env.get(call.f);
   if(fn===undefined) throw {error:"symbol", name: "Fonction non définie",
	    msg:"La fonction "+call.f+" n'existe pas", ln: call.ln};
   if(fn.t=="predfn") return fn.f(call.args, call.ln, call.f);
   if(fn.t=="predvar" && fn.optarg) return fn.f(call.args, call.ln, call.f);
   if(fn.t!="DEF") throw {error:"type", name:"Pas une fonction",
	    msg:"Tentative d'appeler "+call.f+", qui n'est pas une fonction", ln:call.ln};
   if(fn.args.length != call.args.length) throw {error: "type", name:"Mauvais nombre d'arguments",
	    msg:"Appel de "+call.f+" avec "+call.args.length+" argument(s) alors que "+
	        fn.args.length+" sont attendus", ln:call.ln};
   var newEnv = {};
   for(let i=0; i<call.args.length; i++){
      let v=evaluate(call.args[i]);
      newEnv[fn.args[i]] = v;
   }
   newEnv["*"]={t:"empty"};
   _localEnv=newEnv;
   _stackEnv.push(_localEnv);
   interpretWithEnv(fn.insts, false);
   var retval=newEnv["*"];
   _stackEnv.pop();
   _localEnv = _stackEnv[_stackEnv.length-1];
   return retval;
}

function interpIf(si, isloop){
   var c=evaluate(si.cond);
   if(c.t=='null') c=FALSE;
   if(c.t != "boolean") throw {error:"type", name: "Condition non booléenne",
           msg:"La condition du if n'est pas un booléen", ln:si.cond.ln};
   if(c.val) return interpretWithEnv(si["do"], isloop);
   else return interpretWithEnv(si["else"], isloop);
}

function interpWhile(tant){
   for(;;){
      var c=evaluate(tant.cond);
      if(c.t=='null') c=FALSE;
      if(c.t!="boolean") throw {error:"type", name: "Condition non booléenne",
	    msg:"La condition du while n'est pas un booléen", ln:tant.ln};
      if(!c.val) break;
      var b=interpretWithEnv(tant["do"], true);
      if(b=="break") break;
      if(b=="return") return "return";
   }
   return false;
}

function interpFor(ins){
   var comptRef = evaluateLVal(ins.compteur);
   var start=evaluate(ins.start);
   var end=evaluate(ins.end);
   var step={t:"number", val:1};
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

function interpForeach(ins){
   var range=evaluate(ins.range);
   if(range.t!="array"){
      throw {error:"type", name:"Mauvaise plage pour 'for'",
             msg:"Un "+range.t+" ne peut être une plage d'itération pour 'for'",
             ln:ins.range.ln};
   }
   var comptRef=evaluateLVal(ins.compteur);
   for(let i=0; i<range.val.length; i++){
      setRef(comptRef, range.val[i], ins.compteur.ln);
      let b=interpretWithEnv(ins.do, true);
      if(b=="break") break;
      if(b=="return") return "return";
   }
   return false;
}

function interpReturn(ins){
   if(_localEnv["*"]===undefined){
      throw {error:"exec", name:"Return en dehors d'une fonction",
             msg:"'return' ne peut être utilisé qu'à l'intérieur d'une fonction",
	     ln:ins.ln};
   }
   if(ins.val===undefined) return;
   var v=ins.val.map(evaluate);
   if(v.length==1) _localEnv["*"]=v[0];
   else _localEnv["*"]={t:"tuple", v:v};
   return;
}

function interpExit(arg){
   var v=evaluate(arg);
   if(v.t=="boolean" || v.t=="string" || v.t=="number")
      throw {error:"exit", val:v.val, ln:arg.ln};
   if(v.t=="Sommet") throw {error:"exit", val:v.name, ln:arg.ln};
   if(v.t=="Arc") throw {error:"exit", val:v.i.name+"->"+v.a.name, ln:arg.ln};
   if(v.t=="Arete") throw {error:"exit", val:v.i.name+"--"+v.a.name, ln:arg.ln};
   throw {error:"type", name:"Mauvais type pour exit", msg:"", ln:arg.ln};
}


function interpPlusEgal(tree){
   let lv=evaluateLVal(tree.left);
   let lvv = lv[0][lv[1]];
   if(lvv.t=="array"){ // Pour les tableaux on fait une modification in situ
      let r=evaluate(tree.right);
      if(r.t=="array") lvv.val = lvv.val.concat(r.val);
      else lvv.val.push(r);
   }else{ // Pour les autres (pour l'instant) on transforme ça en a=a+b
      let r=evaluate({t:"+", left:tree.left, right:tree.right, ln:tree.ln});
      setRef(lv, r, tree.ln);
   }
}

// LISTE D'INSTRUCTIONS
let _ln = 0;
function interpretWithEnv(tree, isloop){
    for(let ti of tree){
        if(_instrCnt++>100000) {
            regularCheck();
            _instrCnt=0;
        }
        _ln=ti.ln;
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
            var b=interpFor(ti);
            if(b=="return") return "return";
            continue;
        }
        if(ti.t=="if"){
            var b=interpIf(ti, isloop);
            if(isloop && b=="break") return "break";
            if(isloop && b=="continue") return "continue";
            if(b=="return") return "return";
            continue;
        }
        if(ti.t=="while"){
            var b=interpWhile(ti);
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
        if(ti.t=="Graphe"){
            if(Env.Predef[ti.name]) 
                throw {error:"env", name:"Surdéfinition", msg:"Le nom "+ti.name+" est réservé", ln:ti.ln};
            if(Env.Gr.sommets[ti.name])
                throw {error:"env", name:"Surdéfinition", mrg:`Le nom ${ti.name} est celui d'un sommet du graphe principal`, ln:ti.ln};
            if(Env.Graphes[ti.name]){
                Env.Graphes[ti.name].sommets={};
                Env.Graphes[ti.name].arcs.length=0;
            }else{
                Env.addGraphe(ti.name, ti.ln);
            }
            continue;
        }
        if(ti.t=="$"){
            prePrintln([{t:"string", val:JSON.stringify(eval(ti.i.slice(1))), ln:ti.ln}]);
            continue;
        }
    }
    return false;
}

function interpret(tree){
    Env.reset();
    interpretWithEnv(tree, false, false);
    regularCheck(true);
}

onmessage = function (e){
   try{
      let str=parseTabulation(e.data);
      let out = grlang.parse(str);
      interpret(out);
      postMessage({termine: 0, opcnt:Env.OpCnt});
   }catch(e){
      if(e.error) {
	 if(e.error=="exit") {
	    if(e.val) postMessage({error:"exec", name:"Erreur signalée par le progamme",
	       msg:"Le programme a déclenché l'erreur "+e.val, ln:e.ln});
	    else postMessage({termine: e.val, tree:out});
	 }
	 else postMessage(e);
      }
      else if(e.msg){
	 postMessage({error: "syntax", name: "Erreur de syntaxe", msg: e.msg, ln: e.line+1, err:e});
      }
      else {
         console.trace(e);
         postMessage({error:"interne", name:"Erreur interne", msg:JSON.stringify(e), ln:_ln});
         throw(e);
      }
   }
}

