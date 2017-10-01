importScripts("grlang.js");

var _predefEnv = {};
var _grapheEnv = {};
var _globalEnv = {};
var _envStack = [_globalEnv] ;
var _localEnv = _globalEnv;
var _arcs=[];

const _binaryOp = ["+", "<", ">"];


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
   var orient = _predefEnv["Oriente"]==true;
   if(orient) gr+="digraph{";
   else gr+="graph{";
   for(var e in _grapheEnv){
      gr+=(""+e+";");
   }
   for(var i=0; i<_arcs.length; i++){
      if(orient) gr+=""+_arcs[i][0].name +"->"+_arcs[i][1].name+";";
      else gr+=""+_arcs[i][0].name+"--"+_arcs[i][1].name+";";
   }
   gr+="}\n";
   postMessage({graph:gr});
}

function getEnv(sym){
   var envs=[_localEnv, _globalEnv, _grapheEnv, _predefEnv];
   for(var i=0; i<envs.length; i++){
      if(envs[i][sym]!==undefined) return envs[i][sym];
   }
   return undefined;
}

function evaluate(expr){
   if(expr.t=="string"){
      return expr.val;
   }
   if(_binaryOp.indexOf(expr.t)>=0){
      var a=evaluate(expr.left);
      var b=evaluate(expr.right);
      if(expr.t=="+") return a+b;
      if(expr.t=="<") return a<b;
      if(expr.t==">") return a>b;
   }
   if(expr.t=="number"){
      var v=parseFloat(expr.val);
      if(isNaN(v)) throw {error:"math", name:"Erreur mathématique", msg: ""+expr.val+" n'est pas un nombre valide", ln:expr.ln};
      return v;
   }
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
   if(expr.t=="call"){
      var v=interpCall(expr);
      return v;
   }
   console.log("Cannot evaluate", expr);
}

function creerSommets(liste){
   var changes=false;
   for(var i=0; i<liste.length; i++){
      if(liste[i].t=="id"){
	 var e=getEnv(liste[i].name);
	 if(e===undefined){
	    _grapheEnv[liste[i].name] = {t: "Sommet", name: liste[i].name, marques:[]};
	    changes=true;
	    continue;
	 }
      }
      var s = evaluate(liste[i]);
      if(typeof s !== "string") throw {error: "type", name: "Erreur de type", msg: "Le nom d'un sommet doit être une chaîne\nou un identifiant", ln:liste[i].ln};
      if(_grapheEnv[s]){
	 throw("Sommet existe déjà");
      }
      if(!s.match(/^[A-Za-z0-9_]*$/)){
	 throw{error: "type", name: "Nom de sommet illégal", 
	       msg: "Le nom d'un sommet ne doit contenir que\ndes caractères alphanumériques\nnom:"+s, ln: liste[i].ln};
      }
      _grapheEnv[s] = {t: "Sommet", name: s, marques:[]};
      changes=true;
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
      if(_predefEnv["Oriente"] || _predefEnv["Oriente"]===undefined) return creerArc(ins.left.arg, ins.right);
      else return creerArete(ins.left.arg, ins.right);
   }
   console.log("Cannot do +=", ins);
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
   var l, r;

   if(_predefEnv["Oriente"]) throw {error:"graphe", name: "Erreur de graphe", msg: "Un graphe orienté ne peut contenir d'arêtes", ln: left.ln};
   if(_predefEnv["Oriente"]===undefined) _predefEnv["Oriente"]=false;

   if(left.t=="id" && getEnv(left.name)===undefined) l=left.name;
   else l=evaluate(left);
   if(right.t=="id" && getEnv(right.name)===undefined) r=right.name;
   else r=evaluate(right);

   if(l && l.t=="Sommet") l=l.name;
   if(r && r.t=="Sommet") r=r.name;

   if(typeof l !== "string") throw {error:"type", name: "Erreur de type", msg: ""+l+" n'est pas un sommet gauche légal pour une arête", ln:left.ln};
   if(typeof r !== "string") throw {error:"type", name: "Erreur de type", msg: ""+r+" n'est pas un sommet droit légal pour une arête", ln:right.ln};

   if(_grapheEnv[l]===undefined) _grapheEnv[l] = {t: "Sommet", name: l, marques:[]};
   if(_grapheEnv[r]===undefined) _grapheEnv[r] = {t: "Sommet", name: r, marques:[]};

   _arcs.push([_grapheEnv[l],_grapheEnv[r]]);
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
   newEnv["*"]=false;
   _localEnv=newEnv;
   _stackEnv.push(_localEnv);
   interpretWithEnv(fn.insts);
   var retval=newEnv["*"];
   _stackEnv.pop();
   _localEnv = _stackEnv[_stackEnv.length-1];
   return retval;
}

function interpIf(si){
   var c=evaluate(si.cond);
   if(typeof c !== "boolean") throw {error:"type", name: "Condition non booléenne",
           msg:"La condition du if n'est pas un booléen", ln:si.cond.ln};
   if(c) interpretWithEnv(si["do"]);
   else interpretWithEnv(si["else"]);
}

function interpWhile(tant){
   for(;;){
      var c=evaluate(tant.cond);
      if(typeof c!=="boolean") throw {error:"type", name: "Condition non booléenne",
	    msg:"La condition du while n'est pas un booléen", ln:tant.ln};
      if(!c) break;
      interpretWithEnv(tant["do"]);
   }
}

function interpretWithEnv(tree){
   for(var i=0; i<tree.length; i++){
      if(tree[i].t=="SOMMET"){
	 creerSommets(tree[i].args);
	 continue;
      }
      if(tree[i].t=="ARETE"){
	 creerArete(tree[i].left, tree[i].right);
	 continue;
      }
      if(tree[i].t=="+="){
	 interpIncrement(tree[i]);
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
	 interpIf(tree[i]);
	 continue;
      }
      if(tree[i].t=="while"){
	 interpWhile(tree[i]);
	 continue;
      }
      console.log("Can't do ", tree[i]);
   }
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
   for(var i=0; i<args.length; i++){
      var a=evaluate(args[i]);
      str+=a;
   }
   str+="\n";
   postMessage({print: str});
   console.log("un", str);
   console.log({print:str});
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
   _predefEnv["True"]=true;
   _predefEnv["False"]=false;
   _predefEnv["pi"]=Math.PI;
   _predefEnv["random"]={t:"predfn", f:preRandom};
   _predefEnv["print"]={t:"predfn", f:prePrint};
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

