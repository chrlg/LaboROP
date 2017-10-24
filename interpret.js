importScripts("grlang.js");

// Les environnements
// Il y a 3 environnements globaux: _predef qui contient les constantes et fonctions fournies
// _grapheEnv, qui contient les sommets désignés par leurs noms
// _globalEnv, qui contient les variables globales et fonctions définies par l'utilisateur
// Et 1 environnement local, qui est créé à chaque appel de fonction
// Par défaut, l'envionnement local est l'environnement global. 
// _envStack est la pile d'environnement locaux (grandit à chaque appel, diminue à chaque return)
var _predefEnv = {};
var _grapheEnv = {};
var _globalEnv = {};
var _envStack = [_globalEnv] ;
var _localEnv = _globalEnv;
var _numSommet=0, _numArc=0; // Compteur sommets et arcs

var _arcs=[]; // Pas un environnement, contrairement à la liste des sommets _grapheEnv, puisqu'ils n'ont pas de noms
              // mais on a aussi besoin, globalement, d'une liste d'arcs
var _str=""; // Chaine "stdout" à envoyer à la console
var _instrCnt=0; // Nombre d'instruction exécutées (histoire de faire des vérifications régulières)
var _strChange=false; // true ssi _str a changé depuis la dernière fois qu'elle a été affichée
var _grapheChange=false; // true ssi le graphe a changé depuis la dernière fois qu'il a été affiché

// Des constantes du langage utilisées dans le présent code (voir plus loin les constantes du langage
// définies dans _predefEnv. FALSE correspond à False, etc.)
const FALSE={t:"boolean", val:false};
const TRUE={t:"boolean", val:true};
const UNDEFINED={t:"boolean", val:undefined};
const NULL={t:"null"};


// Fonction levant une erreur de syntaxe ou lexicale (call back de l'analyseur syntaxique généré par jison)
grlang.yy.parseError = function(e, h){
   var hh=h;
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
   var out=""; // Variable contenant le code transformé
   var startLine=true; // Indique si on vient de commencer une ligne (au début, c'est forcément le cas)
   var indents=[0]; // Nombre d'espace en début de ligne pour le bloc courant
   var ln=1; // Numéro de ligne
   str+="§;\n§;\n"; // Juste pour forcer à finir tous les blocs commencés
   while(str!=""){
      if(startLine){ // Si on vient de commencer une ligne (on vient de commencer le fichier ou de voir un retour charriot)
	 startLine=false;  // on génère potentiellement des §{/§}.   
	 var m=str.match(/[^ ]/).index; // m=nombre d'espaces au début de cette ligne
	 str=str.slice(m);// Maintenant qu'on sait combien il y en a on peut les virer
	 if(str[0]=="\n"){ // Si le premier caractère non espace de la ligne est un \n, on ignore juste cette ligne
	    continue;
	 }
	 var expected=indents[indents.length-1]; // expected: le nombre d'espace du bloc en cours
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
	 var m=str.match(/^[^\n]+/)[0];
	 out += m;
	 str=str.slice(m.length);
	 continue;
      }
   }
   return out;
}

// Fonction générant du "dot" et l'envoyant au thread HTML pour dessin
function updateGraphe(){
   var gr="";
   var orient = isOrient();
   if(orient) gr+="digraph{";
   else gr+="graph{";
   // Utile uniquement pour les sommets isolés, mais sans effet sur les autres (qui auraient
   // été générés de toutes façons avec leurs arcs)
   // (Note: servira plus tard pour les attributs)
   for(var e in _grapheEnv){
      gr+=(""+e+";");
   }
   // Arcs ou aretes
   for(var i=0; i<_arcs.length; i++){
      if(orient) gr+=""+_arcs[i].i.name +"->"+_arcs[i].a.name+";";
      else gr+=""+_arcs[i].i.name+"--"+_arcs[i].a.name+";";
   }
   gr+="}\n";
   // Envoie le graphe au thread principal, qui appelera dot avec
   postMessage({graph:gr});
}


// Fonction utilitaire : donne la valeur de la variable (du langage cible) "Oriente"
function isOrient(){
   if(_predefEnv.Oriente===undefined) return undefined;
   else return _predefEnv.Oriente.val;
}

// Récupère l'objet désigné par "sym", par ordre de priorité "env local > env global > sommet > var prédéfinie"
function getEnv(sym){
   var envs=[_localEnv, _globalEnv, _grapheEnv, _predefEnv];
   for(var i=0; i<envs.length; i++){
      if(envs[i][sym]!==undefined){
	 if(envs[i][sym].t=="global") continue; // Si ça existe dans l'environnement local, mais déclaré "global",
	 return envs[i][sym]; // il faut remonter plus loin (l'env global) pour trouver le vrai sens du symbole
      }
   }
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
// et o[4][o[5]] vers le 5e
function evaluateArc(o, ln){
   if(o.length!=6) throw {error:"type", name:"Pas un arc ou arête", msg:"", ln:ln};
   var w=o[4][o[5]]; // L'arc lui-même

   // Arc qui a déjà été défini directement dans l'environnement
   // Cad que 
   if(w!==undefined && (w.t=="Arc"||w.t=="Arete"||w.t=="null")) return w; // Arc défini

   // Arc indéfini (il n'a pas été affecté, c'est la première fois qu'on en parle
   // mais peut-être que les sommets qui le constituent correspondent bien à un arc
   var s1=o[0][o[1]];
   var s2=o[2][o[3]];
   if(s1===undefined || s2===undefined || s1.t!="Sommet" || s2.t!="Sommet"){
      throw {error:"type", name:"Pas un arc ou une arête", 
	 msg:"La paire ne correspond pas à un arc ou une arête", ln:ln};
   }
   for(var i=0; i<_arcs.length; i++){
      if(_arcs[i].i==s1 && _arcs[i].a==s2) return _arcs[i];
      if(o[5][0]=="-" && _arcs[i].a==s1 && _arcs[i].i==s2) return _arcs[i];
   }
   throw {error:"type", name:"Arc ou arête inexistant", 
      msg:"La paire ne correspond pas à un arc ou une arête", ln:ln};
}

const _binaryOp = ["+", "-", "*", "/", "%", "**"];
// Retourne la référence (une paire "objet/index" mutable) vers une l-value
// Ou un quadruplet pour les arcs et aretes
function evaluateLVal(lv, direct){

   // Fonction utilitaire : récupère l'environnement concerné
   function getIdlv(name){
      if(_predefEnv[name]) throw{error:"env", name:"Surdéfinition", msg:"Vous ne pouvez modifier une variable prédéfinie", ln:lv.ln};
      if(_grapheEnv[name]) return _grapheEnv;
      if(_localEnv[name] && _localEnv[name].t=="global") return _globalEnv;
      return _localEnv;
   }

   if(lv.t=="id") { // une variable (non prédéfinie) : a=
      return [getIdlv(lv.name), lv.name];
   }

   else if(lv.t=="arc" || lv.t=="arete") { // (a,b)= ou [a,b]=
      if(lv.t=="arete" && isOrient()) throw {error:"type", name: "Arete dans un graphe orienté", msg:"", ln:lv.ln};
      if(lv.t=="arc" && !isOrient()) throw {error:"type", name:"Arc dans un graphe non orienté", msg:"", ln:lv.ln};
      var a=getIdlv(lv.initial);
      var b=getIdlv(lv.terminal);
      var cn=((lv.t=="arc")?">":"-") + lv.initial + "," + lv.terminal;
      var c=getIdlv(cn);
      return [a, lv.initial, b, lv.terminal, c, cn];
   }

   else if(lv.t=="field") { // a.f=
      var o=evaluateLVal(lv.o); // référence ver a
      var e=o[0];  // Environnement de a
      var i=o[1];  // Nom de a dans cet environnement
      var v=e[i];  // Valeur de a (en gros, ce que donnerait evaluate)

      if(v===undefined) e[i]={t:"struct", f:{}}; // a n'existe pas encore. C'est une création implicite

      else if(v.t=="Sommet"){ // Soit un sommet, soit un arc. Le champ fait donc référence à une marque
	 if(o.length==2) return [v.marques, lv.f]; // Sommet
	 if(o.length==6) {
	    var w=evaluateArc(o, lv.ln);
	    if(w.t=="null") throw {error:"type", name:"Arc ou arête nul", msg:"", ln:lv.ln};
	    return [w.marques, lv.f];
	 }
      }else if(v.t!="struct"){ // Autre chose sans champ
	 e[i]=={t:"struct", f:{}};
      }
      return [o[0][o[1]].f, lv.f];
   }

   else if(lv.t=="index"){ // a[12]=
      var o=evaluateLVal(lv.tab); // o=référence vers a
      var v=o[0][o[1]]; // valeur (evaluate(lv.tab))
      if(v===undefined) o[0][o[1]] = {t:"array", val:[]}; // Une création de variable
      else if(o[0]==_grapheEnv) throw{error:"env", name:"Les sommets ne sont pas des tableaux", msg:"", ln:lv.ln};
      else if(v.t!="array"){ // Une variable qui était autre chose qu'un tableau, et devient un tableau
	 o[0][o[1]]={t:"array", val:[]};
      }
      var i=evaluate(lv.index);
      if(i===undefined || i.t!="number"){
	 throw {error:"type", name:"Index invalide", msg:"Un élément de type '"+i.t+"' n'est pas un index valide pour un tableau", ln:lv.index.ln};
      }
      return [ o[0][o[1]].val, i.val ];
   }
   else throw {error:"interne", name:"Erreur interne", msg:"EvaluateLVal appelé sur non-LValue", ln:lv.ln};
}


// EXPRESSIONS
function evaluate(expr){
   // Les valeurs natives. 
   if(expr.t=="string" || expr.t=="number" || expr.t=="boolean"){
      return expr;
   }

   // Accès à une variable. Pour être une expression, il ne peut s'agir d'une fonction
   // (le langage interdit donc les pointeurs de fonctions)
   if(expr.t=="id"){
      var e=getEnv(expr.name);
      if(e===undefined) throw {error:"variable", name:"Symbole non défini", msg: "Symbole "+expr.name+" non défini", ln:expr.ln};
      if(e.t=="predfn") throw {error:"type", name:"Variable incorrecte", 
	    msg: "Tentative d'utiliser la fonction prédéfinie "+expr.name+ " comme une variable",
	    ln:expr.ln};
      if(e.t=="DEF") throw {error:"type", name:"Variable incorrecte",
	    msg: ""+expr.name+" est une fonction", ln:expr.ln};
      if(e.t=="predvar") return e.f();
      return e;
   }

   // Gamma d'un sommet
   if(expr.t=="Gamma"){
      var v=evaluate(expr.arg);
      if(v.t!="Sommet") throw {error:"type", name:"Argument invalide pour Gamma",
	    msg:"Argument de type "+v.t+" invalide pour Gamma. Sommet attendu.", ln:expr.ln};
      var rep=[];
      for(var i=0; i<_arcs.length; i++){
	 if(_arcs[i].i==v) rep.push(_arcs[i].a);
	 if(isOrient()===false && _arcs[i].a==v) rep.push(_arcs[i].i);
      }
      return {t:"array", val:rep};
   }

   // Comparaison (égalité)
   // Pour les valeurs scalaires, compare la valeur. Pour les sommets et arcs, la référence suffit
   // Pour les vecteurs et structures : comparaison récursive
   if(expr.t=="==" || expr.t=="!="){
      var a=evaluate(expr.left);
      var b=evaluate(expr.right);
      if(a.t=="global" || a.t=="predvar" || a.t=="predfn" || a.t=="DEF")
	    throw {error:"exec", name:"Erreur interne", msg:""+a.t+" dans ==", ln:expr.ln};
      if(a.t=="tuple")
	    throw {error:"type", name:"Valeurs multiples", 
		  msg:"Tentative d'utiliser l'opérateur de comparaison avec une valeur multiple",
		  ln:expr.ln};
      function isEq(a,b){
	 if(a.t=="string" && b.t=="Sommet") return a.val==b.name;
	 if(a.t=="Sommet" && b.t=="string") return a.name==b.val;
	 if(a.t!=b.t) return false;
	 if(a.t=="null") return true;
	 if(a.t=="Sommet" || a.t=="Arete" || a.t=="Arc") return a==b;
	 if(a.t=="boolean" || a.t=="number" || a.t=="string") return a.val==b.val;
	 if(a.t=="array"){
	    if(a.val.length!=b.val.length) return false;
	    for(var i=0; i<a.val.length; i++){
	       if(!isEq(a.val[i], b.val[i])) return false;
	    }
	    return true;
	 }
	 if(a.t=="struct"){
	    for(var f in a.f) if(b.f[f]===undefined) return false;
	    for(var f in b.f) if(a.f[f]===undefined) return false;
	    for(var f in a.f) if(!isEq(a.f[f], b.f[f])) return false;
	    return true;
	 }
      }
      if(isEq(a, b)) return (expr.t=="==")?TRUE:FALSE;
      else return (expr.t=="==")?FALSE:TRUE;
   }

   // and / or
   if(expr.t=="&&" || expr.t=="||"){
      var a=evaluate(expr.left);
      if(a.t!="boolean")
	 throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.left.ln};
      if(a.val && expr.t=="||") return TRUE;
      if(!a.val && expr.t=="&&") return FALSE;
      var b=evaluate(expr.right);
      if(b.t!="boolean")
	 throw {error:"type", name:"Opérande non booléenne pour opérateur booléen", msg:"", ln:expr.ln};
      if(b.val) return TRUE;
      else return FALSE;
   }

   // Comparaison (inégalité)
   // Uniquement pour des valeurs scalaires
   if(expr.t=="<" || expr.t==">" || expr.t=="<=" || expr.t==">="){
      var a=evaluate(expr.left);
      var b=evaluate(expr.right);
      if(a.t=="global" || a.t=="predvar" || a.t=="predfn" || a.t=="DEF")
	    throw {error:"exec", name:"Erreur interne", msg:""+a.t+" dans ==", ln:expr.ln};
      if(a.t=="tuple")
	    throw {error:"type", name:"Valeurs multiples", 
		  msg:"Tentative d'utiliser l'opérateur de comparaison avec une valeur multiple",
		  ln:expr.ln};
      if(a.t != b.t) throw {error:"type", name:"Comparaison de valeur de types différents",
	    msg:"", ln:expr.ln};
      var vala=false, valb=false;
      if(a.t=="number" || a.t=="string"){
	 vala=a.val;
	 valb=b.val;
      }else if(a.t=="Sommet"){
	 vala=a.name;
	 valb=b.name;
      }else throw {error:"type", name:"Type invalide pour une comparaison",
	 msg:"Tentative de comparer deux valeurs de type "+a.t, ln:expr.ln};
      if(expr.t=="<") return (vala<valb)?TRUE:FALSE;
      else if(expr.t==">") return (vala>valb)?TRUE:FALSE;
      else if(expr.t==">=") return (vala>=valb)?TRUE:FALSE;
      else if(expr.t=="<=") return (vala<=valb)?TRUE:FALSE;
      else throw {error:"interne", name:"Hein?", msg:"", ln:expr.ln};
   }

   // Arete ou arc
   if(expr.t=="arete" || expr.t=="arc"){
      var ref=evaluateLVal(expr);
      if(ref.length!=6) throw {error:"interne", name:"Erreur interne", msg:"L-Value d'une arête mal évaluée",
	 ln:expr.ln};
      var v=evaluateArc(ref);
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
      var v=op[0][op[1]];
      if(!v) throw {error:"env", name:"Variable non définie", msg:"", ln:expr.ln};
      if(v.t!="number") throw {error:"type", name:"Erreur de type", 
	    msg:"++ ou -- attend un nombre et a été utilisé sur un "+v.t, ln:expr.ln};
      var newVal={t:"number", val:v.val};
      if(expr.t=="++") newVal.val++;
      else newVal.val--;

      setRef(op, newVal, expr.ln);

      if(expr.left) return v;
      else return newVal;
   }

   if(_binaryOp.indexOf(expr.t)>=0){
      var a=evaluate(expr.left);
      var b=evaluate(expr.right);
      // Cas particulier pour le + : on accepte aussi chaines et tableau, et booléens
      if(expr.t=="+"){
	 if(a.t=="array"){
	    var val=a.val.slice();
	    val.push(b);
	    return {t:"array", val:val};
	    // TODO: matrices
	 }
	 if(a.t=="string"){
	    if(b.t=="string") return {t:"string", val:a.val+b.val};
	    if(b.t=="number") return {t:"string", val:a.val+b.val};
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
      // Cas particulier pour * : et non paresseux
      if(expr.t=="*"){
         if(a.t=="boolean" && b.t=="boolean") return (a.val&&b.val)?TRUE:FALSE;
      }
      if(a.t!="number" || b.t!="number")
	 throw {error:"type", name:"Erreur de type", msg:"Types "+a.t+expr.t+b.t+" incompatibles", ln:expr.ln};
      if(expr.t=="+") return {t:"number", val:a.val+b.val};
      if(expr.t=="-") return {t:"number", val:a.val-b.val};
      if(expr.t=="*") return {t:"number", val:a.val*b.val};
      if(expr.t=="/") return {t:"number", val:a.val/b.val};
      if(expr.t=="%") return {t:"number", val:a.val%b.val};
      if(expr.t=="**") return {t:"number", val:a.val**b.val};
      throw {error:"interne", name:"Erreur interne", msg:"Hein?", ln:expr.ln};
   }

   if(expr.t=="call"){
      var v=interpCall(expr);
      if(v===undefined || v.t=="empty") throw {error:"type", name:"Pas de valeur de retour",
	    msg:"La fonction "+expr.f+" n'a retourné aucune valeur",
	    ln:expr.ln};
      return v;
   }

   if(expr.t=="SOMMET"){
      var v=evalSommet(expr.arg, true);
      if(!v || v.t!="Sommet") throw {error:"type", name:"Pas un sommet", 
	 msg:"Un "+v.t+" n'est pas un sommet valide", ln:expr.arg.ln};
      return v;
   }

   if(expr.t=="field"){
      var o=evaluate(expr.o);
      if(o.t=="struct") return o.f[expr.f];
      else if(o.t=="Sommet" || o.t=="Arc" || o.t=="Arete") return o.marques[expr.f];
      else throw {error:"type", name:"Pas une structure", msg:"Un objet de type "+o.t+" n'a pas de champs", ln:expr.ln};
   }

   if(expr.t=="index"){
      var tab=evaluate(expr.tab);
      var idx=evaluate(expr.index);
      if(idx.t!="number") throw {error:"type", name:"Erreur de type", msg:"Index non entier",
            ln:expr.index.ln};
      if(tab.t=="array") return tab.val[idx.val];
      if(tab.t=="string") return {t:"string", val:tab.val[idx.val]};
      if(tab.t=="Sommet") return {t:"string", val:tab.name[idx.val]};
   }
   console.log("Cannot evaluate", expr);
}

// Fonction interne d'ajout de sommet
function addSommet(name){
   _grapheEnv[name] = {t:"Sommet", name:name, marques:{}};
}

// Récupère la valeur d'un sommet à partir d'une chaine ou d'une variable non identifiée
// Si creer est true, crée le sommet s'il n'existe pas
// Si le sommet n'existe pas, et n'a pas été créé, retourne le nom à la place
function evalSommet(som, creer){
   var str=null;
   var S=null;
   if(som.t=="id" && getEnv(som.name)===undefined) str=som.name; // Identifiant non existant, traité comme une chaine
   else{
      var ev=evaluate(som);
      if(ev===undefined) throw {error:"type", name:"Sommet indéfini", msg: "", ln:som.ln};
      if(ev.t=="string") str=ev.val;
      else if(ev.t=="Sommet") {S=ev; str=ev.name;}
      else throw {error:"type", name:"Ce n'est pas un sommet", msg:"Une expression de type '"+ev.t+"' n'est pas un sommet légal", ln:som.ln};
   }
   if(S) return S;
   if(str===null) throw {error:"internal", name:"Sommet non défini", msg:"Erreur interne : le sommet est indéfini", ln:som.ln};
   if(!str.match(/^[A-Za-z0-9_]*$/)){
      throw{error: "type", name: "Nom de sommet illégal", 
	    msg: "Le nom d'un sommet ne doit contenir que\ndes caractères alphanumériques\nnom:"+str, ln: som.ln};
   }
   if(_grapheEnv[str]) return _grapheEnv[str];
   if(creer) {
      addSommet(str);
      return _grapheEnv[str];
   }
   return str;
}


// Ajoute des sommets dans l'environnement _grapheEnv
function creerSommets(liste){
   for(var i=0; i<liste.length; i++){
      var ev=evalSommet(liste[i], false);
      // On a récupéré un sommet existant
      if(ev.t=="Sommet") throw {error:"env", name:"Sommet déjà existant", msg:"Le sommet "+ev.name+" existe déjà", ln:liste[i].ln};
      // Un nom de sommet inexistant
      if(typeof ev == "string") {
	 addSommet(ev);
      }
      // Autre chose ?
      else throw {error:"interne", name:"Erreur interne", msg:"Ni string, ni sommet dans creerSommet\nev:"+ev+"\nev.t="+ev.t, ln:liste[i].ln};
   }
   _grapheChange=true;
}

function interpIncrement(ins){
   if(ins.left.t=="id" && ins.left.name=="X") return creerSommets([ins.right]);
   if(ins.left.t=="id" && ins.left.name=="U"){
      if(ins.right.t=="arete") return creerArete(ins.right.left, ins.right.right);
      if(ins.right.t=="arc") return creerArc(ins.right.left, ins.right.right);
      throw {error:"type", name:"Erreur de type", msg: "Argument invalide pour U+=", ln:ins.ln};
   }
   if(ins.left.t=="Gamma"){
      if(isOrient() || isOrient()===undefined) return creerArc(ins.left.arg, ins.right);
      else return creerArete(ins.left.arg, ins.right);
   }
   if(ins.left.t=="id"){
      
      if(_localEnv[ins.left.name]===undefined) throw {error:"variable", name:"Variable non définie", 
	    msg:""+inst.left.name+" n'est pas définie", ln:ins.left.ln};
      _localEnv[ins.left.name] += evaluate(ins.right);
   }
   console.log("Cannot do +=", ins);
}

function interpPlusPlus(ins){
   if(ins.left.t=="id"){
   }
}

function setRef(ref, val, ln){
   // Cas des arcs et arêtes
   if(ref.length==6){
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
   // Copy "profonde" pour les tableaux et structures
   if(ref[0]==_grapheEnv) throw {error:"env", name:"Surdéfinition d'un sommet", 
	    msg:"Impossible d'écraser le sommet "+ref[1], ln:ln};
   if(val.t=="array" || val.t=="struct"){
      ref[0][ref[1]] = JSON.parse(JSON.stringify(val));
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
   if(v.t=="tuple" && v.vals.length != ins.left.length) throw {error:"type", name:"Nombre d'expressions invalide",
	 msg:"Les nombres de valeurs à droite et à gauche du '=' ne correspondent pas", ln:ins.ln};
   if(v.t!="tuple" && ins.left.length!=1) throw {error:"type", name:"Nombre d'expressions invalide",
	 msg:"Une seule expression pour remplir plusieurs destinations", ln:ins.ln};
   // Affectation de chaque lvalue
   for(var i=0; i<ins.left.length; i++){
      var o=evaluateLVal(ins.left[i]);
      if(v.t=="tuple") setRef(o, v.vals[i], ins.left[i].ln);
      else setRef(o, v, ins.left[i].ln);
   }
}

function creerArete(left, right){
   // Une arête implique un graphe non orienté. Fixer l'orientation si pas encore fait. Sinon, lever une erreur si contradictoire
   if(isOrient()) throw {error:"graphe", name: "Erreur de graphe", msg: "Un graphe orienté ne peut contenir d'arêtes", ln: left.ln};
   if(isOrient()===undefined) _predefEnv["Oriente"]=FALSE;


   var l=evalSommet(left, true);
   var r=evalSommet(right, true);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour une arête", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour une arête", ln:right.ln};

   _arcs.push({t:"Arete", i:l, a:r, marques:{}});
   _grapheChange=true;
}

function creerArc(left, right){
   // Un arc implique un graphe orienté
   if(isOrient()===undefined) _predefEnv["Oriente"]=TRUE;
   if(!isOrient()) throw {error:"graphe", name:"Erreur de graphe", msg:"Un graphe non orienté ne peut contenir d'arcs", ln:left.ln};

   var l=evalSommet(left, true);
   var r=evalSommet(right, true);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour un arc", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour un arc", ln:right.ln};

   _arcs.push({t:"Arc", i:l, a:r, marques:{}});
   _grapheChange=true;
}

function interpDef(def){
   if(_predefEnv[def.nom]!==undefined) throw {error:"type", 
      name: "Surdéfinition", msg: "Impossible de redéfinir le symbole prédéfini "+def.nom,
      ln:def.ln};
   if(_globalEnv[def.nom]!==undefined) throw {error:"type", name: "Surdéfinition", msg: "Fonction "+def.nom+" déjà définie", ln: def.ln};
   _globalEnv[def.nom] = def;
}

function interpCall(call){
   var fn=getEnv(call.f);
   if(fn===undefined) throw {error:"symbol", name: "Fonction non définie",
	    msg:"La fonction "+call.f+" n'existe pas", ln: call.ln};
   if(fn.t=="predfn") return fn.f(call.args, call.ln);
   if(fn.t!="DEF") throw {error:"type", name:"Pas une fonction",
	    msg:"Tentative d'appeler "+call.f+", qui n'est pas une fonction", ln:call.ln};
   if(fn.args.length != call.args.length) throw {error: "type", name:"Mauvais nombre d'arguments",
	    msg:"Appel de "+call.f+" avec "+call.args.length+" argument(s) alors que "+
	        fn.args.length+" sont attendus", ln:call.ln};
   var newEnv = {};
   for(var i=0; i<call.args.length; i++){
      var v=evaluate(call.args[i]);
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
   if(c.t != "boolean") throw {error:"type", name: "Condition non booléenne",
           msg:"La condition du if n'est pas un booléen", ln:si.cond.ln};
   if(c.val) return interpretWithEnv(si["do"], isloop);
   else return interpretWithEnv(si["else"], isloop);
}

function interpWhile(tant){
   for(;;){
      var c=evaluate(tant.cond);
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
   for(var i=start.val; i<end.val; i+=step.val){
      setRef(comptRef, {t:"number", val:i});
      var b=interpretWithEnv(ins.do, true);
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
   for(var i=0; i<range.val.length; i++){
      setRef(comptRef, range.val[i], ins.compteur.ln);
      var b=interpretWithEnv(ins.do, true);
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


function regularCheck(){
   _instrCnt=0;
   if(_grapheChange){
      _grapheChange=false;
      updateGraphe();
   }
   if(_strChange){
      _strChange=false;
      _str=_str.slice(-5000);
      postMessage({print: _str});
   }
}

// LISTE D'INSTRUCTIONS
function interpretWithEnv(tree, isloop){
   for(var i=0; i<tree.length; i++){
      if(_instrCnt++>1000000) regularCheck();
      if(tree[i].t=="SOMMET"){
	 creerSommets(tree[i].args);
	 continue;
      }
      if(tree[i].t=="ARETE"){
	 creerArete(tree[i].left, tree[i].right);
	 continue;
      }
      if(tree[i].t=="Arc"){
	 creerArc(tree[i].left, tree[i].right);
	 continue;
      }
      if(tree[i].t=="ArcOuArete"){
	 if(isOrient()) creerArc(tree[i].left, tree[i].right);
	 else if(isOrient()===false) creerArete(tree[i].left, tree[i].right);
	 else throw {error:"exec", name:"Notation ambigue", msg:"Vous ne pouvez utiliser cette notation sans avoir fixé l'orientation du graphe", ln:tree[i].ln};
	 continue;
      }
      if(tree[i].t=="="){
	 interpAffect(tree[i]);
	 continue;
      }
      if(tree[i].t=="++" || tree[i].t=="--"){
	 evaluate(tree[i]);
	 continue;
      }
      if(tree[i].t=="foreach"){
         var b=interpForeach(tree[i]);
	 if(b=="return") return "return";
         continue;
      }
      if(tree[i].t=="for"){
	 var b=interpFor(tree[i]);
	 if(b=="return") return "return";
	 continue;
      }
      if(tree[i].t=="if"){
	 var b=interpIf(tree[i], isloop);
	 if(isloop && b=="break") return "break";
	 if(isloop && b=="continue") return "continue";
	 if(b=="return") return "return";
	 continue;
      }
      if(tree[i].t=="while"){
	 var b=interpWhile(tree[i]);
	 if(b=="return") return "return";
	 continue;
      }
      if(tree[i].t=="call"){
	 interpCall(tree[i]);
	 continue;
      }
      if(tree[i].t=="DEF"){
	 interpDef(tree[i]);
	 continue;
      }
      if(tree[i].t=="break"){
	 if(!isloop) throw {error:"exec", name:"Break en dehors d'une boucle",
	       msg:"'break' ne peut être utilisé que dans une boucle for ou while",
	       ln:tree[i].ln};
	 return "break";
      }
      if(tree[i].t=="continue"){
	 if(!isloop) throw {error:"exec", name:"continue en dehors d'une boucle",
	       msg:"'continue' ne peut être utilisé que dans une boucle for ou while",
	       ln:tree[i].ln};
	 return "continue";
      }
      if(tree[i].t=="return"){
	 interpReturn(tree[i]);
	 return "return";
      }
      if(tree[i].t=="exit"){
	 interpExit(tree[i].arg);
	 return "exit";
      }
      if(tree[i].t=="$"){
	 console.log(eval(tree[i].i.slice(1)));
	 continue;
      }
      console.log("Can't do ", tree[i]);
   }
   return false;
}

function preRandom(args){
   if(args.length==0){
      return Math.random();
   }
   var a=evaluate(args[0]);
   if(a.t=="number"){
      return Math.floor(Math.random()*a);
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
	 if(!v || v.t!="boolean") throw {error:"type", name:"Condition non booléenne",
	    msg:"Mauvaise condition de filtrage pour random", ln:args[1].ln};
	 if(v.val) return cur;
      }
      return NULL; // Rien ne correspond à la condition
   }
}

function prePrint(args){
   _strChange=true;
   function printRec(o){
      if(typeof o=="object"){
	 if(o.t=="Sommet") _str+=o.name;
	 else if(o.t=="Arete") _str+="["+o.i.name+","+o.a.name+"]";
	 else if(o.t=="Arc") _str+="("+o.i.name+","+o.a.name+")";
	 else if(o.t=="number") _str+=(""+o.val);
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
   }
}

function prePrintln(a){
   prePrint(a);
   _str+="\n";
}

function preM(){
   var M={t:"array", val:[]};
   var k=Object.keys(_grapheEnv);
   for(var i=0; i<k.length; i++){
      M.val[i]={t:"array", val:[]};
      for(var j=0; j<k.length; j++){
	 M.val[i].val[j]=0;
      }
   }
   return M;
}

function preX(){
   return {t:"array", val:Object.values(_grapheEnv)};
}

function preU(){
   return {t:"array", val:_arcs};
}

function preArcs(args, ln){
   if(args.length!=1) throw {error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction arcs/aretes attend un et un seul argument", ln:ln};
   var a=evaluate(args[0]);
   if(a.t!="Sommet") throw {error:"type", name:"Erreur de type", 
      msg:"La fonction arcs/aretes attend un argument de type Sommet", ln:args[0].ln};
   var rep=[];
   for(var i=0; i<_arcs.length; i++){
      if(_arcs[i].i==a) rep.push(_arcs[i]);
      else if(_arcs[i].a==a) {
	 if(_arcs[i].t=="Arete"){ // Dans le cas précis de arete, on inverse les sommets
	    // Avant de retourner le résultat. C'est un peu pourri comme méthode. Mais
	    // le but est de garantir que [x,y] in aretes(A) retourne toujours un y!=A (sauf pour la boucle)
	    var pivot=_arcs[i].i;
	    _arcs[i].i=_arcs[i].a;
	    _arcs[i].a=pivot;
	 }
	 rep.push(_arcs[i]);
      }
   }
   return {t:"array", val:rep};
}

function interpret(tree){
   _grapheEnv={};
   _arcs=[];
   _predefEnv={};
   _predefEnv["M"]={t: "predvar", f:preM};
   _predefEnv["X"]={t: "predvar", f:preX};
   _predefEnv["Oriente"]=UNDEFINED;
   _predefEnv["U"]={t: "predvar", f:preU};
   _predefEnv["True"]=TRUE;
   _predefEnv["False"]=FALSE;
   _predefEnv["pi"]={t:"number", val:Math.PI};
   _predefEnv["random"]={t:"predfn", f:preRandom};
   _predefEnv["print"]={t:"predfn", f:prePrint};
   _predefEnv["println"]={t:"predfn", f:prePrintln};
   _predefEnv["arcs"]={t:"predfn", f:preArcs};
   _predefEnv["aretes"]={t:"predfn", f:preArcs};
   _predefEnv["null"]=NULL;
   _globalEnv={};
   _localEnv=_globalEnv;
   _stackEnv=[_localEnv];
   interpretWithEnv(tree, false, false);
   regularCheck();
}

onmessage = function (e){
   if(e.data=="tick"){
      var v=0;
      if(_globalEnv["tick"]) v=_globalEnv["tick"].val;
      v++;
      _globalEnv["tick"]={t:"number", val:v};
      return;
   }
   try{
      var str=parseTabulation(e.data);
      var out = grlang.parse(str);
      interpret(out);
      postMessage({termine: 0});
   }catch(e){
      console.log(e);
      if(e.error) {
	 if(e.error=="exit") {
	    if(e.val) postMessage({error:"exec", name:"Erreur signalée par le progamme",
	       msg:"Le programme a déclenché l'erreur "+e.val, ln:e.ln});
	    else postMessage({termine: e.val});
	 }
	 else postMessage(e);
      }
      else {
	 postMessage({error: "syntax", name: "Erreur de syntaxe", msg: e.msg, ln: e.line+1, err:e});
      }
   }
}

