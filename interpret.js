// © C. Le Gal, 2017-2018
importScripts("decimal.js");
importScripts("grlang.js");
importScripts("constants.js");
importScripts("domcom.js");
importScripts("environment.js");

var _env = new Environnement();

var _modules = {}; // Modules importés

var _str=""; // Chaine "stdout" à envoyer à la console
var _instrCnt=0; // Nombre d'instruction exécutées (histoire de faire des vérifications régulières)
var _opCnt=0; // Nombre d'opérations (pour tester le coût des algos)
var _strChange=false; // true ssi _str a changé depuis la dernière fois qu'elle a été affichée

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

function isNumeric(v){
   if(v.t=='number') return true;
   if(v.t=='decimal') return true;
   return false;
}

function numericValue(v){
    if(v.t=='number') return v.val;
    if(v.t=='decimal') return v.val.toNumber();
    return undefined;
}

// Etant donnée une référence o (un "pointeur" en quelques sortes) vers un arc
// donne la valeur de l'arc (l'objet de _arcs)
// Note: une référence (cf plus loin) est une paire (object / nom) tel que
// objet.nom désigne l'objet référé
// Ça me sert ici de pointeur, puisque ça veut dire que je peux modifier la valeur
// de l'objet référé
// o est donc un tableau de dimension 2
// o[0] est donc classiquement un environnement, et o[1] le nom d'une variable
// définie dans cet environnement. Donc o[0][o[1]] sa valeur
// o[0] peut également être le champ "f" (liste des champs) d'une structure
// et donc o[1] le nom d'un champ. Donc o[0][o[1]] est structure.champ
// o[0] peut aussi être le champ val d'un tableau, et o[1] l'indice (un nombre donc)
// Ce qui là encore veut dire que o[0][o[1]] = la valeur référencée
// Le cas des arcs est toutefois particulier. Car un arc [a,b] dans la syntaxe particulière 
// du langage, c'est à la fois juste une paire de sommet ([a,b]=random(arcs(S)) signifie que a
// et b sont de nouvelles variables de type sommet), mais aussi un pointeur vers l'objet arc lui
// même (on peut ensuite écrire [a,b].champ=12. Ce qui ne touche pas aux sommets, mais aux
// champs de l'arc lui-même)
// Pour cette raison la référence vers un arc n'est pas de longueur 2 mais 6
// Avec o[0][o[1]] étant la référence vers le 1er sommet, o[2][o[3]] vers le 2e sommet
// et o[4][o[5]] vers l'arc
function evaluateArc(o, ln){
   if(o.length!=6) throw {error:"type", name:"Pas un arc ou arête", msg:"", ln:ln};
   var w=o[4][o[5]]; // L'arc lui-même
   var s1=o[0][o[1]]; // Ses 2 sommets
   var s2=o[2][o[3]];

   // Arc qui a déjà été défini directement dans l'environnement. cad (a,b)=... a déjà été fait
   // Cad que 
   if(w!==undefined && (w.t=="Arc"||w.t=="Arete"||w.t=="null")) {
      // Il faut toutefois vérifier que les sommets n'ont pas changé depuis la définition
      // de l'arc (eg, (x,y)=(A,B) puis x=C
      if(s1==w.i && s2==w.a) return w;
   }

   // Arc indéfini (il n'a pas été affecté, c'est la première fois qu'on en parle
   // ou alors ses sommets ont été changés indépendemment depuis qu'on en a parlé. 
   // mais peut-être que les sommets qui le constituent correspondent bien à un arc
   if(s1===undefined || s2===undefined || s1.t!="Sommet" || s2.t!="Sommet"){
      throw {error:"type", name:"Pas un arc ou une arête", 
	 msg:"La paire ne correspond pas à un arc ou une arête", ln:ln};
   }
   let graphe = _env.grapheContaining(s1);
   if(graphe===null) return NULL;
   for(let a of graphe.arcs){
      if(a.i===s1 && a.a===s2) return a;
      if(o[5][0]=="-" && a.a===s1 && a.i===s2) return a;
   }
   return NULL;
   //throw {error:"type", name:"Arc ou arête inexistant", msg:"La paire ne correspond pas à un arc ou une arête", ln:ln};
}

const _binaryOp = ["+", "-", "*", "/", "%", "**", ".+", ".*", ".^"];
// Retourne la référence (une paire "objet/index" mutable) vers une l-value
// Ou un quadruplet pour les arcs et aretes
function evaluateLVal(lv, direct){

   if(lv.t=="id") { // une variable (non prédéfinie) : a=
      return [_env.getIdlv(lv.name), lv.name];
   }

   else if(lv.t=="arc" || lv.t=="arete") { // (a,b)= ou [a,b]=
      if(lv.t=="arete" && _env.G.isOrient()) throw {error:"type", name: "Arete dans un graphe orienté", msg:"", ln:lv.ln};
      if(lv.t=="arc" && !_env.G.isOrient()) throw {error:"type", name:"Arc dans un graphe non orienté", msg:"", ln:lv.ln};
      let a=_env.getIdlv(lv.initial);
      let b=_env.getIdlv(lv.terminal);
      let cn=((lv.t=="arc")?">":"-") + lv.initial + "," + lv.terminal;
      let c=_env.getIdlv(cn);
      return [a, lv.initial, b, lv.terminal, c, cn];
   }

   else if(lv.t=="field") { // a.f=
      let o=evaluateLVal(lv.o); // référence ver a
      let e=o[0];  // Environnement de a
      let i=o[1];  // Nom de a dans cet environnement
      let v=getRef(o);

      if(v===undefined) e[i]={t:"struct", f:{}}; // a n'existe pas encore. C'est une création implicite
      else if(v.t=="Sommet"){ // Soit un sommet, soit un arc. Le champ fait donc référence à une marque
         if(lv.f=="color" || lv.f=="val" || lv.f=="label") _env.grapheContaining(v).change=true;
	 if(o.length==2) return [v.marques, lv.f]; // Sommet
	 if(o.length==6) {
	    let w=evaluateArc(o, lv.ln);
	    if(w.t=="null") throw {error:"type", name:"Arc ou arête nul", msg:"", ln:lv.ln};
	    return [w.marques, lv.f];
	 }
      }
      else if(v.t=="Arete"){
         if(lv.f=="initial") return [v, "i"];
         else if(lv.f=="terminal") return [v, "a"];
         return [v.marques, lv.f]; // Arete, dans une variable (et non en tant que paire)
      }
      else if(v.t=="Arc"){
         if(lv.f=="initial") return [v, "i"];
         else if(lv.f=="terminal") return [v, "a"];
         return [v.marques, lv.f];
      }
      else if(v.t=="Graphe"){
         return [v.sommets, lv.f];
      }
      else if(v.t!="struct"){ // Autre chose sans champ
         throw {error:"type", name:"Pas une structure", 
            msg:"tentative d'accéder à un champ d'un objet de type "+v.t, ln:lv.ln};
      }
      return [o[0][o[1]].f, lv.f];
   }

   else if(lv.t=="index"){ // a[12]=
      let o=evaluateLVal(lv.tab); // o=référence vers a
      let v=getRef(o); // valeur (evaluate(lv.tab))
      if(v===undefined) o[0][o[1]] = {t:"array", val:[]}; // Une création de variable
      else if(o[0]==_env.G.sommets)
         throw{error:"env", name:"Les sommets ne sont pas des tableaux", msg:"", ln:lv.ln};
      else if(v.t!="array") // Une variable qui était autre chose qu'un tableau, et devient un tableau
         throw{error:"type", name:"Pas un tableau", msg:"Un "+v.t+" n'est pas un tableau",ln:lv.ln};
      let i=evaluate(lv.index);
      if(i===undefined || !isNumeric(i)){
	 throw {error:"type", name:"Index invalide", msg:"Un élément de type '"+i.t+"' n'est pas un index valide pour un tableau", ln:lv.index.ln};
      }
      return [ o[0][o[1]].val, numericValue(i) ];
   }
   else if(lv.t=="mindex"){ // M[1,2]=...
      let o=evaluateLVal(lv.mat); 
      let v=getRef(o);
      if(v===undefined) o[0][o[1]] = preZero(); // Création implicite d'une matrice nulle
      else if(v.t!="matrix") throw{error:"type", name:"Erreur de type",
                                 msg:"Pas une matrice", ln:lv.ln};
      let i=evaluate(lv.i);
      let j=evaluate(lv.j);
      if(i===undefined || !isNumeric(i)){ 
         throw {error:"type", name:"Index de ligne invalide",
                msg:"Un élément de type "+i.t+" n'est pas un index de ligne valide", ln:lv.i.ln};
      }
      if(j===undefined || !isNumeric(j)){
         throw {error:"type", name:"Index de colonne invalide",
                msg:"Un élément de type "+j.t+" n'est pas un index de colonne valide", ln:lv.j.ln};
      }
      return [ o[0][o[1]].val[numericValue(i)], numericValue(j) ];
   }
   else throw {error:"interne", name:"Erreur interne", msg:"EvaluateLVal appelé sur non-LValue", ln:lv.ln};
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
   _opCnt += 2*n*n*n;
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
   _opCnt += 2*n*n*n;
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

// EXPRESSIONS
function evaluate(expr){
    // JIT
    if(expr.l!==undefined) return expr.l();

    // Les valeurs natives. 
    if(expr.t=="string" || expr.t=="number" || expr.t=="boolean" || expr.t=="decimal"){
        expr.l=function(){return expr;};
        return expr;
    }

    // Accès à une variable. Pour être une expression, il ne peut s'agir d'une fonction
    // (le langage interdit donc les pointeurs de fonctions)
    if(expr.t=="id"){
        if(_env.Predef[expr.name]){
            if(_env.Predef[expr.name].t == "predvar") expr.l = _env.Predef[expr.name].f;
            else if(_env.Predef[expr.name].t == "predfn") throw {error:"type", name:"Variable incorrecte", 
                msg: "Tentative d'utiliser la fonction prédéfinie "+expr.name+ " comme une variable",
                    ln:expr.ln};
            else expr.l=function(){return _env.Predef[expr.name];};
        }
        else if(_env.Graphes[expr.name]) expr.l=function(){return _env.Graphes[expr.name];}
        else if(_env.G.sommets[expr.name]) expr.l=function(){return _env.G.sommets[expr.name];}
        else if(_env.Local && _env.Local[expr.name]!==undefined && _env.Local[expr.name].t!="global") expr.l=function(){return _env.Local[expr.name]};
        else if(_env.Global[expr.name]!==undefined){
            if(_env.Global[expr.name].t=="DEF") throw {error:"type", name:"Variable incorrecte", msg: ""+expr.name+" est une fonction", ln:expr.ln};
            expr.l=function(){return _env.Global[expr.name];};
        }
        else throw {error:"variable", name:"Symbole non défini", msg: "Symbole "+expr.name+" non défini", ln:expr.ln};
        return expr.l();
    }

    // Comparaison (égalité)
    // Pour les valeurs scalaires, compare la valeur. Pour les sommets et arcs, la référence suffit
    // Pour les vecteurs et structures : comparaison récursive
    if(expr.t=="==" || expr.t=="!="){
        function isEq(a,b){
            _opCnt++;
            if(a.t=="string" && b.t=="Sommet") return a.val==b.name;
            if(a.t=="Sommet" && b.t=="string") return a.name==b.val;
            if(a.t=="decimal" && isNumeric(b)) return a.val.equals(b.val);
            if(b.t=="decimal" && isNumeric(a)) return b.val.equals(a.val);
            if(a.t!=b.t) return false;
            if(a.t=="null") return true;
            if(a.t=="Sommet" || a.t=="Arete" || a.t=="Arc") return a==b;
            if(a.t=="boolean" || a.t=="number" || a.t=="string") return a.val==b.val;
            if(a.t=="array"){
                if(a.val.length!=b.val.length) return false;
                for(let i=0; i<a.val.length; i++){
                    if(!isEq(a.val[i], b.val[i])) return false;
                }
                _opCnt += a.val.length-1;
                return true;
            }
            if(a.t=="matrix"){
                for(let i=0; i<a.val.length; i++){
                    for(let j=0; j<a.val.length; j++){
                        if(a.val[i][j] != b.val[i][j]) return false;
                    }
                }
                _opCnt += a.val.length*a.val.length-1;
                return true;
            }
            if(a.t=="struct"){
                for(let f in a.f) if(b.f[f]===undefined) return false;
                for(let f in b.f) if(a.f[f]===undefined) return false;
                for(let f in a.f) if(!isEq(a.f[f], b.f[f])) return false;
                return true;
            }
        }
        if(expr.t=="==") expr.l=function(){ 
            if(isEq(evaluate(expr.left), evaluate(expr.right))) return TRUE;
            else return FALSE;
        }
        else expr.l=function(){
            if(isEq(evaluate(expr.left), evaluate(expr.right))) return FALSE;
            else return TRUE;
        }
        return expr.l();
    }

    // and / or
    if(expr.t=="&&"){
        expr.l=function(){
            let a=evaluate(expr.left);
            if(a.t=='null') a=FALSE;
            if(a.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.left.ln};
            if(!a.val) return FALSE;
            let b=evaluate(expr.right);
            if(b.t=='null') b=FALSE;
            if(b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(b.val) return TRUE;
            else return FALSE;
        }
        return expr.l();
    }
    if(expr.t=="||"){
        expr.l=function(){
            let a=evaluate(expr.left);
            if(a.t=='null') a=FALSE;
            if(a.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.left.ln};
            if(a.val) return TRUE;
            let b=evaluate(expr.right);
            if(b.t=='null') b=FALSE;
            if(b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(b.val) return TRUE;
            else return FALSE;
        }
        return expr.l();
    }

    // xor
    if(expr.t=="xor"){
        expr.l=function(){
            let a=evaluate(expr.left);
            let b=evaluate(expr.right);
            if(a.t=='null') a=FALSE;
            if(b.t=='null') b=FALSE;
            if(a.t!="boolean" || b.t!="boolean")
                throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
            if(a.val && !b.val) return TRUE;
            if(!a.val && b.val) return TRUE;
            return FALSE;
        }
        return expr.l();
    }


    // Comparaison (inégalité)
    // Uniquement pour des valeurs scalaires
    if(expr.t=="<" || expr.t==">" || expr.t=="<=" || expr.t==">="){
        let comp=false;
        let compd=false;
        if(expr.t=="<") {
            comp=function(a,b){ return (a<b)?TRUE:FALSE;};
            compd=function(a,b){ return a.lt(b)?TRUE:FALSE;};
        }
        else if(expr.t==">") {
            comp=function(a,b){ return (a>b)?TRUE:FALSE;};
            compd=function(a,b){ return a.gt(b)?TRUE:FALSE;};
        }
        else if(expr.t=="<=") {
            comp=function(a,b){ return (a<=b)?TRUE:FALSE;};
            compd=function(a,b){ return a.lte(b)?TRUE:FALSE;};
        }
        else if(expr.t==">=") {
            comp=function(a,b){ return (a>=b)?TRUE:FALSE;};
            compd=function(a,b){ return a.gte(b)?TRUE:FALSE;};
        }

        expr.l=function(){
            let a=evaluate(expr.left);
            let b=evaluate(expr.right);
            _opCnt++;
            if(isNumeric(a) && isNumeric(b)){
                if(a.t=="number" && b.t=="number") return comp(a.val, b.val);
                if(a.t=="decimal") return compd(a.val, b.val);
                return compd(Decimal(a.val), b);
            }
            if(a.t != b.t) throw {error:"type", name:"Comparaison de valeur de types différents",
                msg:`tentative de comparer un ${a.t} et un ${b.t}`, ln:expr.ln};
            let vala=false, valb=false;
            if(a.t=="number" || a.t=="string"){
                vala=a.val;
                valb=b.val;
            }else if(a.t=="Sommet"){
                vala=a.name;
                valb=b.name;
            }else throw {error:"type", name:"Type invalide pour une comparaison",
                msg:"Tentative de comparer deux valeurs de type "+a.t, ln:expr.ln};
            return comp(vala,valb);
        }
        return expr.l();
    }

    // Arete ou arc
    if(expr.t=="arete" || expr.t=="arc"){
        var ref=evaluateLVal(expr);
        if(ref.length!=6) throw {error:"interne", name:"Erreur interne", msg:"L-Value d'une arête mal évaluée",
            ln:expr.ln};
        var v=evaluateArc(ref, expr.ln);
        if(v===undefined) throw {error:"type", name:"Arc ou arête inexistant", msg:"", ln:expr.ln};
        if(v.t=="null") return v;
        if(v.t=="Arc" || v.t=="Arete") return v;
        throw {error:"type", name:"Pas un arc ou arête", msg:"", ln:expr.ln};
    }

    // ++ / --
    if(expr.t=="++" || expr.t=="--"){
        var op;
        if(expr.left) op=evaluateLVal(expr.left);
        else if(expr.right) op=evaluateLVal(expr.right);
        else throw {error:"interne", name:"++ ou -- sans opérande", msg:"", ln:expr.ln};
        if(op.length!=2) throw {error:"type", name:"++ ou -- utilisé sur arc ou arête", msg:"", ln:expr.ln};
        let v=getRef(op);
        if(!v) throw {error:"env", name:"Variable non définie", msg:"", ln:expr.ln};
        if(v.t!="number") throw {error:"type", name:"Erreur de type", 
            msg:"++ ou -- attend un nombre et a été utilisé sur un "+v.t, ln:expr.ln};
        var newVal={t:"number", val:v.val};
        if(expr.t=="++") newVal.val++;
        else newVal.val--;

        setRef(op, newVal, expr.ln);
        _opCnt++;

        if(expr.left) return v;
        else return newVal;
    }

    if(_binaryOp.indexOf(expr.t)>=0){
        var a=evaluate(expr.left);
        var b=evaluate(expr.right);

        // Cas particulier pour le + : on accepte aussi chaines et tableau, et booléens
        if(expr.t=="+"){
            if(a.t=="array"){
                if(b.t=="array"){ // Concaténation
                    return {t:"array", val:a.val.concat(b.val)};
                }else{
                    let val=a.val.slice(); // Copie
                    val.push(b);
                    return {t:"array", val:val};
                }
            }
            if(a.t=="matrix"){
                if(b.t=="number"){ // M + x = addition de x à tous les coefs de M
                    let R={t:"matrix", val:new Array(a.val.length)};
                    for(let i=0; i<a.val.length; i++){
                        R.val[i]=new Array(a.val.length).fill(0);
                        for(let j=0; j<a.val.length; j++){
                            R.val[i][j] = a.val[i][j] + b.val;
                        }
                    }
                    _opCnt += a.val.length*a.val.length;
                    return R;
                }
                if(b.t=="matrix"){
                    let R={t:"matrix", val:new Array(a.val.length)};
                    for(let i=0; i<a.val.length; i++){
                        R.val[i]=new Array(a.val.length).fill(0);
                        for(let j=0; j<a.val.length; j++){
                            R.val[i][j] = a.val[i][j] + b.val[i][j];
                        }
                    }
                    _opCnt += a.val.length*a.val.length;
                    return R;
                }
            }
            if(a.t=="string"){
                if(b.t=="string") return {t:"string", val:a.val+b.val};
                if(isNumeric(b)) return {t:"string", val:a.val+b.val};
                if(b.t=="boolean") return {t:"string", val:a.val+(b.val?"True":"False")};
                if(b.t=="Sommet") return {t:"string", val:a.val+b.name};
                if(b.t=="Arc") return {t:"string", val:a.val+"("+b.i.name+","+b.a.name+")"};
                if(b.t=="Arete") return {t:"string", val:a.val+"["+b.i.name+","+b.a.name+"]"};
                if(b.t=="null") return {t:"string", val:a.val+"null"};
                throw {error:"type", name:"Erreur de type", msg:"", ln:expr.ln};
            }
            if(a.t=="boolean"){ // Ou non paresseux
                if(b.t=="boolean") return (a.val||b.val)?TRUE:FALSE;
                throw {error:"type", name:"Erreur de type", msg:"", ln:expr.ln};
            }
        }

        // Cas particulier pour *
        if(expr.t=="*"){
            // Et non paresseurx
            if(a.t=="boolean" && b.t=="boolean") {
                _opCnt++;
                return (a.val&&b.val)?TRUE:FALSE;
            }

            // Multiplication matricielle
            if(a.t=="matrix" && b.t=="matrix") return multMat(a,b);
        }

        // Cas particulier pour **
        if(expr.t=="**"){
            if(a.t=="matrix" && b.t=="number") return powMat(a, b.val);
        }

        if(expr.t==".^"){
            if(a.t=="matrix" && b.t=="number") return boolPowMat(a, b.val);
            if(a.t=="number" && b.t=="number") return {t:"number", val:(a.val!=0)?1:0};
        }

        // ".+" n'a de sens que sur les matrices (et, cadeau, 2 nombres)
        if(expr.t==".+"){
            if(a.t=="number" && b.t=="number") {
                _opCnt++;
                return {t:"number", val:(a.val!=0 || b.val!=0)?1:0};
            }
            if(a.t!="matrix" || b.t!="matrix")
                throw {error:"type", name:"Erreur de type", 
                    msg:"Types "+a.t+","+b.t+" incompatibles pour .+", ln:expr.ln};
            let n=a.val.length;
            let R=zeroDim(n);
            for(let i=0; i<n; i++){
                for(let j=0; j<n; j++){
                    R.val[i][j] = (a.val[i][j]!=0 || b.val[i][j]!=0)?1:0;
                }
            }
            _opCnt += a.val.length*a.val.length;
            return R;
        }

        // ".*" sur matrices et nombres
        if(expr.t==".*"){
            if(a.t=="number" && b.t=="number") {
                _opCnt++;
                return {t:"number", val:(a.val!=0 && b.val!=0)?1:0};
            }
            if(a.t!="matrix" || b.t!="matrix")
                throw {error:"type", name:"Erreur de type", 
                    msg:"Types "+a.t+","+b.t+" incompatibles pour .*", ln:expr.ln};
            return boolMultMat(a,b);
        }

        if(!isNumeric(a) || !isNumeric(b)) throw {error:"type", name:"Erreur de type", msg:"Types "+a.t+expr.t+b.t+" incompatibles", ln:expr.ln};
        _opCnt++;

        if(a.t=='number' && b.t=="number"){
            if(expr.t=="+") return {t:"number", val:a.val+b.val};
            if(expr.t=="-") return {t:"number", val:a.val-b.val};
            if(expr.t=="*") return {t:"number", val:a.val*b.val};
            if(expr.t=="/") return {t:"number", val:a.val/b.val};
            if(expr.t=="%") return {t:"number", val:a.val%b.val};
            if(expr.t=="**") return {t:"number", val:a.val**b.val};
        }

        // One of a or b, or both, (not none, else we wouldn't be still there) is decimal
        if(b.t=="decimal" || a.t=="decimal"){
            let va;
            if(a.t=="decimal"){
                va=a.val;
            }else{
                va=Decimal(a.val);
            }
            if(expr.t=="+") return {t:"decimal", val:va.plus(b.val)};
            if(expr.t=="-") return {t:"decimal", val:va.minus(b.val)};
            if(expr.t=="*") return {t:"decimal", val:va.mul(b.val)};
            if(expr.t=="/") return {t:"decimal", val:va.div(b.val)};
            if(expr.t=="%") return {t:"decimal", val:va.mod(b.val)};
            if(expr.t=="**") return {t:"decimal", val:va.pow(b.val)};
        }

        throw {error:"interne", name:"Erreur interne", msg:"Hein?", ln:expr.ln};
    }

    // "!"
    if(expr.t=="!"){
        var a=evaluate(expr.right);
        if(a.t=='null') a=FALSE;
        if(a.t!="boolean")
            throw {error:"type", name:"Valeur non booléenne",
                msg:"L'opérateur ! s'utilise sur un argument booléen", ln:expr.ln};
        if(a.val) return FALSE;
        return TRUE;
    }

    if(expr.t=="call"){
        var v=interpCall(expr);
        if(v===undefined || v.t=="empty") throw {error:"type", name:"Pas de valeur de retour",
            msg:"La fonction "+expr.f+" n'a retourné aucune valeur",
            ln:expr.ln};
        return v;
    }

    if(expr.t=="SOMMET"){
        let g=_env.G;
        if(expr.g) {
            if(_env.Graphes[expr.g]===undefined) throw {error:"env", name:"Graphe inexistant", 
                msg:"Le graphe "+expr.g+" n'existe pas", ln:expr.ln};
            g=_env.Graphes[expr.g];
        }
        let v=evalSommet(expr.arg, true, g);
        if(!v || v.t!="Sommet") throw {error:"type", name:"Pas un sommet", 
            msg:"Un "+v.t+" n'est pas un sommet valide", ln:expr.arg.ln};
        return v;
    }

    if(expr.t=="field"){
        var o=evaluate(expr.o);
        let res=NULL;
        if(o.t=="struct") res=o.f[expr.f];
        else if(o.t=="Arc" || o.t=="Arete"){
            if(expr.f=="initial") res=o.i;
            else if(expr.f=="terminal") res=o.a;
            else res=o.marques[expr.f];
        }
        else if(o.t=="Sommet") res=o.marques[expr.f];
        else if(o.t=="Graphe") res=o.sommets[expr.f];
        else throw {error:"type", name:"Pas une structure", msg:"Un objet de type "+o.t+" n'a pas de champs", ln:expr.ln};
        if(res===undefined) return NULL;
        else return res;
    }

    if(expr.t=="index"){
        var tab=evaluate(expr.tab);
        var idx=evaluate(expr.index);
        if(!isNumeric(idx)) throw {error:"type", name:"Erreur de type", msg:"Index non entier",
            ln:expr.index.ln};
        let i=numericValue(idx);
        if(tab.t=="array") return tab.val[i];
        if(tab.t=="string") return {t:"string", val:tab.val[i]};
        if(tab.t=="Sommet") return {t:"string", val:tab.name[i]};
    }
    if(expr.t=="mindex"){
        let i=evaluate(expr.i);
        let j=evaluate(expr.j);
        let M=evaluate(expr.mat);
        if(M.t!="matrix") throw {error:"type", name:"Erreur de type",
            msg:"Utilisation d'un "+M.t+" comme une matrice", ln:expr.ln};
        if(i.t!="number") throw {error:"type", name:"Erreur de type",
            msg:"Indice de ligne non entier", ln:expr.i.ln};
        if(j.t!="number") throw {error:"type", name:"Erreur de type",
            msg:"Indice de colonne non entier", ln:expr.j.ln};
        return {t:"number", val:M.val[i.val][j.val]};
    }
    if(expr.t=="array"){
        return JSON.parse(JSON.stringify(expr));
    }
    if(expr.t=="struct"){
        return JSON.parse(JSON.stringify(expr));
    }
    if(expr.t=="subarray"){
        let tab=evaluate(expr.tab);
        if(tab.t!="array")
            throw {error:"type", name:"Pas un tableau", msg:"Utilisation de [...] sur un objet non indexable", ln:expr.ln};
        let b0=0;
        let b1=false;
        if(expr.indexinf){
            let idinf=evaluate(expr.indexinf);
            if(idinf.t!="number") throw {error:"type", name:"Index de tableau non entier", msg:"", ln:expr.indexinf.ln};
            b0 = idinf.val;
        }
        if(expr.indexsup){
            let idsup=evaluate(expr.indexsup);
            if(idsup.t!="number") throw {error:"type", name:"Index de tableau non entier", msg:"", ln:expr.indexinf.ln};
            b1 = idsup.val;
        }
        if(b1===false) return {t:"array", val:tab.val.slice(b0)};
        else return {t:"array", val:tab.val.slice(b0, b1)};
    }
    if(expr.t=="Arc"){
        return creerArc(expr);
    }
    if(expr.t=="Arete"){
        return creerArete(expr);
    }
    console.trace("Cannot evaluate", expr);
}

// Fonction interne d'ajout de sommet
function addSommet(name, graphe){
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
        if(_env.get(som.name)===undefined) str=som.name; // Identifiant non existant. Traité comme une chaîne
    }

    if(str===null){
        let ev=evaluate(som); // Y compris un "id", mais qui peut être une variable de type chaine
        if(ev===undefined) throw {error:"type", name:"Sommet indéfini", msg: "", ln:som.ln};
        if(ev.t=="string") str=ev.val;
        else if(ev.t=="Sommet") str=ev.name; // Note : c'est forcément d'un autre graphe, sinon on ne serait plus là
        else if(ev.t=="graphe") str=ev.name; // Il est possible de créer un sommet qui a le même nom qu'un graphe
        else throw {error:"type", name:"Ce n'est pas un sommet", msg:"Une expression de type '"+ev.t+"' n'est pas un sommet légal", ln:som.ln};
    }
    if(str===null) throw {error:"internal", name:"Sommet non défini", msg:"Erreur interne : le sommet est indéfini", ln:som.ln};
    if(!str.match(/^[A-Za-z0-9_]*$/)){
        throw{error: "type", name: "Nom de sommet illégal", 
            msg: "Le nom d'un sommet ne doit contenir que\ndes caractères alphanumériques\nnom:"+str, ln: som.ln};
    }
    if(graphe.sommets[str]) return graphe.sommets[str];
    if(creer) {
        addSommet(str, graphe);
        return graphe.sommets[str];
    }
    return str;
}


// Ajoute des sommets
function interpCreerSommets(ins){
   let liste=ins.args;
   let g=_env.G;
   if(ins.g){
      if(!_env.Graphes[ins.g]) throw {error:"env", name:"Graphe non existant", msg:"Le graphe "+ins.g+" n'existe pas", ln:ins.ln};
      g=_env.Graphes[ins.g];
   }
   for(let i=0; i<liste.length; i++){
      let ev=evalSommet(liste[i], false, g);
      // On a récupéré un sommet existant
      if(ev.t=="Sommet") throw {error:"env", name:"Sommet déjà existant", msg:"Le sommet "+ev.name+" existe déjà", ln:liste[i].ln};
      // Un nom de sommet inexistant
      if(typeof ev == "string") {
	 addSommet(ev, g);
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
      if(ref[0]==_env.G.sommets || ref[2]==_env.G.sommets){ // Arc constitué d'un sommet immutable
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
   if(ref[0]==_env.G.sommets) throw {error:"env", name:"Surdéfinition d'un sommet", 
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
   var v=evaluate(ins.right);
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
   let g=_env.G;
   if(ins.g){
      g=_env.Graphes[ins.g];
      if(!g) throw {error:"graphe", name:"Graphe inexistant", msg:"Le graphe "+ins.g+" n'existe pas", ln:ins.ln};
   }
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

   // Graphe concerné
   let g=_env.G;
   if(ins.g){
      g=_env.Graphes[ins.g];
      if(!g) throw {error:"graphe", name:"Graphe inexistant", msg:"Le graphe "+ins.g+" n'existe pas", ln:ins.ln};
   }
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
   if(_env.getPredef(def.nom)) throw {error:"type",
      name: "Surdéfinition", msg: "Impossible de redéfinir le symbole prédéfini "+def.nom,
      ln:def.ln};
   if(_env.Global[def.nom]!==undefined) throw {error:"type", name: "Surdéfinition", msg: "Fonction "+def.nom+" déjà définie", ln: def.ln};
   _env.Global[def.nom] = def;
}

function interpCall(call){
   let fn=_env.get(call.f);
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


function regularCheck(force=false){
    _instrCnt=0;
    for(let i in _env.Graphes) _env.Graphes[i].redraw(force);
    
    if(_strChange){
        _strChange=false;
        postMessage({print: _str});
    }
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
function interpretWithEnv(tree, isloop){
    for(let ti of tree){
        if(_instrCnt++>100000) regularCheck();
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
            if(_env.Predef[ti.name]) 
                throw {error:"env", name:"Surdéfinition", msg:"Le nom "+ti.name+" est réservé", ln:ti.ln};
            if(_env.Graphes[ti.name]){
                _env.Graphes[ti.name].sommets={};
                _env.Graphes[ti.name].arcs.length=0;
            }else{
                _env.addGraphe(ti.name, ti.ln);
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

function preRandom(args){
   if(args.length==0){
      return Math.random();
   }
   var a=evaluate(args[0]);
   if(a.t=="number"){
      if(args.length==2){
         let b=evaluate(args[1]);
         if(b.t!="number") throw {error:"type", name:"Mauvais argument pour random",
            msg:"Un entier et un "+a.t+" ne sont pas des arguments valides", 
            ln:args[1].ln};
         return a.val+Math.floor(Math.random()*(b.val-a.val));
      }
      return Math.floor(Math.random()*a.val);
   }
   if(a.t!="array"){
      throw {error:"type", name:"Mauvais argument pour random", 
	 msg:"Un "+a.t+" n'est pas un argument valide pour random", ln:args[0].ln};
   }
   if(a.val.length<=0){
      return NULL;
   }
   var r=Math.floor(Math.random()*a.val.length);
   if(args.length==1){
      return a.val[r];
   }
   else{
      // On parcours tous les éléments de la liste à partir du r
      // et on retourne le premier qui vérifie la condition
      for(var ii=0; ii<a.val.length; ii++){
	 var i=(r+ii)%a.val.length;
	 var cur=a.val[i];
         // Environnement pour self
         let envSelf={self:cur};
         _localEnv=envSelf;
         _stackEnv.push(envSelf);
	 var env=false; // Environnement d'évaluation de la condition (champs des éléments)
	 if(cur && cur.t=="struct") env=cur.f;
	 if(cur && (cur.t=="Arc" || cur.t=="Arete" || cur.t=="Sommet")) env=cur.marques;
	 if(env){ // S'il y a un environnement, on le push avant d'évaluer la condition
	    _localEnv=env;
	    _stackEnv.push(env);
	 }
	 var v=evaluate(args[1]);
	 if(env){
	    _stackEnv.pop();
	    _localEnv = _stackEnv[_stackEnv.length-1];
	 }
         // Retrait de envSelf
         _stackEnv.pop();
         _localEnv = _stackEnv[_stackEnv.length-1];

	 if(!v || v.t!="boolean") throw {error:"type", name:"Condition non booléenne",
	    msg:"Mauvaise condition de filtrage pour random", ln:args[1].ln};
	 if(v.val) return cur;
      }
      return NULL; // Rien ne correspond à la condition
   }
}

function prePremier(args, ln){
   if(args.length!=1) throw {error:"type", name:"Mauvais nombre d'arguments",
         msg:"Mauvais nombre d'arguments pour premier", ln:ln};
   var l=evaluate(args[0]);
   if(l.t!="array") throw {error:"type", name:"Erreur de type",
         msg:"'premier' attend un argument de type tableau", ln:args[0].ln};
   if(l.val.length<=0) return NULL;
   else return l.val[0];
}

function preDernier(args, ln){
   if(args.length!=1) throw {error:"type", name:"Mauvais nombre d'arguments",
         msg:"Mauvais nombre d'arguments pour dernier", ln:ln};
   var l=evaluate(args[0]);
   if(l.t!="array") throw {error:"type", name:"Erreur de type",
         msg:"'dernier' attend un argument de type tableau", ln:args[0].ln};
   if(l.val.length<=0) return NULL;
   else return l.val[l.val.length-1];
}


function prePrint(args){
   function printRec(o){
      if(typeof o=="object"){
	 if(o.t=="Sommet") _str+=o.name;
	 else if(o.t=="Arete") _str+="["+o.i.name+","+o.a.name+"]";
	 else if(o.t=="Arc") _str+="("+o.i.name+","+o.a.name+")";
	 else if(isNumeric(o)) _str+=(""+o.val);
	 else if(o.t=="string") _str+=o.val;
	 else if(o.t=="boolean") _str+= (o.val?"True":"False");
	 else if(o.t=="array"){
	    _str+="[";
	    for(var i=0; i<o.val.length; i++){
	       printRec(o.val[i]);
	       if(i<o.val.length-1) _str+=",";
	    }
	    _str+="]";
	 }
         else if(o.t=="matrix"){
            for(let i=0; i<o.val.length; i++){
               _str+="[";
               for(let j=0; j<o.val[i].length; j++){
                  if(j>0) _str+=" ";
                  _str+=o.val[i][j];
               }
               _str+="]\n";
            }
         }
	 else if(o.t=="struct"){
	    _str+="{";
	    var first=true;
	    for(var k in o.f){
	       if(first) first=false;
	       else _str+=" ";
	       _str+=k;
	       _str+=":";
	       printRec(o.f[k]);
	    }
	    _str+="}";
	 }
	 else _str+="{"+o.t+"}";
      }
      else{
         _str+=o;
      }
   }

   for(var i=0; i<args.length; i++){
      var a=evaluate(args[i]);
      printRec(a);
      _strChange=true;
   }
}

function prePrintln(a){
   prePrint(a);
   _str+="\n";
}

function preM(args, ln, fname){
   var M={t:"matrix", val:[]};
   var k;
   var arcs;
   if(args){
      if(args.length!=1) throw {error:"env", ln:ln, name:"Mauvais nombre d'arguments", msg:"La variable Adj ne peut prendre qu'un argument optionnel, le graphe"};
      let g=evaluate(args[0]);
      if(g.t!="Graphe") throw {error:"env", ln:ln, name:"Mauvais type d'argument", msg:"Quand la variable Adj est utilisée avec un argument optionnel, cet argument doit être un graphe"};
      k=Object.keys(g.sommets);
      arcs=g.arcs;
   }
   else {
      k=Object.keys(_grapheEnv);
      arcs=_arcs;
   }
   for(let i=0; i<k.length; i++){
      M.val[i]=new Array(k.length).fill(0);
      for(let j=0; j<k.length; j++){
	 M.val[i][j]=0;
         for(let ai=0; ai<arcs.length; ai++){
            if(arcs[ai].i.name == k[i] && arcs[ai].a.name==k[j]) {;}
            else if(_env.isOrient()) continue;
            else if(arcs[ai].a.name==k[i] && arcs[ai].i.name==k[j]) {;}
            else continue;
            M.val[i][j]++;
         }
      }
   }
   return M;
}

function preId(args, ln, fname){
   var M={t:"matrix", val:[]};
   var n=0;
   if(args){
      if(args.length!=1) throw {error:"env", ln:ln, name:"Mauvais nombre d'arguments", msg:"La variable Id ne peut prendre qu'un argument optionnel, le graphe"};
      let g=evaluate(args[0]);
      if(g.t!="Graphe") throw {error:"env", ln:ln, name:"Mauvais type d'argument", msg:"Quand la variable Id est utilisée avec un argument optionnel, cet argument doit être un graphe"};
      n=Object.keys(g.sommets).length;
   }
   else n=Object.keys(_grapheEnv).length;
   for(let i=0; i<n; i++){
      M.val[i]=new Array(n).fill(0);
      M.val[i][i]=1;
   }
   return M;
}

function zeroDim(n){
   var M={t:"matrix", val:[]};
   for(let i=0; i<n; i++){
      M.val[i]=new Array(n).fill(0);
   }
   return M;
}

function preZero(args, ln, fname){
   var n=0;
   if(args){
      if(args.length!=1) throw {error:"env", ln:ln, name:"Mauvais nombre d'arguments", msg:"La variable Zero ne peut prendre qu'un argument optionnel, le graphe"};
      let g=evaluate(args[0]);
      if(g.t!="Graphe") throw {error:"env", ln:ln, name:"Mauvais type d'argument", msg:"Quand la variable Zero est utilisée avec un argument optionnel, cet argument doit être un graphe"};
      n=Object.keys(g.sommets).length;
   }
   else n=Object.keys(_grapheEnv).length;
   return zeroDim(n);
}

function preArcs(args, ln){
   if(args.length>2) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction arcs s'utilise avec au plus 2 arguments (graphe et/ou sommet)", ln:ln};
   let arcs=false;
   let s=false;
   for(let a of args){
      let ev=evaluate(a);
      if(ev.t=="Graphe") arcs=ev.arcs;
      else if(ev.t=="Sommet") s=ev;
      else throw {error:"args", name:"Mauvais argument", 
         msg:"Argument de type "+ev.t+" invalide pour arcs", ln:ln};
   }
   if(arcs===false){
      if(s){ // Pas de graphe précisé. Mais puisqu'il y a un sommet de donné, on peut le trouver via le sommet
         for(let gn in _env.Graphes){
            if(_env.Graphes[gn].sommets[s.name]===s) arcs=_env.Graphes[gn].arcs;
         }
      }
      else arcs=_arcs;
   }
   if(s===false) {
       if(_grapheDisc){
           let orient=_env.isOrient();
           if(orient){
               return {t:"array", val: arcs.filter(a=>a.i.marques.visible)};
           }
           else{
               return {t:"array", val: arcs.filter(a=>a.i.marques.visible || a.a.marques.visible)};
           }
       }
       else{
           return {t:"array", val:arcs};
       }
   }
   if(arcs===false) return NULL;

   if(_grapheDisc && !s.marques.visible) return NULL;
   var rep=[];
   for(var i=0; i<arcs.length; i++){
      if(arcs[i].i==s) rep.push(arcs[i]);
      else if(arcs[i].a==s && arcs[i].t=="Arete") {
	 // Dans le cas précis de arete, on inverse les sommets
	 // Avant de retourner le résultat. C'est un peu pourri comme méthode. Mais
	 // le but est de garantir que [x,y] in aretes(A) retourne toujours un y!=A (sauf pour la boucle)
	 var pivot=arcs[i].i;
	 arcs[i].i=arcs[i].a;
	 arcs[i].a=pivot;
	 rep.push(arcs[i]);
      }
   }
   return {t:"array", val:rep};
}

function preSommets(args, ln){
   let g=_grapheEnv;
   let idx=false;
   if(args.length>2) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction sommets s'utilise avec au plus 2 arguments (graphe et/ou index)", ln:ln};
   for(let a of args){
      let ev=evaluate(a);
      if(ev.t=="Graphe") g=ev.sommets;
      else if(ev.t=="number"){
         if(idx!==false) throw {error:"args", name:"Mauvais arguments", 
            msg:"La fonction sommets s'utilise avec au plus un argument index", ln:ln};
         idx=ev.val;
      }
      else throw {error:"args", name:"Mauvais arguments",
            msg:"La fonction sommets s'utilise sans argument, ou des arguements de type entier et graphe", ln:ln};
   }
   let t=Object.values(g);

   if(_grapheDisc && !idx) return {t:"array", val:t.filter(s=>s.marques.visible)};
   if(idx===false) return {t:"array", val:t};
   if(idx<0 || idx>=t.length) throw {error:"exec", name:"Indice invalide",
         msg:"Le sommet #"+idx+" n'existe pas", ln:ln};
   if(_grapheDisc && !t[idx].marques.visible) throw {error:"exec", name: "Sommet inaccessible", msg:"Le sommet #"+idx+" n'est pas encore visible", ln:ln};
   return t[idx];
}

function preLen(args, ln){
   if(args.length!=1) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction len s'utilise avec un et un seul argument", ln:ln};
   let a=evaluate(args[0]);
   if(a.t=="array") return {t:"number", val:a.val.length};
   if(a.t=="matrix") return {t:"number", val:a.val.length};
   if(a.t=="string") return {t:"number", val:a.val.length};
   throw {error:"type", name:"Erreur de type", 
      msg:"Mauvais type "+a.t+" pour la fonction len", ln:ln};
}

function preMaths1(args, ln, fname){
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

function preRefresh(args, ln){
   if(args.length!=0) throw{error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction refresh s'utilise sans argument", ln:ln};
   _grapheChange=true;
   _strChange=true;
   regularCheck();
}

function preOpCnt(){
   return {t:"number", val:_opCnt};
}

function importGraphe(g,v){
   for(let i=0; i<g[0].length; i++){
      let x={t:"number", val:g[0][i][0]};
      let y={t:"number", val:g[0][i][1]};
      _grapheEnv["S"+i] = {t:"Sommet", name:"S"+i, marques:{x:x, y:y}};
   }
   for(let p of g[1]){
      let s1=_grapheEnv["S"+p[0]];
      let s2=_grapheEnv["S"+p[1]];
      let d={t:"number", val:0};
      if(p.length==3) d.val=p[2];
      else{
         let x1=s1.marques.x;
         let x2=s2.marques.x;
         let y1=s1.marques.x;
         let y2=s2.marques.x;
         d.val=Math.sqrt((x1-x2)**2 + (y1-y2)**2);
      }
      if (v=="noValues") _arcs.push({t:"Arete", i:s1, a:s2, marques:{}});
      else _arcs.push({t:"Arete", i:s1, a:s2, marques:{val:d}});
   }
   _grapheChange=true;
   _grapheMode="map";
}

function importReseau(g,v){
   for(let i=0; i<g[0].length; i++){
      let x={t:"number", val:g[0][i][0]};
      let y={t:"number", val:g[0][i][1]};
      _env.G.sommets["S"+i] = {t:"Sommet", name:"S"+i, marques:{x:x, y:y}};
   }
   for(let p of g[1]){
      let s1=_env.G.sommets["S"+p[0]];
      let s2=_env.G.sommets["S"+p[1]];
      let d={t:"number", val:0};
      if(p.length==3) d.val=p[2];
      else{
         let x1=s1.marques.x;
         let x2=s2.marques.x;
         let y1=s1.marques.x;
         let y2=s2.marques.x;
         d.val=Math.sqrt((x1-x2)**2 + (y1-y2)**2);
      }
      if (v=="noValues") _env.G.arcs.push({t:"Arc", i:s1, a:s2, marques:{}});
      else _env.G.arcs.push({t:"Arc", i:s1, a:s2, marques:{t:"number",capacite:d}});
   }
   _env.G.setOrient(TRUE);
   _env.G.mode="dot";   
   _env.G.change=true;
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

function preImport(args, ln){
   if(args.length!=1) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction import s'utilise avec un argument", ln:ln};
   let e=evaluate(args[0]);
   if(e.t!="string") throw {error:"args", name:"Mauvais type d'argument",
      msg:"La fonction import attent une chaîne", ln:ln};
   if(_modules[e.val]) return ; // Déjà importé
   importScripts("Modules/mod_"+e.val+".js");
   _modules[e.val]=true;
}

function prePop(args, ln){
   if(args.length!=1 && args.length!=2) throw {error:"args", name:"Mauvais nombre d'arguments", 
      msg:"pop(tableau [,indice]) s'utilise avec deux arguments", ln:ln};
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

function preClear(args, ln){
    if(args.length==1){
        console.log('clear args', args);
    }
    _env.G.sommets={};
    _env.G.arcs.length=0;
}

function preGraphMode(args, ln){
    if(args.length==0){
        return {t:"string", val:_grapheMode};
    }
    _grapheMode = ''+args[0].val;
    _grapheChange=true;
    regularCheck();
}

function interpret(tree){
   _grapheEnv={};
   _arcs=[];
   _env.Predef["clear"]={t:"predfn", f:preClear};
   _env.Predef["Adj"]={t: "predvar", f:preM, optarg:true};
   _env.Predef["Id"]={t: "predvar", f:preId, optarg:true};
   _env.Predef["Zero"]={t: "predvar", f:preZero, optarg:true};
   _env.Predef["OpCount"]={t:"predvar", f:preOpCnt};
   _env.Predef["sommets"]={t:"predfn", f:preSommets};
   _env.Predef["len"]={t:"predfn", f:preLen};
   _env.Predef["True"]=TRUE;
   _env.Predef["False"]=FALSE;
   _env.Predef["pi"]={t:"number", val:Math.PI};
   _env.Predef["random"]={t:"predfn", f:preRandom};
   _env.Predef["print"]={t:"predfn", f:prePrint};
   _env.Predef["refresh"]={t:"predfn", f:preRefresh};
   _env.Predef["println"]={t:"predfn", f:prePrintln};
   _env.Predef["arcs"]={t:"predfn", f:preArcs};
   _env.Predef["aretes"]={t:"predfn", f:preArcs};
   _env.Predef["null"]={t:"predvar", f:function(){return NULL;}};
   _env.Predef["sqrt"]={t:"predfn", f:preMaths1};
   _env.Predef["sqr"]={t:"predfn", f:preMaths1};
   _env.Predef["exp"]={t:"predfn", f:preMaths1};
   _env.Predef["log"]={t:"predfn", f:preMaths1};
   _env.Predef["log10"]={t:"predfn", f:preMaths1};
   _env.Predef["log2"]={t:"predfn", f:preMaths1};
   _env.Predef["sin"]={t:"predfn", f:preMaths1};
   _env.Predef["cos"]={t:"predfn", f:preMaths1};
   _env.Predef["tan"]={t:"predfn", f:preMaths1};
   _env.Predef["asin"]={t:"predfn", f:preMaths1};
   _env.Predef["acos"]={t:"predfn", f:preMaths1};
   _env.Predef["atan"]={t:"predfn", f:preMaths1};
   _env.Predef["abs"]={t:"predfn", f:preMaths1};
   _env.Predef["import"]={t:"predfn", f:preImport};
   _env.Predef["pop"]={t:"predfn", f:prePop};
   _env.Predef["Infinity"]={t:"number", val:Infinity};
   _env.Predef["_grapheMode"]={t:"predfn", f:preGraphMode};
   _globalEnv={};
   _localEnv=_globalEnv;
   _stackEnv=[_localEnv];
   interpretWithEnv(tree, false, false);
   regularCheck(true);
}

onmessage = function (e){
   if(e.data=="tick"){
      var v=0;
      if(_env.Global["tick"]) v=_env.Global["tick"].val;
      v++;
      _env.Global["tick"]={t:"number", val:v};
      return;
   }
   try{
      let str=parseTabulation(e.data);
      let out = grlang.parse(str);
      interpret(out);
      postMessage({termine: 0, opcnt:_opCnt});
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
         //postMessage({error:"interne", name:"Erreur interne", msg:JSON.stringify(e)});
         throw(e);
      }
   }
}

