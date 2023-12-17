import * as Cst from "./constants.js";
import * as Env from "./environment.js";
import * as Mod from "./modules.js";
import * as Mat from "./matrix.js";
import {evaluate, evaluateLVal, isNumeric, numericValue} from "./expression.js";
import {regularCheck, print, flush} from "./domcom.js";
import Decimal from "./lib/decimal.mjs";

// help available for different kind of objects. To be fill later in the code
let Help={"predfn":{}, "type":{}, name:{}, "line":"════════════════════════════════════════════════════════════\n"};

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
   Env.addPredfn("help", preHelp);
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
Help.predfn.clear=`clear()
Remet le graphe Gr (graphe par défaut) à 0. 
Cad supprime tous les sommets et arcs de ce graphe.
`;

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
Help.predfn.sommets=`sommets():
Retourne la liste des sommets du graphe par défaut (Gr)
Dans le mode «découverte» seuls les sommets visibles sont retournés
────────────────────────────────────────────────────────────
sommets(graphe):
Retourne la liste des sommets du graphe «graphe»
Dans le mode «découverte» seuls les sommets visibles sont retournés
────────────────────────────────────────────────────────────
sommets(index):
index est un entier
Retourne le indexᵉ sommet du graphe
Dans le mode «découverte», si ce sommet n'est pas visible, une erreur
est déclenchée
────────────────────────────────────────────────────────────
sommets(graphe, index)
cf deux précédents
────────────────────────────────────────────────────────────
Notez qu'il n'y a aucune règle de numérotation des sommets.
Vous ne pouvez donc pas utiliser l'index pour désigner un sommet précis.
En revanche, la numérotation, arbitraire, est garantie déterministe.
L'index peut donc être utilisé, par exemple, pour reprendre
une itération interrompue
`;


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
Help.predfn['len']=`len(tableau): Retourne la longueur d'un tableau
    print(len([1,2,3]))
    →
    3
────────────────────────────────────────────────────────────
len(chaine): retourne la longueur d'une chaine
    print(len("abdegilmopstuv"))
    →
    14
────────────────────────────────────────────────────────────
len(matrice): retourne la dimension de la matrice carrée.
C'est à dire le nombre de sommets du graphe d'où est tirés cette matrice
    Arc (A,B)
    print(len(Id))
    ⇒
    2
────────────────────────────────────────────────────────────
len(graphe): retourne le nombre de sommets du graphe
Notez que c'est la même valeur que len(Id(graphe)) ou len(sommets(graphe))
(Sauf en mode découverte, ou sommets() ne contient pas tous
les sommets).
Mais plus rapide, car len(Id) doit fabriquer la matrice
identité avant de la mesurer, et len(sommets()) doit fabriquer 
la liste de sommets 
`

// Random
// Can be used with no argument-> return a number between 0 and 1
// With 1 number -> an integer between 0 and that number
// With 2 numbers -> an integer between the 2 numbers
// With an array -> a choice
function preRandom(args, named, ln, fname){
    // No arg => U([0,1])
    if(args.length==0){
        return {t:"number", val:Math.random()};
    }
    let a=evaluate(args[0]);
    // 1 or 2 numbers
    if(isNumeric(a)){
        if(args.length==2){
            let b=evaluate(args[1]);
            if(!isNumeric(b)) throw {error:"type", name:"Mauvais argument pour random",
                msg:"Un nombre et un "+a.t+" ne sont pas des arguments valides", 
                ln:args[1].ln};
            return {t:"number", val:numericValue(a)+Math.floor(Math.random()*(numericValue(b)-numericValue(a)))};
        }
        return {t:"number", val:Math.floor(Math.random()*numericValue(a))};
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
Help.predfn.random=`random(): retourne un nombre réel aléatoire entre 0 et 1
────────────────────────────────────────────────────────────
random(nombre): retourne un nombre entier aléatoire 
entre 0 (inclus) et nombre (exclu)
────────────────────────────────────────────────────────────
random(nb1, nb2): retourne un nombre entier aléatoire entre 
nb1 (inclus) et nb2 (exclu)
Notez que pour ces deux derniers usage, les arguments peuvent être
des nombres décimaux, mais le résultat est un nombre normal
    random(10d)
retourne 0,1,2,3,4,5,6,7,8 ou 9. Pas 0d, 1d, ...
Cela est logique, puisque ces nombres sont de toutes façons entiers, donc exacts
Rien n'empêche d'écrire random(10)*1d, si on veut un décimal
────────────────────────────────────────────────────────────
random(tableau): retourn un élément au hasard du tableau
────────────────────────────────────────────────────────────
random(tableau, filtre): retourne un élément aléatoire du tableau
parmi ceux pour lesquels «filtre» est vrai.
Le mot clé «this» désigne l'élément potentiel dans ce filtre. Ainsi
    random([1,2,3,4,5,6], this%2==0)
retourne un nombre pair 
    random(sommets(), this.color=='blue')
retourne un des sommets dont la couleur est bleue
`

// Internal function : prints an object. 
// Used mainly in prePrint function. But may be used also by other functions that may want to print things (such as help)
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
        else print("{"+o.t+"}");
    }
    else{
        print(o);
    }
}
function prePrint(args, named, ln, fname){

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
Help.predfn['print']=`print(o1, o2, ...): affiche les arguments passés
Accepte les arguments optionnels nommés
* sep=chaine: sépare les arguments par «sep». Par défaut sep est l'espace ' '
    print(1,2,3,sep='|') ⇒ 1|2|3
* end=chaine: termine l'affichage par «end>. Par défaut, end est le retour charriot '\n'
    print(1, end='-')
    print(2)
    print(3,4)
    ⇒ 
    1-2
    3 4
* flush=booleen: force l'affichage immédiat (sans attendre que la plateforme décide
    d'elle même de rafraichir l'affichage)
    Attention, la plupart du temps cela est inutile et ralentit l'affichage
    Par défaut, cela est vrai si end est '\n', sinon c'est faux.

Notez que print peut s'utiliser sans argument. Dans ce cas, seul «end» (par défaut 
un retour charriot) est affiché.

Voir aussi : println, printnr
`

Help.predfn['println']=`println(o1,o2,...): affiche les arguments passés.
Ancienne fonction gardée pour compatibilité. 
C'est l'équivalent de 
    print(o1, o2, ..., end='\n', sep='')
C'est à dire que les arguments sont affichés sans espace les séparents, et que
la ligne se termine par un retour charriot
Voir aussi : print, printnr
`

Help.predfn['printnr']=`printnr(o1,o2,...): affiche les arguments passés.
C'est l'ancienne fonction «print».
Équivalent à l'actuel 
    print(o1, o2, ..., end='', sep='')
Voir aussi : print, println
`

function preRefresh(args, named, ln, fname){
   if(args.length!=0) throw{error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction refresh s'utilise sans argument", ln:ln};
   regularCheck(true);
}
Help.predfn.refresh=`refresh():
Force l'affichage du texte non encore affiché, et le redessin des graphes
`;

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
Help.predfn.arcs=`arcs(g): retourne la liste des arcs du graphe «g»
────────────────────────────────────────────────────────────
arcs(): même chose, pour le graphe par défaut «Gr»
────────────────────────────────────────────────────────────
arcs(g, sommet) or arcs(sommet):
retourne les arcs sortant du sommet. 

Notez qu'en mode découverte, seuls les arcs sortant des sommets visibles sont retournés
`
Help.predfn.aretes=`aretes(g): retourne la liste des arêtes du graphe «g»
────────────────────────────────────────────────────────────
aretes(): même chose, pour le graphe par défaut «Gr»
────────────────────────────────────────────────────────────
aretes(g, sommet) or aretes(sommet):
retourne les aretes liées au sommet. 
Notez que [A,B] et [B,A] sont la même arête. Toutefois, vous avez la garantie que
aretes(S) ne retourne des arêtes que sous la forme [S,x] (avec S en premier)
et non [x,S]

Notez aussi qu'en mode découverte, seuls les arêtes liées aux sommets visibles sont retournées
`

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
    return {t:'number', val:Math.floor(v.val)};
}

function preHelp(args, named, ln, fname){
    // Without args, just shows the list of predef symbols
    if(args.length==0){
        print(Help.line);
        print("Help : liste des symboles prédéfinis\n");
        print(Help.line);
        for(let k in Env.Predef){
            print(k+' ');
        }
        print('\n');
        print(Help.line);
        return;
    }
    if(args.length>1) error({error:"args", name:"Mauvais nombre d'arguments", msg:"help s'utilise avec 0 ou 1 argument", ln:ln});
    // With 1 arg: show Help about that arg
    // Help about specific symbol names (for constants)
    if(args[0].t=='id' && Help.name[args[0].name]){
        print(Help.line);
        print(Help.name[args[0].name]);
        print(Help.line);
        return;
    }
    let a=evaluate(args[0]);
    if(a.t=='predfn'){
        if(Help.predfn[a.name]){
            print(Help.line);
            print(Help.predfn[a.name]);
            print(Help.line);
            return;
        }
        print(`Pas d'aide disponible sur la fonction «${a.name}»\n`);
    }
    if(Help.type[a.t]){
        print(Help.line);
        print(Help.type[a.t]);
        print(Help.line);
    }
    if(a.t=='Sommet'){
        let g=Env.grapheContaining(a);
        print(`Sommet «${a.name}» du graphe «${g.name}»\nConnecté aux ${g.isOrient()?"arcs":"aretes"}:\n`);
        for(let edge of g.arcs){
            if(edge.i==a || edge.a==a) print(`   ${edge.i.name}${g.isOrient()?'—→':'——'}${edge.a.name}\n`);
        }
        print("Attributs:\n")
        for(let m in a.marques){
            print(`    ${m}:`);
            printRec(a.marques[m]);
            print('\n');
        }
        print(Help.line);
    }else if(a.t=='Arc'){
        let g=Env.grapheContaining(a.i);
        print(`Arc ${a.i.name}→${a.a.name} du graphe «${g.name}»\n`);
        print("Attributs:\n");
        for(let m in a.marques){
            print(`    ${m}:`);
            printRec(a.marques[m]);
            print('\n');
        }
        print(Help.line);
    }else if(a.t=='Arete'){
        let g=Env.grapheContaining(a.i);
        print(`Arete ${a.i.name}——${a.a.name} du graphe «${g.name}»\n`);
        print("Attributs:\n");
        for(let m in a.marques){
            print(`    ${m}:`);
            printRec(a.marques[m]);
            print('\n');
        }
        print(Help.line);
    }else if(a.t=='graphe'){
        print(`Graphe ${a.isOrient()?"orienté":"non-orienté"} ${a.name}\n`);
        print(`graphe s'affichant dans le mode graphique «${a.mode}»\n`);
        if(a.discover) 
            print(`graphe en mode découverte : seuls les sommets marqués visibles sont affichés ou apparaissent dans les listes de sommets\n`);
        print(`Ce graphe contient ${Object.keys(a.sommets).length} sommets et ${a.arcs.length} arcs\n`);
        print(Help.line);
    }
    if(Help.type[a.t]) return; // We have already printed some help

    print(`Pas d'aide disponible sur le type «${a.t}»\n`);
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
Help.predfn['premier']=`premier(tableau): retourne le premier élément du tableau.
Si le tableau est vide, retourne «null»
`

function preDernier(args, named, ln, fname){
   if(args.length!=1) throw {error:"type", name:"Mauvais nombre d'arguments",
         msg:"Mauvais nombre d'arguments pour dernier", ln:ln};
   let l=evaluate(args[0]);
   if(l.t!="array") throw {error:"type", name:"Erreur de type",
         msg:"'dernier' attend un argument de type tableau", ln:args[0].ln};
   if(l.val.length<=0) return Cst.NULL;
   else return l.val[l.val.length-1];
}
Help.predfn['dernier']=`dernier(tableau): retourne le dernier élément du tableau.
Si le tableau est vide, retourne «null»
`


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
        if(g.t!="graphe") throw {error:"env", ln:ln, name:"Mauvais type d'argument", msg:"Quand la variable Id est utilisée avec un argument optionnel, cet argument doit être un graphe"};
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

Help.type['number']=`Un nombre est un entier ou un réel. 
Lorsque ce nombre est un entier inférieur à 9007199254740992, il est exact. 
Sinon, il souffre de l'erreur numérique classique des réels. Par exemple 
    print(0.1+0.2==0.3)
    ⇒
    False
Utilisez les nombres décimaux si cela est un problème.
cf help(1d)
`;

Help.type['decimal']=`Un nombre décimal. Un nombre décimal est exact si sa représentation
en base 10 (y compris avec des virgules) l'est. Contrairement aux nombres flottants
habituels, qui ne sont exacts que quand leur représentation en base 2 l'est.
Une limitation à 50 décimales (ce qui est bien plus précis que les 64 bits habituels) 
existe toutefois.
Les constantes décimales s'écrivent en ajoutant un «d» après le nombre.
    print(0.1d+0.2d==0.3d)
    ⇒
    True
Comparez avec «0.1+0.2==0.3» (cf help(1)).
Le caractère décimal d'un nombre est en général viral.
Ainsi 1+2d+3+4 est un nombre décimal
`;

Help.type['string']=`Une chaîne de caractères.
Les chaînes sont indexables, mais non mutables. Ainsi
    s="hello"
    print(s, s[0], s[1:3], s[:-1])
    ⇒
    hello h el hell
Mais
    s[0]='H'
déclenche une erreur

À voir aussi: len, int
`;

Help.type['null']=`Une valeur (dont le type, null, n'existe que pour elle) spéciale.
Elle est retournée par certaines fonctions pour signifier qu'il n'y a pas de résultat.
L'accès à un champ inexistant d'un sommet, 
Une converstion impossible (int("x"))
Etc., 
Retournent «null»
`

Help.type['array']=`Un tableau de valeurs quelconques.
Attention à l'ambiguïté : deux valeurs entre crochets sont considérés comme une arête
par le langage. Pour lever cette ambiguïté, on peut laisser une virgule. Ainsi
    [S1,S2]
est une arête. Tandis que
    [S1,S2,]
est un tableau contenant deux valeurs, qui sont les sommets S1 et S2.

Les tableaux peuvent être indexé. Lorsque les index sont négatifs, ils sont comptés
à partir de la fin.
    T=[1,2,3,4]
    print(T[0], T[1], T[-1], T[-2])
    ⇒
    1 2 4 3

Il est également possible d'extraire des sous tableaux
    print(T[:2], T[2:], T[-2:], T[1:3])
    ⇒
    [1,2] [3,4] [3,4] [2,3]

À voir aussi: len, premier, dernier, random, pop, insert
`

Help.name['Infinity']=`Un nombre presque comme les autres nombres.
Si ce n'est qu'il est plus grand que tous les nombres.
    print(Infinity>1e30)
    ⇒
    True
`

Help.name['Id']=`La matrice identité.
Il s'agit d'une matrice carrée, dont la dimension est le nombre de sommets du graphe.

«Id» se comporte à la fois comme une variable («print(Id)» affiche l'Identité)
et comme une fonction, auquel cas son argument doit être un graphe,
et elle retourne la matrice identité correspondant à ce graphe 
    Graphe E
    Arc<E> (A,B)
    print(Id(E))
    →
    ⎡1 0⎤
    ⎣0 1⎦

Pour l'aide sur les matrices en général, voir help(matrix) ou help(Id*1)
Voir aussi : Adj, Zero
`

Help.type['matrix']=`Une matrice.
Dans le langage, toutes les matrices sont carrées, et contiennent des nombres.

Les éléments (nombres) d'une matrice peuvent être obtenus en utilisant l'indexation 2d
M[i,j] est l'élément de la jᵉ colonne de la iᵉ ligne de M
    Arc (A,B)
    Arc (B,C)
    print(Adj)
    print(Adj[0,0], Adj[0,1])
    ⇒
    ⎡0 1 0⎤
    ⎢0 0 1⎥
    ⎣0 0 0⎦

    0 1
Il est possible de faire des opérations arithmétiques élémentaires entre des matrices et
des nombres
    print(Adj*3+1)
    →
    ⎡1 4 1⎤
    ⎢1 1 4⎥
    ⎣1 1 1⎦
Ainsi qu'entre matrices
    print(Adj*3+Id)
    ⇒
    ⎡1 3 0⎤
    ⎢0 1 3⎥
    ⎣0 0 1⎦
La multiplication entre deux matrices doit être comprise comme l'opération d'algèbre linéaire,
et non la multiplication élément par élément. Ainsi Adj*Adj est
    ⎡0 0 1⎤                ⎡0 1 0⎤
    ⎢0 0 0⎥ et non pas     ⎢0 0 1⎥
    ⎣0 0 0⎦                ⎣0 0 0⎦
De même pour Adj**2.
Enfin, des opérateurs booléens existent (.+, .*, .**)
    
Voir aussi : Id, Adj, Zero
`

Help.name.matrix=Help.type.matrix

Help.name.True = `Le booléen vrai.
Voir help(boolean) ou Help(1==1) pour l'aide générale sur les booléens
Voir aussi : False
`

Help.type['boolean'] = `Valeur booléenne.
Peut valoir True ou False.
Les opérateurs «and», «or», «xor» permettent des les combiner:
    print(True and False, True or False, True xor False)
    ⇒
    False True True
L'opposé d'un booléen est obtenu par l'opérateur ! ou not
    print(!True, not False)
    →
    False True
Enfin, les opérateur && et || existent également, signifiant également «and» et «or»
Il ne s'agit toutefois pas de synonymes exacts: «and» et «or» sont paresseux
tandis que «&&» et «||» ne le sont pas
    x=10
    y=10
    print(x++>0 or x++>0, x, y++>0 || y++>0, y)
    ⇒
    True 11 True 12

Voir aussi : True, False
`

Help.name['boolean'] = Help.type['boolean']

Help.type['Sommet'] =`Un sommet d'un graphe.
Un sommet est créé par l'instruction ad-hoc
    Sommet S
L'argument de «Sommet» peut être également une expression dont la valeur est une chaine
    Sommet "S"+2 # Crée le sommet S2
Plusieurs sommets peuvent être créés à la fois
    Sommet A,B,C
Un sommet peut être créé dans un autre graphe
    Sommet<Ecart> A,B,C # Crée des sommets A,B,C dans le graphe Ecart
Si un seul sommet est créé, alors l'instruction Sommet retourne également le sommet créé
    x=Sommet<E> A

Enfin, un sommet peut également être crée implicitement quand un arc ou une arête le mentionnant est créé
    Arc (A,B) # Crée les sommets A et B s'ils n'existaient pas déjà

Les sommets peuvent avoir des attributs arbitraires
    A.foo="bar"

En général, c'est à vous de choisir le nom et la signification de ces attributs. 
Certains attributs toutefois ont un rôle spécifique
    A.x, A.y # Coordonnées du sommet dans le dessin pour les mode "map" et "mesh"
    A.color # Couleur du sommet dans le dessin pour les mode "node" et "mesh"
    A.label # Information supplémentaire affichée dans le dessin pour les modes "node" et "mesh"
    A.visible # En mode découverte, le sommet est visible ssi cet attribut est présent et vrai
`

Help.type['Arc']=`Un arc entre deux sommets dans un graphe orienté.
Un arc est crée par l'instruction ad-hoc
    Arc (S1, S2)     # Crée un arc entre les sommets S1 et S2
    Arc<E> (S1, S2)  # Crée un arc dans le graphe E
    x=Arc<E> (S1,S2) # Crée un arc, et range l'arc créé dans x

Dans le reste du code un arc est désigné sous forme de paire parenthésée de sommets
    print((S1,S2))

Les arcs peuvent avoir des attributs
    x.color="blue"
    print((S1,S2).color)

En général, c'est à vous de choisir le nom et la signification de ces attributs. 
Certains attributs toutefois ont un rôle spécifique
    x.color # Couleur de l'arc dans le dessin
    x.val # valeur de l'arc affichée dans le dessin pour les mode "node" et "mesh", sauf si un label est aussi présent
    x.label # Information supplémentaire affichée dans le dessin pour les modes "node" et "mesh"
    x.initial # sommet initial de l'arc
    x.terminal # sommet terminal de l'arc
`

Help.type['Arete']=`Une arête entre deux sommets dans un graphe non-orienté.
Une arête est créée par l'instruction ad-hoc
    Arete [S1, S2]     # Crée une arête entre les sommets S1 et S2
    Arete<E> [S1, S2]  # Crée une arête dans le graphe E
    x=Arete<E> [S1,S2] # Crée une arête, et range l'arête créée dans x

Dans le reste du code une arête est désignée sous forme de paire crochetée de sommets
    print([S1,S2])

Les arêtes peuvent avoir des attributs
    x.color="blue"
    print([S1,S2].color)

En général, c'est à vous de choisir le nom et la signification de ces attributs. 
Certains attributs toutefois ont un rôle spécifique
    x.color # Couleur de l'arête dans le dessin
    x.val # valeur de l'arête affichée dans le dessin pour les mode "node" et "mesh", sauf si un label est aussi présent
    x.label # Information supplémentaire affichée dans le dessin pour les modes "node" et "mesh"
    x.initial # un des deux sommets  de l'arête
    x.terminal # l'autre sommet. Notez que cette notation est héritée des arc. Mais dans une arête
               # les sommets n'ont aucun rôle particulier, et aucune règle ne dit lequel
               # sera x.initial et lequel sera x.terminal. Seulement que x.initial≠x.terminal
`

Help.type['struct']=`Une structure, ou dictionnaire.
La structure vide est «{}».
Les champs d'une structure sont ajoutés sans déclaration préalable 
    st={}
    st.a=42
    st.name="blabla"
    print(st.name)
Notez que les structures sont passées par valeur. Ce qui signifie que
    st1={}
    st1.a=42
    st2=st1   # st2 est une copie de st1
    st2.a=55  # N'affecte que le champ a de la copie
    print(st1, st2)
    ⇒
    {a:42} {a:55}
`

Help.type['graphe']=`Un graphe.
Le graphe par défaut, existant à l'avance, s'appelle «Gr».
Toutes les instructions et fonctions s'appliquent par défaut à Gr.
«Sommet A», «sommets()», «Adj» sont ainsi des instructions ajoutant un sommet 
A au graphe Gr, retournant la liste des sommets du graphe Gr, la matrice
d'adjacence du graphe Gr, ...

Toutefois, il est possible de créer d'autres graphes par l'instruction
    Graphe E
Si E était déjà existant, il est réinitialisé

Dans ce cas, les instructions Sommet, Arc, Arete, peuvent prendre
un contexte optionnel <E> pour spécifier le graphe sur lequel elle s'appliquent
    Sommet<E> A,B,C
    Arc<E> (A,B)
    Arete<E> [A,B]

La plupart des fonctions pour lequel cela fait sens, acceptent un argument
optionnel qui est le graphe 
    sommets(E)
    arcs(E)
Y compris pour les variables spéciales
    Id(E), Adj(E), Zero(E)
`

Help.name['pi']=`La constante π.
Notez qu'il s'agit d'un «nombre», c'est à dire qu'il n'a que la précision des nombres flottants.
Voyez «acos(-1d)» pour plus de décimales, si cela vous amuse :-)
`

