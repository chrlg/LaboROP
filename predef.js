import * as Env from "./environment.js";

export default function populate(){
   Env.addPredfn("clear", preClear);
   Env.addPredfn("sommets", preSommets);
   Env.addPredfn("len", preLen);
   Env.addPredfn("random", f:preRandom);
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
      return NULL;
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
      return NULL; // Rien ne correspond à la condition
   }
}

