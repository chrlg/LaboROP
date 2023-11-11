import * as Cst from "./constants.js";
import * as Env from "./environment.js";

export default function populate(){
   Env.addPredfn("clear", preClear);
   Env.addPredfn("sommets", preSommets);
   Env.addPredfn("len", preLen);
   Env.addPredfn("random", preRandom);
   Env.addPredfn("premier", prePremier);
   Env.addPredfn("dernier", preDernier);
   Env.addPredfn("print", prePrint);
   Env.addPredfn("println", prePrintln);
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
   Env.addPredvar("OpCount", () => { return {t:"number", val:_opCnt}});
   Env.addPredvar("Time", () => {return {t:"number", val: (new Date()).valueOf()/1000.0}});
   Env.Predef["True"]=Cst.TRUE;
   Env.Predef["False"]=Cst.FALSE;
   Env.Predef["null"]=Cst.NULL;
   Env.Predef["pi"]=Cst.PI;
   Env.Predef["Infinity"]=Cst.INFINITY;
}

function preClear(args, ln){
    if(args.length==1){
        console.log('clear args', args);
    }
    Env.G.sommets={};
    Env.G.arcs.length=0;
}

function preSommets(args, ln){
   let g=Env.G;
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
      return Cst.NULL;
   }
   let r=Math.floor(Math.random()*a.val.length);
   if(args.length==1){
      return a.val[r];
   }
   else{
      // On parcours tous les éléments de la liste à partir du r
      // et on retourne le premier qui vérifie la condition
      for(let ii=0; ii<a.val.length; ii++){
	 let i=(r+ii)%a.val.length;
	 let cur=a.val[i];
         // Environnement pour self
         let envSelf={self:cur};
         _localEnv=envSelf;
         _stackEnv.push(envSelf);
	 let env=false; // Environnement d'évaluation de la condition (champs des éléments)
	 if(cur && cur.t=="struct") env=cur.f;
	 if(cur && (cur.t=="Arc" || cur.t=="Arete" || cur.t=="Sommet")) env=cur.marques;
	 if(env){ // S'il y a un environnement, on le push avant d'évaluer la condition
	    _localEnv=env;
	    _stackEnv.push(env);
	 }
	 let v=evaluate(args[1]);
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
      return Cst.NULL; // Rien ne correspond à la condition
   }
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

function preRefresh(args, ln){
   if(args.length!=0) throw{error:"args", name:"Mauvais nombre d'arguments",
      msg:"La fonction refresh s'utilise sans argument", ln:ln};
   _grapheChange=true;
   _strChange=true;
   regularCheck();
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
   if(arcs===false) return Cst.NULL;

   if(_grapheDisc && !s.marques.visible) return Cst.NULL;
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

function preGraphMode(args, ln){
    if(args.length==0){
        return {t:"string", val:_grapheMode};
    }
    _grapheMode = ''+args[0].val;
    _grapheChange=true;
    regularCheck();
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

