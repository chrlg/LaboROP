importScripts("grlang.js");

var _predefEnv = {};
var _grapheEnv = {};
var _globalEnv = {};
var _envStack = [_globalEnv] ;
var _localEnv = _globalEnv;


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
   var orient = _predefEnv["X"].orient==true;
   if(orient) gr+="digraph{";
   else gr+="graph{";
   for(var e in _grapheEnv){
      gr+=(""+e+";");
   }
   var U=_predefEnv["U"];
   for(var i=0; i<U.arcs.length; i++){
      if(orient) gr+=""+U.arcs[i][0] +"->"+U.arcs[i][1]+";";
      else gr+=""+U.arcs[i][0]+"--"+U.arcs[i][1]+";";
   }
   gr+="}\n";
   postMessage({graph:gr});
}

function getEnv(sym){
   var envs=[_localEnv, _globalEnv, _grapheEnv, _predefEnv];
   for(var i=0; i<envs.length; i++){
      if(envs[i][sym]) return envs[i][sym];
   }
   return undefined;
}

function evaluate(expr){
   if(expr.t=="string"){
      return expr.val;
   }
   if(expr.t=="+"){
      var a=evaluate(expr.left);
      var b=evaluate(expr.right);
      return a+b;
   }
   if(expr.t=="number"){
      var v=parseFloat(expr.val);
      if(isNaN(v)) throw {error:"math", name:"Erreur mathématique", msg: ""+expr.val+" n'est pas un nombre valide", ln:expr.ln};
      return v;
   }
   if(expr.t=="id"){
      var e=getEnv(expr.name);
      if(e===undefined) throw {error:"variable", name:"Symbole non défini", msg: "Symbole "+expr.name+" non défini", ln:expr.ln};
      return e;
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
      if(_predefEnv["X"].orient || _predefEnv["X"].orient===undefined) return creerArc(ins.left.arg, ins.right);
      else return creerArete(ins.left.arg, ins.right);
   }
   console.log("Cannot do +=", ins);
}

function interpAffect(ins){
   var v=evaluate(ins.right);
   if(ins.left.t=="id") {
      _localEnv[ins.left.name] = v;
      return;
   }
   console.log("Cannot do =", ins);
}

function creerArete(left, right){
   var l, r;

   var X=_predefEnv["X"];
   if(X.orient) throw {error:"graphe", name: "Erreur de graphe", msg: "Un graphe orienté ne peut contenir d'arêtes", ln: left.ln};
   if(X.orient===undefined) X.orient=false;

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

   var U=_predefEnv["U"];
   U.arcs.push([l,r]);
   updateGraphe();
}

function interpDef(def){
   if(_globalEnv[def.nom]!==undefined) throw {error:"type", name: "Surdéfinition", msg: "Fonction "+def.nom+" déjà définie", ln: def.ln};
   _globalEnv[def.nom] = def;
}

function interpCall(call){
   var fn=getEnv(call.f);
   if(fn===undefined) throw {error:"symbol", name: "Fonction nom définie",
	    msg:"La fonction "+call.f+" n'existe pas", ln: call.ln};
   console.log("About to call",fn, "with",call);
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
      console.log("Can't do ", tree[i]);
   }
   console.log("Terminated");
}

function interpret(tree){
   _grapheEnv={};
   _predefEnv={};
   _predefEnv["M"]={t: "M"};
   _predefEnv["X"]={t: "X", orient:undefined};
   _predefEnv["U"]={t: "U", arcs:[]};
   _globalEnv={};
   _localEnv=_globalEnv;
   _stackEnv=[_localEnv];
   interpretWithEnv(tree);
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

