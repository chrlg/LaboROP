for(let s in _grapheEnv) delete _grapheEnv[s];

_grapheEnv.S={t:"Sommet", name:"S", marques:{}};
_grapheEnv.A={t:"Sommet", name:"A", marques:{}};
_grapheEnv.B={t:"Sommet", name:"B", marques:{}};
_grapheEnv.P={t:"Sommet", name:"P", marques:{}};
function ajoutArc(init, term, cap, f, v){
   _arcs.push({t:"Arc", i:_grapheEnv[init], a:_grapheEnv[term], 
      marques:{
         capacite:{t:"number", val:cap}, 
         flux:{t:"number", val:f}, 
         val:{t:"number", val:v},
         label:{t:"string", val:""+f+"/"+cap+"("+v+")"}
      }});
}
ajoutArc("S", "A", 20, 18, 2);
ajoutArc("S", "B", 20, 0, 6);
ajoutArc("A", "B", 20, 18, 1);
ajoutArc("A", "P", 10, 0, 3);
ajoutArc("B", "P", 20, 18, 2);
_predefEnv.Oriente=TRUE;
_grapheChange=true;
