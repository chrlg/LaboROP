importScripts("grlang.js");

var _predefEnv = {};
var _grapheEnv = {};
var _globalEnv = {};
var _envStack = [_globalEnv] ;
var _localEnv = _globalEnv;
var _arcs=[];

const _binaryOp = ["+", "<", ">", "=="];


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

function parseTabulation(str){
   var out="";
   var startLine=true;
   var indents=[0];
   var ln=1;
   str+="§;\n§;\n";
   while(str!=""){
      if(startLine){
	 startLine=false;
	 var m=str.match(/[^ ]/).index;
	 if(str[m]=="\n"){
	    str=str.slice(m);
	    continue;
	 }
	 str=str.slice(m);
	 var expected=indents[indents.length-1];
	 if(m==expected) continue;
	 if(m>expected){
	    out+="§{";
	    indents.push(m);
	    continue;
	 }
	 while(m<expected){
	    out += "§}§;";
	    indents.pop();
	    expected=indents[indents.length-1];
	 }
	 if(m>expected){
	    throw {error: "indent", msg: false, name: "Erreur d'indentation", ln:ln};
	 }
	 continue;
      }
      else if(str[0]=='\n'){
	 ln ++;
	 out += "\n";
	 str=str.slice(1);
	 startLine=true;
	 continue;
      }else{
	 var m=str.match(/^[^\n]+/)[0];
	 out += m;
	 str=str.slice(m.length);
	 continue;
      }
   }
   return out;
}

function updateGraphe(){
   var gr="";
   var orient = isOrient();
   if(orient) gr+="digraph{";
   else gr+="graph{";
   for(var e in _grapheEnv){
      gr+=(""+e+";");
   }
   for(var i=0; i<_arcs.length; i++){
      if(orient) gr+=""+_arcs[i].i.name +"->"+_arcs[i].a.name+";";
      else gr+=""+_arcs[i].i.name+"--"+_arcs[i].a.name+";";
   }
   gr+="}\n";
   postMessage({graph:gr});
}

function isOrient(){
   if(_predefEnv.Oriente===undefined) return undefined;
   else return _predefEnv.Oriente.val;
}

function getEnv(sym){
   var envs=[_localEnv, _globalEnv, _grapheEnv, _predefEnv];
   for(var i=0; i<envs.length; i++){
      if(envs[i][sym]!==undefined) return envs[i][sym];
   }
   return undefined;
}

function evaluate(expr){
   if(expr.t=="string" || expr.t=="number" || expr.t=="boolean"){
      return expr;
   }
   // TODO FROM HERE
   if(_binaryOp.indexOf(expr.t)>=0){
      var a=evaluate(expr.left);
      var b=evaluate(expr.right);
      if(expr.t=="+") return a+b;
      if(expr.t=="<") return a<b;
      if(expr.t==">") return a>b;
      if(expr.t=="==") return a==b;
   }
   if(expr.t=="id"){
      var e=getEnv(expr.name);
      if(e===undefined) throw {error:"variable", name:"Symbole non défini", msg: "Symbole "+expr.name+" non défini", ln:expr.ln};
      if(e===null) return null;
      if(e.t=="predfn") throw {error:"type", name:"Variable incorrecte", 
	    msg: "Tentative d'utiliser la fonction prédéfinie "+expr.name+ " comme une variable",
	    ln:expr.ln};
      if(e.t=="DEF") throw {error:"type", name:"Variable incorrecte",
	    msg: ""+expr.name+" est une fonction", ln:expr.ln};
      if(e.t=="predvar") return e.f();
      return e;
   }
   if(expr.t=="call"){
      var v=interpCall(expr);
      if(v!==undefined && v.t=="empty") throw {error:"type", name:"Pas de valeur de retour",
	    msg:"La fonction "+expr.f+" n'a retourné aucune valeur",
	    ln:expr.ln};
      return v;
   }
   if(expr.t=="Gamma"){
      var v=evaluate(expr.arg);
      if(typeof v=="string") v=_grapheEnv[v];
      if(v===undefined || v.t!="Sommet"){
	 throw {error:"type", name:"Mauvais argument pour gamma",
		  msg:"Gamma attend un argument de type 'Sommet'", ln:expr.ln};
      }
      var rep=[];
      for(var i=0; i<_arcs.length; i++){
	 if(_arcs[i].i==v) rep.push(_arcs[i].a);
	 if(isOrient()===false && _arcs[i].a==v) rep.push(_arcs[i].i);
      }
      return rep;
   }
   console.log("Cannot evaluate", expr);
}

// Fonction interne d'ajout de sommet
function addSommet(name){
   _grapheEnv[name] = {t:"Sommet", name:name, marques:[]};
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
   var changes=false;
   for(var i=0; i<liste.length; i++){
      var ev=evalSommet(liste[i], false);
      // On a récupéré un sommet existant
      if(ev.t=="Sommet") throw {error:"env", name:"Sommet déjà existant", msg:"Le sommet "+ev.name+" existe déjà", ln:liste[i].ln};
      // Un nom de sommet inexistant
      if(typeof ev == "string") {
	 addSommet(ev);
	 changes=true;
      }
      // Autre chose ?
      else throw {error:"interne", name:"Erreur interne", msg:"Ni string, ni sommet dans creerSommet\nev:"+ev+"\nev.t="+ev.t, ln:liste[i].ln};
   }
   if(changes) updateGraphe();
}

function interpIncrement(ins){
   if(ins.left.t=="id" && ins.left.name=="X") return creerSommets([ins.right]);
   if(ins.left.t=="id" && ins.left.name=="U"){
      if(ins.right.t=="arete") return creerArete(ins.right.left, ins.right.right);
      if(ins.right.t=="arc") return creerArc(ins.right.left, ins.right.right);
      throw {error:"type", name:"Erreur de type", msg: "Argument invalide pour U+=", ln:ins.ln};
   }
   if(ins.left.t=="Gamma"){
      if(isOrient() || isOrient===undefined) return creerArc(ins.left.arg, ins.right);
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

function interpAffect(ins){
   var v=evaluate(ins.right);
   if(ins.left.t=="id") {
      if(_predefEnv[ins.left.name]!==undefined){
	 throw {error:"type", name:"Surdéfinition", 
	        msg: "Vous ne pouvez modifier la variable prédéfinie "+ins.left.name,
		ln: ins.ln};
      }
      _localEnv[ins.left.name] = v;
      return;
   }
   console.log("Cannot do =", ins);
}

function creerArete(left, right){
   // Une arête implique un graphe non orienté. Fixer l'orientation si pas encore fait. Sinon, lever une erreur si contradictoire
   if(isOrient()) throw {error:"graphe", name: "Erreur de graphe", msg: "Un graphe orienté ne peut contenir d'arêtes", ln: left.ln};
   if(isOrient()===undefined) _predefEnv["Oriente"]={t:"boolean", val:false};


   var l=evalSommet(left, true);
   var r=evalSommet(right, true);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour une arête", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour une arête", ln:right.ln};

   _arcs.push({t:"Arete", i:l, a:r});
   updateGraphe();
}

function creerArc(left, right){
   // Un arc implique un graphe orienté
   if(isOrient()===undefined) _predefEnv["Oriente"]={t:"boolean", val: true};
   if(!isOrient()) throw {error:"graphe", name:"Erreur de graphe", msg:"Un graphe non orienté ne peut contenir d'arcs", ln:left.ln};

   var l=evalSommet(left, true);
   var r=evalSommet(right, true);
   if(!l || l.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+left.t+" n'est pas un sommet gauche légal pour un arc", ln:left.ln};
   if(!r || r.t !== "Sommet") throw {error:"type", name: "Erreur de type", msg: "Un "+right.t+" n'est pas un sommet droit légal pour un arc", ln:right.ln};

   _arcs.push({t:"Arc", i:l, a:r});
   updateGraphe();
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
   if(fn.t=="predfn") return fn.f(call.args);
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
   if(typeof c !== "boolean") throw {error:"type", name: "Condition non booléenne",
           msg:"La condition du if n'est pas un booléen", ln:si.cond.ln};
   if(c) return interpretWithEnv(si["do"], isloop);
   else return interpretWithEnv(si["else"], isloop);
}

function interpWhile(tant){
   for(;;){
      var c=evaluate(tant.cond);
      if(typeof c!=="boolean") throw {error:"type", name: "Condition non booléenne",
	    msg:"La condition du while n'est pas un booléen", ln:tant.ln};
      if(!c) break;
      var b=interpretWithEnv(tant["do"], true);
      if(b=="break") break;
      if(b=="return") return "return";
   }
   return false;
}

function interpFor(ins){
   console.log("TODO for", ins);
}

function interpForeach(ins){
   var range=evaluate(ins.range);
   if(typeof range != "object" || range.length===undefined){
      throw {error:"type", name:"Mauvaise plage pour 'for'",
             msg:""+range+" ne peut être une plage d'itération pour 'for'",
             ln:ins.range.ln};
   }
   for(var i=0; i<range.length; i++){
      if(ins.compteur.t=="id") _localEnv[ins.compteur.name] = range[i];
      else if(ins.compteur.t=="arete"){
         if(range[i].t!="Arc")
            throw {error:"type", name:"Mauvaise plage pour 'for'",
                   msg:"Il ne s'agit pas d'une liste d'arêtes", ln:ins.range.ln};
         _localEnv[ins.compteur.left.name]=range[i].i;
         _localEnv[ins.compteur.right.name]=range[i].a;
      }
      else console.log("TODO foreach compteur=", ins.compteur);
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


// LISTE D'INSTRUCTIONS
function interpretWithEnv(tree, isloop){
   for(var i=0; i<tree.length; i++){
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
      if(tree[i].t=="="){
	 interpAffect(tree[i]);
	 continue;
      }
      if(tree[i].t=="DEF"){
	 interpDef(tree[i]);
	 continue;
      }
      if(tree[i].t=="call"){
	 interpCall(tree[i]);
	 continue;
      }
      if(tree[i].t=="if"){
	 var b=interpIf(tree[i], isloop);
	 if(isloop && b=="break") return "break";
	 if(b=="return") return "return";
	 continue;
      }
      if(tree[i].t=="while"){
	 var b=interpWhile(tree[i]);
	 if(b=="return") return "return";
	 continue;
      }
      if(tree[i].t=="for"){
	 var b=interpFor(tree[i]);
	 if(b=="return") return "return";
	 continue;
      }
      if(tree[i].t=="foreach"){
         var b=interpForeach(tree[i]);
	 if(b=="return") return "return";
         continue;
      }
      if(tree[i].t=="break"){
	 if(!isloop) throw {error:"exec", name:"Break en dehors d'une boucle",
	       msg:"'break' ne peut être utilisé que dans une boucle for ou while",
	       ln:tree[i].ln};
	 return "break";
      }
      if(tree[i].t=="return"){
	 interpReturn(tree[i]);
	 return "return";
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
   if(typeof a=="number"){
      return Math.floor(Math.random()*a);
   }
   if(typeof a != "object"){
      console.log(args);
      throw {error:"type", name:"Mauvais argument pour random", 
	 msg:""+a+" n'est pas un argument valide pour random", ln:args[0].ln};
   }
   if(args.length==1){
      var k=Object.keys(a);
      var r=Math.floor(Math.random()*k.length);
      return a[k[r]];
   }
}

function prePrint(args){
   str="";

   function printRec(o){
      if(typeof o=="object"){
	 if(o.t=="Sommet") str+=o.name;
	 else if(o.t=="Arete") str+="("+o.i.name+","+o.a.name+")";
	 else if(o.t=="Arc") str+="["+o.i.name+","+o.a.name+"]";
	 else if(o.length!==undefined){
	    str+="[";
	    for(var i=0; i<o.length; i++){
	       printRec(o[i]);
	       if(i<o.length-1) str+=",";
	    }
	    str+="]";
	 }
	 else str+="{"+o.t+"}";
      }
      else{
         str+=o;
      }
   }

   for(var i=0; i<args.length; i++){
      var a=evaluate(args[i]);
      printRec(a);
   }

   str+="\n";
   postMessage({print: str});
}

function preM(){
   return [[]];
}

function preX(){
   return Object.values(_grapheEnv);
}

function preU(){
   return _arcs;
}

function interpret(tree){
   _grapheEnv={};
   _arcs=[];
   _predefEnv={};
   _predefEnv["M"]={t: "predvar", f:preM};
   _predefEnv["X"]={t: "predvar", f:preX};
   _predefEnv["Oriente"]=undefined;
   _predefEnv["U"]={t: "predvar", f:preU};
   _predefEnv["True"]={t:"boolean", val:true};
   _predefEnv["False"]={t:"boolean", val:false};
   _predefEnv["pi"]={t:"number", val:Math.PI};
   _predefEnv["random"]={t:"predfn", f:preRandom};
   _predefEnv["print"]={t:"predfn", f:prePrint};
   _predefEnv["null"]={t:"null"};
   _globalEnv={};
   _localEnv=_globalEnv;
   _stackEnv=[_localEnv];
   interpretWithEnv(tree, false, false);
}

onmessage = function (e){
   try{
      var str=parseTabulation(e.data);
      var out = grlang.parse(str);
      interpret(out);
      postMessage({termine: 0});
   }catch(e){
      console.log(e);
      if(e.error) postMessage(e);
      else {
	 postMessage({error: "syntax", name: "Erreur de syntaxe", msg: e.msg, ln: e.line+1, err:e});
      }
   }
}

